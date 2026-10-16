import React, { useState, useEffect, useRef } from 'react';
import {
  aesEncrypt,
  aesDecrypt,
  stringToBuffer,
  bufferToString,
  base64ToBuffer,
  bufferToBase64,
  encryptFileAesPassword,
  decryptFileAesPassword,
  encryptFileAesRaw,
  decryptFileAesRaw,
  detectEncryptedFileMetadata,
} from '../utils/cryptoUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import {
  Lock,
  Unlock,
  Key,
  Copy,
  Check,
  FileLock,
  Upload,
  Download,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  FileText,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  selectedKey?: {
    action: 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null;
  onClearSelectedKey?: () => void;
}

export const AesTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
}) => {
  const [activeMode, setActiveMode] = useState<'text' | 'file'>('text');

  // --- Text State ---
  const [textAction, setTextAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [keyInputType, setKeyInputType] = useState<'password' | 'raw' | 'vault'>('password');
  const [password, setPassword] = useState('');
  const [rawKeyBase64, setRawKeyBase64] = useState('');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');
  const [plainText, setPlainText] = useState('');
  const [cipherText, setCipherText] = useState('');
  const [decryptedText, setDecryptedText] = useState('');
  const [textError, setTextError] = useState('');
  const [isProcessingText, setIsProcessingText] = useState(false);

  // --- File State ---
  const [fileAction, setFileAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [fileKeyType, setFileKeyType] = useState<'password' | 'raw' | 'vault'>('password');
  const [filePassword, setFilePassword] = useState('');
  const [filePasswordConfirm, setFilePasswordConfirm] = useState('');
  const [fileRawKeyBase64, setFileRawKeyBase64] = useState('');
  const [fileSelectedVaultKeyId, setFileSelectedVaultKeyId] = useState('');
  const [encFile, setEncFile] = useState<{ name: string; size: number; buffer: ArrayBuffer } | null>(null);
  const [decFile, setDecFile] = useState<{ name: string; size: number; buffer: ArrayBuffer } | null>(null);
  const [fileError, setFileError] = useState('');
  const [fileSuccess, setFileSuccess] = useState<{
    filename: string;
    size: number;
    downloadUrl: string;
    message: string;
  } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const encFileInputRef = useRef<HTMLInputElement>(null);
  const decFileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const aesVaultKeys = vault.keys.filter((k) => k.type === 'aes-gcm');

  // Sync selected key from vault
  useEffect(() => {
    if (selectedKey && selectedKey.key.type === 'aes-gcm') {
      setTextAction(selectedKey.action);
      setKeyInputType('vault');
      setSelectedVaultKeyId(selectedKey.key.id);
      if (selectedKey.key.rawKeyBase64) {
        setRawKeyBase64(selectedKey.key.rawKeyBase64);
        setFileRawKeyBase64(selectedKey.key.rawKeyBase64);
      }
      onClearSelectedKey?.();
    }
  }, [selectedKey, onClearSelectedKey]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getEffectiveKeyBuffer = async (
    type: 'password' | 'raw' | 'vault',
    pass: string,
    rawB64: string,
    vaultKeyId: string
  ): Promise<Uint8Array> => {
    if (type === 'password') {
      if (!pass.trim()) throw new Error('パスワードを入力してください');
      const encoder = new TextEncoder();
      const passBuf = encoder.encode(pass.trim());
      const hash = await crypto.subtle.digest('SHA-256', passBuf);
      return new Uint8Array(hash);
    } else if (type === 'raw') {
      if (!rawB64.trim()) throw new Error('Base64共通鍵を入力してください');
      return base64ToBuffer(rawB64.trim()) as any;
    } else {
      const vk = aesVaultKeys.find((k) => k.id === vaultKeyId);
      if (!vk || !vk.rawKeyBase64) throw new Error('保管庫から有効なAESキーを選択してください');
      return base64ToBuffer(vk.rawKeyBase64) as any;
    }
  };

  const handleGenerateRawKey = () => {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    const b64 = bufferToBase64(raw as any);
    setRawKeyBase64(b64);
    setFileRawKeyBase64(b64);
  };

  // Text Encrypt
  const handleTextEncrypt = async () => {
    setTextError('');
    setCipherText('');
    if (!plainText.trim()) {
      setTextError('暗号化するテキストを入力してください');
      return;
    }
    setIsProcessingText(true);
    try {
      const keyBuf = await getEffectiveKeyBuffer(keyInputType, password, rawKeyBase64, selectedVaultKeyId);
      const plainBuf = stringToBuffer(plainText);
      const encRes = await aesEncrypt(keyBuf as any, plainBuf as any);
      setCipherText(encRes.combinedBase64);
    } catch (err: any) {
      setTextError(err.message || 'AES暗号化エラー');
    } finally {
      setIsProcessingText(false);
    }
  };

  // Text Decrypt
  const handleTextDecrypt = async () => {
    setTextError('');
    setDecryptedText('');
    if (!cipherText.trim()) {
      setTextError('復号する暗号文 (Base64) を入力してください');
      return;
    }
    setIsProcessingText(true);
    try {
      const keyBuf = await getEffectiveKeyBuffer(keyInputType, password, rawKeyBase64, selectedVaultKeyId);
      const cipherBuf = base64ToBuffer(cipherText.trim());
      const decBuf = await aesDecrypt(keyBuf as any, cipherBuf as any);
      setDecryptedText(bufferToString(decBuf as any));
    } catch (err: any) {
      setTextError(`AES復号エラー: ${err.message} (鍵が異なるか暗号文が破損しています)`);
    } finally {
      setIsProcessingText(false);
    }
  };

  // File Handlers
  const handleEncFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setEncFile({
        name: file.name,
        size: file.size,
        buffer: event.target?.result as ArrayBuffer,
      });
      setFileError('');
      setFileSuccess(null);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDecFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setDecFile({
        name: file.name,
        size: file.size,
        buffer: event.target?.result as ArrayBuffer,
      });
      setFileError('');
      setFileSuccess(null);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileEncrypt = async () => {
    setFileError('');
    setFileSuccess(null);
    if (!encFile) {
      setFileError('暗号化するファイルを選択してください');
      return;
    }

    setIsProcessingFile(true);
    try {
      let outBuffer: ArrayBuffer;
      const outFilename = `${encFile.name}.enc`;

      if (fileKeyType === 'password') {
        if (!filePassword.trim()) throw new Error('パスワードを入力してください');
        if (filePasswordConfirm && filePassword !== filePasswordConfirm) {
          throw new Error('パスワードが一致しません');
        }
        outBuffer = await encryptFileAesPassword(encFile.buffer, encFile.name, filePassword.trim());
      } else {
        const keyBuf = await getEffectiveKeyBuffer(fileKeyType, filePassword, fileRawKeyBase64, fileSelectedVaultKeyId);
        outBuffer = await encryptFileAesRaw(encFile.buffer, encFile.name, (keyBuf as any).buffer || keyBuf);
      }

      const blob = new Blob([outBuffer], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      setFileSuccess({
        filename: outFilename,
        size: outBuffer.byteLength,
        downloadUrl,
        message: 'AES-256-GCM によりファイルを正常に暗号化しました。',
      });
    } catch (err: any) {
      setFileError(err.message || 'ファイル暗号化エラー');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileDecrypt = async () => {
    setFileError('');
    setFileSuccess(null);
    if (!decFile) {
      setFileError('復号する暗号化ファイル (.enc) を選択してください');
      return;
    }

    setIsProcessingFile(true);
    try {
      let decrypted: { filename: string; fileData: ArrayBuffer };
      const meta = detectEncryptedFileMetadata(decFile.buffer);

      if (meta?.mode === 'aes-raw' || fileKeyType === 'raw' || fileKeyType === 'vault') {
        const keyBuf = await getEffectiveKeyBuffer(fileKeyType, filePassword, fileRawKeyBase64, fileSelectedVaultKeyId);
        decrypted = await decryptFileAesRaw(decFile.buffer, (keyBuf as any).buffer || keyBuf);
      } else {
        if (!filePassword.trim()) throw new Error('パスワードを入力してください');
        decrypted = await decryptFileAesPassword(decFile.buffer, filePassword.trim());
      }

      const blob = new Blob([decrypted.fileData], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      setFileSuccess({
        filename: decrypted.filename,
        size: decrypted.fileData.byteLength,
        downloadUrl,
        message: 'AES-256-GCM 認証付き復号に成功しました。完全性が確認されました。',
      });
    } catch (err: any) {
      setFileError(`ファイル復号エラー: ${err.message} (パスワード/鍵が正しくないか改竄されています)`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">AES-256 (GCM / CBC)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono font-medium">
                Advanced Encryption Standard
              </span>
            </div>
            <p className="text-xs text-slate-400">
              NIST FIPS 197 準拠の 256-bit 共通鍵認証付き暗号。高速なテキストおよびファイルの秘匿と改竄検知
            </p>
          </div>
        </div>

        {/* Subtab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMode('text')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeMode === 'text'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>テキスト暗号化・復号</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('file')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeMode === 'file'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileLock className="w-3.5 h-3.5" />
            <span>ファイル暗号化・復号</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Text AES */}
      {activeMode === 'text' && (
        <div className="space-y-6">
          {/* Action Toggle (Encrypt / Decrypt) */}
          <div className="flex border-b border-slate-800 gap-4">
            <button
              type="button"
              onClick={() => setTextAction('encrypt')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                textAction === 'encrypt'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>暗号化 (Encrypt)</span>
            </button>
            <button
              type="button"
              onClick={() => setTextAction('decrypt')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                textAction === 'decrypt'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>復号 (Decrypt)</span>
            </button>
          </div>

          {/* Key Selection */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>暗号鍵の指定方法</span>
              </label>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setKeyInputType('password')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    keyInputType === 'password'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  パスワードから導出 (PBKDF2/SHA-256)
                </button>
                <button
                  type="button"
                  onClick={() => setKeyInputType('raw')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    keyInputType === 'raw'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  256-bit 生鍵 (Base64)
                </button>
                <button
                  type="button"
                  onClick={() => setKeyInputType('vault')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    keyInputType === 'vault'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  保管庫から選択 ({aesVaultKeys.length}件)
                </button>
              </div>
            </div>

            {keyInputType === 'password' && (
              <div className="space-y-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスフレーズを入力..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            )}

            {keyInputType === 'raw' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rawKeyBase64}
                    onChange={(e) => setRawKeyBase64(e.target.value)}
                    placeholder="32バイトのBase64エンコードされた鍵..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRawKey}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium border border-slate-700 shrink-0"
                  >
                    ランダム生成
                  </button>
                </div>
              </div>
            )}

            {keyInputType === 'vault' && (
              <div>
                {aesVaultKeys.length === 0 ? (
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                    鍵保管庫に登録された AES-GCM 共通鍵がありません。「鍵生成」または「鍵保管庫」で作成できます。
                  </div>
                ) : (
                  <select
                    value={selectedVaultKeyId}
                    onChange={(e) => {
                      setSelectedVaultKeyId(e.target.value);
                      const k = aesVaultKeys.find((item) => item.id === e.target.value);
                      if (k?.rawKeyBase64) setRawKeyBase64(k.rawKeyBase64);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- 保管庫のキーを選択 --</option>
                    {aesVaultKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.title} (AES-256-GCM)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Text Areas */}
          {textAction === 'encrypt' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  平文テキスト (暗号化対象)
                </label>
                <textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  rows={4}
                  placeholder="暗号化するテキストを入力..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              {textError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {textError}
                </div>
              )}

              <button
                type="button"
                onClick={handleTextEncrypt}
                disabled={isProcessingText || !plainText.trim()}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Lock className="w-4 h-4" />
                <span>AES-256-GCM で暗号化</span>
              </button>

              {cipherText && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      暗号化完了 (Base64 / IV+Ciphertext+AuthTag)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(cipherText, 'cipher')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] flex items-center gap-1"
                    >
                      {copiedId === 'cipher' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === 'cipher' ? 'コピー完了' : 'コピー'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={cipherText}
                    rows={4}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  暗号文 (Base64)
                </label>
                <textarea
                  value={cipherText}
                  onChange={(e) => setCipherText(e.target.value)}
                  rows={4}
                  placeholder="復号するBase64暗号文を入力..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {textError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {textError}
                </div>
              )}

              <button
                type="button"
                onClick={handleTextDecrypt}
                disabled={isProcessingText || !cipherText.trim()}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                <span>AES-256-GCM で復号</span>
              </button>

              {decryptedText && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      復号完了 (完全性検証OK)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(decryptedText, 'plain')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] flex items-center gap-1"
                    >
                      {copiedId === 'plain' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === 'plain' ? 'コピー完了' : 'コピー'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={decryptedText}
                    rows={4}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-sans"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode 2: File AES */}
      {activeMode === 'file' && (
        <div className="space-y-6">
          <div className="flex border-b border-slate-800 gap-4">
            <button
              type="button"
              onClick={() => {
                setFileAction('encrypt');
                setFileSuccess(null);
                setFileError('');
              }}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                fileAction === 'encrypt'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>ファイル暗号化 (.enc 作成)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFileAction('decrypt');
                setFileSuccess(null);
                setFileError('');
              }}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                fileAction === 'decrypt'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>ファイル復号 (.enc 解除)</span>
            </button>
          </div>

          {/* Key Selection for File */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>ファイル用 共通鍵</span>
              </label>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFileKeyType('password')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    fileKeyType === 'password'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  パスワード暗号化
                </button>
                <button
                  type="button"
                  onClick={() => setFileKeyType('raw')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    fileKeyType === 'raw'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  256-bit 生鍵
                </button>
                <button
                  type="button"
                  onClick={() => setFileKeyType('vault')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    fileKeyType === 'vault'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  保管庫から選択 ({aesVaultKeys.length}件)
                </button>
              </div>
            </div>

            {fileKeyType === 'password' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">暗号化パスワード</label>
                  <input
                    type="password"
                    value={filePassword}
                    onChange={(e) => setFilePassword(e.target.value)}
                    placeholder="パスワードを入力..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                {fileAction === 'encrypt' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">パスワード確認</label>
                    <input
                      type="password"
                      value={filePasswordConfirm}
                      onChange={(e) => setFilePasswordConfirm(e.target.value)}
                      placeholder="再入力..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {fileKeyType === 'raw' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fileRawKeyBase64}
                  onChange={(e) => setFileRawKeyBase64(e.target.value)}
                  placeholder="Base64 鍵..."
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateRawKey}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium border border-slate-700 shrink-0"
                >
                  ランダム生成
                </button>
              </div>
            )}

            {fileKeyType === 'vault' && (
              <div>
                <select
                  value={fileSelectedVaultKeyId}
                  onChange={(e) => {
                    setFileSelectedVaultKeyId(e.target.value);
                    const k = aesVaultKeys.find((item) => item.id === e.target.value);
                    if (k?.rawKeyBase64) setFileRawKeyBase64(k.rawKeyBase64);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- 保管庫のキーを選択 --</option>
                  {aesVaultKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title} (AES-256-GCM)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Upload and Execute Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            {fileAction === 'encrypt' ? (
              <div className="space-y-4">
                <div
                  onClick={() => encFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40"
                >
                  <input
                    ref={encFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleEncFileChange}
                  />
                  <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-200">
                    {encFile ? encFile.name : '暗号化するファイルを選択またはドラッグ＆ドロップ'}
                  </div>
                  {encFile && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      サイズ: {(encFile.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleFileEncrypt}
                  disabled={isProcessingFile || !encFile}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <Lock className="w-4 h-4" />
                  <span>ファイルを暗号化して .enc を生成</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => decFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40"
                >
                  <input
                    ref={decFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleDecFileChange}
                  />
                  <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-200">
                    {decFile ? decFile.name : '復号する暗号化ファイル (.enc) を選択'}
                  </div>
                  {decFile && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      サイズ: {(decFile.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleFileDecrypt}
                  disabled={isProcessingFile || !decFile}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <Unlock className="w-4 h-4" />
                  <span>暗号化ファイルを復号して復元</span>
                </button>
              </div>
            )}

            {fileError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                {fileError}
              </div>
            )}

            {fileSuccess && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{fileSuccess.message}</span>
                </div>
                <div className="flex items-center justify-between text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">{fileSuccess.filename}</div>
                    <div className="text-[10px] text-slate-500">{(fileSuccess.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <a
                    href={fileSuccess.downloadUrl}
                    download={fileSuccess.filename}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ダウンロード</span>
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
