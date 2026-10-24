import React, { useState, useRef } from 'react';
import {
  chacha20EncryptWithPassword,
  chacha20DecryptWithPassword,
  chacha20EncryptFile,
  chacha20DecryptFile,
  ChaChaVariant,
} from '../utils/chachaUtils';
import { FileLoaderButton } from './FileLoaderButton';
import {
  Lock,
  Unlock,
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

export const ChaCha20Tool: React.FC = () => {
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [targetType, setTargetType] = useState<'text' | 'file'>('text');
  const [variant, setVariant] = useState<ChaChaVariant>('chacha20-poly1305');

  // Text State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
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

    if (!password.trim()) {
      setError('暗号化パスワードを入力してください');
      return;
    }

    setIsProcessing(true);
    try {
      if (action === 'encrypt') {
        if (!plainText.trim()) {
          throw new Error('暗号化するテキストを入力してください');
        }
        const res = await chacha20EncryptWithPassword(plainText, password.trim(), variant);
        setCipherText(res.combinedBase64);
      } else {
        if (!cipherText.trim()) {
          throw new Error('復号する暗号文 Base64 を入力してください');
        }
        const res = await chacha20DecryptWithPassword(cipherText.trim(), password.trim(), variant);
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
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">ChaCha20 / Salsa20 暗号化スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono font-medium">
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
                  ? 'bg-emerald-600 text-white shadow-sm'
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
                  ? 'bg-emerald-600 text-white shadow-sm'
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
                  ? 'bg-emerald-600 text-white shadow-sm'
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
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileLock className="w-3.5 h-3.5" />
              <span>ファイル</span>
            </button>
          </div>
        </div>
      </div>

      {/* Variant Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
        <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
          <span>暗号規格ファミリー (Cipher Specification)</span>
          <span className="text-[10px] text-slate-400 font-mono">RFC 8439 / libsodium</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setVariant('chacha20-poly1305')}
            className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
              variant === 'chacha20-poly1305'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-slate-100">ChaCha20-Poly1305</div>
            <div className="text-[10px] text-slate-400 mt-0.5">IETF RFC 8439 (96bit Nonce)</div>
          </button>

          <button
            type="button"
            onClick={() => setVariant('xchacha20-poly1305')}
            className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
              variant === 'xchacha20-poly1305'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-slate-100">XChaCha20-Poly1305</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Extended 192bit Nonce (衝突耐性)</div>
          </button>

          <button
            type="button"
            onClick={() => setVariant('chacha20-raw')}
            className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
              variant === 'chacha20-raw'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-slate-100">ChaCha20 (Raw)</div>
            <div className="text-[10px] text-slate-400 mt-0.5">MACなし純粋ストリーム暗号</div>
          </button>

          <button
            type="button"
            onClick={() => setVariant('xsalsa20-poly1305')}
            className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
              variant === 'xsalsa20-poly1305'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-slate-100">XSalsa20-Poly1305</div>
            <div className="text-[10px] text-slate-400 mt-0.5">NaCl / libsodium secretbox互換</div>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      {/* TEXT MODE */}
      {targetType === 'text' && (
        <form onSubmit={handleTextAction} className="space-y-5">
          {/* Key Input */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                パスワード
              </label>
              <FileLoaderButton
                label="鍵ファイル読込"
                onFileLoaded={(content) => setPassword(content.trim())}
                title="パスワードや秘密文字列ファイルを読込"
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="暗号化または復号用のパスワードを入力"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Payload Input */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                {action === 'encrypt' ? '暗号化する平文' : '復号する暗号文 Base64'}
              </label>
              <div className="flex items-center gap-2">
                <FileLoaderButton
                  label="ファイルから読込"
                  onFileLoaded={(content) => {
                    if (action === 'encrypt') setPlainText(content);
                    else setCipherText(content);
                  }}
                />
                {action === 'decrypt' && cipherText && (
                  <button
                    type="button"
                    onClick={() => setCipherText('')}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    クリア
                  </button>
                )}
              </div>
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
              placeholder={action === 'encrypt' ? '暗号化したいテキストを入力' : 'Base64 暗号文を貼り付け'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

          {/* Text Result */}
          {action === 'encrypt' && cipherText && (
            <div className="bg-slate-900/70 border border-emerald-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  暗号化結果 Base64
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(cipherText, 'chacha-ct')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  {copiedKey === 'chacha-ct' ? (
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-emerald-300 font-mono select-all focus:outline-none"
              />
            </div>
          )}

          {action === 'decrypt' && decryptedText && (
            <div className="bg-slate-900/70 border border-emerald-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  復号テキスト
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(decryptedText, 'chacha-dec')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  {copiedKey === 'chacha-dec' ? (
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono select-all focus:outline-none"
              />
            </div>
          )}
        </form>
      )}

      {/* FILE MODE */}
      {targetType === 'file' && (
        <div className="space-y-5">
          {/* Key Input */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                パスワード
              </label>
              <FileLoaderButton
                label="鍵ファイル読込"
                onFileLoaded={(content) => setFilePassword(content.trim())}
                title="パスワードや秘密文字列ファイルを読込"
              />
            </div>
            <div className="relative">
              <input
                type={showFilePassword ? 'text' : 'password'}
                value={filePassword}
                onChange={(e) => setFilePassword(e.target.value)}
                placeholder="ファイル用のパスワードを入力"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowFilePassword(!showFilePassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                {showFilePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* File Picker */}
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
              className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors"
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
            disabled={isProcessing || !selectedFile}
            onClick={handleFileAction}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

          {/* File Result */}
          {fileSuccess && (
            <div className="bg-emerald-950/20 border border-emerald-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
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
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
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
