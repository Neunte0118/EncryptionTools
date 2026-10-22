import React, { useState, useEffect, useRef } from 'react';
import {
  rsaEncrypt,
  rsaDecrypt,
  stringToBuffer,
  bufferToString,
  base64ToBuffer,
  bufferToBase64,
  encryptFileHybrid,
  decryptFileHybrid,
  HashAlgorithm,
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
  Eye,
  EyeOff,
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

export const RsaTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
}) => {
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [targetType, setTargetType] = useState<'text' | 'file'>('text');

  // Key state
  const [hashAlgo, setHashAlgo] = useState<HashAlgorithm>('SHA-256');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');
  const [publicKeyPem, setPublicKeyPem] = useState('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [isPrivRevealed, setIsPrivRevealed] = useState(false);

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

  const rsaVaultKeys = vault.keys.filter((k) => k.type === 'rsa-oaep');

  // Sync selected key from vault
  useEffect(() => {
    if (selectedKey && selectedKey.key.type === 'rsa-oaep') {
      setAction(selectedKey.action);
      setSelectedVaultKeyId(selectedKey.key.id);
      if (selectedKey.key.publicKeyPem) {
        setPublicKeyPem(selectedKey.key.publicKeyPem);
      }
      if (selectedKey.key.privateKeyPem) {
        setPrivateKeyPem(selectedKey.key.privateKeyPem);
      }
      onClearSelectedKey?.();
    }
  }, [selectedKey, onClearSelectedKey]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Text Encrypt
  const handleTextEncrypt = async () => {
    setTextError('');
    setCipherText('');
    if (!publicKeyPem.trim()) {
      setTextError('暗号化に使用するRSA公開鍵 PEM を指定してください');
      return;
    }
    if (!plainText.trim()) {
      setTextError('暗号化するテキストを入力してください');
      return;
    }

    setIsProcessingText(true);
    try {
      const plainBuf = stringToBuffer(plainText);
      const encRes = await rsaEncrypt(publicKeyPem.trim(), hashAlgo, plainBuf);
      setCipherText(encRes.base64);
    } catch (err: any) {
      setTextError(err.message || 'RSA暗号化エラー');
    } finally {
      setIsProcessingText(false);
    }
  };

  // Text Decrypt
  const handleTextDecrypt = async () => {
    setTextError('');
    setDecryptedText('');
    if (!privateKeyPem.trim()) {
      setTextError('復号に使用するRSA秘密鍵 PEM を指定してください');
      return;
    }
    if (!cipherText.trim()) {
      setTextError('復号する暗号文 Base64 を入力してください');
      return;
    }

    setIsProcessingText(true);
    try {
      const cipherBuf = base64ToBuffer(cipherText.trim());
      const decBuf = await rsaDecrypt(privateKeyPem.trim(), hashAlgo, cipherBuf);
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
        if (!publicKeyPem.trim()) {
          throw new Error('暗号化に使用するRSA公開鍵 PEM を指定してください');
        }
        const outBuffer = await encryptFileHybrid(
          selectedFile.buffer,
          selectedFile.name,
          publicKeyPem.trim(),
          hashAlgo
        );
        const outFilename = `${selectedFile.name}.rsa.enc`;
        const blob = new Blob([outBuffer], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: outFilename,
          size: outBuffer.byteLength,
          downloadUrl,
        });
      } else {
        if (!privateKeyPem.trim()) {
          throw new Error('復号に使用するRSA秘密鍵 PEM を指定してください');
        }
        const decrypted = await decryptFileHybrid(
          selectedFile.buffer,
          privateKeyPem.trim(),
          hashAlgo
        );
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
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">RSA-OAEP</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 font-mono font-medium">
                PKCS#1 v2.2
              </span>
            </div>
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
                  ? 'bg-purple-600 text-white shadow-sm'
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
                  ? 'bg-purple-600 text-white shadow-sm'
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
                  ? 'bg-purple-600 text-white shadow-sm'
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
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileLock className="w-3.5 h-3.5" />
              <span>ファイル</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key & Hash Config */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-purple-400" />
            <span>鍵とハッシュの設定</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">ハッシュ:</span>
            <select
              value={hashAlgo}
              onChange={(e) => setHashAlgo(e.target.value as HashAlgorithm)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
            >
              <option value="SHA-256">SHA-256</option>
              <option value="SHA-384">SHA-384</option>
              <option value="SHA-512">SHA-512</option>
              <option value="SHA-1">SHA-1</option>
            </select>
          </div>
        </div>

        {rsaVaultKeys.length > 0 && (
          <div>
            <select
              value={selectedVaultKeyId}
              onChange={(e) => {
                setSelectedVaultKeyId(e.target.value);
                const k = rsaVaultKeys.find((item) => item.id === e.target.value);
                if (k?.publicKeyPem) setPublicKeyPem(k.publicKeyPem);
                if (k?.privateKeyPem) setPrivateKeyPem(k.privateKeyPem);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="">保管庫の RSA キーを選択</option>
              {rsaVaultKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {action === 'encrypt' ? (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] text-slate-400">受取人のRSA公開鍵 PEM</label>
              <FileLoaderButton
                label="公開鍵読込"
                onFileLoaded={(content) => setPublicKeyPem(content)}
                title="RSA公開鍵ファイル (.pem, .pub, .crt) を選択またはドロップ"
              />
            </div>
            <textarea
              value={publicKeyPem}
              onChange={(e) => setPublicKeyPem(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setPublicKeyPem(await f.text());
              }}
              rows={3}
              placeholder="-----BEGIN PUBLIC KEY-----"
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] text-slate-400">復号用のRSA秘密鍵 PEM</label>
              <div className="flex items-center gap-2">
                <FileLoaderButton
                  label="秘密鍵読込"
                  onFileLoaded={(content) => setPrivateKeyPem(content)}
                  title="RSA秘密鍵ファイル (.pem, .key) を選択またはドロップ"
                />
                <button
                  type="button"
                  onClick={() => setIsPrivRevealed(!isPrivRevealed)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  {isPrivRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{isPrivRevealed ? '伏せる' : '表示'}</span>
                </button>
              </div>
            </div>
            <textarea
              value={privateKeyPem}
              onChange={(e) => setPrivateKeyPem(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setPrivateKeyPem(await f.text());
              }}
              rows={3}
              placeholder="-----BEGIN PRIVATE KEY-----"
              className={`w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 ${
                !isPrivRevealed ? 'filter blur-[3px]' : ''
              }`}
            />
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
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-purple-500 font-mono"
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
            disabled={
              isProcessingText ||
              (action === 'encrypt' ? !plainText.trim() || !publicKeyPem.trim() : !cipherText.trim() || !privateKeyPem.trim())
            }
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="bg-slate-900/70 border border-purple-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  暗号化結果 Base64
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(cipherText, 'rsa-cipher')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  {copiedId === 'rsa-cipher' ? (
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
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-purple-300 text-xs font-mono select-all focus:outline-none"
              />
            </div>
          )}

          {action === 'decrypt' && decryptedText && (
            <div className="bg-slate-900/70 border border-purple-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  復号テキスト
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(decryptedText, 'rsa-plain')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  {copiedId === 'rsa-plain' ? (
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
              className="border-2 border-dashed border-slate-800 hover:border-purple-500/50 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors"
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
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="bg-purple-950/20 border border-purple-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
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
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
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
