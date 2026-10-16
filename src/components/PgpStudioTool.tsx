import React, { useState } from 'react';
import {
  generatePgpKeyPair,
  encryptPgpMessage,
  decryptPgpMessage,
  getPgpKeyInfo,
} from '../utils/pgpUtils';
import {
  Shield,
  Key,
  Lock,
  Unlock,
  Copy,
  Check,
  Download,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  FileText,
  User,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export const PgpStudioTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encrypt' | 'decrypt' | 'keygen'>('encrypt');

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

  // Encrypt state
  const [encPlaintext, setEncPlaintext] = useState('');
  const [encPubKeyArmored, setEncPubKeyArmored] = useState('');
  const [encPassphrase, setEncPassphrase] = useState('');
  const [useSymmetricOnly, setUseSymmetricOnly] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encResultArmored, setEncResultArmored] = useState('');
  const [encError, setEncError] = useState('');

  // Decrypt state
  const [decCiphertextArmored, setDecCiphertextArmored] = useState('');
  const [decPrivKeyArmored, setDecPrivKeyArmored] = useState('');
  const [decPassphrase, setDecPassphrase] = useState('');
  const [showDecPassphrase, setShowDecPassphrase] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decResultText, setDecResultText] = useState('');
  const [decSignatures, setDecSignatures] = useState<{ keyID: string; verified: boolean }[]>([]);
  const [decError, setDecError] = useState('');

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
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
        name: keyName.trim() || 'Anonymous',
        email: keyEmail.trim() || 'anon@local',
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

  // Encrypt Message
  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setEncError('');
    setEncResultArmored('');

    if (!encPlaintext.trim()) {
      setEncError('暗号化する本文を入力してください');
      return;
    }

    if (!useSymmetricOnly && !encPubKeyArmored.trim()) {
      setEncError('受信者のPGP公開鍵を入力してください（またはパスワード暗号化を選択）');
      return;
    }

    if (useSymmetricOnly && !encPassphrase.trim()) {
      setEncError('共通暗号化パスフレーズを入力してください');
      return;
    }

    setIsEncrypting(true);
    try {
      const ciphertext = await encryptPgpMessage({
        plaintext: encPlaintext,
        publicKeyArmored: useSymmetricOnly ? undefined : encPubKeyArmored,
        passphrase: useSymmetricOnly ? encPassphrase : undefined,
      });
      setEncResultArmored(ciphertext);
    } catch (err: any) {
      setEncError(`PGP暗号化エラー: ${err.message}`);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Decrypt Message
  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecError('');
    setDecResultText('');
    setDecSignatures([]);

    if (!decCiphertextArmored.trim()) {
      setDecError('復号するPGP暗号文 (-----BEGIN PGP MESSAGE-----) を入力してください');
      return;
    }

    setIsDecrypting(true);
    try {
      const res = await decryptPgpMessage({
        armoredCiphertext: decCiphertextArmored,
        privateKeyArmored: decPrivKeyArmored.trim() || undefined,
        passphrase: decPassphrase || undefined,
      });
      setDecResultText(res.data);
      if (res.signatures) {
        setDecSignatures(res.signatures);
      }
    } catch (err: any) {
      setDecError(`復号エラー: パスフレーズまたは秘密鍵が合わないか、破損しています (${err.message})`);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                PGP / GPG 互換アーマー &amp; メッセージ暗号化・復号
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 border border-indigo-700/80 text-indigo-300">
                RFC 4880 OpenPGP
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              GnuPG、Thunderbird、ProtonMail等と100%相互互換。ASCIIアーマー形式の公開鍵/秘密鍵生成、メッセージ暗号化・復号を完全ブラウザ内で行います。
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('encrypt')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'encrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>PGP暗号化</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('decrypt')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'decrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>PGP復号</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('keygen')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'keygen'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>PGP鍵ペア新規生成</span>
        </button>
      </div>

      {/* --- ENCRYPT TAB --- */}
      {activeTab === 'encrypt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>メッセージ暗号化設定</span>
            </h3>

            <form onSubmit={handleEncrypt} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  平文メッセージ (Plaintext)
                </label>
                <textarea
                  value={encPlaintext}
                  onChange={(e) => setEncPlaintext(e.target.value)}
                  rows={5}
                  placeholder="暗号化したいメッセージを入力..."
                  required
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">暗号化方式:</label>
                  <label className="text-slate-400 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSymmetricOnly}
                      onChange={(e) => setUseSymmetricOnly(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <span>パスワード対称暗号（公開鍵なし）</span>
                  </label>
                </div>

                {!useSymmetricOnly ? (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      受信者のPGP公開鍵 (Public Key Block):
                    </label>
                    <textarea
                      value={encPubKeyArmored}
                      onChange={(e) => setEncPubKeyArmored(e.target.value)}
                      rows={6}
                      placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      対称暗号化パスフレーズ:
                    </label>
                    <input
                      type="password"
                      value={encPassphrase}
                      onChange={(e) => setEncPassphrase(e.target.value)}
                      placeholder="パスワードを入力"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              {encError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {encError}
                </div>
              )}

              <button
                type="submit"
                disabled={isEncrypting}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isEncrypting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>OpenPGP 暗号化処理中...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>PGP メッセージを暗号化</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>暗号化出力 (PGP ASCII Armor)</span>
              </h3>

              {encResultArmored ? (
                <div className="space-y-3">
                  <textarea
                    readOnly
                    rows={12}
                    value={encResultArmored}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 select-all"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(encResultArmored, 'enc-pgp-copy')}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                    >
                      {copiedKey === 'enc-pgp-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'enc-pgp-copy' ? 'コピー完了' : '暗号文をコピー'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadText(encResultArmored, 'message.pgp.asc')}
                      className="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.asc ファイル保存</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Shield className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <div className="text-xs">左のフォームにメッセージを入力し、暗号化を実行してください</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- DECRYPT TAB --- */}
      {activeTab === 'decrypt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Unlock className="w-4 h-4 text-indigo-400" />
              <span>PGP メッセージ復号</span>
            </h3>

            <form onSubmit={handleDecrypt} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  PGP 暗号文 (-----BEGIN PGP MESSAGE-----)
                </label>
                <textarea
                  value={decCiphertextArmored}
                  onChange={(e) => setDecCiphertextArmored(e.target.value)}
                  rows={6}
                  placeholder="-----BEGIN PGP MESSAGE-----&#10;...&#10;-----END PGP MESSAGE-----"
                  required
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  復号用 PGP秘密鍵 (-----BEGIN PGP PRIVATE KEY BLOCK-----) (任意)
                </label>
                <textarea
                  value={decPrivKeyArmored}
                  onChange={(e) => setDecPrivKeyArmored(e.target.value)}
                  rows={5}
                  placeholder="秘密鍵（パスワード暗号の場合は空欄で可）"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  秘密鍵パスフレーズ または 共通パスワード
                </label>
                <div className="relative">
                  <input
                    type={showDecPassphrase ? 'text' : 'password'}
                    value={decPassphrase}
                    onChange={(e) => setDecPassphrase(e.target.value)}
                    placeholder="パスフレーズを入力（保護されていない鍵の場合は空欄可）"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 pr-10 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDecPassphrase(!showDecPassphrase)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-200"
                  >
                    {showDecPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {decError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs whitespace-pre-wrap">
                  {decError}
                </div>
              )}

              <button
                type="submit"
                disabled={isDecrypting}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isDecrypting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>復号処理中...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>PGP メッセージを復号</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>復号された平文</span>
              </h3>

              {decResultText ? (
                <div className="space-y-3">
                  {decSignatures.length > 0 && (
                    <div className="p-3 bg-indigo-950/30 border border-indigo-800/60 rounded-lg text-xs space-y-1">
                      <div className="font-semibold text-indigo-300">署名検証結果:</div>
                      {decSignatures.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span>Key ID: <code className="font-mono">{s.keyID}</code></span>
                          <span className={s.verified ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                            {s.verified ? '✓ 署名検証成功' : '署名未検証'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 max-h-72 overflow-y-auto whitespace-pre-wrap select-all">
                    {decResultText}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(decResultText, 'dec-pgp-copy')}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    {copiedKey === 'dec-pgp-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'dec-pgp-copy' ? 'コピー完了' : '復号平文をコピー'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Unlock className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <div className="text-xs">左のフォームに暗号文を入力し、復号を実行してください</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- KEYGEN TAB --- */}
      {activeTab === 'keygen' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              <span>OpenPGP 鍵ペアパラメータ</span>
            </h3>

            <form onSubmit={handleGenerateKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ユーザー名 (Name)</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="ユーザー名・識別名を入力"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">メールアドレス (Email)</label>
                <input
                  type="email"
                  value={keyEmail}
                  onChange={(e) => setKeyEmail(e.target.value)}
                  placeholder="メールアドレスを入力"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">秘密鍵保護パスフレーズ (任意)</label>
                <input
                  type="password"
                  value={keyPassphrase}
                  onChange={(e) => setKeyPassphrase(e.target.value)}
                  placeholder="秘密鍵を暗号化保存する場合は入力"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1">鍵アルゴリズム</label>
                  <select
                    value={keyType}
                    onChange={(e) => setKeyType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ecc">Curve25519 (モダン・高速)</option>
                    <option value="rsa">RSA (従来標準互換)</option>
                  </select>
                </div>

                {keyType === 'rsa' && (
                  <div>
                    <label className="block text-slate-400 mb-1">RSA キー長</label>
                    <select
                      value={rsaBits}
                      onChange={(e) => setRsaBits(Number(e.target.value) as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={2048}>2048-bit (標準)</option>
                      <option value={4096}>4096-bit (高セキュリティ)</option>
                    </select>
                  </div>
                )}
              </div>

              {keygenError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {keygenError}
                </div>
              )}

              <button
                type="submit"
                disabled={isGeneratingKey}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isGeneratingKey ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>鍵ペアを数学計算中...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>PGP 鍵ペアを生成</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>生成された PGP 鍵アーマー</span>
            </h3>

            {generatedKeyPair ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Key ID:</span>
                    <span className="font-mono text-indigo-300 font-bold">{generatedKeyPair.keyID}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fingerprint:</span>
                    <span className="font-mono text-slate-300 text-[10px] truncate max-w-[200px]" title={generatedKeyPair.fingerprint}>
                      {generatedKeyPair.fingerprint}
                    </span>
                  </div>
                </div>

                {/* Public Key */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>公開鍵 (Public Key - 共有用):</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedKeyPair.publicKeyArmored, 'pub-copy')}
                        className="text-indigo-400 hover:text-indigo-300 font-mono text-[10px]"
                      >
                        {copiedKey === 'pub-copy' ? 'コピー完了' : 'コピー'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadText(generatedKeyPair.publicKeyArmored, `${keyName}-public.asc`)}
                        className="text-emerald-400 hover:text-emerald-300 font-mono text-[10px]"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    rows={6}
                    value={generatedKeyPair.publicKeyArmored}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 select-all"
                  />
                </div>

                {/* Private Key */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-amber-400 font-semibold">秘密鍵 (Private Key - 厳重保管):</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedKeyPair.privateKeyArmored, 'priv-copy')}
                        className="text-indigo-400 hover:text-indigo-300 font-mono text-[10px]"
                      >
                        {copiedKey === 'priv-copy' ? 'コピー完了' : 'コピー'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadText(generatedKeyPair.privateKeyArmored, `${keyName}-private.asc`)}
                        className="text-emerald-400 hover:text-emerald-300 font-mono text-[10px]"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    rows={6}
                    value={generatedKeyPair.privateKeyArmored}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-amber-200/80 select-all"
                  />
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                <Key className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <div className="text-xs">左のフォームで名前・メールを入力し鍵ペアを生成してください</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
