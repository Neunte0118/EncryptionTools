import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  splitSecret,
  reconstructSecret,
  parseShareString,
  ShamirShare,
  ReconstructResult,
  generateMathSimulation,
} from '../utils/shamirUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import {
  Shield,
  Key,
  Split,
  FileText,
  File,
  Upload,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Printer,
  QrCode,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Plus,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';

interface ShamirSecretSharingToolProps {
  vault?: KeyVaultFile;
  onImportToVault?: (key: KeyVaultItem) => void;
}

type MainTab = 'split' | 'reconstruct' | 'math';

export const ShamirSecretSharingTool: React.FC<ShamirSecretSharingToolProps> = ({
  vault,
  onImportToVault,
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('split');

  // --- Split Tab State ---
  const [inputType, setInputType] = useState<'text' | 'file' | 'vault'>('text');
  const [secretText, setSecretText] = useState('');
  const [isSecretMasked, setIsSecretMasked] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState<string>('');

  const [thresholdK, setThresholdK] = useState<number>(3);
  const [totalSharesN, setTotalSharesN] = useState<number>(5);

  const [generatedShares, setGeneratedShares] = useState<ShamirShare[] | null>(null);
  const [participantLabels, setParticipantLabels] = useState<Record<number, string>>({});
  const [shareDisplayFormat, setShareDisplayFormat] = useState<'compact' | 'armored'>('compact');
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<number, string>>({});
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copiedShareIndex, setCopiedShareIndex] = useState<number | null>(null);
  const [copiedAllShares, setCopiedAllShares] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  // --- Reconstruct Tab State ---
  const [reconstructInputs, setReconstructInputs] = useState<string[]>(['', '', '']);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [reconstructResult, setReconstructResult] = useState<ReconstructResult | null>(null);
  const [isResultMasked, setIsResultMasked] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [importedToVaultSuccess, setImportedToVaultSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reconstructFileInputRef = useRef<HTMLInputElement>(null);

  // --- Math Demo State ---
  const [demoK, setDemoK] = useState<number>(3);
  const [demoN, setDemoN] = useState<number>(5);
  const [demoSecret, setDemoSecret] = useState<number>(35);

  // Adjust totalSharesN if thresholdK increases
  useEffect(() => {
    if (thresholdK > totalSharesN) {
      setTotalSharesN(thresholdK);
    }
  }, [thresholdK]);

  // Generate QR codes whenever generatedShares change
  useEffect(() => {
    if (!generatedShares) {
      setQrCodeUrls({});
      return;
    }
    const urls: Record<number, string> = {};
    let isCancelled = false;

    Promise.all(
      generatedShares.map(async (share) => {
        try {
          // Use compact text for QR codes for best density & readability
          const url = await QRCode.toDataURL(share.formattedText, {
            margin: 2,
            width: 256,
            errorCorrectionLevel: 'M',
          });
          urls[share.x] = url;
        } catch (err) {
          console.error('Failed to generate QR for share', share.x, err);
        }
      })
    ).then(() => {
      if (!isCancelled) {
        setQrCodeUrls(urls);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [generatedShares]);

  // Handle file selection in Split tab
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      setFileBytes(new Uint8Array(buffer));
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Split Action
  const handleSplitSecret = () => {
    setSplitError(null);
    try {
      let dataBytes: Uint8Array;
      let isText = true;
      let filename: string | undefined = undefined;

      if (inputType === 'text') {
        if (!secretText.trim()) {
          setSplitError('分割するテキストを入力してください');
          return;
        }
        dataBytes = new TextEncoder().encode(secretText);
        isText = true;
      } else if (inputType === 'file') {
        if (!fileBytes || !selectedFile) {
          setSplitError('分割するファイルを選択してください');
          return;
        }
        dataBytes = fileBytes;
        isText = false;
        filename = selectedFile.name;
      } else {
        // Vault key
        if (!selectedVaultKeyId || !vault) {
          setSplitError('Vaultから秘密鍵を選択してください');
          return;
        }
        const keyItem = vault.keys.find((k) => k.id === selectedVaultKeyId);
        if (!keyItem) {
          setSplitError('選択されたキーが見つかりません');
          return;
        }
        const content = keyItem.privateKeyPem || keyItem.rawKeyBase64 || keyItem.publicKeyPem || '';
        if (!content) {
          setSplitError('この鍵にはエクスポート可能な秘密データが含まれていません');
          return;
        }
        dataBytes = new TextEncoder().encode(content);
        isText = true;
        filename = `${keyItem.title.replace(/\s+/g, '_')}_private_key.pem`;
      }

      const shares = splitSecret(dataBytes, thresholdK, totalSharesN, {
        isText,
        filename,
      });

      // Default participant labels
      const initialLabels: Record<number, string> = {};
      shares.forEach((s) => {
        initialLabels[s.x] = `保管者 ${String.fromCharCode(64 + s.x)} (${s.x}番)`;
      });

      setParticipantLabels(initialLabels);
      setGeneratedShares(shares);
    } catch (err: any) {
      setSplitError(err.message || '秘密の分割に失敗しました');
    }
  };

  // Copy single share
  const handleCopyShare = (share: ShamirShare) => {
    const textToCopy = shareDisplayFormat === 'armored' ? share.armoredText : share.formattedText;
    navigator.clipboard.writeText(textToCopy);
    setCopiedShareIndex(share.x);
    setTimeout(() => setCopiedShareIndex(null), 2000);
  };

  // Copy all shares
  const handleCopyAllShares = () => {
    if (!generatedShares) return;
    const combined = generatedShares
      .map((s) => {
        const label = participantLabels[s.x] || `Share ${s.x}`;
        return `### ${label} (${s.x}/${s.n}) ###\n${shareDisplayFormat === 'armored' ? s.armoredText : s.formattedText}\n`;
      })
      .join('\n');

    navigator.clipboard.writeText(combined);
    setCopiedAllShares(true);
    setTimeout(() => setCopiedAllShares(false), 2000);
  };

  // Download single share file
  const handleDownloadShare = (share: ShamirShare) => {
    const textContent = share.armoredText;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `share_${share.x}_of_${share.n}.share`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download all shares as one text file
  const handleDownloadAllShares = () => {
    if (!generatedShares) return;
    const combined = generatedShares
      .map((s) => {
        const label = participantLabels[s.x] || `Share ${s.x}`;
        return `=========================================\n${label} (閾値: ${s.k} / 総数: ${s.n})\n=========================================\n${s.armoredText}\n`;
      })
      .join('\n\n');

    const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shamir_shares_${generatedShares[0].k}of${generatedShares[0].n}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Preset secrets
  const loadPresetSecret = (preset: 'mnemonic' | 'crypto' | 'password') => {
    if (preset === 'mnemonic') {
      setSecretText(
        'ocean peanut canvas victory shield velvet crisp mystery digital harbor pulse wisdom'
      );
    } else if (preset === 'crypto') {
      setSecretText('0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d');
    } else {
      setSecretText('MasterVault@2026!#UltraSecureSecretKey_Alpha99');
    }
  };

  // --- Reconstruct Logic ---
  const handleAddShareInput = () => {
    setReconstructInputs([...reconstructInputs, '']);
  };

  const handleRemoveShareInput = (index: number) => {
    const next = [...reconstructInputs];
    next.splice(index, 1);
    setReconstructInputs(next);
  };

  const handleShareInputChange = (index: number, val: string) => {
    const next = [...reconstructInputs];
    next[index] = val;
    setReconstructInputs(next);
  };

  // Handle bulk paste in Reconstruct Tab
  const handleApplyBulkPaste = () => {
    if (!bulkPasteText.trim()) return;

    // Detect all occurrences of SSS1- or -----BEGIN SHAMIR...
    const sharesFound: string[] = [];

    // Compact matches
    const compactRegex = /SSS1-\d+of\d+-\d+-[0-9a-fA-F]{8}-[A-Za-z0-9+/=_-]+/g;
    const compactMatches = bulkPasteText.match(compactRegex);
    if (compactMatches) {
      sharesFound.push(...compactMatches);
    }

    // Armored matches
    const armoredRegex = /-----BEGIN SHAMIR SECRET SHARE-----[\s\S]*?-----END SHAMIR SECRET SHARE-----/g;
    const armoredMatches = bulkPasteText.match(armoredRegex);
    if (armoredMatches) {
      sharesFound.push(...armoredMatches);
    }

    if (sharesFound.length > 0) {
      setReconstructInputs(sharesFound);
      setBulkPasteText('');
    } else {
      // Fallback: split by lines if someone pasted single lines
      const lines = bulkPasteText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('SSS1-'));
      if (lines.length > 0) {
        setReconstructInputs(lines);
        setBulkPasteText('');
      }
    }
  };

  // Handle multiple file upload in Reconstruct Tab
  const handleReconstructFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const readPromises = fileList.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve((event.target?.result as string) || '');
          };
          reader.readAsText(file);
        })
    );

    Promise.all(readPromises).then((contents) => {
      const newInputs = [...reconstructInputs.filter((i) => i.trim() !== '')];
      contents.forEach((c) => {
        if (c.trim()) newInputs.push(c.trim());
      });
      setReconstructInputs(newInputs);
    });
  };

  // Execute Reconstruction
  const handleExecuteReconstruct = () => {
    setImportedToVaultSuccess(false);
    const parsedList: Array<ReturnType<typeof parseShareString> & { indexInList: number }> = [];

    reconstructInputs.forEach((raw, idx) => {
      if (!raw.trim()) return;
      const parsed = parseShareString(raw);
      if (parsed) {
        parsedList.push({ ...parsed, indexInList: idx + 1 });
      }
    });

    if (parsedList.length === 0) {
      setReconstructResult({
        success: false,
        checksumMatched: false,
        threshold: 0,
        total: 0,
        sharesUsed: [],
        error: '有効なシェアが入力されていません。正しいシェアテキストを貼り付けてください。',
      });
      return;
    }

    const result = reconstructSecret(parsedList);
    setReconstructResult(result);
  };

  // Download reconstructed file or text
  const handleDownloadReconstructed = () => {
    if (!reconstructResult?.secretBytes) return;
    const blob = new Blob([reconstructResult.secretBytes as unknown as BlobPart], {
      type: reconstructResult.isText ? 'text/plain;charset=utf-8' : 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reconstructResult.filename || (reconstructResult.isText ? 'reconstructed_secret.txt' : 'reconstructed_secret.bin');
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import reconstructed key into vault
  const handleSaveToVault = () => {
    if (!reconstructResult?.text || !onImportToVault) return;
    const content = reconstructResult.text;
    const isPrivateKey = content.includes('PRIVATE KEY');

    const newVaultItem: KeyVaultItem = {
      id: `vault-key-${Date.now()}`,
      title: reconstructResult.filename
        ? reconstructResult.filename.replace(/\.[^/.]+$/, '')
        : 'Shamir復元キー',
      memo: `シャミアの秘密分散法 (${reconstructResult.threshold} of ${reconstructResult.total}) により復元された鍵`,
      type: isPrivateKey ? 'rsa-pss' : 'aes-gcm',
      algorithmDetails: {
        name: isPrivateKey ? 'RSA-PSS / PEM' : 'Custom Secret',
      },
      privateKeyPem: isPrivateKey ? content : undefined,
      rawKeyBase64: !isPrivateKey ? btoa(unescape(encodeURIComponent(content))) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onImportToVault(newVaultItem);
    setImportedToVaultSuccess(true);
    setTimeout(() => setImportedToVaultSuccess(false), 3000);
  };

  // Inspect current parsed shares count for status indicator in Reconstruct
  const validParsedCount = reconstructInputs
    .map((input) => parseShareString(input))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const detectedThreshold = validParsedCount[0]?.k ?? null;
  const detectedTotal = validParsedCount[0]?.n ?? null;

  // Math simulation data
  const mathData = generateMathSimulation(demoK, demoN, demoSecret);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
                <Split className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                シャミアの秘密分散法
              </h2>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Shamir's Secret Sharing (k, n) 閾値法。秘密を <span className="text-cyan-400 font-semibold">n 個のシェア</span> に分散し、
              任意の <span className="text-cyan-400 font-semibold">k 個</span> が集まった時のみ復元できます。
              k-1個以下では数学的に1ビットの情報も漏洩しない情報理論的安全（完全秘匿）を実現します。
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 self-start md:self-center">
            <button
              onClick={() => setActiveTab('split')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'split'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Split className="w-4 h-4" />
              <span>秘密を分割 (生成)</span>
            </button>
            <button
              onClick={() => setActiveTab('reconstruct')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'reconstruct'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>秘密を復元 (結合)</span>
            </button>
            <button
              onClick={() => setActiveTab('math')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'math'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>仕組みと数学</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. SPLIT TAB */}
      {/* ========================================================= */}
      {activeTab === 'split' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input & Config Column */}
            <div className="lg:col-span-5 space-y-5">
              {/* Secret Source Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <span>分散する秘密の指定</span>
                  </label>
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setInputType('text')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        inputType === 'text'
                          ? 'bg-cyan-600 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      テキスト/鍵
                    </button>
                    <button
                      onClick={() => setInputType('file')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        inputType === 'file'
                          ? 'bg-cyan-600 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ファイル
                    </button>
                    {vault && vault.keys.length > 0 && (
                      <button
                        onClick={() => setInputType('vault')}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          inputType === 'vault'
                            ? 'bg-cyan-600 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Vault鍵
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. Text Input */}
                {inputType === 'text' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <textarea
                        value={secretText}
                        onChange={(e) => setSecretText(e.target.value)}
                        placeholder="分散したい秘密を入力 (シードフレーズ、暗号鍵、マスターパスワード、機密メッセージなど)..."
                        rows={5}
                        className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono transition-all ${
                          isSecretMasked ? 'tracking-widest' : ''
                        }`}
                        style={isSecretMasked ? { WebkitTextSecurity: 'disc' } as any : {}}
                      />
                      <button
                        type="button"
                        onClick={() => setIsSecretMasked(!isSecretMasked)}
                        className="absolute right-3 top-3 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        title={isSecretMasked ? '内容を表示' : '内容をマスク'}
                      >
                        {isSecretMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>文字数: {secretText.length} 文字</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">サンプル:</span>
                        <button
                          type="button"
                          onClick={() => loadPresetSecret('mnemonic')}
                          className="text-cyan-400 hover:underline"
                        >
                          シード12語
                        </button>
                        <span className="text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={() => loadPresetSecret('crypto')}
                          className="text-cyan-400 hover:underline"
                        >
                          秘密鍵Hex
                        </button>
                        <span className="text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={() => loadPresetSecret('password')}
                          className="text-cyan-400 hover:underline"
                        >
                          パスワード
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. File Input */}
                {inputType === 'file' && (
                  <div className="space-y-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-950/50 group"
                    >
                      <Upload className="w-8 h-8 mx-auto text-slate-500 group-hover:text-cyan-400 transition-colors mb-2" />
                      {selectedFile ? (
                        <div>
                          <p className="text-sm font-medium text-cyan-300">{selectedFile.name}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            サイズ: {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-slate-300 font-medium">
                            クリックしてファイルを選択
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            任意のファイル形式 (秘密鍵、証明書、PDF、ZIPなど)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Vault Key Input */}
                {inputType === 'vault' && vault && (
                  <div className="space-y-2">
                    <select
                      value={selectedVaultKeyId}
                      onChange={(e) => setSelectedVaultKeyId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-- Vaultから秘密鍵を選択 --</option>
                      {vault.keys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title} ({k.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400">
                      ローカルKey Vaultに保存されている秘密鍵をそのままShamirシェアに分散できます。
                    </p>
                  </div>
                )}
              </div>

              {/* Threshold & Parameters Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    分散パラメータ設定 (k of n 閾値)
                  </h3>
                </div>

                {/* Threshold k */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">必要閾値 (k)</span>
                    <span className="font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                      {thresholdK} 枚で復元可能
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={Math.min(20, Math.max(thresholdK, totalSharesN))}
                    value={thresholdK}
                    onChange={(e) => setThresholdK(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    復元に最低限必要なシェアの枚数。これ未満では1ビットも復元できません。
                  </p>
                </div>

                {/* Total shares n */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-medium">総シェア数 (n)</span>
                    <span className="font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                      {totalSharesN} 枚発行
                    </span>
                  </div>
                  <input
                    type="range"
                    min={thresholdK}
                    max={20}
                    value={totalSharesN}
                    onChange={(e) => setTotalSharesN(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    生成して配布する総シェア数 (各保管者に1枚ずつ手渡します)。
                  </p>
                </div>

                {/* Scenario Summary Box */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
                    <Shield className="w-3.5 h-3.5" />
                    <span>
                      {thresholdK} of {totalSharesN} 閾値スキーム
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    ・{totalSharesN}人に別々に保管してもらいます。
                    <br />
                    ・任意の <strong className="text-white">{thresholdK}人</strong> が合意すれば完全復元。
                    <br />
                    ・もし <strong className="text-white">{totalSharesN - thresholdK}人</strong> がシェアを紛失しても復元可能。
                    <br />
                    ・<strong className="text-white">{thresholdK - 1}人以下</strong> が結託しても秘密は絶対に解読されません。
                  </p>
                </div>

                {splitError && (
                  <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{splitError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSplitSecret}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Split className="w-4 h-4" />
                  <span>秘密を分散してシェアを生成</span>
                </button>
              </div>
            </div>

            {/* Shares Results Column */}
            <div className="lg:col-span-7 space-y-5">
              {generatedShares ? (
                <div className="space-y-4">
                  {/* Top Bar for Results */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-white">
                          シェア生成完了 ({generatedShares[0].k} of {generatedShares[0].n})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        チェックサム: 0x{generatedShares[0].checksum.toString(16).toUpperCase()} |
                        形式: GF(256)多項式
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Format toggle */}
                      <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                        <button
                          onClick={() => setShareDisplayFormat('compact')}
                          className={`px-2 py-1 rounded transition-colors ${
                            shareDisplayFormat === 'compact'
                              ? 'bg-slate-800 text-cyan-300 font-medium'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          単一行
                        </button>
                        <button
                          onClick={() => setShareDisplayFormat('armored')}
                          className={`px-2 py-1 rounded transition-colors ${
                            shareDisplayFormat === 'armored'
                              ? 'bg-slate-800 text-cyan-300 font-medium'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ブロック
                        </button>
                      </div>

                      {/* Batch actions */}
                      <button
                        onClick={handleCopyAllShares}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="全シェアを一括コピー"
                      >
                        {copiedAllShares ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedAllShares ? 'コピー完了' : '全コピー'}</span>
                      </button>

                      <button
                        onClick={handleDownloadAllShares}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="全シェアをテキストファイルで一括保存"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>一括保存</span>
                      </button>

                      <button
                        onClick={() => setShowPrintModal(true)}
                        className="p-2 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/70 text-cyan-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        title="印刷用カード / 紙のバックアップシートを表示"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>印刷シート</span>
                      </button>
                    </div>
                  </div>

                  {/* Share Cards List */}
                  <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                    {generatedShares.map((share) => {
                      const label = participantLabels[share.x] || `保管者 ${share.x}`;
                      const qrUrl = qrCodeUrls[share.x];

                      return (
                        <div
                          key={share.x}
                          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all space-y-3"
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold text-xs flex items-center justify-center">
                                #{share.x}
                              </span>
                              <input
                                type="text"
                                value={label}
                                onChange={(e) =>
                                  setParticipantLabels({
                                    ...participantLabels,
                                    [share.x]: e.target.value,
                                  })
                                }
                                className="bg-transparent text-sm font-semibold text-slate-200 hover:bg-slate-950/50 focus:bg-slate-950 px-2 py-0.5 rounded border border-transparent focus:border-slate-700 focus:outline-none transition-colors"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleCopyShare(share)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1 transition-colors"
                              >
                                {copiedShareIndex === share.x ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">コピー済</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>コピー</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleDownloadShare(share)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs flex items-center gap-1 transition-colors"
                                title="このシェアを単一ファイル (.share) で保存"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>保存</span>
                              </button>
                            </div>
                          </div>

                          {/* Share Content with QR code preview */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                            {/* QR Code thumbnail */}
                            <div className="md:col-span-1 flex flex-col items-center justify-center bg-white p-2 rounded-lg shadow-inner">
                              {qrUrl ? (
                                <img
                                  src={qrUrl}
                                  alt={`Share #${share.x} QR Code`}
                                  className="w-24 h-24 object-contain"
                                />
                              ) : (
                                <div className="w-24 h-24 flex items-center justify-center text-slate-400">
                                  <QrCode className="w-8 h-8 animate-pulse text-slate-400" />
                                </div>
                              )}
                              <span className="text-[10px] text-slate-600 font-mono mt-1">
                                スキャン対応
                              </span>
                            </div>

                            {/* Text code box */}
                            <div className="md:col-span-3">
                              <pre className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all max-h-28 selection:bg-cyan-900 selection:text-white">
                                {shareDisplayFormat === 'armored'
                                  ? share.armoredText
                                  : share.formattedText}
                              </pre>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Empty placeholder state */
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500">
                    <Split className="w-8 h-8" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-base font-semibold text-slate-200">
                      シェアがまだ生成されていません
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      左側の設定で秘密（パスワード、シードフレーズ、またはファイル）を入力し、
                      復元閾値 (k) と総シェア数 (n) を指定して「シェアを生成」を押してください。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. RECONSTRUCT TAB */}
      {/* ========================================================= */}
      {activeTab === 'reconstruct' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Shares Column */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-slate-200">
                      収集したシェアの入力
                    </h3>
                  </div>

                  {/* Status Indicator */}
                  {detectedThreshold && (
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                      検知閾値: {detectedThreshold} of {detectedTotal}
                    </span>
                  )}
                </div>

                {/* Status Bar */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        detectedThreshold && validParsedCount.length >= detectedThreshold
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-slate-300">
                      有効なシェア:{' '}
                      <strong className="text-white font-mono">{validParsedCount.length}</strong> 枚
                      {detectedThreshold ? ` (必要: ${detectedThreshold}枚)` : ''}
                    </span>
                  </div>

                  {detectedThreshold && (
                    <span
                      className={`font-medium ${
                        validParsedCount.length >= detectedThreshold
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {validParsedCount.length >= detectedThreshold
                        ? '✓ 復元可能です！'
                        : `あと ${Math.max(0, detectedThreshold - validParsedCount.length)} 枚必要`}
                    </span>
                  )}
                </div>

                {/* Bulk Paste / Multi-Share Importer */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
                    <span>一括テキスト貼り付け / 複数シェアの自動認識</span>
                    {bulkPasteText && (
                      <button
                        onClick={handleApplyBulkPaste}
                        className="text-cyan-400 hover:underline font-semibold"
                      >
                        抽出して適用
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <textarea
                      value={bulkPasteText}
                      onChange={(e) => setBulkPasteText(e.target.value)}
                      placeholder="メールやチャットで受け取ったシェア、または複数のシェアを含むテキストをそのまま貼り付けてください..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    {bulkPasteText && (
                      <button
                        type="button"
                        onClick={handleApplyBulkPaste}
                        className="absolute right-2 bottom-2.5 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors"
                      >
                        シェアを抽出
                      </button>
                    )}
                  </div>
                </div>

                {/* File Upload Trigger */}
                <div className="flex items-center justify-between pt-1">
                  <input
                    type="file"
                    multiple
                    ref={reconstructFileInputRef}
                    onChange={handleReconstructFiles}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => reconstructFileInputRef.current?.click()}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>.share ファイルを複数選択して追加</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddShareInput}
                    className="text-xs text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>入力枠を追加</span>
                  </button>
                </div>

                {/* Individual Share Input Fields */}
                <div className="space-y-3 pt-2">
                  {reconstructInputs.map((val, idx) => {
                    const parsed = parseShareString(val);
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 text-[11px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span>シェア #{idx + 1}</span>
                          </span>

                          <div className="flex items-center gap-2">
                            {parsed ? (
                              <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                                ✓ シェア #{parsed.x} ({parsed.k}of{parsed.n})
                              </span>
                            ) : val.trim() ? (
                              <span className="text-[11px] text-red-400 font-mono bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60">
                                不正な形式
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">未入力</span>
                            )}

                            {reconstructInputs.length > 2 && (
                              <button
                                onClick={() => handleRemoveShareInput(idx)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                title="この入力枠を削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <textarea
                          value={val}
                          onChange={(e) => handleShareInputChange(idx, e.target.value)}
                          placeholder="SSS1-... または -----BEGIN SHAMIR SECRET SHARE----- を貼り付け"
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-800/80 rounded p-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleExecuteReconstruct}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  <span>秘密を復元する (Lagrange補間)</span>
                </button>
              </div>
            </div>

            {/* Reconstruct Result Column */}
            <div className="lg:col-span-6 space-y-4">
              {reconstructResult ? (
                reconstructResult.success ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-base font-bold text-white">秘密の復元に成功しました</h3>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-mono font-semibold">
                        完全性検証済 (CRC32一致)
                      </span>
                    </div>

                    {/* Metadata & Scheme Info */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5 font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>適用スキーム:</span>
                        <span className="text-cyan-400 font-bold">
                          {reconstructResult.threshold} of {reconstructResult.total} (必要閾値: {reconstructResult.threshold} 枚)
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>入力された有効シェア:</span>
                        <span className="text-cyan-300 font-medium">
                          {reconstructResult.validSharesProvided
                            ? `${reconstructResult.validSharesProvided.length} 枚 (シェア #${reconstructResult.validSharesProvided.join(', #')})`
                            : `${reconstructResult.sharesUsed.length} 枚`}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>復元計算に使用したシェア:</span>
                        <span className="text-emerald-400 font-semibold">
                          #{reconstructResult.sharesUsed.join(', #')}
                        </span>
                      </div>
                      {reconstructResult.filename && (
                        <div className="flex justify-between text-slate-300">
                          <span>元ファイル名:</span>
                          <span className="text-white">{reconstructResult.filename}</span>
                        </div>
                      )}
                    </div>

                    {/* Notice when more than k authentic shares were supplied */}
                    {!reconstructResult.faultyShareIndices &&
                      reconstructResult.validSharesProvided &&
                      reconstructResult.validSharesProvided.length > reconstructResult.threshold && (
                        <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-lg text-xs text-cyan-300 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">
                              必要閾値（{reconstructResult.threshold} 枚）を上回る {reconstructResult.validSharesProvided.length} 枚の正常なシェアが入力されました
                            </p>
                            <p className="text-[11px] text-cyan-400/90 mt-0.5">
                              入力されたすべてのシェア（#{reconstructResult.validSharesProvided.join(', #')}）の整合性が確認され、秘密が完全に復元されました。
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Warning if faulty share was detected and isolated */}
                    {reconstructResult.faultyShareIndices &&
                      reconstructResult.faultyShareIndices.length > 0 && (
                        <div className="p-3 bg-amber-950/50 border border-amber-800/70 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">破損または改ざんされたシェアを特定・排除しました</p>
                            <p className="text-[11px] text-amber-400/90 mt-0.5">
                              シェア #{reconstructResult.faultyShareIndices.join(', #')} のデータが不正でしたが、
                              他の正常なシェア（#{reconstructResult.sharesUsed.join(', #')}）から秘密を無事に復元できました。
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Text Payload View */}
                    {reconstructResult.isText && reconstructResult.text !== undefined && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>復元されたテキスト / 秘密鍵:</span>
                          <button
                            onClick={() => setIsResultMasked(!isResultMasked)}
                            className="flex items-center gap-1 hover:text-slate-200"
                          >
                            {isResultMasked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span>{isResultMasked ? '表示' : 'マスク'}</span>
                          </button>
                        </div>
                        <pre
                          className={`p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all max-h-60 selection:bg-cyan-900 selection:text-white ${
                            isResultMasked ? 'tracking-widest' : ''
                          }`}
                          style={isResultMasked ? { WebkitTextSecurity: 'disc' } as any : {}}
                        >
                          {reconstructResult.text}
                        </pre>
                      </div>
                    )}

                    {/* Binary File Payload View */}
                    {!reconstructResult.isText && (
                      <div className="p-5 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-2">
                        <File className="w-10 h-10 mx-auto text-cyan-400" />
                        <p className="text-sm font-semibold text-slate-200">
                          {reconstructResult.filename || 'バイナリファイル'}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          サイズ: {reconstructResult.secretBytes?.length} バイト
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {reconstructResult.isText && (
                        <button
                          onClick={() => {
                            if (reconstructResult.text) {
                              navigator.clipboard.writeText(reconstructResult.text);
                              setCopiedResult(true);
                              setTimeout(() => setCopiedResult(false), 2000);
                            }
                          }}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          {copiedResult ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">コピー完了</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>クリップボードにコピー</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={handleDownloadReconstructed}
                        className="px-3.5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>復元データをダウンロード</span>
                      </button>

                      {/* If text contains private key or user wants to save to Vault */}
                      {onImportToVault && reconstructResult.isText && (
                        <button
                          onClick={handleSaveToVault}
                          className="px-3.5 py-2 bg-purple-900/60 hover:bg-purple-800/80 border border-purple-700/60 text-purple-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5 text-purple-400" />
                          <span>
                            {importedToVaultSuccess ? 'Vaultに保存完了！' : 'Key Vaultにインポート'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Error state */
                  <div className="bg-red-950/30 border border-red-800/70 rounded-xl p-6 space-y-3">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span>復元に失敗しました</span>
                    </div>
                    <p className="text-xs text-red-300 leading-relaxed font-mono">
                      {reconstructResult.error}
                    </p>
                    <div className="pt-2 text-xs text-slate-400">
                      <p className="font-semibold text-slate-300 mb-1">考えられる原因:</p>
                      <ul className="list-disc list-inside space-y-1 text-[11px]">
                        <li>異なる閾値設定や異なる秘密のシェアが混在している</li>
                        <li>シェア文字列の末尾が欠けているか改ざんされている</li>
                        <li>必要な閾値 (k 枚) を満たしていない</li>
                      </ul>
                    </div>
                  </div>
                )
              ) : (
                /* Empty placeholder state */
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500">
                    <Key className="w-8 h-8" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-base font-semibold text-slate-200">
                      復元待機中
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      左側に各保管者から集めたシェア（閾値 k 枚以上）を貼り付けて「秘密を復元する」を実行してください。
                      元のデータが復元・検証されます。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. HOW IT WORKS & MATH VISUALIZATION TAB */}
      {/* ========================================================= */}
      {activeTab === 'math' && (
        <div className="space-y-6">
          {/* Conceptual intro cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Shield className="w-4 h-4" />
                <span>1. 情報理論的安全 (完全秘匿)</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                k-1個のシェアからは、どんなスーパーコンピュータや量子計算機を用いても、秘密の候補が全空間に等確率で広がり、1ビットの情報すら漏洩しません。
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Split className="w-4 h-4" />
                <span>2. 2次元多項式と y切片</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                秘密 <code className="text-cyan-300 font-mono">S</code> を定数項とする k-1 次多項式 <code className="text-cyan-300 font-mono">f(x)</code> を生成します。各シェアは曲線上の点 <code className="text-cyan-300 font-mono">(x, f(x))</code> です。
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>3. 有限体 GF(256) の適用</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                実数計算の丸め誤差や桁肥大を防ぐため、AESと同じガロア体 GF(256) 上で演算します。各シェアのサイズは元の秘密と完全に同一（1倍）を維持します。
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>4. 外部暗号ライブラリ不使用</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                GF(256)演算、多項式生成、ラグランジュ補間、CRC32整合性検査まですべてPure TypeScriptで自前実装しています（※QRコード描画のみ qrcode ライブラリを使用）。
              </p>
            </div>
          </div>

          {/* Interactive Math Curve Demo */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>多項式曲線の幾何学的シミュレーション</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  2次曲線（k=3の場合: 放物線）において、任意の3点があれば曲線全体と y切片 (x=0) が一意に定まります。
                </p>
              </div>

              {/* Slider controls */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">秘密 S = f(0):</span>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    value={demoSecret}
                    onChange={(e) => setDemoSecret(parseInt(e.target.value, 10))}
                    className="w-24 accent-cyan-500"
                  />
                  <span className="font-mono text-cyan-300 font-bold w-6">{demoSecret}</span>
                </div>
              </div>
            </div>

            {/* SVG Interactive Coordinate Chart */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden relative">
              <div className="h-64 w-full relative flex items-center justify-center">
                <svg
                  viewBox="0 0 600 240"
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Grid Lines */}
                  <line x1="50" y1="20" x2="50" y2="200" stroke="#334155" strokeWidth="1.5" />
                  <line x1="50" y1="200" x2="560" y2="200" stroke="#334155" strokeWidth="1.5" />

                  {/* Axis Labels */}
                  <text x="35" y="25" fill="#94a3b8" fontSize="10" textAnchor="end">
                    y = f(x)
                  </text>
                  <text x="560" y="215" fill="#94a3b8" fontSize="10">
                    x (シェア番号)
                  </text>

                  {/* Secret point at (0, secret) */}
                  {(() => {
                    // scale secret: y = 200 - demoSecret * 2.5
                    const sy = Math.max(30, Math.min(190, 200 - demoSecret * 2.5));
                    return (
                      <g>
                        <circle cx="50" cy={sy} r="6" fill="#06b6d4" className="animate-pulse" />
                        <text x="62" y={sy + 4} fill="#22d3ee" fontSize="11" fontWeight="bold">
                          秘密 S = f(0) [{demoSecret}]
                        </text>
                      </g>
                    );
                  })()}

                  {/* Share points (x=1..5) */}
                  {mathData.points.map((pt) => {
                    const cx = 50 + pt.x * 90;
                    // Normalize y value for visualization
                    const cy = Math.max(30, Math.min(190, 200 - (demoSecret + pt.x * 8) * 1.8));

                    return (
                      <g key={pt.x}>
                        <line
                          x1={cx}
                          y1="200"
                          x2={cx}
                          y2={cy}
                          stroke="#475569"
                          strokeDasharray="3 3"
                        />
                        <circle cx={cx} cy={cy} r="5" fill="#3b82f6" />
                        <text
                          x={cx}
                          y={cy - 10}
                          fill="#93c5fd"
                          fontSize="10"
                          textAnchor="middle"
                          fontWeight="bold"
                        >
                          シェア #{pt.x}
                        </text>
                        <text x={cx} y="215" fill="#64748b" fontSize="10" textAnchor="middle">
                          x={pt.x}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-2 text-center text-xs text-slate-400">
                2点だけ知っていても放物線は無限に傾きを変えられるため、y切片（秘密）を推定することは不可能です。
                3点すべてが揃って初めて、ラグランジュ補間により y切片が特定されます。
              </div>
            </div>

            {/* Practical Use Cases Comparison */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-semibold text-slate-200">実務での活用シナリオ</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-semibold text-cyan-400">
                    暗号資産・重要ウォレットのソーシャルリカバリ (3 of 5)
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    家族、信頼できる友人、弁護士、貸金庫に1枚ずつ配布。本人が紛失したり万が一の時でも、3名が集まれば資産を復元可能。誰も単独では資産を盗めません。
                  </p>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-semibold text-cyan-400">
                    企業のBCP・マスター暗号鍵の分散管理 (2 of 3)
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    CEO、CTO、法務担当に分散保管。CEO単独の暴走や急逝を防ぎつつ、重大インシデント時には2名の承認で安全にシステム秘密鍵を復元できます。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINTABLE CARDS MODAL (Paper Backup) */}
      {/* ========================================================= */}
      {showPrintModal && generatedShares && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Printer className="w-5 h-5 text-cyan-400" />
                  <span>印刷用ペーパーバックアップシート</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  物理保管や金庫保管用のカードです。ブラウザの印刷機能 (Ctrl+P / ⌘+P) で印刷できます。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>印刷を実行</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content / Cards */}
            <div className="p-6 overflow-y-auto space-y-6 bg-slate-950">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedShares.map((share) => {
                  const label = participantLabels[share.x] || `保管者 ${share.x}`;
                  const qrUrl = qrCodeUrls[share.x];

                  return (
                    <div
                      key={share.x}
                      className="border-2 border-slate-300 bg-white text-slate-900 p-5 rounded-xl shadow-md space-y-3"
                    >
                      <div className="border-b border-slate-300 pb-2 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-cyan-800 tracking-wider uppercase block">
                            SHAMIR SECRET SHARE
                          </span>
                          <h4 className="text-base font-bold text-slate-900">{label}</h4>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-900 text-white text-xs font-mono font-bold rounded">
                          {share.x} / {share.n}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        {qrUrl && (
                          <img
                            src={qrUrl}
                            alt="QR Code"
                            className="w-28 h-28 border border-slate-300 p-1 rounded"
                          />
                        )}
                        <div className="text-xs space-y-1 text-slate-700">
                          <p>
                            <strong>復元閾値:</strong> {share.k} of {share.n}
                          </p>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            このカード単体では秘密は一切解読できません。復元には他{' '}
                            <strong>{share.k - 1} 名</strong> のカードが必要です。
                          </p>
                          <p className="text-[10px] font-mono text-slate-500">
                            CRC: 0x{share.checksum.toString(16).toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div className="p-2 bg-slate-100 rounded text-[9px] font-mono break-all text-slate-800 select-all border border-slate-200">
                        {share.formattedText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
