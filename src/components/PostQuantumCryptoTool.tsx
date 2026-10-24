import React, { useState, useRef } from 'react';
import {
  encryptHybridMlKem,
  decryptHybridMlKem,
  mlDsaSign,
  mlDsaVerify,
  MlKemLevel,
  MlDsaLevel,
  PqcEncryptedPackage,
} from '../utils/postQuantumUtils';
import { KeyVaultFile } from '../types/crypto';
import { FileLoaderButton } from './FileLoaderButton';
import {
  Lock,
  Unlock,
  Key,
  FileSignature,
  FileLock,
  Upload,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  CheckCircle2,
  Atom,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface Props {
  vault?: KeyVaultFile;
  onNavigateToKeyGenerator?: () => void;
}

export const PostQuantumCryptoTool: React.FC<Props> = ({
  vault,
  onNavigateToKeyGenerator,
}) => {
  const [activeTab, setActiveTab] = useState<'ml-kem' | 'ml-dsa'>('ml-kem');

  // ML-KEM State
  const [kemLevel, setKemLevel] = useState<MlKemLevel>('768');
  const [kemMyPubKeyHex, setKemMyPubKeyHex] = useState('');
  const [kemMySecKeyHex, setKemMySecKeyHex] = useState('');
  const [isKemSecRevealed, setIsKemSecRevealed] = useState(false);
  const [selectedKemVaultKeyId, setSelectedKemVaultKeyId] = useState('');

  // KEM Action & Target
  const [kemAction, setKemAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [kemTargetType, setKemTargetType] = useState<'text' | 'file'>('text');

  // KEM Text
  const [kemPeerPubKeyHex, setKemPeerPubKeyHex] = useState('');
  const [kemPlainText, setKemPlainText] = useState('');
  const [kemEncryptedPkgJson, setKemEncryptedPkgJson] = useState('');
  const [kemDecryptedText, setKemDecryptedText] = useState('');

  // KEM File
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
  const [selectedDsaVaultKeyId, setSelectedDsaVaultKeyId] = useState('');

  // DSA Sign / Verify
  const [dsaAction, setDsaAction] = useState<'sign' | 'verify'>('sign');
  const [dsaMessage, setDsaMessage] = useState('');
  const [dsaSignatureHex, setDsaSignatureHex] = useState('');
  const [dsaVerifyResult, setDsaVerifyResult] = useState<boolean | null>(null);
  const [dsaError, setDsaError] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const kemVaultKeys = vault?.keys.filter((k) => k.type === 'pqc-kem') || [];
  const dsaVaultKeys = vault?.keys.filter((k) => k.type === 'pqc-dsa') || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // ML-KEM Text Encrypt
  const handleKemTextEncrypt = async () => {
    setKemError('');
    setKemEncryptedPkgJson('');
    const recipientKey = kemPeerPubKeyHex.trim() || kemMyPubKeyHex.trim();
    if (!recipientKey) {
      setKemError('受取人のML-KEM公開鍵 Hex を入力してください（「暗号鍵生成」ツールで生成できます）');
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
      setKemError('復号に使用するML-KEM秘密鍵 Hex を指定してください（「暗号鍵生成」ツールで生成可能）');
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
          throw new Error('受取人のML-KEM公開鍵 Hex を入力してください（「暗号鍵生成」ツールで生成可能）');
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

  // ML-DSA Sign
  const handleDsaSign = () => {
    setDsaError('');
    setDsaSignatureHex('');
    if (!dsaSecKeyHex.trim()) {
      setDsaError('署名に使用するML-DSA秘密鍵 Hex を指定してください（「暗号鍵生成」ツールで生成可能）');
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
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Atom className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">耐量子暗号 (Post-Quantum Cryptography)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                NIST FIPS 203 / 204
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              量子コンピュータによる解読耐性を持つML-KEM (Kyber) 格子暗号化およびML-DSA (Dilithium) 格子署名
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('ml-kem')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'ml-kem'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ML-KEM 格子暗号化</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ml-dsa')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'ml-dsa'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>ML-DSA 格子署名</span>
          </button>
        </div>
      </div>

      {/* Strict Key Notice Banner */}
      <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
        <span className="flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>※ 鍵の生成はすべて「暗号鍵生成」で行います。それ以外では認めません。</span>
        </span>
        {onNavigateToKeyGenerator && (
          <button
            type="button"
            onClick={onNavigateToKeyGenerator}
            className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/40 transition-colors shrink-0"
          >
            「暗号鍵生成」を開く
          </button>
        )}
      </div>

      {/* ML-KEM TAB */}
      {activeTab === 'ml-kem' && (
        <div className="space-y-6">
          {/* Key Selection & Parameters Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">パラメータ強度:</span>
                <select
                  value={kemLevel}
                  onChange={(e) => setKemLevel(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="512">ML-KEM-512 (高速 / AES-128同等)</option>
                  <option value="768">ML-KEM-768 (標準推奨 / AES-192同等)</option>
                  <option value="1024">ML-KEM-1024 (最高強度 / AES-256同等)</option>
                </select>
              </div>
              {onNavigateToKeyGenerator && (
                <button
                  type="button"
                  onClick={onNavigateToKeyGenerator}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-indigo-500/40 transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>「暗号鍵生成」でML-KEM鍵を生成</span>
                </button>
              )}
            </div>

            {kemVaultKeys.length > 0 && (
              <div>
                <select
                  value={selectedKemVaultKeyId}
                  onChange={(e) => {
                    setSelectedKemVaultKeyId(e.target.value);
                    const k = kemVaultKeys.find((item) => item.id === e.target.value);
                    if (k?.publicKeyPem) setKemMyPubKeyHex(k.publicKeyPem);
                    if (k?.privateKeyPem) setKemMySecKeyHex(k.privateKeyPem);
                    if (k?.algorithmDetails?.level) setKemLevel(k.algorithmDetails.level as any);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- 保管庫の ML-KEM キーから選択 --</option>
                  {kemVaultKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-300">自身の公開鍵 Hex</span>
                  <div className="flex items-center gap-1">
                    <FileLoaderButton
                      label="読込"
                      onFileLoaded={(content) => setKemMyPubKeyHex(content.trim())}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(kemMyPubKeyHex, 'kemPub')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                    >
                      {copiedId === 'kemPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={kemMyPubKeyHex}
                  onChange={(e) => setKemMyPubKeyHex(e.target.value)}
                  placeholder="公開鍵Hexを入力または保管庫から選択..."
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg font-mono text-slate-200 text-xs break-all focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-rose-300">自身の秘密鍵 Hex</span>
                    <button
                      type="button"
                      onClick={() => setIsKemSecRevealed(!isKemSecRevealed)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-0.5"
                    >
                      {isKemSecRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{isKemSecRevealed ? '伏せる' : '表示'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileLoaderButton
                      label="読込"
                      onFileLoaded={(content) => setKemMySecKeyHex(content.trim())}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(kemMySecKeyHex, 'kemSec')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                    >
                      {copiedId === 'kemSec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={isKemSecRevealed ? kemMySecKeyHex : kemMySecKeyHex.replace(/[^-]/g, '*')}
                  onChange={(e) => setKemMySecKeyHex(e.target.value)}
                  placeholder="秘密鍵Hexを入力または保管庫から選択..."
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg font-mono text-slate-200 text-xs break-all focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Action and Target Switchers */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setKemAction('encrypt')}
                className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                  kemAction === 'encrypt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>暗号化</span>
              </button>
              <button
                type="button"
                onClick={() => setKemAction('decrypt')}
                className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                  kemAction === 'decrypt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>復号</span>
              </button>
            </div>

            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setKemTargetType('text')}
                className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                  kemTargetType === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>テキスト</span>
              </button>
              <button
                type="button"
                onClick={() => setKemTargetType('file')}
                className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                  kemTargetType === 'file' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileLock className="w-3.5 h-3.5" />
                <span>ファイル</span>
              </button>
            </div>
          </div>

          {/* KEM TEXT MODE */}
          {kemTargetType === 'text' && (
            <div className="space-y-4">
              {kemAction === 'encrypt' ? (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">
                        受取人の公開鍵 Hex (未入力の場合は自身の公開鍵を使用)
                      </label>
                      <FileLoaderButton
                        label="公開鍵読込"
                        onFileLoaded={(content) => setKemPeerPubKeyHex(content.trim())}
                      />
                    </div>
                    <textarea
                      value={kemPeerPubKeyHex}
                      onChange={(e) => setKemPeerPubKeyHex(e.target.value)}
                      rows={2}
                      placeholder="未入力の場合は自身の公開鍵を使用"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">
                        暗号化する平文
                      </label>
                      <FileLoaderButton
                        label="ファイルから読込"
                        onFileLoaded={(content) => setKemPlainText(content)}
                      />
                    </div>
                    <textarea
                      value={kemPlainText}
                      onChange={(e) => setKemPlainText(e.target.value)}
                      rows={4}
                      placeholder="テキストを入力..."
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleKemTextEncrypt}
                    disabled={isProcessingKem || !kemPlainText.trim()}
                    className="w-full py-2.5 rounded-lg font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    <Lock className="w-4 h-4" />
                    <span>暗号化を実行</span>
                  </button>

                  {kemEncryptedPkgJson && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>暗号化パッケージ JSON (ML-KEMカプセル + AES-GCM暗号文)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(kemEncryptedPkgJson, 'kemPkg')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                        >
                          {copiedId === 'kemPkg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>コピー</span>
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={kemEncryptedPkgJson}
                        rows={6}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 text-xs font-mono select-all focus:outline-none"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">
                        暗号化パッケージ JSON を貼り付け
                      </label>
                      <FileLoaderButton
                        label="JSONファイル読込"
                        onFileLoaded={(content) => setKemEncryptedPkgJson(content.trim())}
                      />
                    </div>
                    <textarea
                      value={kemEncryptedPkgJson}
                      onChange={(e) => setKemEncryptedPkgJson(e.target.value)}
                      rows={5}
                      placeholder="{ 'encapsulatedKeyHex': ..., 'ciphertextBase64': ... }"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleKemTextDecrypt}
                    disabled={isProcessingKem || !kemEncryptedPkgJson.trim()}
                    className="w-full py-2.5 rounded-lg font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>復号を実行</span>
                  </button>

                  {kemDecryptedText && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>復号結果 (平文)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(kemDecryptedText, 'kemDec')}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                        >
                          {copiedId === 'kemDec' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>コピー</span>
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

          {/* KEM FILE MODE */}
          {kemTargetType === 'file' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <input
                ref={kemFileInputRef}
                type="file"
                onChange={handleKemFileChange}
                className="hidden"
              />
              <div
                onClick={() => kemFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950 rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                {selectedFile ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{selectedFile.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-slate-300 font-medium">ファイルを選択またはドロップ</div>
                    <div className="text-[11px] text-slate-500 mt-1">ハイブリッド耐量子暗号化で安全に保護</div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleKemFileAction}
                disabled={isProcessingKem || !selectedFile}
                className="w-full py-2.5 rounded-lg font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {kemAction === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{isProcessingKem ? '処理中...' : kemAction === 'encrypt' ? 'ファイルを暗号化' : 'ファイルを復号'}</span>
              </button>

              {fileSuccess && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-100">{fileSuccess.filename}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {(fileSuccess.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <a
                    href={fileSuccess.downloadUrl}
                    download={fileSuccess.filename}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ダウンロード</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {kemError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{kemError}</span>
            </div>
          )}
        </div>
      )}

      {/* ML-DSA TAB */}
      {activeTab === 'ml-dsa' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">パラメータ強度:</span>
                <select
                  value={dsaLevel}
                  onChange={(e) => setDsaLevel(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="44">ML-DSA-44 (NIST Category 2)</option>
                  <option value="65">ML-DSA-65 (NIST Category 3 - 標準推奨)</option>
                  <option value="87">ML-DSA-87 (NIST Category 5 - 最高強度)</option>
                </select>
              </div>
              {onNavigateToKeyGenerator && (
                <button
                  type="button"
                  onClick={onNavigateToKeyGenerator}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-indigo-500/40 transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>「暗号鍵生成」でML-DSA鍵を生成</span>
                </button>
              )}
            </div>

            {dsaVaultKeys.length > 0 && (
              <div>
                <select
                  value={selectedDsaVaultKeyId}
                  onChange={(e) => {
                    setSelectedDsaVaultKeyId(e.target.value);
                    const k = dsaVaultKeys.find((item) => item.id === e.target.value);
                    if (k?.publicKeyPem) setDsaPubKeyHex(k.publicKeyPem);
                    if (k?.privateKeyPem) setDsaSecKeyHex(k.privateKeyPem);
                    if (k?.algorithmDetails?.level) setDsaLevel(k.algorithmDetails.level as any);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- 保管庫の ML-DSA キーから選択 --</option>
                  {dsaVaultKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-300">検証用公開鍵 Hex</span>
                  <div className="flex items-center gap-1">
                    <FileLoaderButton
                      label="読込"
                      onFileLoaded={(content) => setDsaPubKeyHex(content.trim())}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(dsaPubKeyHex, 'dsaPub')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                    >
                      {copiedId === 'dsaPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={dsaPubKeyHex}
                  onChange={(e) => setDsaPubKeyHex(e.target.value)}
                  placeholder="検証用公開鍵Hexを入力または保管庫から選択..."
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg font-mono text-slate-200 text-xs break-all focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-rose-300">署名用秘密鍵 Hex</span>
                    <button
                      type="button"
                      onClick={() => setIsDsaSecRevealed(!isDsaSecRevealed)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-0.5"
                    >
                      {isDsaSecRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{isDsaSecRevealed ? '伏せる' : '表示'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileLoaderButton
                      label="読込"
                      onFileLoaded={(content) => setDsaSecKeyHex(content.trim())}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(dsaSecKeyHex, 'dsaSec')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                    >
                      {copiedId === 'dsaSec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={isDsaSecRevealed ? dsaSecKeyHex : dsaSecKeyHex.replace(/[^-]/g, '*')}
                  onChange={(e) => setDsaSecKeyHex(e.target.value)}
                  placeholder="署名用秘密鍵Hexを入力または保管庫から選択..."
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg font-mono text-slate-200 text-xs break-all focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Action Toggle */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setDsaAction('sign');
                  setDsaVerifyResult(null);
                }}
                className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                  dsaAction === 'sign' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSignature className="w-3.5 h-3.5" />
                <span>署名作成</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDsaAction('verify');
                  setDsaVerifyResult(null);
                }}
                className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                  dsaAction === 'verify' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>署名検証</span>
              </button>
            </div>
          </div>

          {/* Message Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                署名 / 検証対象メッセージ
              </label>
              <FileLoaderButton
                label="ファイル読込"
                onFileLoaded={(content) => setDsaMessage(content)}
              />
            </div>
            <textarea
              rows={3}
              value={dsaMessage}
              onChange={(e) => setDsaMessage(e.target.value)}
              placeholder="メッセージを入力..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />

            {dsaAction === 'verify' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">検証する署名 Hex</label>
                <textarea
                  rows={3}
                  value={dsaSignatureHex}
                  onChange={(e) => setDsaSignatureHex(e.target.value)}
                  placeholder="署名Hexを入力..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <button
              type="button"
              onClick={dsaAction === 'sign' ? handleDsaSign : handleDsaVerify}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {dsaAction === 'sign' ? <FileSignature className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{dsaAction === 'sign' ? '耐量子署名を作成' : '耐量子署名を検証'}</span>
            </button>
          </div>

          {dsaError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{dsaError}</span>
            </div>
          )}

          {dsaAction === 'sign' && dsaSignatureHex && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>生成された耐量子電子署名 (Hex)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(dsaSignatureHex, 'dsaSig')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                >
                  {copiedId === 'dsaSig' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>コピー</span>
                </button>
              </div>
              <textarea
                readOnly
                value={dsaSignatureHex}
                rows={4}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 text-xs font-mono select-all focus:outline-none"
              />
            </div>
          )}

          {dsaAction === 'verify' && dsaVerifyResult !== null && (
            <div
              className={`p-4 rounded-xl border flex items-center gap-3 ${
                dsaVerifyResult
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}
            >
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <div className="font-semibold text-xs">
                  {dsaVerifyResult ? '署名検証成功: 有効な耐量子電子署名です' : '署名検証失敗: 署名が無効または改ざんされています'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  ML-DSA-{dsaLevel} 格子暗号パラメータによる真正性検証
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
