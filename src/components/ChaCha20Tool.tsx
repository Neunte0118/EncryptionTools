import React, { useState, useRef } from 'react';
import {
  chacha20EncryptWithPassword,
  chacha20DecryptWithPassword,
  chacha20EncryptWithRawKey,
  chacha20DecryptWithRawKey,
  chacha20EncryptFile,
  chacha20DecryptFile,
  ChaChaVariant,
} from '../utils/chachaUtils';
import {
  getChaChaLinuxCommand,
  getChaChaPowerShellScript,
} from '../utils/opensslInterop';
import { CrossPlatformCliPanel } from './CrossPlatformCliPanel';
import { FileLoaderButton } from './FileLoaderButton';
import { KeyVaultFile } from '../types/crypto';
import { base64ToBuffer, hexToBuffer } from '../utils/cryptoUtils';
import {
  Lock,
  Unlock,
  Key,
  Copy,
  Check,
  FileText,
  FileLock,
  Upload,
  Download,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  vault?: KeyVaultFile;
  onNavigateToKeyGenerator?: () => void;
}

export const ChaCha20Tool: React.FC<Props> = ({
  vault,
  onNavigateToKeyGenerator,
}) => {
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [targetType, setTargetType] = useState<'text' | 'file'>('text');
  const [variant, setVariant] = useState<ChaChaVariant>('chacha20-poly1305');

  // Key Mode
  const [keyInputType, setKeyInputType] = useState<'password' | 'raw' | 'vault'>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rawKeyInput, setRawKeyInput] = useState('');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');

  // Text State
  const [plainText, setPlainText] = useState('');
  const [cipherText, setCipherText] = useState('');
  const [decryptedText, setDecryptedText] = useState('');

  // File State
  const [filePassword, setFilePassword] = useState('');
  const [showFilePassword, setShowFilePassword] = useState(false);
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chachaVaultKeys = vault?.keys.filter((k) => k.type === 'chacha20') || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const getEffectiveRawKeyBytes = (): Uint8Array => {
    let keyStr = rawKeyInput.trim();
    if (keyInputType === 'vault') {
      const vk = chachaVaultKeys.find((k) => k.id === selectedVaultKeyId);
      if (!vk || !vk.rawKeyBase64) {
        throw new Error('保管庫からChaCha20キーを選択してください（「暗号鍵生成」ツールで生成できます）');
      }
      keyStr = vk.rawKeyBase64;
    }

    if (!keyStr) {
      throw new Error('共通鍵（Base64 または Hex 32バイト）を入力してください。「暗号鍵生成」ツールで生成できます');
    }

    // Try Base64 or Hex
    try {
      if (/^[0-9a-fA-F]{64}$/.test(keyStr)) {
        return new Uint8Array(hexToBuffer(keyStr));
      }
      const buf = new Uint8Array(base64ToBuffer(keyStr));
      if (buf.length === 32) return buf;
      throw new Error(`共通鍵は32バイト (256bit) である必要があります（入力長: ${buf.length} バイト）`);
    } catch (e: any) {
      throw new Error(`共通鍵のパースに失敗しました: ${e.message}`);
    }
  };

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
      setError('');
      setFileSuccess(null);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleTextAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setIsProcessing(true);
    try {
      if (action === 'encrypt') {
        if (!plainText.trim()) {
          throw new Error('暗号化するテキストを入力してください');
        }

        let res: { combinedBase64: string };
        if (keyInputType === 'password') {
          if (!password.trim()) throw new Error('暗号化パスワードを入力してください');
          res = await chacha20EncryptWithPassword(plainText, password.trim(), variant);
        } else {
          const rawKeyBytes = getEffectiveRawKeyBytes();
          res = await chacha20EncryptWithRawKey(plainText, rawKeyBytes, variant);
        }
        setCipherText(res.combinedBase64);
      } else {
        if (!cipherText.trim()) {
          throw new Error('復号する暗号文 Base64 を入力してください');
        }

        let res: { text?: string };
        if (keyInputType === 'password') {
          if (!password.trim()) throw new Error('復号パスワードを入力してください');
          res = await chacha20DecryptWithPassword(cipherText.trim(), password.trim(), variant);
        } else {
          const rawKeyBytes = getEffectiveRawKeyBytes();
          res = await chacha20DecryptWithRawKey(cipherText.trim(), rawKeyBytes, variant);
        }
        setDecryptedText(res.text ?? '');
      }
    } catch (err: any) {
      setError(err.message || '処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileAction = async () => {
    setError('');
    setFileSuccess(null);

    if (!selectedFile) {
      setError('ファイルを選択してください');
      return;
    }
    if (!filePassword.trim()) {
      setError('パスワードを入力してください');
      return;
    }

    setIsProcessing(true);
    try {
      if (action === 'encrypt') {
        const outBuffer = await chacha20EncryptFile(
          selectedFile.buffer,
          selectedFile.name,
          filePassword.trim(),
          variant
        );
        const outFilename = `${selectedFile.name}.chacha20`;
        const blob = new Blob([outBuffer], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: outFilename,
          size: outBuffer.byteLength,
          downloadUrl,
        });
      } else {
        const decrypted = await chacha20DecryptFile(
          selectedFile.buffer,
          filePassword.trim()
        );
        const blob = new Blob([decrypted.fileData], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: decrypted.fileName,
          size: decrypted.fileData.byteLength,
          downloadUrl,
        });
      }
    } catch (err: any) {
      setError(err.message || 'ファイル処理エラー');
    } finally {
      setIsProcessing(false);
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
              <h2 className="text-lg font-bold text-slate-100">ChaCha20 / Salsa20 暗号化スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                {variant.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ChaCha20-Poly1305 (RFC 8439), XChaCha20 (Extended Nonce), Raw ChaCha20, XSalsa20 規格に対応
            </p>
          </div>
        </div>

        {/* Operation & Target Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Toggle */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAction('encrypt');
                setError('');
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
                setError('');
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
                setError('');
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
                setError('');
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


      {/* Algorithm Variant Selection */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <label className="text-xs font-semibold text-slate-200 block">
          暗号化アルゴリズム種別 (ChaCha / Salsa 規格)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setVariant('chacha20-poly1305')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              variant === 'chacha20-poly1305'
                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 font-semibold shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-mono text-xs">ChaCha20-Poly1305</div>
            <div className="text-[10px] text-slate-400 mt-0.5">RFC 8439 (96-bit Nonce AEAD)</div>
          </button>
          <button
            type="button"
            onClick={() => setVariant('xchacha20-poly1305')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              variant === 'xchacha20-poly1305'
                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 font-semibold shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-mono text-xs">XChaCha20-Poly1305</div>
            <div className="text-[10px] text-slate-400 mt-0.5">192-bit Extended Nonce</div>
          </button>
          <button
            type="button"
            onClick={() => setVariant('chacha20-raw')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              variant === 'chacha20-raw'
                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 font-semibold shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-mono text-xs">ChaCha20 Raw</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Stream Cipher (MACなし)</div>
          </button>
          <button
            type="button"
            onClick={() => setVariant('xsalsa20-poly1305')}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              variant === 'xsalsa20-poly1305'
                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 font-semibold shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-mono text-xs">XSalsa20-Poly1305</div>
            <div className="text-[10px] text-slate-400 mt-0.5">NaCl crypto_secretbox</div>
          </button>
        </div>
      </div>

      {/* TEXT MODE */}
      {targetType === 'text' && (
        <form onSubmit={handleTextAction} className="space-y-5">
          {/* Key Input Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>共通鍵またはパスワードの指定</span>
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
                  256bit 生鍵
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
                  保管庫から選択
                </button>
              </div>
            </div>

            {keyInputType === 'password' && (
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="暗号化パスワードを入力"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {keyInputType === 'raw' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rawKeyInput}
                  onChange={(e) => setRawKeyInput(e.target.value)}
                  placeholder="32バイト(256bit)のBase64またはHex共通鍵を入力"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <FileLoaderButton
                  label="鍵読込"
                  mode="base64"
                  onFileLoaded={(content) => setRawKeyInput(content.trim())}
                  title="鍵ファイルを指定"
                />
                {onNavigateToKeyGenerator && (
                  <button
                    type="button"
                    onClick={onNavigateToKeyGenerator}
                    className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-500/40 flex items-center gap-1.5 shrink-0"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>「暗号鍵生成」で作成</span>
                  </button>
                )}
              </div>
            )}

            {keyInputType === 'vault' && (
              <div>
                {chachaVaultKeys.length === 0 ? (
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>保管庫に ChaCha20 キーが登録されていません</span>
                    {onNavigateToKeyGenerator && (
                      <button
                        type="button"
                        onClick={onNavigateToKeyGenerator}
                        className="text-indigo-400 hover:underline"
                      >
                        「暗号鍵生成」で生成する
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={selectedVaultKeyId}
                    onChange={(e) => setSelectedVaultKeyId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">保管庫のキーを選択</option>
                    {chachaVaultKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Text Input / Output */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                {action === 'encrypt' ? '暗号化する平文' : '復号する暗号文 Base64'}
              </label>
              <FileLoaderButton
                label="ファイル読込"
                onFileLoaded={(content) => {
                  if (action === 'encrypt') setPlainText(content);
                  else setCipherText(content);
                }}
              />
            </div>
            <textarea
              rows={4}
              value={action === 'encrypt' ? plainText : cipherText}
              onChange={(e) => {
                if (action === 'encrypt') setPlainText(e.target.value);
                else setCipherText(e.target.value);
              }}
              placeholder={
                action === 'encrypt'
                  ? '暗号化したいテキストを入力...'
                  : '復号したい暗号化Base64テキストを入力...'
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {action === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isProcessing ? '処理中...' : action === 'encrypt' ? '暗号化を実行' : '復号を実行'}</span>
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Section */}
          {((action === 'encrypt' && cipherText) || (action === 'decrypt' && decryptedText)) && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{action === 'encrypt' ? '暗号化結果 (Base64)' : '復号結果'}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(action === 'encrypt' ? cipherText : decryptedText, 'text-out')
                  }
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  {copiedKey === 'text-out' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'text-out' ? 'コピー完了' : 'コピー'}</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={4}
                value={action === 'encrypt' ? cipherText : decryptedText}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none select-all"
              />
            </div>
          )}
        </form>
      )}

      {/* FILE MODE */}
      {targetType === 'file' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200">
                パスワード
              </label>
              <div className="relative">
                <input
                  type={showFilePassword ? 'text' : 'password'}
                  value={filePassword}
                  onChange={(e) => setFilePassword(e.target.value)}
                  placeholder="ファイル保護パスワードを入力"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowFilePassword(!showFilePassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showFilePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200">
                対象ファイル
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950"
              >
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                {selectedFile ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{selectedFile.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-slate-300">ファイルを選択またはドラッグ＆ドロップ</div>
                    <div className="text-[11px] text-slate-500 mt-1">すべての形式に対応</div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleFileAction}
              disabled={isProcessing || !selectedFile}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {action === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isProcessing ? 'ファイル処理中...' : action === 'encrypt' ? 'ファイルを暗号化' : 'ファイルを復号'}</span>
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {fileSuccess && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
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
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ダウンロード</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Linux (OpenSSL CLI) & PowerShell Cross-Platform Compatibility Panel */}
      <CrossPlatformCliPanel
        title="Linux (OpenSSL) & Windows PowerShell ChaCha20 互換コマンド"
        defaultOpen={false}
        linuxCommand={getChaChaLinuxCommand({
          action,
          variant,
          filename: selectedFile?.name,
          isBase64: targetType === 'text',
        })}
        powerShellScript={getChaChaPowerShellScript({ action, variant }).nativePowerShell}
        powerShellCli={getChaChaPowerShellScript({ action, variant }).openSslCli}
        note="Linux (OpenSSL 1.1.1+ / 3.x) および Windows PowerShell (.NET Core 6+ / PS 7+) で ChaCha20-Poly1305 を直接復号・暗号化可能です。"
      />
    </div>
  );
};
