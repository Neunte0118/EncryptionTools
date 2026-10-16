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
  CheckCircle2,
  FileText,
  KeyRound,
  Shield,
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
  const [activeMode, setActiveMode] = useState<'text' | 'file'>('text');

  // --- Text State ---
  const [textAction, setTextAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [hashAlgo, setHashAlgo] = useState<HashAlgorithm>('SHA-256');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');
  const [publicKeyPem, setPublicKeyPem] = useState('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [isPrivRevealed, setIsPrivRevealed] = useState(false);
  const [plainText, setPlainText] = useState('');
  const [cipherText, setCipherText] = useState('');
  const [decryptedText, setDecryptedText] = useState('');
  const [textError, setTextError] = useState('');
  const [isProcessingText, setIsProcessingText] = useState(false);

  // --- File State ---
  const [fileAction, setFileAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [fileSelectedVaultKeyId, setFileSelectedVaultKeyId] = useState('');
  const [filePubKeyPem, setFilePubKeyPem] = useState('');
  const [filePrivKeyPem, setFilePrivKeyPem] = useState('');
  const [isFilePrivRevealed, setIsFilePrivRevealed] = useState(false);
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

  const rsaVaultKeys = vault.keys.filter((k) => k.type === 'rsa-oaep');

  // Sync selected key from vault
  useEffect(() => {
    if (selectedKey && selectedKey.key.type === 'rsa-oaep') {
      setTextAction(selectedKey.action);
      setFileAction(selectedKey.action);
      setSelectedVaultKeyId(selectedKey.key.id);
      setFileSelectedVaultKeyId(selectedKey.key.id);
      if (selectedKey.key.publicKeyPem) {
        setPublicKeyPem(selectedKey.key.publicKeyPem);
        setFilePubKeyPem(selectedKey.key.publicKeyPem);
      }
      if (selectedKey.key.privateKeyPem) {
        setPrivateKeyPem(selectedKey.key.privateKeyPem);
        setFilePrivKeyPem(selectedKey.key.privateKeyPem);
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
      setTextError('暗号化に使用するRSA公開鍵 (PEM) を指定してください');
      return;
    }
    if (!plainText.trim()) {
      setTextError('暗号化するテキストを入力してください');
      return;
    }

    setIsProcessingText(true);
    try {
      const plainBuf = stringToBuffer(plainText);
      const encRes = await rsaEncrypt(publicKeyPem.trim(), hashAlgo, (plainBuf as any).buffer || plainBuf);
      setCipherText(encRes.base64);
    } catch (err: any) {
      setTextError(`RSA暗号化エラー: ${err.message}`);
    } finally {
      setIsProcessingText(false);
    }
  };

  // Text Decrypt
  const handleTextDecrypt = async () => {
    setTextError('');
    setDecryptedText('');
    if (!privateKeyPem.trim()) {
      setTextError('復号に使用するRSA秘密鍵 (PEM) を指定してください');
      return;
    }
    if (!cipherText.trim()) {
      setTextError('復号する暗号文 (Base64) を入力してください');
      return;
    }

    setIsProcessingText(true);
    try {
      const cipherBuf = base64ToBuffer(cipherText.trim());
      const decBuf = await rsaDecrypt(privateKeyPem.trim(), hashAlgo, (cipherBuf as any).buffer || cipherBuf);
      setDecryptedText(bufferToString(decBuf as any));
    } catch (err: any) {
      setTextError(`RSA復号エラー: ${err.message} (秘密鍵が一致しないか暗号文が破損しています)`);
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
    if (!filePubKeyPem.trim()) {
      setFileError('受取人のRSA公開鍵 (PEM) を指定してください');
      return;
    }

    setIsProcessingFile(true);
    try {
      const outBuffer = await encryptFileHybrid(
        encFile.buffer,
        encFile.name,
        filePubKeyPem.trim(),
        hashAlgo
      );
      const outFilename = `${encFile.name}.enc`;
      const blob = new Blob([outBuffer], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      setFileSuccess({
        filename: outFilename,
        size: outBuffer.byteLength,
        downloadUrl,
        message: 'RSA-OAEP + AES-256-GCM ハイブリッド暗号化ファイルを作成しました。',
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
      setFileError('復号するファイル (.enc) を選択してください');
      return;
    }
    if (!filePrivKeyPem.trim()) {
      setFileError('復号用のRSA秘密鍵 (PEM) を指定してください');
      return;
    }

    setIsProcessingFile(true);
    try {
      const decrypted = await decryptFileHybrid(
        decFile.buffer,
        filePrivKeyPem.trim(),
        hashAlgo
      );
      const blob = new Blob([decrypted.fileData], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      setFileSuccess({
        filename: decrypted.filename,
        size: decrypted.fileData.byteLength,
        downloadUrl,
        message: 'RSAハイブリッド復号に成功しました。完全性が確認されました。',
      });
    } catch (err: any) {
      setFileError(`復号エラー: ${err.message} (秘密鍵が正しくないか暗号データが破損しています)`);
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
                PKCS#1 v2.2 OAEP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              公開鍵暗号標準。受取人の公開鍵で安全に暗号化し、秘密鍵所持者のみが復号
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
                ? 'bg-purple-600 text-white shadow-sm'
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
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileLock className="w-3.5 h-3.5" />
            <span>ファイル暗号化・復号</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Text RSA */}
      {activeMode === 'text' && (
        <div className="space-y-6">
          <div className="flex border-b border-slate-800 gap-4">
            <button
              type="button"
              onClick={() => setTextAction('encrypt')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                textAction === 'encrypt'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>公開鍵で暗号化</span>
            </button>
            <button
              type="button"
              onClick={() => setTextAction('decrypt')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                textAction === 'decrypt'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>秘密鍵で復号</span>
            </button>
          </div>

          {/* Key & Hash Config */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                <span>鍵とハッシュアルゴリズムの設定</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">ハッシュ:</span>
                <select
                  value={hashAlgo}
                  onChange={(e) => setHashAlgo(e.target.value as HashAlgorithm)}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="SHA-256">SHA-256 (推奨)</option>
                  <option value="SHA-384">SHA-384</option>
                  <option value="SHA-512">SHA-512</option>
                  <option value="SHA-1">SHA-1 (レガシー)</option>
                </select>
              </div>
            </div>

            {/* Vault Key Selector */}
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- 保管庫の RSA キーを自動入力 --</option>
                  {rsaVaultKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title} ({k.algorithmDetails.name} / {k.algorithmDetails.modulusLength || 2048}bit)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {textAction === 'encrypt' ? (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">受取人のRSA公開鍵 (PEM)</label>
                <textarea
                  value={publicKeyPem}
                  onChange={(e) => setPublicKeyPem(e.target.value)}
                  rows={4}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-400">復号用のRSA秘密鍵 (PEM)</label>
                  <button
                    type="button"
                    onClick={() => setIsPrivRevealed(!isPrivRevealed)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    {isPrivRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{isPrivRevealed ? '秘密鍵を伏せる' : '秘密鍵を表示'}</span>
                  </button>
                </div>
                <textarea
                  value={privateKeyPem}
                  onChange={(e) => setPrivateKeyPem(e.target.value)}
                  rows={4}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  className={`w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 ${
                    !isPrivRevealed ? 'filter blur-[3px] focus:filter-none transition-all' : ''
                  }`}
                />
              </div>
            )}
          </div>

          {/* Text Inputs & Action */}
          {textAction === 'encrypt' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">平文テキスト</label>
                <textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  rows={4}
                  placeholder="暗号化するテキストを入力..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-purple-500 font-sans"
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
                disabled={isProcessingText || !plainText.trim() || !publicKeyPem.trim()}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Lock className="w-4 h-4" />
                <span>RSA-OAEP で暗号化</span>
              </button>

              {cipherText && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      暗号化完了 (Base64)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(cipherText, 'cipher')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] flex items-center gap-1"
                    >
                      {copiedId === 'cipher' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === 'cipher' ? 'コピー完了' : 'コピー'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={cipherText}
                    rows={4}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-purple-300 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">暗号文 (Base64)</label>
                <textarea
                  value={cipherText}
                  onChange={(e) => setCipherText(e.target.value)}
                  rows={4}
                  placeholder="復号する暗号文を入力..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-purple-500 font-mono"
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
                disabled={isProcessingText || !cipherText.trim() || !privateKeyPem.trim()}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                <span>RSA-OAEP で復号</span>
              </button>

              {decryptedText && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      復号完了
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(decryptedText, 'plain')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] flex items-center gap-1"
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

      {/* Mode 2: File RSA (Hybrid RSA-OAEP + AES-GCM) */}
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
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>ファイル暗号化 (ハイブリッド .enc 作成)</span>
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
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>ファイル復号 (秘密鍵で解除)</span>
            </button>
          </div>

          {/* Key Selection for File */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                <span>ハイブリッド暗号化の鍵指定</span>
              </label>
              {rsaVaultKeys.length > 0 && (
                <select
                  value={fileSelectedVaultKeyId}
                  onChange={(e) => {
                    setFileSelectedVaultKeyId(e.target.value);
                    const k = rsaVaultKeys.find((item) => item.id === e.target.value);
                    if (k?.publicKeyPem) setFilePubKeyPem(k.publicKeyPem);
                    if (k?.privateKeyPem) setFilePrivKeyPem(k.privateKeyPem);
                  }}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- 保管庫の RSA キーを選択 --</option>
                  {rsaVaultKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title} ({k.algorithmDetails.name} / {k.algorithmDetails.modulusLength || 2048}bit)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {fileAction === 'encrypt' ? (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">受取人のRSA公開鍵 (PEM)</label>
                <textarea
                  value={filePubKeyPem}
                  onChange={(e) => setFilePubKeyPem(e.target.value)}
                  rows={4}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-400">復号用のRSA秘密鍵 (PEM)</label>
                  <button
                    type="button"
                    onClick={() => setIsFilePrivRevealed(!isFilePrivRevealed)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    {isFilePrivRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{isFilePrivRevealed ? '秘密鍵を伏せる' : '秘密鍵を表示'}</span>
                  </button>
                </div>
                <textarea
                  value={filePrivKeyPem}
                  onChange={(e) => setFilePrivKeyPem(e.target.value)}
                  rows={4}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  className={`w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 ${
                    !isFilePrivRevealed ? 'filter blur-[3px] focus:filter-none transition-all' : ''
                  }`}
                />
              </div>
            )}
          </div>

          {/* File Upload and Run */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            {fileAction === 'encrypt' ? (
              <div className="space-y-4">
                <div
                  onClick={() => encFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40"
                >
                  <input
                    ref={encFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleEncFileChange}
                  />
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
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
                  disabled={isProcessingFile || !encFile || !filePubKeyPem.trim()}
                  className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <Lock className="w-4 h-4" />
                  <span>ハイブリッド暗号化ファイル (.enc) を作成</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onClick={() => decFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40"
                >
                  <input
                    ref={decFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleDecFileChange}
                  />
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
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
                  disabled={isProcessingFile || !decFile || !filePrivKeyPem.trim()}
                  className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <Unlock className="w-4 h-4" />
                  <span>RSA秘密鍵でハイブリッド復号</span>
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
