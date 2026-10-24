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
  onNavigateToKeyGenerator?: () => void;
}

export const RsaTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
  onNavigateToKeyGenerator,
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

  const rsaVaultKeys = vault.keys.filter(
    (k) => k.type === 'rsa-oaep' || k.type === 'rsa-pss' || k.type === 'rsa-pkcs1'
  );

  // Sync selected key from vault
  useEffect(() => {
    if (selectedKey && selectedKey.key.type.startsWith('rsa')) {
      setAction(selectedKey.action);
      setSelectedVaultKeyId(selectedKey.key.id);
      if (selectedKey.key.publicKeyPem) {
        setPublicKeyPem(selectedKey.key.publicKeyPem);
      }
      if (selectedKey.key.privateKeyPem) {
        setPrivateKeyPem(selectedKey.key.privateKeyPem);
      }
      if (selectedKey.key.algorithmDetails?.hash) {
        setHashAlgo(selectedKey.key.algorithmDetails.hash as HashAlgorithm);
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
      setTextError('暗号化に使用するRSA公開鍵 PEM を指定してください（「暗号鍵生成」ツールで生成可能）');
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
      setTextError('復号に使用するRSA秘密鍵 PEM を指定してください（「暗号鍵生成」ツールで生成可能）');
      return;
    }
    if (!cipherText.trim()) {
      setTextError('復号するBase64暗号文を入力してください');
      return;
    }

    setIsProcessingText(true);
    try {
      const cipherBuf = base64ToBuffer(cipherText.trim());
      const decBuf = await rsaDecrypt(privateKeyPem.trim(), hashAlgo, cipherBuf);
      setDecryptedText(bufferToString(decBuf));
    } catch (err: any) {
      setTextError(err.message || 'RSA復号エラー: 鍵または暗号文が一致しません');
    } finally {
      setIsProcessingText(false);
    }
  };

  // File Handlers
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
        const outFilename = `${selectedFile.name}.rsa`;
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
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">RSA-OAEP 暗号化スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                PKCS#1 v2.2 (OAEP-{hashAlgo})
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              NIST SP 800-56B 準拠 最適非対称暗号化パディング (OAEP) による公開鍵暗号化・ハイブリッドファイル暗号
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

      {/* Key & Hash Config */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>鍵とハッシュの設定</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">OAEP ハッシュ:</span>
            <select
              value={hashAlgo}
              onChange={(e) => setHashAlgo(e.target.value as HashAlgorithm)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="SHA-256">SHA-256 (標準)</option>
              <option value="SHA-384">SHA-384</option>
              <option value="SHA-512">SHA-512</option>
              <option value="SHA-1">SHA-1 (互換性用)</option>
            </select>
          </div>
        </div>

        {rsaVaultKeys.length > 0 ? (
          <div>
            <select
              value={selectedVaultKeyId}
              onChange={(e) => {
                setSelectedVaultKeyId(e.target.value);
                const k = rsaVaultKeys.find((item) => item.id === e.target.value);
                if (k?.publicKeyPem) setPublicKeyPem(k.publicKeyPem);
                if (k?.privateKeyPem) setPrivateKeyPem(k.privateKeyPem);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="">保管庫の RSA キーを選択</option>
              {rsaVaultKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>保管庫に RSA キーが登録されていません</span>
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
        )}

        {action === 'encrypt' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">公開鍵 SPKI PEM</label>
              <FileLoaderButton
                label="PEM読込"
                onFileLoaded={(content) => setPublicKeyPem(content.trim())}
              />
            </div>
            <textarea
              rows={3}
              value={publicKeyPem}
              onChange={(e) => setPublicKeyPem(e.target.value)}
              placeholder="-----BEGIN PUBLIC KEY-----..."
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">秘密鍵 PKCS#8 PEM</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPrivRevealed(!isPrivRevealed)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                >
                  {isPrivRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{isPrivRevealed ? '隠す' : '表示'}</span>
                </button>
                <FileLoaderButton
                  label="PEM読込"
                  onFileLoaded={(content) => setPrivateKeyPem(content.trim())}
                />
              </div>
            </div>
            <textarea
              rows={3}
              value={isPrivRevealed ? privateKeyPem : privateKeyPem.replace(/[^-]/g, '*')}
              onChange={(e) => setPrivateKeyPem(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----..."
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* TEXT MODE */}
      {targetType === 'text' && (
        <div className="space-y-5">
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
                  : '復号したいBase64暗号文を入力...'
              }
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />

            {textError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{textError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessingText}
              onClick={action === 'encrypt' ? handleTextEncrypt : handleTextDecrypt}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              {action === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isProcessingText ? '処理中...' : action === 'encrypt' ? '暗号化を実行' : '復号を実行'}</span>
            </button>
          </div>

          {action === 'encrypt' && cipherText && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>暗号化結果 (Base64)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(cipherText, 'cipher')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  {copiedId === 'cipher' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'cipher' ? 'コピー完了' : 'コピー'}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={cipherText}
                rows={4}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono select-all focus:outline-none"
              />
            </div>
          )}

          {action === 'decrypt' && decryptedText && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>復号結果 (平文)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(decryptedText, 'decrypted')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  {copiedId === 'decrypted' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'decrypted' ? 'コピー完了' : 'コピー'}</span>
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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <label className="text-xs font-semibold text-slate-200 block">
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
                  <div className="text-xs text-slate-300 font-medium">クリックしてファイルを選択</div>
                  <div className="text-[11px] text-slate-500 mt-1">ハイブリッド暗号化（AES-256 + RSA）により大容量ファイルにも対応</div>
                </div>
              )}
            </div>

            {fileError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessingFile || !selectedFile}
              onClick={handleFileAction}
              className="w-full py-2.5 rounded-lg font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {action === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isProcessingFile ? '処理中...' : action === 'encrypt' ? 'ファイルを暗号化' : 'ファイルを復号'}</span>
            </button>
          </div>

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
