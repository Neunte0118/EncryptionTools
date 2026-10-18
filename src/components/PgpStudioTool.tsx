import React, { useState, useRef } from 'react';
import {
  generatePgpKeyPair,
  encryptPgpMessage,
  decryptPgpMessage,
  encryptPgpFile,
  decryptPgpFile,
} from '../utils/pgpUtils';
import {
  Shield,
  Key,
  Lock,
  Unlock,
  Copy,
  Check,
  Download,
  AlertCircle,
  RefreshCw,
  FileText,
  FileLock,
  Upload,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

export const PgpStudioTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crypto' | 'keygen'>('crypto');

  // Unified Crypto State
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

  // Keygen state
  const [keyName, setKeyName] = useState('');
  const [keyEmail, setKeyEmail] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [keyType, setKeyType] = useState<'ecc' | 'rsa'>('ecc');
  const [rsaBits, setRsaBits] = useState<2048 | 4096>(2048);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<{
    publicKeyArmored: string;
    privateKeyArmored: string;
    keyID?: string;
    fingerprint?: string;
  } | null>(null);
  const [keygenError, setKeygenError] = useState('');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  // Generate Key
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeygenError('');
    setIsGeneratingKey(true);
    try {
      const keys = await generatePgpKeyPair({
        name: keyName.trim() || 'User',
        email: keyEmail.trim() || 'user@local',
        passphrase: keyPassphrase || undefined,
        type: keyType,
        rsaBits,
      });
      setGeneratedKeyPair(keys);
    } catch (err: any) {
      setKeygenError(`鍵生成エラー: ${err.message}`);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  // Text Crypto Action
  const handleTextCrypto = async () => {
    setCryptoError('');
    setIsProcessing(true);
    try {
      if (action === 'encrypt') {
        if (!encPlaintext.trim()) throw new Error('暗号化するテキストを入力してください');
        if (!encPubKeyArmored.trim() && !encPassphrase.trim()) {
          throw new Error('受取人の公開鍵またはパスフレーズを指定してください');
        }
        const res = await encryptPgpMessage({
          plaintext: encPlaintext,
          publicKeyArmored: encPubKeyArmored.trim() || undefined,
          passphrase: encPassphrase || undefined,
        });
        setEncResultArmored(res);
      } else {
        if (!decCiphertextArmored.trim()) throw new Error('復号するPGP暗号文を入力してください');
        if (!decPrivKeyArmored.trim() && !decPassphrase.trim()) {
          throw new Error('秘密鍵またはパスフレーズを入力してください');
        }
        const res = await decryptPgpMessage({
          armoredCiphertext: decCiphertextArmored,
          privateKeyArmored: decPrivKeyArmored.trim() || undefined,
          passphrase: decPassphrase || undefined,
        });
        setDecResultText(res.data);
      }
    } catch (err: any) {
      setCryptoError(`処理エラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
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
      setCryptoError('');
      setFileSuccess(null);
    };
    reader.readAsArrayBuffer(file);
  };

  // File Crypto Action
  const handleFileCrypto = async () => {
    setCryptoError('');
    setFileSuccess(null);
    if (!selectedFile) {
      setCryptoError('ファイルを選択してください');
      return;
    }

    setIsProcessing(true);
    try {
      if (action === 'encrypt') {
        if (!encPubKeyArmored.trim() && !encPassphrase.trim()) {
          throw new Error('受取人の公開鍵またはパスフレーズを指定してください');
        }
        const armored = await encryptPgpFile({
          fileData: selectedFile.buffer,
          fileName: selectedFile.name,
          publicKeyArmored: encPubKeyArmored.trim() || undefined,
          passphrase: encPassphrase || undefined,
        });
        const outName = `${selectedFile.name}.pgp.asc`;
        const blob = new Blob([armored], { type: 'text/plain;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        setFileSuccess({
          filename: outName,
          size: blob.size,
          downloadUrl,
        });
      } else {
        if (!decPrivKeyArmored.trim() && !decPassphrase.trim()) {
          throw new Error('秘密鍵またはパスフレーズを入力してください');
        }
        let input: string | ArrayBuffer;
        try {
          const decStr = new TextDecoder('utf-8', { fatal: true }).decode(selectedFile.buffer);
          input = decStr;
        } catch {
          input = selectedFile.buffer;
        }
        const decrypted = await decryptPgpFile({
          armoredOrBinary: input,
          privateKeyArmored: decPrivKeyArmored.trim() || undefined,
          passphrase: decPassphrase || undefined,
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
      setCryptoError(`ファイル処理エラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">OpenPGP 暗号</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono font-medium">
                RFC 4880
              </span>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('crypto')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'crypto'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>暗号化・復号</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('keygen')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'keygen'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>PGP鍵ペア生成</span>
          </button>
        </div>
      </div>

      {/* CRYPTO TAB */}
      {activeTab === 'crypto' && (
        <div className="space-y-6">
          {/* Operation & Target Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAction('encrypt');
                  setCryptoError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  action === 'encrypt'
                    ? 'bg-amber-600 text-white shadow-sm'
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
                  setCryptoError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  action === 'decrypt'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>復号</span>
              </button>
            </div>

            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setTargetType('text');
                  setCryptoError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  targetType === 'text'
                    ? 'bg-amber-600 text-white shadow-sm'
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
                  setCryptoError('');
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  targetType === 'file'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileLock className="w-3.5 h-3.5" />
                <span>ファイル</span>
              </button>
            </div>
          </div>

          {/* Key Input Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>{action === 'encrypt' ? '受取人の公開鍵または共通パスフレーズ' : '復号用の秘密鍵または共通パスフレーズ'}</span>
            </label>

            {action === 'encrypt' ? (
              <div className="space-y-3">
                <div>
                  <textarea
                    value={encPubKeyArmored}
                    onChange={(e) => setEncPubKeyArmored(e.target.value)}
                    rows={3}
                    placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    value={encPassphrase}
                    onChange={(e) => setEncPassphrase(e.target.value)}
                    placeholder="パスフレーズのみで暗号化する場合は入力"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <textarea
                    value={decPrivKeyArmored}
                    onChange={(e) => setDecPrivKeyArmored(e.target.value)}
                    rows={3}
                    placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="relative">
                  <input
                    type={showDecPassphrase ? 'text' : 'password'}
                    value={decPassphrase}
                    onChange={(e) => setDecPassphrase(e.target.value)}
                    placeholder="秘密鍵のパスフレーズまたは共通暗号パスフレーズ"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDecPassphrase(!showDecPassphrase)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                  >
                    {showDecPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {cryptoError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/80 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium">{cryptoError}</div>
            </div>
          )}

          {/* TEXT MODE */}
          {targetType === 'text' && (
            <div className="space-y-5">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <label className="text-xs font-bold text-slate-300">
                  {action === 'encrypt' ? '暗号化する平文' : '復号するPGP暗号文'}
                </label>
                <textarea
                  value={action === 'encrypt' ? encPlaintext : decCiphertextArmored}
                  onChange={(e) => {
                    if (action === 'encrypt') setEncPlaintext(e.target.value);
                    else setDecCiphertextArmored(e.target.value);
                  }}
                  rows={4}
                  placeholder={action === 'encrypt' ? 'テキストを入力' : '-----BEGIN PGP MESSAGE----- を貼り付け'}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleTextCrypto}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

              {action === 'encrypt' && encResultArmored && (
                <div className="bg-slate-900/70 border border-amber-900/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      暗号化結果 Armored
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(encResultArmored, 'pgp-enc')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                      >
                        {copiedKey === 'pgp-enc' ? (
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
                      <button
                        type="button"
                        onClick={() => handleDownloadText(encResultArmored, 'message.pgp.asc')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>保存</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={encResultArmored}
                    rows={6}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 text-xs font-mono select-all focus:outline-none"
                  />
                </div>
              )}

              {action === 'decrypt' && decResultText && (
                <div className="bg-slate-900/70 border border-amber-900/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      復号テキスト
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(decResultText, 'pgp-dec')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1"
                    >
                      {copiedKey === 'pgp-dec' ? (
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
                    value={decResultText}
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
                  className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors"
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
                onClick={handleFileCrypto}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
                <div className="bg-amber-950/20 border border-amber-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
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
                      className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
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
      )}

      {/* KEYGEN TAB */}
      {activeTab === 'keygen' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateKey} className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">名前</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="氏名または識別名"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={keyEmail}
                  onChange={(e) => setKeyEmail(e.target.value)}
                  placeholder="メールアドレス"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">鍵アルゴリズム</label>
                <select
                  value={keyType}
                  onChange={(e) => setKeyType(e.target.value as 'ecc' | 'rsa')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="ecc">ECC Ed25519 高速・高強度</option>
                  <option value="rsa">RSA 2048 / 4096 標準互換</option>
                </select>
              </div>

              {keyType === 'rsa' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">RSA 鍵長</label>
                  <select
                    value={rsaBits}
                    onChange={(e) => setRsaBits(Number(e.target.value) as 2048 | 4096)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value={2048}>2048 bit</option>
                    <option value={4096}>4096 bit</option>
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">パスフレーズ</label>
                <input
                  type="password"
                  value={keyPassphrase}
                  onChange={(e) => setKeyPassphrase(e.target.value)}
                  placeholder="秘密鍵保護用のパスフレーズを設定"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {keygenError && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-red-300 text-xs">
                {keygenError}
              </div>
            )}

            <button
              type="submit"
              disabled={isGeneratingKey}
              className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
              <span>PGP鍵ペアを生成</span>
            </button>
          </form>

          {generatedKeyPair && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">公開鍵 Armored</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedKeyPair.publicKeyArmored, 'gen-pub')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedKey === 'gen-pub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadText(generatedKeyPair.publicKeyArmored, 'public_key.asc')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={generatedKeyPair.publicKeyArmored}
                  rows={6}
                  className="w-full p-2 bg-slate-950 rounded font-mono text-slate-300 text-[10px]"
                />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300">秘密鍵 Armored</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedKeyPair.privateKeyArmored, 'gen-sec')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedKey === 'gen-sec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadText(generatedKeyPair.privateKeyArmored, 'private_key.asc')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={generatedKeyPair.privateKeyArmored}
                  rows={6}
                  className="w-full p-2 bg-slate-950 rounded font-mono text-slate-300 text-[10px]"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
