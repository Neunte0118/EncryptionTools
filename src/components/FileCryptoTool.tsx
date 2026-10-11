import React, { useState, useRef, useEffect } from 'react';
import {
  encryptFileAesPassword,
  decryptFileAesPassword,
  encryptFileAesRaw,
  decryptFileAesRaw,
  encryptFileHybrid,
  decryptFileHybrid,
  detectEncryptedFileMetadata,
  base64ToBuffer,
  bufferToBase64,
  HashAlgorithm,
  FileEncMode,
} from '../utils/cryptoUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import {
  Upload,
  Download,
  Lock,
  Unlock,
  Key,
  Shield,
  FileCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  selectedKey?: {
    action: 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null;
  onClearSelectedKey?: () => void;
}

export const FileCryptoTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
}) => {
  const [tab, setTab] = useState<'encrypt' | 'decrypt'>('encrypt');

  // Encryption state
  const [encFile, setEncFile] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);
  const [encMethod, setEncMethod] = useState<FileEncMode>('hybrid-rsa');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [aesRawKeyBase64, setAesRawKeyBase64] = useState('');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');
  const [rsaPublicKeyPem, setRsaPublicKeyPem] = useState('');
  const [rsaHash, setRsaHash] = useState<HashAlgorithm>('SHA-256');

  // Decryption state
  const [decFile, setDecFile] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);
  const [detectedMeta, setDetectedMeta] = useState<{
    mode: FileEncMode;
    filename: string;
  } | null>(null);
  const [decMethod, setDecMethod] = useState<FileEncMode>('hybrid-rsa');
  const [decPassword, setDecPassword] = useState('');
  const [decAesRawKeyBase64, setDecAesRawKeyBase64] = useState('');
  const [decSelectedVaultKeyId, setDecSelectedVaultKeyId] = useState('');
  const [rsaPrivateKeyPem, setRsaPrivateKeyPem] = useState('');
  const [isRsaPrivRevealed, setIsRsaPrivRevealed] = useState(false);
  const [decRsaHash, setDecRsaHash] = useState<HashAlgorithm>('SHA-256');

  // Processing & Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    filename: string;
    size: number;
    downloadBlobUrl: string;
  } | null>(null);

  const encFileInputRef = useRef<HTMLInputElement>(null);
  const decFileInputRef = useRef<HTMLInputElement>(null);

  // Sync selectedKey from vault
  useEffect(() => {
    if (selectedKey) {
      if (selectedKey.key.type === 'rsa-oaep') {
        if (selectedKey.action === 'encrypt') {
          setTab('encrypt');
          setEncMethod('hybrid-rsa');
          setSelectedVaultKeyId(selectedKey.key.id);
          if (selectedKey.key.publicKeyPem) setRsaPublicKeyPem(selectedKey.key.publicKeyPem);
        } else {
          setTab('decrypt');
          setDecMethod('hybrid-rsa');
          setDecSelectedVaultKeyId(selectedKey.key.id);
          if (selectedKey.key.privateKeyPem) setRsaPrivateKeyPem(selectedKey.key.privateKeyPem);
        }
      } else if (selectedKey.key.type === 'aes-gcm') {
        if (selectedKey.action === 'encrypt') {
          setTab('encrypt');
          setEncMethod('aes-raw');
          if (selectedKey.key.rawKeyBase64) setAesRawKeyBase64(selectedKey.key.rawKeyBase64);
        } else {
          setTab('decrypt');
          setDecMethod('aes-raw');
          if (selectedKey.key.rawKeyBase64) setDecAesRawKeyBase64(selectedKey.key.rawKeyBase64);
        }
      }
      onClearSelectedKey?.();
    }
  }, [selectedKey, onClearSelectedKey]);

  // Handle Encrypt File Selection
  const handleEncFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEncFile({
        name: file.name,
        size: file.size,
        buffer: event.target?.result as ArrayBuffer,
      });
      setErrorMsg('');
      setSuccessInfo(null);
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Decrypt File Selection
  const handleDecFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      setDecFile({
        name: file.name,
        size: file.size,
        buffer,
      });
      setErrorMsg('');
      setSuccessInfo(null);

      // Auto-detect encryption format
      const meta = detectEncryptedFileMetadata(buffer);
      if (meta) {
        setDetectedMeta(meta);
        setDecMethod(meta.mode);
      } else {
        setDetectedMeta(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Helper: Trigger File Download
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Encrypt Execution
  const handleRunEncrypt = async () => {
    setErrorMsg('');
    setSuccessInfo(null);
    if (!encFile) {
      setErrorMsg('暗号化するファイルを選択してください');
      return;
    }

    setIsProcessing(true);
    try {
      let outputBuffer: ArrayBuffer;
      const outFilename = `${encFile.name}.enc`;

      if (encMethod === 'hybrid-rsa') {
        if (!rsaPublicKeyPem.trim()) {
          throw new Error('受取人のRSA公開鍵 (Public Key PEM) を指定してください');
        }
        outputBuffer = await encryptFileHybrid(
          encFile.buffer,
          encFile.name,
          rsaPublicKeyPem.trim(),
          rsaHash
        );
      } else if (encMethod === 'aes-password') {
        if (!password) {
          throw new Error('パスワードを入力してください');
        }
        if (password !== passwordConfirm) {
          throw new Error('確認用パスワードが一致しません');
        }
        outputBuffer = await encryptFileAesPassword(encFile.buffer, encFile.name, password);
      } else if (encMethod === 'aes-raw') {
        if (!aesRawKeyBase64.trim()) {
          throw new Error('AES共通鍵 (256-bit Base64) を指定してください');
        }
        const keyBuffer = base64ToBuffer(aesRawKeyBase64.trim());
        outputBuffer = await encryptFileAesRaw(encFile.buffer, encFile.name, keyBuffer);
      } else {
        throw new Error('暗号化方式が不正です');
      }

      const blob = new Blob([outputBuffer], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      downloadBlob(blob, outFilename);

      setSuccessInfo({
        message: 'ファイルの暗号化が完了し、自動ダウンロードされました',
        filename: outFilename,
        size: outputBuffer.byteLength,
        downloadBlobUrl: downloadUrl,
      });
    } catch (err: any) {
      setErrorMsg(err.message || '暗号化処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  // Decrypt Execution
  const handleRunDecrypt = async () => {
    setErrorMsg('');
    setSuccessInfo(null);
    if (!decFile) {
      setErrorMsg('復号する暗号化ファイル (.enc) を選択してください');
      return;
    }

    setIsProcessing(true);
    try {
      let result: { filename: string; fileData: ArrayBuffer };

      if (decMethod === 'hybrid-rsa') {
        if (!rsaPrivateKeyPem.trim()) {
          throw new Error('復号用のRSA秘密鍵 (Private Key PEM) を指定してください');
        }
        result = await decryptFileHybrid(
          decFile.buffer,
          rsaPrivateKeyPem.trim(),
          decRsaHash
        );
      } else if (decMethod === 'aes-password') {
        if (!decPassword) {
          throw new Error('復号パスワードを入力してください');
        }
        result = await decryptFileAesPassword(decFile.buffer, decPassword);
      } else if (decMethod === 'aes-raw') {
        if (!decAesRawKeyBase64.trim()) {
          throw new Error('復号用のAES共通鍵 (256-bit Base64) を指定してください');
        }
        const keyBuffer = base64ToBuffer(decAesRawKeyBase64.trim());
        result = await decryptFileAesRaw(decFile.buffer, keyBuffer);
      } else {
        throw new Error('復号方式が不正です');
      }

      const blob = new Blob([result.fileData], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      downloadBlob(blob, result.filename);

      setSuccessInfo({
        message: 'ファイルの復号に成功し、元ファイルが復元・ダウンロードされました',
        filename: result.filename,
        size: result.fileData.byteLength,
        downloadBlobUrl: downloadUrl,
      });
    } catch (err: any) {
      setErrorMsg(err.message || '復号に失敗しました。パスワードまたは鍵を確認してください');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateRandomAes = () => {
    const raw = window.crypto.getRandomValues(new Uint8Array(32));
    setAesRawKeyBase64(bufferToBase64(raw.buffer));
  };

  const handleVaultKeySelectForEncrypt = (id: string) => {
    setSelectedVaultKeyId(id);
    if (!id) return;
    const item = vault.keys.find((k) => k.id === id);
    if (!item) return;
    if (item.type === 'rsa-oaep') {
      setEncMethod('hybrid-rsa');
      if (item.publicKeyPem) setRsaPublicKeyPem(item.publicKeyPem);
      if (item.algorithmDetails.hash) setRsaHash(item.algorithmDetails.hash as any);
    } else if (item.type === 'aes-gcm') {
      setEncMethod('aes-raw');
      if (item.rawKeyBase64) setAesRawKeyBase64(item.rawKeyBase64);
    }
  };

  const handleVaultKeySelectForDecrypt = (id: string) => {
    setDecSelectedVaultKeyId(id);
    if (!id) return;
    const item = vault.keys.find((k) => k.id === id);
    if (!item) return;
    if (item.type === 'rsa-oaep') {
      setDecMethod('hybrid-rsa');
      if (item.privateKeyPem) setRsaPrivateKeyPem(item.privateKeyPem);
      if (item.algorithmDetails.hash) setDecRsaHash(item.algorithmDetails.hash as any);
    } else if (item.type === 'aes-gcm') {
      setDecMethod('aes-raw');
      if (item.rawKeyBase64) setDecAesRawKeyBase64(item.rawKeyBase64);
    }
  };

  const rsaOaepKeys = vault.keys.filter((k) => k.type === 'rsa-oaep');
  const aesKeys = vault.keys.filter((k) => k.type === 'aes-gcm');

  return (
    <div className="space-y-6">
      {/* Top Tabs: Encrypt File / Decrypt File */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => {
            setTab('encrypt');
            setErrorMsg('');
            setSuccessInfo(null);
          }}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'encrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>ファイル暗号化 (Encrypt)</span>
        </button>

        <button
          onClick={() => {
            setTab('decrypt');
            setErrorMsg('');
            setSuccessInfo(null);
          }}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'decrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>ファイル復号 (Decrypt)</span>
        </button>
      </div>

      {/* --- ENCRYPT FILE TAB --- */}
      {tab === 'encrypt' && (
        <div className="space-y-5">
          {/* File Upload Zone */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="text-sm font-semibold text-slate-200">
              1. 暗号化するファイルを選択
            </div>

            <input
              ref={encFileInputRef}
              type="file"
              onChange={handleEncFileUpload}
              className="hidden"
            />
            <div
              onClick={() => encFileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-8 text-center cursor-pointer bg-slate-950/60 transition-colors"
            >
              <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              {encFile ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-indigo-400 flex items-center justify-center gap-2">
                    <FileCheck className="w-4 h-4" />
                    <span>{encFile.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    サイズ: {(encFile.size / 1024).toFixed(2)} KB (
                    {encFile.size.toLocaleString()} バイト)
                  </div>
                  <div className="text-xs text-slate-500 pt-1">
                    クリックして別のファイルを選択
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    任意のファイルをドラッグ＆ドロップ、またはクリックして選択
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    PDF, ZIP, 画像, ドキュメント等あらゆる形式に対応
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Encryption Method & Key Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="text-sm font-semibold text-slate-200">
              2. 暗号化方式の選択
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setEncMethod('hybrid-rsa')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  encMethod === 'hybrid-rsa'
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-indigo-300 flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>ハイブリッド暗号 [推奨]</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  AES-256でファイルを高速暗号化し、ワンタイム共通鍵を受取人のRSA公開鍵で安全にカプセル化。
                </p>
              </button>

              <button
                type="button"
                onClick={() => setEncMethod('aes-password')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  encMethod === 'aes-password'
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-emerald-300 flex items-center gap-1.5 mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>AES (パスワード方式)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  合言葉からPBKDF2で鍵を導出。鍵ファイルを持たない相手ともパスワードだけでやり取り可能。
                </p>
              </button>

              <button
                type="button"
                onClick={() => setEncMethod('aes-raw')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  encMethod === 'aes-raw'
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs text-amber-300 flex items-center gap-1.5 mb-1">
                  <Key className="w-3.5 h-3.5" />
                  <span>AES (256-bit 共通鍵)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  事前共有された高強度な256-bit共通鍵（Base64）を用いて直接暗号化。
                </p>
              </button>
            </div>

            {/* Method-Specific Inputs */}
            {encMethod === 'hybrid-rsa' && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                      <span>鍵管理ファイルから選択</span>
                    </label>
                    <select
                      value={selectedVaultKeyId}
                      onChange={(e) => handleVaultKeySelectForEncrypt(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">(手動入力または選択)</option>
                      {rsaOaepKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      OAEP ハッシュ関数
                    </label>
                    <select
                      value={rsaHash}
                      onChange={(e) => setRsaHash(e.target.value as HashAlgorithm)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="SHA-256">SHA-256 (標準)</option>
                      <option value="SHA-512">SHA-512</option>
                      <option value="SHA-384">SHA-384</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>受取人のRSA公開鍵 (Public Key PEM)</span>
                    <span className="text-[11px] text-slate-500">SPKI 形式</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rsaPublicKeyPem}
                    onChange={(e) => setRsaPublicKeyPem(e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {encMethod === 'aes-password' && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      暗号化パスワード
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="強力なパスワードを入力..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      パスワードの再確認
                    </label>
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="もう一度入力..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {encMethod === 'aes-raw' && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                      <span>鍵管理ファイルから選択</span>
                    </label>
                    <select
                      value={selectedVaultKeyId}
                      onChange={(e) => handleVaultKeySelectForEncrypt(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">(手動入力または選択)</option>
                      {aesKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-300">
                        256-bit 共通鍵 (Base64)
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomAes}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                      >
                        ランダム鍵を生成
                      </button>
                    </div>
                    <input
                      type="text"
                      value={aesRawKeyBase64}
                      onChange={(e) => setAesRawKeyBase64(e.target.value)}
                      placeholder="32バイトのBase64エンコードキーを入力..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button & Output */}
          <div className="space-y-4">
            <button
              onClick={handleRunEncrypt}
              disabled={isProcessing || !encFile}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>暗号化処理中...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>ファイルを暗号化してダウンロード</span>
                </>
              )}
            </button>

            {errorMsg && (
              <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successInfo && (
              <div className="p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg space-y-2">
                <div className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{successInfo.message}</span>
                </div>
                <div className="text-xs text-slate-300">
                  出力ファイル: <span className="font-mono text-white">{successInfo.filename}</span> (
                  {(successInfo.size / 1024).toFixed(2)} KB)
                </div>
                <div className="pt-1">
                  <a
                    href={successInfo.downloadBlobUrl}
                    download={successInfo.filename}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>再ダウンロード</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DECRYPT FILE TAB --- */}
      {tab === 'decrypt' && (
        <div className="space-y-5">
          {/* File Upload Zone */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="text-sm font-semibold text-slate-200">
              1. 復号する暗号化ファイル (.enc) を選択
            </div>

            <input
              ref={decFileInputRef}
              type="file"
              onChange={handleDecFileUpload}
              className="hidden"
            />
            <div
              onClick={() => decFileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-8 text-center cursor-pointer bg-slate-950/60 transition-colors"
            >
              <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              {decFile ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-indigo-400 flex items-center justify-center gap-2">
                    <FileCheck className="w-4 h-4" />
                    <span>{decFile.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    サイズ: {(decFile.size / 1024).toFixed(2)} KB (
                    {decFile.size.toLocaleString()} バイト)
                  </div>

                  {detectedMeta && (
                    <div className="mt-3 p-2.5 bg-indigo-950/80 border border-indigo-800/80 rounded text-xs text-indigo-200 flex flex-col items-center gap-1">
                      <div>
                        検出形式:{' '}
                        <span className="font-semibold text-white uppercase">
                          {detectedMeta.mode === 'hybrid-rsa'
                            ? 'ハイブリッド暗号 (AES + RSA)'
                            : detectedMeta.mode === 'aes-password'
                            ? 'AES (パスワード暗号化)'
                            : 'AES (共通鍵暗号化)'}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        同封された元ファイル名:{' '}
                        <span className="font-mono text-emerald-300 font-medium">
                          {detectedMeta.filename}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 pt-1">
                    クリックして別のファイルを選択
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    暗号化ファイル (.enc) をドラッグ＆ドロップ、またはクリックして選択
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    本ツールで暗号化されたファイルを自動判別します
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Decryption Key Inputs */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">
                2. 復号パラメータ
              </div>

              {!detectedMeta && (
                <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800 text-xs">
                  <button
                    onClick={() => setDecMethod('hybrid-rsa')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      decMethod === 'hybrid-rsa'
                        ? 'bg-slate-800 text-indigo-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ハイブリッド
                  </button>
                  <button
                    onClick={() => setDecMethod('aes-password')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      decMethod === 'aes-password'
                        ? 'bg-slate-800 text-indigo-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    パスワード
                  </button>
                  <button
                    onClick={() => setDecMethod('aes-raw')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      decMethod === 'aes-raw'
                        ? 'bg-slate-800 text-indigo-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    共通鍵
                  </button>
                </div>
              )}
            </div>

            {/* Hybrid Decryption Form */}
            {decMethod === 'hybrid-rsa' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                      <span>鍵管理ファイルから選択</span>
                    </label>
                    <select
                      value={decSelectedVaultKeyId}
                      onChange={(e) => handleVaultKeySelectForDecrypt(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">(手動入力または選択)</option>
                      {rsaOaepKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      OAEP ハッシュ関数
                    </label>
                    <select
                      value={decRsaHash}
                      onChange={(e) => setDecRsaHash(e.target.value as HashAlgorithm)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="SHA-256">SHA-256 (標準)</option>
                      <option value="SHA-512">SHA-512</option>
                      <option value="SHA-384">SHA-384</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>復号用 RSA秘密鍵 (Private Key PEM)</span>
                      <button
                        type="button"
                        onClick={() => setIsRsaPrivRevealed(!isRsaPrivRevealed)}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                      >
                        {isRsaPrivRevealed ? (
                          <EyeOff className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Eye className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{isRsaPrivRevealed ? '秘密鍵を隠す' : '秘密鍵を表示'}</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500">PKCS#8 形式</span>
                  </label>
                  {isRsaPrivRevealed ? (
                    <textarea
                      rows={3}
                      value={rsaPrivateKeyPem}
                      onChange={(e) => setRsaPrivateKeyPem(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono text-amber-200 focus:outline-none focus:border-indigo-500"
                    />
                  ) : (
                    <div
                      onClick={() => setIsRsaPrivRevealed(true)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded p-3 text-xs font-mono text-amber-400/70 cursor-pointer flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <span className="truncate">
                        {rsaPrivateKeyPem
                          ? '•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••• [保護中: クリックまたはボタンで表示]'
                          : '（秘密鍵未入力: ここをクリックまたは「秘密鍵を表示」を押して入力）'}
                      </span>
                      <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded shrink-0 ml-2">
                        表示する
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Password Decryption Form */}
            {decMethod === 'aes-password' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  復号パスワード
                </label>
                <input
                  type="password"
                  value={decPassword}
                  onChange={(e) => setDecPassword(e.target.value)}
                  placeholder="暗号化時に設定したパスワードを入力..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* AES Raw Key Decryption Form */}
            {decMethod === 'aes-raw' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                      <span>鍵管理ファイルから選択</span>
                    </label>
                    <select
                      value={decSelectedVaultKeyId}
                      onChange={(e) => handleVaultKeySelectForDecrypt(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">(手動入力または選択)</option>
                      {aesKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      256-bit 共通鍵 (Base64)
                    </label>
                    <input
                      type="text"
                      value={decAesRawKeyBase64}
                      onChange={(e) => setDecAesRawKeyBase64(e.target.value)}
                      placeholder="32バイトのBase64エンコードキーを入力..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button & Output */}
          <div className="space-y-4">
            <button
              onClick={handleRunDecrypt}
              disabled={isProcessing || !decFile}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>復号処理中...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>ファイルを復号して復元ダウンロード</span>
                </>
              )}
            </button>

            {errorMsg && (
              <div className="p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs rounded-md flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successInfo && (
              <div className="p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg space-y-2">
                <div className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{successInfo.message}</span>
                </div>
                <div className="text-xs text-slate-300">
                  復元ファイル名: <span className="font-mono text-white font-semibold">{successInfo.filename}</span> (
                  {(successInfo.size / 1024).toFixed(2)} KB)
                </div>
                <div className="pt-1">
                  <a
                    href={successInfo.downloadBlobUrl}
                    download={successInfo.filename}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>再ダウンロード</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
