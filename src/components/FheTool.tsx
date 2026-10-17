import React, { useState, useRef } from 'react';
import {
  generatePaillierKeys,
  paillierEncrypt,
  paillierDecrypt,
  paillierAdd,
  PaillierPublicKey,
  PaillierPrivateKey,
  FheDatasetPackage,
  FheAggregatePackage,
  FheDatasetItem,
  serializePaillierPublicKey,
  parsePaillierPublicKey,
  serializePaillierPrivateKey,
  parsePaillierPrivateKey,
} from '../utils/fheUtils';
import {
  Cpu,
  Lock,
  Unlock,
  Plus,
  Play,
  RotateCcw,
  Check,
  Server,
  Layers,
  Calculator,
  Download,
  Upload,
  FileText,
  Trash2,
  KeyRound,
  FileCode,
} from 'lucide-react';

export const FheTool: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'dataset' | 'aggregate' | 'decrypt' | 'keys'>('dataset');

  // Key Pair State
  const [paillierKeys, setPaillierKeys] = useState<{ publicKey: PaillierPublicKey; privateKey: PaillierPrivateKey }>(() =>
    generatePaillierKeys()
  );

  // Tab 1: Dataset Encryption State
  const [datasetTitle, setDatasetTitle] = useState('機密データセット');
  const [newLabel, setNewLabel] = useState('');
  const [newVal, setNewVal] = useState<number | ''>('');
  const [datasetItems, setDatasetItems] = useState<{ id: string; label: string; plaintext: number; ciphertext: bigint }[]>([]);
  const [datasetFileImportError, setDatasetFileImportError] = useState('');

  // Tab 2: Server Aggregation State (Zero-knowledge server side)
  const [serverPackage, setServerPackage] = useState<FheDatasetPackage | null>(null);
  const [serverSumCipher, setServerSumCipher] = useState<bigint | null>(null);
  const [serverStatusMessage, setServerStatusMessage] = useState('');

  // Tab 3: Decryption & Report State
  const [decryptTargetPackage, setDecryptTargetPackage] = useState<FheAggregatePackage | FheDatasetPackage | null>(null);
  const [decryptReport, setDecryptReport] = useState<{
    title: string;
    itemCount: number;
    totalSum: number;
    average: number;
  } | null>(null);
  const [decryptErrorMessage, setDecryptErrorMessage] = useState('');

  // Key Import/Export State
  const [keyStatusMessage, setKeyStatusMessage] = useState('');

  const datasetFileInputRef = useRef<HTMLInputElement>(null);
  const serverFileInputRef = useRef<HTMLInputElement>(null);
  const decryptFileInputRef = useRef<HTMLInputElement>(null);
  const pubKeyFileInputRef = useRef<HTMLInputElement>(null);
  const privKeyFileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // Tab 1 Handlers: Data Entry & File Export
  // -------------------------------------------------------------
  const handleAddItem = () => {
    if (newVal === '' || isNaN(Number(newVal))) return;
    const num = Number(newVal);
    const cipher = paillierEncrypt(num, paillierKeys.publicKey);
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: newLabel.trim() || `項目 ${datasetItems.length + 1}`,
      plaintext: num,
      ciphertext: cipher,
    };
    setDatasetItems((prev) => [...prev, newItem]);
    setNewLabel('');
    setNewVal('');
  };

  const handleRemoveItem = (id: string) => {
    setDatasetItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearDataset = () => {
    setDatasetItems([]);
  };

  const handleExportDatasetFile = () => {
    if (datasetItems.length === 0) return;
    const pkg: FheDatasetPackage = {
      format: 'FHE_PAILLIER_DATASET',
      version: 1,
      title: datasetTitle.trim() || '機密データセット',
      publicKey: {
        n: paillierKeys.publicKey.n.toString(16),
        n2: paillierKeys.publicKey.n2.toString(16),
        g: paillierKeys.publicKey.g.toString(16),
        bitLength: paillierKeys.publicKey.bitLength,
      },
      items: datasetItems.map((item) => ({
        id: item.id,
        label: item.label,
        ciphertextHex: item.ciphertext.toString(16),
      })),
      createdAt: Date.now(),
    };

    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.title}-encrypted.fhe.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV / Text Import for numbers
  const handleImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDatasetFileImportError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        const newItems: { id: string; label: string; plaintext: number; ciphertext: bigint }[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(/[,\t]/);
          let label = `行 ${i + 1}`;
          let numStr = parts[0];
          if (parts.length >= 2) {
            label = parts[0].trim();
            numStr = parts[1].trim();
          }
          const num = Number(numStr);
          if (!isNaN(num)) {
            const cipher = paillierEncrypt(num, paillierKeys.publicKey);
            newItems.push({
              id: `csv-${Date.now()}-${i}`,
              label,
              plaintext: num,
              ciphertext: cipher,
            });
          }
        }

        if (newItems.length === 0) {
          throw new Error('有効な数値データが見つかりませんでした');
        }

        setDatasetItems((prev) => [...prev, ...newItems]);
      } catch (err: any) {
        setDatasetFileImportError(err.message || 'ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // Tab 2 Handlers: Server-Side Zero-Knowledge Homomorphic Aggregation
  // -------------------------------------------------------------
  const handleLoadDatasetPackageForServer = (e: React.ChangeEvent<HTMLInputElement>) => {
    setServerStatusMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.format !== 'FHE_PAILLIER_DATASET' || !Array.isArray(json.items)) {
          throw new Error('Paillier暗号化データセットファイルではありません');
        }
        setServerPackage(json);
        setServerSumCipher(null);
        setServerStatusMessage(`暗号化データセット「${json.title}」計 ${json.items.length} 件を読み込みました`);
      } catch (err: any) {
        setServerStatusMessage(err.message || 'データセットファイルの解析に失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleComputeServerHomomorphicSum = () => {
    if (!serverPackage || serverPackage.items.length === 0) return;

    const pk: PaillierPublicKey = {
      n: BigInt(`0x${serverPackage.publicKey.n}`),
      n2: BigInt(`0x${serverPackage.publicKey.n2}`),
      g: BigInt(`0x${serverPackage.publicKey.g}`),
      bitLength: serverPackage.publicKey.bitLength,
    };

    let acc = BigInt(`0x${serverPackage.items[0].ciphertextHex}`);
    for (let i = 1; i < serverPackage.items.length; i++) {
      const nextCipher = BigInt(`0x${serverPackage.items[i].ciphertextHex}`);
      acc = paillierAdd(acc, nextCipher, pk);
    }

    setServerSumCipher(acc);
    setServerStatusMessage('平文を一切閲覧することなく、暗号文のまま合算演算が完了しました');
  };

  const handleExportAggregateResultFile = () => {
    if (!serverPackage || serverSumCipher === null) return;

    const resPkg: FheAggregatePackage = {
      format: 'FHE_PAILLIER_AGGREGATE',
      version: 1,
      title: `${serverPackage.title} 合算結果`,
      itemCount: serverPackage.items.length,
      publicKey: serverPackage.publicKey,
      aggregateCiphertextHex: serverSumCipher.toString(16),
      createdAt: Date.now(),
    };

    const blob = new Blob([JSON.stringify(resPkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serverPackage.title}-aggregated-result.fhe-result.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // Tab 3 Handlers: Decryption & Report
  // -------------------------------------------------------------
  const handleLoadFileForDecryption = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDecryptErrorMessage('');
    setDecryptReport(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.format === 'FHE_PAILLIER_AGGREGATE' || json.format === 'FHE_PAILLIER_DATASET') {
          setDecryptTargetPackage(json);
        } else {
          throw new Error('未対応の暗号化ファイルフォーマットです');
        }
      } catch (err: any) {
        setDecryptErrorMessage(err.message || 'ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteDecryption = () => {
    setDecryptErrorMessage('');
    if (!decryptTargetPackage) return;

    try {
      if (decryptTargetPackage.format === 'FHE_PAILLIER_AGGREGATE') {
        const cipher = BigInt(`0x${decryptTargetPackage.aggregateCiphertextHex}`);
        const total = Number(paillierDecrypt(cipher, paillierKeys.privateKey));
        const count = decryptTargetPackage.itemCount;
        setDecryptReport({
          title: decryptTargetPackage.title,
          itemCount: count,
          totalSum: total,
          average: count > 0 ? total / count : 0,
        });
      } else {
        // Dataset format
        let sum = 0;
        for (const it of decryptTargetPackage.items) {
          const c = BigInt(`0x${it.ciphertextHex}`);
          const p = Number(paillierDecrypt(c, paillierKeys.privateKey));
          sum += p;
        }
        const count = decryptTargetPackage.items.length;
        setDecryptReport({
          title: decryptTargetPackage.title,
          itemCount: count,
          totalSum: sum,
          average: count > 0 ? sum / count : 0,
        });
      }
    } catch (err: any) {
      setDecryptErrorMessage('復号に失敗しました。対応する秘密鍵が一致しているか確認してください。');
    }
  };

  const handleDownloadDecryptedReport = () => {
    if (!decryptReport) return;
    const reportText = [
      `完全準同型暗号 集計復号レポート`,
      `対象: ${decryptReport.title}`,
      `集計件数: ${decryptReport.itemCount} 件`,
      `復号合計値: ${decryptReport.totalSum}`,
      `平均値: ${decryptReport.average.toFixed(4)}`,
      `生成日時: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${decryptReport.title}-decrypted-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // Tab 4 Handlers: Key Pair Management
  // -------------------------------------------------------------
  const handleRegenerateKeys = () => {
    const fresh = generatePaillierKeys();
    setPaillierKeys(fresh);
    setKeyStatusMessage('新規Paillier鍵ペアを生成しました');
  };

  const handleExportPublicKey = () => {
    const obj = serializePaillierPublicKey(paillierKeys.publicKey);
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paillier-public-key.fhepub.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPrivateKey = () => {
    const obj = serializePaillierPrivateKey(paillierKeys.privateKey);
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paillier-private-key.fhekey.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPublicKeyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyStatusMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const pk = parsePaillierPublicKey(json);
        setPaillierKeys((prev) => ({
          ...prev,
          publicKey: pk,
        }));
        setKeyStatusMessage('公開鍵を正常にインポートしました');
      } catch (err: any) {
        setKeyStatusMessage(err.message || '公開鍵のインポートに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportPrivateKeyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyStatusMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const sk = parsePaillierPrivateKey(json);
        setPaillierKeys({
          publicKey: sk.publicKey,
          privateKey: sk,
        });
        setKeyStatusMessage('秘密鍵を正常にインポートしました');
      } catch (err: any) {
        setKeyStatusMessage(err.message || '秘密鍵のインポートに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">完全準同型暗号スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono font-medium">
                Paillier 準同型暗号系
              </span>
            </div>
            <p className="text-xs text-slate-400">
              暗号化したまま外部サーバーで合算演算を実行し、暗号化ファイル保存・集計・復号レポートを出力
            </p>
          </div>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSubTab('dataset')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'dataset'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>データ暗号化と保存</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('aggregate')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'aggregate'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>秘密鍵不要の合算</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('decrypt')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'decrypt'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>結果復号・レポート</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('keys')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'keys'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>鍵管理</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Data Encryption & Export */}
      {activeSubTab === 'dataset' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>機密データの入力と暗号化登録</span>
              </h3>
              <div className="flex items-center gap-2">
                <input
                  ref={datasetFileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleImportCsvFile}
                />
                <button
                  type="button"
                  onClick={() => datasetFileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>CSV・テキスト読込</span>
                </button>
                {datasetItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearDataset}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                    title="全消去"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">データセット名称</label>
              <input
                type="text"
                value={datasetTitle}
                onChange={(e) => setDatasetTitle(e.target.value)}
                placeholder="例: 部門別機密売上データ"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Input row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2">
              <div className="sm:col-span-6">
                <label className="block text-slate-400 mb-1">項目名・ラベル</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="例: 第1四半期売上"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-slate-400 mb-1">数値データ</label>
                <input
                  type="number"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="例: 1250000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={newVal === ''}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>追加</span>
                </button>
              </div>
            </div>

            {datasetFileImportError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                {datasetFileImportError}
              </div>
            )}

            {/* Items list */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-slate-400 text-[11px] px-1">
                <span>登録済み暗号化データ一覧</span>
                <span>{datasetItems.length} 件</span>
              </div>

              {datasetItems.length === 0 ? (
                <div className="p-8 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
                  <div className="text-slate-400 font-medium">登録データがありません</div>
                  <p className="text-[11px] text-slate-500">
                    項目名と数値を入力して「追加」を押すか、CSVファイルを読み込んでください。
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {datasetItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-200 truncate">{item.label}</div>
                        <div className="font-mono text-[10px] text-cyan-400/80 truncate mt-0.5">
                          暗号文: {item.ciphertext.toString(16).slice(0, 32)}...
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[11px] text-slate-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          平文: {item.plaintext}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-400" />
                <span>暗号化ファイルのダウンロード</span>
              </h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                作成したデータセットをPaillier暗号化ファイルとしてエクスポートします。このファイルには暗号文のみが含まれ、秘密鍵を持たない第三者や外部サーバーに安全に送信・配布できます。
              </p>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>暗号化件数:</span>
                  <span className="text-slate-200">{datasetItems.length} 件</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>公開鍵ビット長:</span>
                  <span className="text-slate-200">{paillierKeys.publicKey.bitLength} bit</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>出力形式:</span>
                  <span className="text-cyan-400 font-bold">.fhe.json</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportDatasetFile}
              disabled={datasetItems.length === 0}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>暗号化データセットファイルを保存</span>
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Server Aggregation without Private Key */}
      {activeSubTab === 'aggregate' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>暗号化ファイルのインポートとゼロ知識合算</span>
              </h3>
              <input
                ref={serverFileInputRef}
                type="file"
                accept=".json,.fhe.json"
                className="hidden"
                onChange={handleLoadDatasetPackageForServer}
              />
              <button
                type="button"
                onClick={() => serverFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 shadow-sm text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>暗号化ファイル読込</span>
              </button>
            </div>

            {serverStatusMessage && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-cyan-300 font-medium">
                {serverStatusMessage}
              </div>
            )}

            {!serverPackage ? (
              <div className="p-8 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
                <FileCode className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-slate-300 font-medium">暗号化データセットファイルが読み込まれていません</div>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  上の「暗号化ファイル読込」ボタンから、エクスポートした .fhe.json ファイルをアップロードしてください。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">{serverPackage.title}</span>
                    <span className="font-mono text-cyan-400">{serverPackage.items.length} 件の暗号文</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                    {serverPackage.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between p-1.5 bg-slate-900 rounded border border-slate-800/80">
                        <span className="text-slate-300 font-sans">{it.label}</span>
                        <span className="text-slate-500 truncate max-w-xs">{it.ciphertextHex.slice(0, 24)}...</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleComputeServerHomomorphicSum}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>中身を復号せずに暗号文のまま合算演算を実行</span>
                  </button>

                  {serverSumCipher !== null && (
                    <button
                      type="button"
                      onClick={handleExportAggregateResultFile}
                      className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>集計結果ファイルを保存</span>
                    </button>
                  )}
                </div>

                {serverSumCipher !== null && (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-800/60 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Check className="w-4 h-4" />
                      <span>準同型合算値の算出完了</span>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded border border-slate-800 font-mono text-[10px] text-cyan-300 break-all select-all">
                      暗号化合算値: {serverSumCipher.toString(16)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      サーバー側には秘密鍵が存在しないため、平文の合計額は判明していません。この結果ファイルを秘密鍵の所有者へ返送します。
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Decryption & Reporting */}
      {activeSubTab === 'decrypt' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Unlock className="w-4 h-4 text-cyan-400" />
              <span>秘密鍵による集計結果または暗号化データの復号</span>
            </h3>
            <input
              ref={decryptFileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleLoadFileForDecryption}
            />
            <button
              type="button"
              onClick={() => decryptFileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 shadow-sm text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>集計ファイル読込</span>
            </button>
          </div>

          {decryptErrorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
              {decryptErrorMessage}
            </div>
          )}

          {!decryptTargetPackage ? (
            <div className="p-8 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-slate-300 font-medium">復号対象のファイルが選択されていません</div>
              <p className="text-[11px] text-slate-500">
                外部サーバーから返送された集計結果ファイル .fhe-result.json またはデータセットファイルを読み込んでください。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">{decryptTargetPackage.title}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    フォーマット: {decryptTargetPackage.format}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExecuteDecryption}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm text-xs"
                >
                  <Unlock className="w-4 h-4" />
                  <span>秘密鍵で復号を実行</span>
                </button>
              </div>

              {decryptReport && (
                <div className="p-5 bg-slate-950 border border-emerald-800/80 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      復号完了レポート
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadDecryptedReport}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>レポートテキスト保存</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-400 text-[11px]">復号合計値</div>
                      <div className="font-mono text-lg font-bold text-emerald-400 mt-1">
                        {decryptReport.totalSum.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-400 text-[11px]">集計件数</div>
                      <div className="font-mono text-lg font-bold text-slate-200 mt-1">
                        {decryptReport.itemCount} 件
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-400 text-[11px]">計算平均値</div>
                      <div className="font-mono text-lg font-bold text-cyan-300 mt-1">
                        {decryptReport.average.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 4: Key Management */}
      {activeSubTab === 'keys' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                <span>Paillier 準同型暗号 鍵ペア管理</span>
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                公開鍵はデータの暗号化およびサーバー合算演算に使用し、秘密鍵は手元で厳重に保管して結果の復号にのみ使用します。
              </p>
            </div>
            <button
              type="button"
              onClick={handleRegenerateKeys}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 text-xs border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>鍵ペア再生成</span>
            </button>
          </div>

          {keyStatusMessage && (
            <div className="p-2.5 bg-cyan-950/40 border border-cyan-800 rounded-lg text-cyan-300 font-medium">
              {keyStatusMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Public Key Card */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200 text-xs">公開鍵ファイル</span>
                <span className="text-[10px] font-mono text-cyan-400">{paillierKeys.publicKey.bitLength} bit</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 font-mono text-[10px] text-slate-400 break-all select-all max-h-24 overflow-y-auto">
                Modulus n: {paillierKeys.publicKey.n.toString(16)}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportPublicKey}
                  className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>公開鍵保存</span>
                </button>
                <input
                  ref={pubKeyFileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportPublicKeyFile}
                />
                <button
                  type="button"
                  onClick={() => pubKeyFileInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1 border border-slate-700"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>読込</span>
                </button>
              </div>
            </div>

            {/* Private Key Card */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200 text-xs">秘密鍵ファイル</span>
                <span className="text-[10px] font-mono text-amber-400">機密保管</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 font-mono text-[10px] text-slate-400 break-all select-all max-h-24 overflow-y-auto">
                Lambda: {paillierKeys.privateKey.lambda.toString(16)}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportPrivateKey}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>秘密鍵保存</span>
                </button>
                <input
                  ref={privKeyFileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportPrivateKeyFile}
                />
                <button
                  type="button"
                  onClick={() => privKeyFileInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1 border border-slate-700"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>読込</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
