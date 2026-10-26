import React, { useState, useRef } from 'react';
import {
  encryptPgpMessage,
  decryptPgpMessage,
  encryptPgpFile,
  decryptPgpFile,
} from '../utils/pgpUtils';
import { KeyVaultFile } from '../types/crypto';
import { FileLoaderButton } from './FileLoaderButton';
import {
  Shield,
  Key,
  Lock,
  Unlock,
  Copy,
  Check,
  Download,
  AlertCircle,
  FileText,
  FileLock,
  Upload,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  vault?: KeyVaultFile;
  onNavigateToKeyGenerator?: () => void;
}

export const PgpStudioTool: React.FC<Props> = ({
  vault,
  onNavigateToKeyGenerator,
}) => {
  // Operation & Target
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [targetType, setTargetType] = useState<'text' | 'file'>('text');

  // Encrypt inputs
  const [encPlaintext, setEncPlaintext] = useState('');
  const [encPubKeyArmored, setEncPubKeyArmored] = useState('');
  const [encPassphrase, setEncPassphrase] = useState('');
  const [encResultArmored, setEncResultArmored] = useState('');

  // Decrypt inputs
  const [decCiphertextArmored, setDecCiphertextArmored] = useState('');
  const [decPrivKeyArmored, setDecPrivKeyArmored] = useState('');
  const [decPassphrase, setDecPassphrase] = useState('');
  const [showDecPassphrase, setShowDecPassphrase] = useState(false);
  const [decResultText, setDecResultText] = useState('');

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cryptoError, setCryptoError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');

  const pgpVaultKeys = vault?.keys.filter((k) => k.type === 'pgp') || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadText = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleTextAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setCryptoError('');

    setIsProcessing(true);
    try {
      if (action === 'encrypt') {
        if (!encPlaintext.trim()) {
          throw new Error('暗号化する平文を入力してください');
        }
        if (!encPubKeyArmored.trim() && !encPassphrase.trim()) {
          throw new Error('受取人の公開鍵または共通パスフレーズを指定してください');
        }
        const armored = await encryptPgpMessage({
          plaintext: encPlaintext.trim(),
          publicKeyArmored: encPubKeyArmored.trim() || undefined,
          passphrase: encPassphrase.trim() || undefined,
        });
        setEncResultArmored(armored);
      } else {
        if (!decCiphertextArmored.trim()) {
          throw new Error('復号する暗号化PGPメッセージを入力してください');
        }
        if (!decPrivKeyArmored.trim() && !decPassphrase.trim()) {
          throw new Error('秘密鍵またはパスフレーズを指定してください');
        }
        const decrypted = await decryptPgpMessage({
          armoredCiphertext: decCiphertextArmored.trim(),
          privateKeyArmored: decPrivKeyArmored.trim() || undefined,
          passphrase: decPassphrase.trim() || undefined,
        });
        setDecResultText(decrypted.data);
      }
    } catch (err: any) {
      setCryptoError(err.message || 'PGP処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
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
      setCryptoError('');
      setFileSuccess(null);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileAction = async () => {
    setCryptoError('');
    setFileSuccess(null);

    if (!selectedFile) {
      setCryptoError('処理するファイルを選択してください');
      return;
    }

    setIsProcessing(true);
    try {
      if (action === 'encrypt') {
        if (!encPubKeyArmored.trim() && !encPassphrase.trim()) {
          throw new Error('受取人の公開鍵またはパスフレーズを指定してください');
        }
        const outArmored = await encryptPgpFile({
          fileData: selectedFile.buffer,
          fileName: selectedFile.name,
          publicKeyArmored: encPubKeyArmored.trim() || undefined,
          passphrase: encPassphrase.trim() || undefined,
        });

        const outFilename = `${selectedFile.name}.asc`;
        const blob = new Blob([outArmored], { type: 'application/pgp-encrypted' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: outFilename,
          size: blob.size,
          downloadUrl,
        });
      } else {
        if (!decPrivKeyArmored.trim() && !decPassphrase.trim()) {
          throw new Error('復号用の秘密鍵またはパスフレーズを指定してください');
        }
        const decrypted = await decryptPgpFile({
          armoredOrBinary: selectedFile.buffer,
          privateKeyArmored: decPrivKeyArmored.trim() || undefined,
          passphrase: decPassphrase.trim() || undefined,
        });

        const blob = new Blob([decrypted.fileData], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: decrypted.fileName,
          size: decrypted.fileData.byteLength,
          downloadUrl,
        });
      }
    } catch (err: any) {
      setCryptoError(err.message || 'ファイル処理エラー');
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
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">OpenPGP 暗号化スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                RFC 4880 / GnuPG 互換
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              OpenPGP規格準拠のメッセージ・ファイル暗号化および復号
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
                setCryptoError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                action === 'encrypt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>暗号化</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('decrypt');
                setCryptoError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                action === 'decrypt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
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
                setCryptoError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                targetType === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>テキスト</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetType('file');
                setCryptoError('');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                targetType === 'file' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileLock className="w-3.5 h-3.5" />
              <span>ファイル</span>
            </button>
          </div>
        </div>
      </div>


      {/* Key Input Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>{action === 'encrypt' ? '受取人の公開鍵またはパスフレーズ' : '復号用秘密鍵またはパスフレーズ'}</span>
          </label>
          {onNavigateToKeyGenerator && (
            <button
              type="button"
              onClick={onNavigateToKeyGenerator}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <Key className="w-3.5 h-3.5" />
              <span>「暗号鍵生成」でOpenPGP鍵を生成</span>
            </button>
          )}
        </div>

        {pgpVaultKeys.length > 0 && (
          <div>
            <select
              value={selectedVaultKeyId}
              onChange={(e) => {
                setSelectedVaultKeyId(e.target.value);
                const k = pgpVaultKeys.find((item) => item.id === e.target.value);
                if (k?.publicKeyPem) setEncPubKeyArmored(k.publicKeyPem);
                if (k?.privateKeyPem) setDecPrivKeyArmored(k.privateKeyPem);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- 保管庫の OpenPGP キーから選択 --</option>
              {pgpVaultKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {action === 'encrypt' ? (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-slate-400 font-semibold">受取人のPGP公開鍵 (ASCII Armored)</label>
                <FileLoaderButton
                  label="公開鍵読込"
                  onFileLoaded={(content) => setEncPubKeyArmored(content)}
                  title="公開鍵ファイル (.asc, .pub) を指定"
                />
              </div>
              <textarea
                value={encPubKeyArmored}
                onChange={(e) => setEncPubKeyArmored(e.target.value)}
                rows={3}
                placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={encPassphrase}
                onChange={(e) => setEncPassphrase(e.target.value)}
                placeholder="パスフレーズのみで対称暗号化する場合はここに入力"
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
              <FileLoaderButton
                label="パス読込"
                onFileLoaded={(content) => setEncPassphrase(content.trim())}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-slate-400 font-semibold">復号用のPGP秘密鍵 (ASCII Armored)</label>
                <FileLoaderButton
                  label="秘密鍵読込"
                  onFileLoaded={(content) => setDecPrivKeyArmored(content)}
                  title="秘密鍵ファイル (.asc, .sec, .key) を指定"
                />
              </div>
              <textarea
                value={decPrivKeyArmored}
                onChange={(e) => setDecPrivKeyArmored(e.target.value)}
                rows={3}
                placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showDecPassphrase ? 'text' : 'password'}
                  value={decPassphrase}
                  onChange={(e) => setDecPassphrase(e.target.value)}
                  placeholder="秘密鍵のパスフレーズまたは共通暗号パスフレーズ"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowDecPassphrase(!showDecPassphrase)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showDecPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <FileLoaderButton
                label="パス読込"
                onFileLoaded={(content) => setDecPassphrase(content.trim())}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {cryptoError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{cryptoError}</span>
        </div>
      )}

      {/* TEXT MODE */}
      {targetType === 'text' && (
        <form onSubmit={handleTextAction} className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                {action === 'encrypt' ? '暗号化する平文' : '復号する暗号化PGPメッセージ'}
              </label>
              <FileLoaderButton
                label="ファイルから読込"
                onFileLoaded={(content) => {
                  if (action === 'encrypt') setEncPlaintext(content);
                  else setDecCiphertextArmored(content);
                }}
              />
            </div>
            <textarea
              rows={4}
              value={action === 'encrypt' ? encPlaintext : decCiphertextArmored}
              onChange={(e) => {
                if (action === 'encrypt') setEncPlaintext(e.target.value);
                else setDecCiphertextArmored(e.target.value);
              }}
              placeholder={
                action === 'encrypt'
                  ? '平文メッセージを入力...'
                  : '-----BEGIN PGP MESSAGE-----...'
              }
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {action === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isProcessing ? '処理中...' : action === 'encrypt' ? 'PGP暗号化を実行' : 'PGP復号を実行'}</span>
            </button>
          </div>

          {((action === 'encrypt' && encResultArmored) || (action === 'decrypt' && decResultText)) && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{action === 'encrypt' ? '暗号化結果 (PGP Armor)' : '復号結果 (平文)'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(action === 'encrypt' ? encResultArmored : decResultText, 'res')
                    }
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'res' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'res' ? 'コピー完了' : 'コピー'}</span>
                  </button>
                  {action === 'encrypt' && (
                    <button
                      type="button"
                      onClick={() => handleDownloadText(encResultArmored, 'message.pgp.asc')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>保存</span>
                    </button>
                  )}
                </div>
              </div>
              <textarea
                readOnly
                rows={6}
                value={action === 'encrypt' ? encResultArmored : decResultText}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 text-xs font-mono select-all focus:outline-none"
              />
            </div>
          )}
        </form>
      )}

      {/* FILE MODE */}
      {targetType === 'file' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
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
                <div className="text-[11px] text-slate-500 mt-1">OpenPGPバイナリ暗号化に対応</div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isProcessing || !selectedFile}
            onClick={handleFileAction}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {action === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{isProcessing ? '処理中...' : action === 'encrypt' ? 'ファイルを暗号化' : 'ファイルを復号'}</span>
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
    </div>
  );
};
