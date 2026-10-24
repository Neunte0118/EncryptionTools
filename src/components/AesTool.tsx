import React, { useState, useEffect, useRef } from 'react';
import {
  aesEncrypt,
  aesDecrypt,
  aesEncryptAdvanced,
  aesDecryptAdvanced,
  AesCipherMode,
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
import { FileLoaderButton } from './FileLoaderButton';
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
  AlertCircle,
  CheckCircle2,
  FileText,
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
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [targetType, setTargetType] = useState<'text' | 'file'>('text');

  // Mode & Key length state
  const [aesMode, setAesMode] = useState<AesCipherMode>('AES-GCM');
  const [aesKeyLength, setAesKeyLength] = useState<128 | 192 | 256>(256);

  // Key state
  const [keyInputType, setKeyInputType] = useState<'password' | 'raw' | 'vault'>('password');
  const [password, setPassword] = useState('');
  const [rawKeyBase64, setRawKeyBase64] = useState('');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');

  // Text state
  const [plainText, setPlainText] = useState('');
  const [cipherText, setCipherText] = useState('');
  const [decryptedText, setDecryptedText] = useState('');
  const [textError, setTextError] = useState('');
  const [isProcessingText, setIsProcessingText] = useState(false);

  // File state
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
  const [fileError, setFileError] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const aesVaultKeys = vault.keys.filter((k) => k.type === 'aes-gcm');

  // Sync selected key from vault
  useEffect(() => {
    if (selectedKey && selectedKey.key.type === 'aes-gcm') {
      setAction(selectedKey.action);
      setKeyInputType('vault');
      setSelectedVaultKeyId(selectedKey.key.id);
      if (selectedKey.key.rawKeyBase64) {
        setRawKeyBase64(selectedKey.key.rawKeyBase64);
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
    const requiredBytes = aesKeyLength / 8;
    if (type === 'password') {
      if (!pass.trim()) throw new Error('パスワードを入力してください');
      const encoder = new TextEncoder();
      const passBuf = encoder.encode(pass.trim());
      const hash = await crypto.subtle.digest('SHA-256', passBuf);
      return new Uint8Array(hash.slice(0, requiredBytes));
    } else if (type === 'raw') {
      if (!rawB64.trim()) throw new Error('Base64 共通鍵を入力してください');
      const buf = new Uint8Array(base64ToBuffer(rawB64.trim()));
      if (buf.length !== requiredBytes) {
        // If provided key length doesn't match selected, slice or pad appropriately
        if (buf.length > requiredBytes) return buf.slice(0, requiredBytes);
        throw new Error(`指定の鍵長 (${aesKeyLength} bit / ${requiredBytes} バイト) に対し、入力された鍵は ${buf.length} バイトです`);
      }
      return buf;
    } else {
      const vk = aesVaultKeys.find((k) => k.id === vaultKeyId);
      if (!vk || !vk.rawKeyBase64) throw new Error('保管庫から有効なAESキーを選択してください');
      const buf = new Uint8Array(base64ToBuffer(vk.rawKeyBase64));
      return buf.slice(0, requiredBytes);
    }
  };

  const handleGenerateRawKey = () => {
    const raw = new Uint8Array(aesKeyLength / 8);
    crypto.getRandomValues(raw);
    const b64 = bufferToBase64(raw.buffer);
    setRawKeyBase64(b64);
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
      const encRes = await aesEncryptAdvanced(keyBuf.buffer as ArrayBuffer, plainBuf, aesMode);
      setCipherText(encRes.combinedBase64);
    } catch (err: any) {
      setTextError(err.message || '暗号化エラー');
    } finally {
      setIsProcessingText(false);
    }
  };

  // Text Decrypt
  const handleTextDecrypt = async () => {
    setTextError('');
    setDecryptedText('');
    if (!cipherText.trim()) {
      setTextError('復号する暗号文 Base64 を入力してください');
      return;
    }
    setIsProcessingText(true);
    try {
      const keyBuf = await getEffectiveKeyBuffer(keyInputType, password, rawKeyBase64, selectedVaultKeyId);
      const cipherBuf = base64ToBuffer(cipherText.trim());
      const decBuf = await aesDecryptAdvanced(keyBuf.buffer as ArrayBuffer, cipherBuf, aesMode);
      setDecryptedText(bufferToString(decBuf));
    } catch (err: any) {
      setTextError(`復号エラー: ${err.message}`);
    } finally {
      setIsProcessingText(false);
    }
  };

  // File Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        size: file.size,
        buffer: event.target?.result as ArrayBuffer,
      });
      setFileError('');
      setFileSuccess(null);
    };
    reader.readAsArrayBuffer(file);
  };

  // File Action
  const handleFileAction = async () => {
    setFileError('');
    setFileSuccess(null);
    if (!selectedFile) {
      setFileError('ファイルを選択してください');
      return;
    }

    setIsProcessingFile(true);
    try {
      if (action === 'encrypt') {
        let outBuffer: ArrayBuffer;
        const outFilename = `${selectedFile.name}.enc`;

        if (keyInputType === 'password') {
          if (!password.trim()) throw new Error('パスワードを入力してください');
          outBuffer = await encryptFileAesPassword(selectedFile.buffer, selectedFile.name, password.trim());
        } else {
          const keyBuf = await getEffectiveKeyBuffer(keyInputType, password, rawKeyBase64, selectedVaultKeyId);
          const rawKeyBuffer = keyBuf.buffer.slice(keyBuf.byteOffset, keyBuf.byteOffset + keyBuf.byteLength) as ArrayBuffer;
          outBuffer = await encryptFileAesRaw(selectedFile.buffer, selectedFile.name, rawKeyBuffer);
        }

        const blob = new Blob([outBuffer], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: outFilename,
          size: outBuffer.byteLength,
          downloadUrl,
        });
      } else {
        let decrypted: { filename: string; fileData: ArrayBuffer };
        const meta = detectEncryptedFileMetadata(selectedFile.buffer);

        if (meta?.mode === 'aes-raw' || keyInputType === 'raw' || keyInputType === 'vault') {
          const keyBuf = await getEffectiveKeyBuffer(keyInputType, password, rawKeyBase64, selectedVaultKeyId);
          const rawKeyBuffer = keyBuf.buffer.slice(keyBuf.byteOffset, keyBuf.byteOffset + keyBuf.byteLength) as ArrayBuffer;
          decrypted = await decryptFileAesRaw(selectedFile.buffer, rawKeyBuffer);
        } else {
          if (!password.trim()) throw new Error('パスワードを入力してください');
          decrypted = await decryptFileAesPassword(selectedFile.buffer, password.trim());
        }

        const blob = new Blob([decrypted.fileData], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: decrypted.filename,
          size: decrypted.fileData.byteLength,
          downloadUrl,
        });
      }
    } catch (err: any) {
      setFileError(`ファイル処理エラー: ${err.message}`);
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
              <h2 className="text-lg font-bold text-slate-100">AES 暗号化スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                {aesMode} ({aesKeyLength}bit)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              NIST FIPS 197 / SP 800-38 準拠の全AES規格（GCM / CBC / CTR 及び 128/192/256bit 鍵長）に対応
            </p>
          </div>
        </div>

        {/* Operation & Target Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Toggle */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAction('encrypt');
                setTextError('');
                setFileError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                action === 'encrypt'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>暗号化</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('decrypt');
                setTextError('');
                setFileError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                action === 'decrypt'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>復号</span>
            </button>
          </div>

          {/* Target Toggle */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTargetType('text');
                setTextError('');
                setFileError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                targetType === 'text'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>テキスト</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetType('file');
                setTextError('');
                setFileError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                targetType === 'file'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileLock className="w-3.5 h-3.5" />
              <span>ファイル</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode & Specification Selection (GCM, CBC, CTR / 128, 192, 256) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-200 flex items-center justify-between mb-1.5">
            <span>暗号化規格・動作モード (AES Mode)</span>
            <span className="text-[10px] text-slate-400 font-mono">NIST SP 800-38</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setAesMode('AES-GCM')}
              className={`py-1.5 px-2 rounded text-center transition-colors ${
                aesMode === 'AES-GCM'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Galois/Counter Mode: 認証タグ(AEAD)により完全性と機密性を同時保証"
            >
              GCM (AEAD)
            </button>
            <button
              type="button"
              onClick={() => setAesMode('AES-CBC')}
              className={`py-1.5 px-2 rounded text-center transition-colors ${
                aesMode === 'AES-CBC'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cipher Block Chaining: 暗号ブロック連鎖 + PKCS#7パディング"
            >
              CBC (PKCS#7)
            </button>
            <button
              type="button"
              onClick={() => setAesMode('AES-CTR')}
              className={`py-1.5 px-2 rounded text-center transition-colors ${
                aesMode === 'AES-CTR'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Counter Mode: カウンタ値の暗号化によるストリーム型ブロック暗号"
            >
              CTR (カウンタ)
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-200 flex items-center justify-between mb-1.5">
            <span>鍵長規格 (Key Length)</span>
            <span className="text-[10px] text-slate-400 font-mono">FIPS 197</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setAesKeyLength(256);
                if (keyInputType === 'raw') handleGenerateRawKey();
              }}
              className={`py-1.5 px-2 rounded text-center transition-colors ${
                aesKeyLength === 256
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              256 bit (最高強度)
            </button>
            <button
              type="button"
              onClick={() => {
                setAesKeyLength(192);
                if (keyInputType === 'raw') handleGenerateRawKey();
              }}
              className={`py-1.5 px-2 rounded text-center transition-colors ${
                aesKeyLength === 192
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              192 bit (標準)
            </button>
            <button
              type="button"
              onClick={() => {
                setAesKeyLength(128);
                if (keyInputType === 'raw') handleGenerateRawKey();
              }}
              className={`py-1.5 px-2 rounded text-center transition-colors ${
                aesKeyLength === 128
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              128 bit (軽量)
            </button>
          </div>
        </div>
      </div>

      {/* Key Selection */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>共通鍵の指定方法</span>
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
              パスワード
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
              Base64 生鍵
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
              保管庫
            </button>
          </div>
        </div>

        {keyInputType === 'password' && (
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
            />
            <FileLoaderButton
              label="鍵ファイル読込"
              onFileLoaded={(content) => setPassword(content.trim())}
              title="パスワードや秘密鍵ファイルを指定"
            />
          </div>
        )}

        {keyInputType === 'raw' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={rawKeyBase64}
              onChange={(e) => setRawKeyBase64(e.target.value)}
              placeholder="32バイトのBase64鍵を入力"
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
            <FileLoaderButton
              label="鍵ファイル読込"
              mode="base64"
              onFileLoaded={(content) => setRawKeyBase64(content)}
              title="32バイト共通鍵バイナリまたはBase64ファイルを指定"
            />
            <button
              type="button"
              onClick={handleGenerateRawKey}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium border border-slate-700 shrink-0"
            >
              新規生成
            </button>
          </div>
        )}

        {keyInputType === 'vault' && (
          <div>
            {aesVaultKeys.length === 0 ? (
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                鍵保管庫に登録された AES-GCM 共通鍵がありません
              </div>
            ) : (
              <select
                value={selectedVaultKeyId}
                onChange={(e) => {
                  setSelectedVaultKeyId(e.target.value);
                  const k = aesVaultKeys.find((item) => item.id === e.target.value);
                  if (k?.rawKeyBase64) setRawKeyBase64(k.rawKeyBase64);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">保管庫のキーを選択</option>
                {aesVaultKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* TEXT MODE */}
      {targetType === 'text' && (
        <div className="space-y-5">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                {action === 'encrypt' ? '暗号化する平文' : '復号する暗号文 Base64'}
              </label>
              <FileLoaderButton
                label="ファイルから読込"
                onFileLoaded={(content) => {
                  if (action === 'encrypt') setPlainText(content);
                  else setCipherText(content);
                }}
              />
            </div>
            <textarea
              value={action === 'encrypt' ? plainText : cipherText}
              onChange={(e) => {
                if (action === 'encrypt') setPlainText(e.target.value);
                else setCipherText(e.target.value);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  const txt = await f.text();
                  if (action === 'encrypt') setPlainText(txt);
                  else setCipherText(txt);
                }
              }}
              rows={4}
              placeholder={action === 'encrypt' ? 'テキストを入力' : 'Base64 暗号文を貼り付け'}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {textError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium">{textError}</div>
            </div>
          )}

          <button
            type="button"
            onClick={action === 'encrypt' ? handleTextEncrypt : handleTextDecrypt}
            disabled={isProcessingText || (action === 'encrypt' ? !plainText.trim() : !cipherText.trim())}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {action === 'encrypt' ? (
              <>
                <Lock className="w-4 h-4" />
                <span>暗号化を実行</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>復号を実行</span>
              </>
            )}
          </button>

          {action === 'encrypt' && cipherText && (
            <div className="bg-slate-900/70 border border-indigo-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  暗号化結果 Base64
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(cipherText, 'cipher')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  {copiedId === 'cipher' ? (
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
                value={cipherText}
                rows={4}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 text-xs font-mono select-all focus:outline-none"
              />
            </div>
          )}

          {action === 'decrypt' && decryptedText && (
            <div className="bg-slate-900/70 border border-indigo-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  復号テキスト
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(decryptedText, 'plain')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  {copiedId === 'plain' ? (
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
                value={decryptedText}
                rows={4}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono select-all focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* FILE MODE */}
      {targetType === 'file' && (
        <div className="space-y-5">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <label className="text-xs font-bold text-slate-300">
              {action === 'encrypt' ? '暗号化するファイル' : '復号する暗号化ファイル'}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors"
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

          {fileError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium">{fileError}</div>
            </div>
          )}

          <button
            type="button"
            disabled={isProcessingFile || !selectedFile}
            onClick={handleFileAction}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {action === 'encrypt' ? (
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

          {fileSuccess && (
            <div className="bg-indigo-950/20 border border-indigo-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>{action === 'encrypt' ? 'ファイル暗号化完了' : 'ファイル復号完了'}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                <div>
                  <div className="text-xs font-mono font-bold text-slate-200">{fileSuccess.filename}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{fileSuccess.size.toLocaleString()} bytes</div>
                </div>
                <a
                  href={fileSuccess.downloadUrl}
                  download={fileSuccess.filename}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
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
  );
};
