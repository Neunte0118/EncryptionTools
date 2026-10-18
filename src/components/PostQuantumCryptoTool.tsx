import React, { useState, useRef } from 'react';
import {
  generateMlKemKeyPair,
  encryptHybridMlKem,
  decryptHybridMlKem,
  generateMlDsaKeyPair,
  mlDsaSign,
  mlDsaVerify,
  MlKemLevel,
  MlDsaLevel,
  PqcEncryptedPackage,
} from '../utils/postQuantumUtils';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  FileSignature,
  FileLock,
  Upload,
  Download,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  Cpu,
  FileText,
  AlertCircle,
} from 'lucide-react';

export const PostQuantumCryptoTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ml-kem' | 'ml-dsa'>('ml-kem');

  // ML-KEM State
  const [kemLevel, setKemLevel] = useState<MlKemLevel>('768');
  const [kemMyPubKeyHex, setKemMyPubKeyHex] = useState('');
  const [kemMySecKeyHex, setKemMySecKeyHex] = useState('');
  const [isKemSecRevealed, setIsKemSecRevealed] = useState(false);

  // KEM Unified Action and Target
  const [kemAction, setKemAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [kemTargetType, setKemTargetType] = useState<'text' | 'file'>('text');

  // Text State
  const [kemPeerPubKeyHex, setKemPeerPubKeyHex] = useState('');
  const [kemPlainText, setKemPlainText] = useState('');
  const [kemEncryptedPkgJson, setKemEncryptedPkgJson] = useState('');
  const [kemDecryptedText, setKemDecryptedText] = useState('');

  // File State
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);
  const [fileSuccess, setFileSuccess] = useState<{
    filename: string;
    size: number;
    downloadUrl: string;
  } | null>(null);
  const kemFileInputRef = useRef<HTMLInputElement>(null);

  const [kemError, setKemError] = useState('');
  const [isProcessingKem, setIsProcessingKem] = useState(false);

  // ML-DSA State
  const [dsaLevel, setDsaLevel] = useState<MlDsaLevel>('65');
  const [dsaPubKeyHex, setDsaPubKeyHex] = useState('');
  const [dsaSecKeyHex, setDsaSecKeyHex] = useState('');
  const [isDsaSecRevealed, setIsDsaSecRevealed] = useState(false);

  // DSA Sign / Verify
  const [dsaAction, setDsaAction] = useState<'sign' | 'verify'>('sign');
  const [dsaMessage, setDsaMessage] = useState('');
  const [dsaSignatureHex, setDsaSignatureHex] = useState('');
  const [dsaVerifyResult, setDsaVerifyResult] = useState<boolean | null>(null);
  const [dsaError, setDsaError] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // ML-KEM Keygen
  const handleGenerateKemKeys = () => {
    try {
      const keys = generateMlKemKeyPair(kemLevel);
      setKemMyPubKeyHex(keys.publicKeyHex);
      setKemMySecKeyHex(keys.secretKeyHex);
      setKemError('');
    } catch (e: any) {
      setKemError(`ML-KEM 鍵生成エラー: ${e.message}`);
    }
  };

  // ML-KEM Text Encrypt
  const handleKemTextEncrypt = async () => {
    setKemError('');
    setKemEncryptedPkgJson('');
    const recipientKey = kemPeerPubKeyHex.trim() || kemMyPubKeyHex.trim();
    if (!recipientKey) {
      setKemError('受取人のML-KEM公開鍵 Hex を入力するか鍵ペアを生成してください');
      return;
    }
    if (!kemPlainText.trim()) {
      setKemError('暗号化するテキストを入力してください');
      return;
    }

    setIsProcessingKem(true);
    try {
      const encoder = new TextEncoder();
      const plainBytes = encoder.encode(kemPlainText.trim());
      const pkg = await encryptHybridMlKem(plainBytes, recipientKey, kemLevel);
      setKemEncryptedPkgJson(JSON.stringify(pkg, null, 2));
    } catch (e: any) {
      setKemError(`暗号化エラー: ${e.message}`);
    } finally {
      setIsProcessingKem(false);
    }
  };

  // ML-KEM Text Decrypt
  const handleKemTextDecrypt = async () => {
    setKemError('');
    setKemDecryptedText('');
    if (!kemMySecKeyHex.trim()) {
      setKemError('復号に使用するML-KEM秘密鍵 Hex を指定してください');
      return;
    }
    if (!kemEncryptedPkgJson.trim()) {
      setKemError('暗号化パッケージ JSON を入力してください');
      return;
    }

    setIsProcessingKem(true);
    try {
      const pkg: PqcEncryptedPackage = JSON.parse(kemEncryptedPkgJson.trim());
      const decryptedBytes = await decryptHybridMlKem(pkg, kemMySecKeyHex.trim());
      const decoder = new TextDecoder();
      setKemDecryptedText(decoder.decode(decryptedBytes));
    } catch (e: any) {
      setKemError(`復号エラー: ${e.message}`);
    } finally {
      setIsProcessingKem(false);
    }
  };

  // ML-KEM File Change
  const handleKemFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        size: file.size,
        buffer: event.target?.result as ArrayBuffer,
      });
      setKemError('');
      setFileSuccess(null);
    };
    reader.readAsArrayBuffer(file);
  };

  // ML-KEM File Action
  const handleKemFileAction = async () => {
    setKemError('');
    setFileSuccess(null);

    if (!selectedFile) {
      setKemError('ファイルを選択してください');
      return;
    }

    setIsProcessingKem(true);
    try {
      if (kemAction === 'encrypt') {
        const recipientKey = kemPeerPubKeyHex.trim() || kemMyPubKeyHex.trim();
        if (!recipientKey) {
          throw new Error('受取人のML-KEM公開鍵 Hex を入力するか鍵ペアを生成してください');
        }
        const fileBytes = new Uint8Array(selectedFile.buffer);
        const pkg = await encryptHybridMlKem(fileBytes, recipientKey, kemLevel, {
          filename: selectedFile.name,
          mimeType: 'application/octet-stream',
        });
        const jsonStr = JSON.stringify(pkg, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: `${selectedFile.name}.pqc.json`,
          size: blob.size,
          downloadUrl,
        });
      } else {
        if (!kemMySecKeyHex.trim()) {
          throw new Error('復号に使用するML-KEM秘密鍵 Hex を入力してください');
        }
        const textDecoder = new TextDecoder('utf-8');
        const jsonStr = textDecoder.decode(selectedFile.buffer);
        const pkg: PqcEncryptedPackage = JSON.parse(jsonStr);
        const decryptedBytes = await decryptHybridMlKem(pkg, kemMySecKeyHex.trim());
        const originalName = pkg.filename || 'decrypted.bin';
        const blob = new Blob([decryptedBytes as any], { type: pkg.mimeType || 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: originalName,
          size: decryptedBytes.byteLength,
          downloadUrl,
        });
      }
    } catch (e: any) {
      setKemError(`ファイル処理エラー: ${e.message}`);
    } finally {
      setIsProcessingKem(false);
    }
  };

  // ML-DSA Keygen
  const handleGenerateDsaKeys = () => {
    try {
      const keys = generateMlDsaKeyPair(dsaLevel);
      setDsaPubKeyHex(keys.publicKeyHex);
      setDsaSecKeyHex(keys.secretKeyHex);
      setDsaError('');
    } catch (e: any) {
      setDsaError(`ML-DSA 鍵生成エラー: ${e.message}`);
    }
  };

  // ML-DSA Sign
  const handleDsaSign = () => {
    setDsaError('');
    setDsaSignatureHex('');
    if (!dsaSecKeyHex.trim()) {
      setDsaError('署名に使用するML-DSA秘密鍵 Hex を指定してください');
      return;
    }
    if (!dsaMessage.trim()) {
      setDsaError('署名対象のメッセージを入力してください');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const msgBytes = encoder.encode(dsaMessage.trim());
      const res = mlDsaSign(msgBytes, dsaSecKeyHex.trim(), dsaLevel);
      setDsaSignatureHex(res.signatureHex);
    } catch (e: any) {
      setDsaError(`署名作成エラー: ${e.message}`);
    }
  };

  // ML-DSA Verify
  const handleDsaVerify = () => {
    setDsaError('');
    setDsaVerifyResult(null);
    if (!dsaPubKeyHex.trim()) {
      setDsaError('検証に使用するML-DSA公開鍵 Hex を指定してください');
      return;
    }
    if (!dsaSignatureHex.trim()) {
      setDsaError('検証する署名Hexを入力してください');
      return;
    }
    if (!dsaMessage.trim()) {
      setDsaError('検証対象の元メッセージを入力してください');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const msgBytes = encoder.encode(dsaMessage.trim());
      const isValid = mlDsaVerify(dsaSignatureHex.trim(), msgBytes, dsaPubKeyHex.trim(), dsaLevel);
      setDsaVerifyResult(isValid);
    } catch (e: any) {
      setDsaError(`署名検証エラー: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">耐量子暗号 ML-KEM ML-DSA</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/60 font-mono font-medium">
                NIST FIPS 203 204
              </span>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('ml-kem')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'ml-kem'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ML-KEM 格子暗号化</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ml-dsa')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'ml-dsa'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>ML-DSA 格子署名</span>
          </button>
        </div>
      </div>

      {/* ML-KEM TAB */}
      {activeTab === 'ml-kem' && (
        <div className="space-y-6">
          {/* Key Generation Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">パラメータ強度:</span>
                <select
                  value={kemLevel}
                  onChange={(e) => setKemLevel(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-teal-300 font-mono text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="512">ML-KEM-512 高速</option>
                  <option value="768">ML-KEM-768 標準推奨</option>
                  <option value="1024">ML-KEM-1024 最高強度</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleGenerateKemKeys}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>格子鍵ペアを生成</span>
              </button>
            </div>

            {kemMyPubKeyHex && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-300">公開鍵 Hex</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(kemMyPubKeyHex, 'kemPub')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'kemPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto">
                    {kemMyPubKeyHex}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rose-300">秘密鍵 Hex</span>
                      <button
                        type="button"
                        onClick={() => setIsKemSecRevealed(!isKemSecRevealed)}
                        className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                      >
                        {isKemSecRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isKemSecRevealed ? '伏せる' : '表示'}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(kemMySecKeyHex, 'kemSec')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'kemSec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div
                    className={`p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto ${
                      !isKemSecRevealed ? 'filter blur-[3px]' : ''
                    }`}
                  >
                    {kemMySecKeyHex}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Unified Operation & Target Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setKemAction('encrypt');
                  setKemError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  kemAction === 'encrypt'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>暗号化</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setKemAction('decrypt');
                  setKemError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  kemAction === 'decrypt'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>復号</span>
              </button>
            </div>

            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setKemTargetType('text');
                  setKemError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  kemTargetType === 'text'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>テキスト</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setKemTargetType('file');
                  setKemError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  kemTargetType === 'file'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileLock className="w-3.5 h-3.5" />
                <span>ファイル</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {kemError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium">{kemError}</div>
            </div>
          )}

          {/* TEXT MODE */}
          {kemTargetType === 'text' && (
            <div className="space-y-5">
              {kemAction === 'encrypt' ? (
                <>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <label className="text-xs font-bold text-slate-300">
                      受取人の公開鍵 Hex
                    </label>
                    <textarea
                      value={kemPeerPubKeyHex}
                      onChange={(e) => setKemPeerPubKeyHex(e.target.value)}
                      rows={2}
                      placeholder="未入力の場合は上で生成した自身の公開鍵を使用"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <label className="text-xs font-bold text-slate-300">
                      暗号化する平文
                    </label>
                    <textarea
                      value={kemPlainText}
                      onChange={(e) => setKemPlainText(e.target.value)}
                      rows={4}
                      placeholder="テキストを入力"
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleKemTextEncrypt}
                    disabled={isProcessingKem || !kemPlainText.trim()}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    <span>暗号化を実行</span>
                  </button>

                  {kemEncryptedPkgJson && (
                    <div className="bg-slate-900/70 border border-teal-900/50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-400" />
                          暗号化パッケージ JSON
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(kemEncryptedPkgJson, 'kemPkg')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                        >
                          {copiedId === 'kemPkg' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>コピー済み</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>コピー</span>
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={kemEncryptedPkgJson}
                        rows={6}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-teal-300 text-xs font-mono select-all focus:outline-none"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <label className="text-xs font-bold text-slate-300">
                      復号用の秘密鍵 Hex
                    </label>
                    <textarea
                      value={kemMySecKeyHex}
                      onChange={(e) => setKemMySecKeyHex(e.target.value)}
                      rows={2}
                      placeholder="秘密鍵のHexを入力"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <label className="text-xs font-bold text-slate-300">
                      暗号化パッケージ JSON
                    </label>
                    <textarea
                      value={kemEncryptedPkgJson}
                      onChange={(e) => setKemEncryptedPkgJson(e.target.value)}
                      rows={5}
                      placeholder="暗号化されたJSONを貼り付け"
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleKemTextDecrypt}
                    disabled={isProcessingKem || !kemMySecKeyHex.trim() || !kemEncryptedPkgJson.trim()}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>復号を実行</span>
                  </button>

                  {kemDecryptedText && (
                    <div className="bg-slate-900/70 border border-teal-900/50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-teal-400" />
                          復号テキスト
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(kemDecryptedText, 'kemDec')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                        >
                          {copiedId === 'kemDec' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>コピー済み</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>コピー</span>
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={kemDecryptedText}
                        rows={4}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono select-all focus:outline-none"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* FILE MODE */}
          {kemTargetType === 'file' && (
            <div className="space-y-5">
              {kemAction === 'encrypt' ? (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <label className="text-xs font-bold text-slate-300">
                    受取人の公開鍵 Hex
                  </label>
                  <textarea
                    value={kemPeerPubKeyHex}
                    onChange={(e) => setKemPeerPubKeyHex(e.target.value)}
                    rows={2}
                    placeholder="未入力の場合は上で生成した自身の公開鍵を使用"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              ) : (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                  <label className="text-xs font-bold text-slate-300">
                    復号用の秘密鍵 Hex
                  </label>
                  <textarea
                    value={kemMySecKeyHex}
                    onChange={(e) => setKemMySecKeyHex(e.target.value)}
                    rows={2}
                    placeholder="復号用秘密鍵のHexを入力"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              )}

              {/* File Dropzone */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <label className="text-xs font-bold text-slate-300">
                  {kemAction === 'encrypt' ? '暗号化するファイル' : '復号する暗号化ファイル'}
                </label>
                <input
                  ref={kemFileInputRef}
                  type="file"
                  onChange={handleKemFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => kemFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-7 h-7 text-slate-500 mx-auto mb-2" />
                  {selectedFile ? (
                    <div>
                      <div className="text-xs font-bold text-slate-200">{selectedFile.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {selectedFile.size.toLocaleString()} bytes
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs text-slate-300 font-medium">クリックしてファイルを選択</div>
                      <div className="text-[11px] text-slate-500 mt-1">任意のファイル形式に対応</div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isProcessingKem || !selectedFile}
                onClick={handleKemFileAction}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {kemAction === 'encrypt' ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>ファイルを暗号化</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>ファイルを復号</span>
                  </>
                )}
              </button>

              {/* File Result */}
              {fileSuccess && (
                <div className="bg-teal-950/20 border border-teal-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{kemAction === 'encrypt' ? 'ファイル暗号化完了' : 'ファイル復号完了'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                    <div>
                      <div className="text-xs font-mono font-bold text-slate-200">{fileSuccess.filename}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{fileSuccess.size.toLocaleString()} bytes</div>
                    </div>
                    <a
                      href={fileSuccess.downloadUrl}
                      download={fileSuccess.filename}
                      className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ダウンロード</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ML-DSA TAB */}
      {activeTab === 'ml-dsa' && (
        <div className="space-y-6">
          {/* Keygen Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">パラメータ強度:</span>
                <select
                  value={dsaLevel}
                  onChange={(e) => setDsaLevel(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-teal-300 font-mono text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="44">ML-DSA-44 高速</option>
                  <option value="65">ML-DSA-65 標準推奨</option>
                  <option value="87">ML-DSA-87 最高強度</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleGenerateDsaKeys}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>格子署名鍵ペアを生成</span>
              </button>
            </div>

            {dsaPubKeyHex && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-300">検証用公開鍵 Hex</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(dsaPubKeyHex, 'dsaPub')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'dsaPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto">
                    {dsaPubKeyHex}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rose-300">署名用秘密鍵 Hex</span>
                      <button
                        type="button"
                        onClick={() => setIsDsaSecRevealed(!isDsaSecRevealed)}
                        className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                      >
                        {isDsaSecRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isDsaSecRevealed ? '伏せる' : '表示'}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(dsaSecKeyHex, 'dsaSec')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'dsaSec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div
                    className={`p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto ${
                      !isDsaSecRevealed ? 'filter blur-[3px]' : ''
                    }`}
                  >
                    {dsaSecKeyHex}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Tabs: Sign / Verify */}
          <div className="flex border-b border-slate-800 gap-4">
            <button
              type="button"
              onClick={() => {
                setDsaAction('sign');
                setDsaVerifyResult(null);
                setDsaError('');
              }}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                dsaAction === 'sign'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSignature className="w-3.5 h-3.5" />
              <span>電子署名を作成</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDsaAction('verify');
                setDsaVerifyResult(null);
                setDsaError('');
              }}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                dsaAction === 'verify'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>電子署名を検証</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">対象メッセージ</label>
              <textarea
                value={dsaMessage}
                onChange={(e) => setDsaMessage(e.target.value)}
                rows={3}
                placeholder="メッセージを入力"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            {dsaAction === 'sign' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    署名用秘密鍵 Hex
                  </label>
                  <textarea
                    value={dsaSecKeyHex}
                    onChange={(e) => setDsaSecKeyHex(e.target.value)}
                    rows={2}
                    placeholder="秘密鍵のHexを入力"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                {dsaError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                    {dsaError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDsaSign}
                  disabled={!dsaSecKeyHex.trim() || !dsaMessage.trim()}
                  className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <FileSignature className="w-4 h-4" />
                  <span>電子署名を生成</span>
                </button>

                {dsaSignatureHex && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        署名生成完了
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(dsaSignatureHex, 'dsaSig')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] flex items-center gap-1"
                      >
                        {copiedId === 'dsaSig' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>署名をコピー</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={dsaSignatureHex}
                      rows={5}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-teal-300 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    検証用公開鍵 Hex
                  </label>
                  <textarea
                    value={dsaPubKeyHex}
                    onChange={(e) => setDsaPubKeyHex(e.target.value)}
                    rows={2}
                    placeholder="公開鍵のHexを入力"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    検証する署名 Hex
                  </label>
                  <textarea
                    value={dsaSignatureHex}
                    onChange={(e) => setDsaSignatureHex(e.target.value)}
                    rows={3}
                    placeholder="署名Hexを貼り付け"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                {dsaError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                    {dsaError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDsaVerify}
                  disabled={!dsaPubKeyHex.trim() || !dsaSignatureHex.trim() || !dsaMessage.trim()}
                  className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>署名を検証</span>
                </button>

                {dsaVerifyResult !== null && (
                  <div
                    className={`p-4 rounded-xl border flex items-center gap-3 ${
                      dsaVerifyResult
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                    }`}
                  >
                    {dsaVerifyResult ? (
                      <>
                        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">署名検証 真正</div>
                          <div className="text-[11px] text-emerald-400/80">
                            メッセージは改ざんされておらず公開鍵に対応する署名者によって正当に作成されました。
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">署名検証 不正</div>
                          <div className="text-[11px] text-rose-400/80">
                            署名が一致しないかデータが破損または改ざんされています。
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
