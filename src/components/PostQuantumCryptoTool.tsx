import React, { useState, useRef } from 'react';
import {
  generateMlKemKeyPair,
  mlKemEncapsulate,
  mlKemDecapsulate,
  encryptHybridMlKem,
  decryptHybridMlKem,
  generateMlDsaKeyPair,
  mlDsaSign,
  mlDsaVerify,
  MlKemLevel,
  MlDsaLevel,
  PqcEncryptedPackage,
  hexToBytes,
} from '../utils/postQuantumUtils';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Key,
  KeyRound,
  FileSignature,
  FileLock,
  Upload,
  Download,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  Cpu,
  Sparkles,
  Info,
  Binary,
} from 'lucide-react';

export const PostQuantumCryptoTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ml-kem' | 'ml-dsa'>('ml-kem');

  // -------------------------------------------------------------
  // ML-KEM (Kyber) State
  // -------------------------------------------------------------
  const [kemLevel, setKemLevel] = useState<MlKemLevel>('768');
  const [kemMyPubKeyHex, setKemMyPubKeyHex] = useState('');
  const [kemMySecKeyHex, setKemMySecKeyHex] = useState('');
  const [isKemSecRevealed, setIsKemSecRevealed] = useState(false);

  // KEM Encrypt / Decrypt State
  const [kemAction, setKemAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [kemPeerPubKeyHex, setKemPeerPubKeyHex] = useState('');
  const [kemPlainText, setKemPlainText] = useState('');
  const [kemEncryptedPkgJson, setKemEncryptedPkgJson] = useState('');
  const [kemDecryptedText, setKemDecryptedText] = useState('');
  const [kemError, setKemError] = useState('');
  const [isProcessingKem, setIsProcessingKem] = useState(false);

  // -------------------------------------------------------------
  // ML-DSA (Dilithium) State
  // -------------------------------------------------------------
  const [dsaLevel, setDsaLevel] = useState<MlDsaLevel>('65');
  const [dsaPubKeyHex, setDsaPubKeyHex] = useState('');
  const [dsaSecKeyHex, setDsaSecKeyHex] = useState('');
  const [isDsaSecRevealed, setIsDsaSecRevealed] = useState(false);

  // DSA Sign / Verify State
  const [dsaAction, setDsaAction] = useState<'sign' | 'verify'>('sign');
  const [dsaMessage, setDsaMessage] = useState('');
  const [dsaSignatureHex, setDsaSignatureHex] = useState('');
  const [dsaVerifyResult, setDsaVerifyResult] = useState<boolean | null>(null);
  const [dsaError, setDsaError] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // ML-KEM Keygen
  const handleGenerateKemKeys = () => {
    try {
      const keys = generateMlKemKeyPair(kemLevel);
      setKemMyPubKeyHex(keys.publicKeyHex);
      setKemMySecKeyHex(keys.secretKeyHex);
      setKemError('');
    } catch (e: any) {
      setKemError(`ML-KEM 鍵生成エラー: ${e.message}`);
    }
  };

  // ML-KEM Encrypt
  const handleKemEncrypt = async () => {
    setKemError('');
    setKemEncryptedPkgJson('');
    const recipientKey = kemPeerPubKeyHex.trim() || kemMyPubKeyHex.trim();
    if (!recipientKey) {
      setKemError('受取人のML-KEM公開鍵 (Hex) を入力するか、自身の鍵を生成してください');
      return;
    }
    if (!kemPlainText.trim()) {
      setKemError('暗号化するテキストを入力してください');
      return;
    }

    setIsProcessingKem(true);
    try {
      const encoder = new TextEncoder();
      const plainBytes = encoder.encode(kemPlainText.trim());
      const pkg = await encryptHybridMlKem(plainBytes, recipientKey, kemLevel);
      setKemEncryptedPkgJson(JSON.stringify(pkg, null, 2));
    } catch (e: any) {
      setKemError(`ML-KEM 暗号化エラー: ${e.message}`);
    } finally {
      setIsProcessingKem(false);
    }
  };

  // ML-KEM Decrypt
  const handleKemDecrypt = async () => {
    setKemError('');
    setKemDecryptedText('');
    if (!kemMySecKeyHex.trim()) {
      setKemError('復号に使用するML-KEM秘密鍵 (Hex) を指定してください');
      return;
    }
    if (!kemEncryptedPkgJson.trim()) {
      setKemError('暗号化パッケージ (JSON) を入力してください');
      return;
    }

    setIsProcessingKem(true);
    try {
      const pkg: PqcEncryptedPackage = JSON.parse(kemEncryptedPkgJson.trim());
      const decryptedBytes = await decryptHybridMlKem(pkg, kemMySecKeyHex.trim());
      const decoder = new TextDecoder();
      setKemDecryptedText(decoder.decode(decryptedBytes));
    } catch (e: any) {
      setKemError(`ML-KEM 復号エラー: ${e.message} (秘密鍵が一致しないか暗号データが破損しています)`);
    } finally {
      setIsProcessingKem(false);
    }
  };

  // ML-DSA Keygen
  const handleGenerateDsaKeys = () => {
    try {
      const keys = generateMlDsaKeyPair(dsaLevel);
      setDsaPubKeyHex(keys.publicKeyHex);
      setDsaSecKeyHex(keys.secretKeyHex);
      setDsaError('');
    } catch (e: any) {
      setDsaError(`ML-DSA 鍵生成エラー: ${e.message}`);
    }
  };

  // ML-DSA Sign
  const handleDsaSign = () => {
    setDsaError('');
    setDsaSignatureHex('');
    if (!dsaSecKeyHex.trim()) {
      setDsaError('署名に使用するML-DSA秘密鍵 (Hex) を指定してください');
      return;
    }
    if (!dsaMessage.trim()) {
      setDsaError('署名対象のメッセージを入力してください');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const msgBytes = encoder.encode(dsaMessage.trim());
      const res = mlDsaSign(msgBytes, dsaSecKeyHex.trim(), dsaLevel);
      setDsaSignatureHex(res.signatureHex);
    } catch (e: any) {
      setDsaError(`ML-DSA 署名作成エラー: ${e.message}`);
    }
  };

  // ML-DSA Verify
  const handleDsaVerify = () => {
    setDsaError('');
    setDsaVerifyResult(null);
    if (!dsaPubKeyHex.trim()) {
      setDsaError('検証に使用するML-DSA公開鍵 (Hex) を指定してください');
      return;
    }
    if (!dsaSignatureHex.trim()) {
      setDsaError('検証する署名Hexを入力してください');
      return;
    }
    if (!dsaMessage.trim()) {
      setDsaError('検証対象の元メッセージを入力してください');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const msgBytes = encoder.encode(dsaMessage.trim());
      const isValid = mlDsaVerify(dsaSignatureHex.trim(), msgBytes, dsaPubKeyHex.trim(), dsaLevel);
      setDsaVerifyResult(isValid);
    } catch (e: any) {
      setDsaError(`署名検証エラー: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">耐量子暗号 (ML-KEM / ML-DSA)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/60 font-mono font-medium">
                NIST FIPS 203 / 204 PQC
              </span>
            </div>
            <p className="text-xs text-slate-400">
              ショアのアルゴリズムを実装した将来の量子コンピュータに対しても解読不可能な格子暗号標準（ML-KEM / Kyber &amp; ML-DSA / Dilithium）
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('ml-kem')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'ml-kem'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ML-KEM 格子暗号化 (Kyber)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ml-dsa')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'ml-dsa'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>ML-DSA 格子署名 (Dilithium)</span>
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-teal-300 font-semibold">
          <Info className="w-4 h-4 text-teal-400" />
          <span>耐量子暗号 (Post-Quantum Cryptography: PQC) について</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          RSAや楕円曲線暗号（ECDSA/ECDH）は、量子コンピュータが実用化されると素因数分解・離散対数問題の脆弱性により瞬時に解読されるリスクがあります。
          米国国立標準技術研究所（NIST）が正式採択した<strong>FIPS 203 (ML-KEM / 旧称 Crystals-Kyber)</strong> および <strong>FIPS 204 (ML-DSA / 旧称 Crystals-Dilithium)</strong> は、多次元格子上の最短ベクトル問題（LWE）の計算困難性に基づき、量子時代においても完全な安全性を保証します。
        </p>
      </div>

      {/* ML-KEM Tab */}
      {activeTab === 'ml-kem' && (
        <div className="space-y-6">
          {/* Level & Keygen Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">ML-KEM パラメータ強度:</span>
                <select
                  value={kemLevel}
                  onChange={(e) => setKemLevel(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-teal-300 font-mono text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="512">ML-KEM-512 (NIST Category 1 / AES-128同等)</option>
                  <option value="768">ML-KEM-768 (NIST Category 3 / 推奨・標準)</option>
                  <option value="1024">ML-KEM-1024 (NIST Category 5 / AES-256同等)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleGenerateKemKeys}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>格子鍵ペアを新規生成</span>
              </button>
            </div>

            {kemMyPubKeyHex && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-300">ML-KEM 公開鍵 (Hex / 相手へ共有)</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(kemMyPubKeyHex, 'kemPub')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'kemPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto">
                    {kemMyPubKeyHex}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rose-300">ML-KEM 秘密鍵 (Hex - 厳重保管)</span>
                      <button
                        type="button"
                        onClick={() => setIsKemSecRevealed(!isKemSecRevealed)}
                        className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                      >
                        {isKemSecRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isKemSecRevealed ? '伏せる' : '表示'}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(kemMySecKeyHex, 'kemSec')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'kemSec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className={`p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto ${
                    !isKemSecRevealed ? 'filter blur-[3px]' : ''
                  }`}>
                    {kemMySecKeyHex}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Tabs: Encrypt / Decrypt */}
          <div className="flex border-b border-slate-800 gap-4">
            <button
              type="button"
              onClick={() => setKemAction('encrypt')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                kemAction === 'encrypt'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>受取人の公開鍵で暗号化</span>
            </button>
            <button
              type="button"
              onClick={() => setKemAction('decrypt')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                kemAction === 'decrypt'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>自身の秘密鍵で復号</span>
            </button>
          </div>

          {kemAction === 'encrypt' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  受取人のML-KEM公開鍵 (Hex)
                </label>
                <textarea
                  value={kemPeerPubKeyHex}
                  onChange={(e) => setKemPeerPubKeyHex(e.target.value)}
                  rows={3}
                  placeholder="未入力の場合は上で生成した自身の公開鍵を使用..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">暗号化する平文メッセージ</label>
                <textarea
                  value={kemPlainText}
                  onChange={(e) => setKemPlainText(e.target.value)}
                  rows={4}
                  placeholder="暗号化するテキストを入力..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              {kemError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {kemError}
                </div>
              )}

              <button
                type="button"
                onClick={handleKemEncrypt}
                disabled={isProcessingKem || !kemPlainText.trim()}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Lock className="w-4 h-4" />
                <span>耐量子暗号化を実行 (ML-KEM + AES-256-GCM)</span>
              </button>

              {kemEncryptedPkgJson && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      暗号化完了 (ML-KEM カプセル化暗号文 + AES-256-GCM)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(kemEncryptedPkgJson, 'kemPkg')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] flex items-center gap-1"
                    >
                      {copiedId === 'kemPkg' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === 'kemPkg' ? 'コピー完了' : 'JSONをコピー'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={kemEncryptedPkgJson}
                    rows={6}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-teal-300 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  復号用のML-KEM秘密鍵 (Hex)
                </label>
                <textarea
                  value={kemMySecKeyHex}
                  onChange={(e) => setKemMySecKeyHex(e.target.value)}
                  rows={3}
                  placeholder="秘密鍵のHexを入力..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  暗号化パッケージ (JSON)
                </label>
                <textarea
                  value={kemEncryptedPkgJson}
                  onChange={(e) => setKemEncryptedPkgJson(e.target.value)}
                  rows={5}
                  placeholder="受取った暗号化JSONを貼り付け..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              {kemError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {kemError}
                </div>
              )}

              <button
                type="button"
                onClick={handleKemDecrypt}
                disabled={isProcessingKem || !kemMySecKeyHex.trim() || !kemEncryptedPkgJson.trim()}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                <span>ML-KEM 秘密鍵でデカプセル化 &amp; 復号</span>
              </button>

              {kemDecryptedText && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      復号完了 (認証付き平文復元OK)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(kemDecryptedText, 'kemDec')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] flex items-center gap-1"
                    >
                      {copiedId === 'kemDec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === 'kemDec' ? 'コピー完了' : 'コピー'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={kemDecryptedText}
                    rows={4}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-sans"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ML-DSA Tab */}
      {activeTab === 'ml-dsa' && (
        <div className="space-y-6">
          {/* Level & Keygen Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">ML-DSA パラメータ強度:</span>
                <select
                  value={dsaLevel}
                  onChange={(e) => setDsaLevel(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-teal-300 font-mono text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="44">ML-DSA-44 (NIST Category 2 / 高速)</option>
                  <option value="65">ML-DSA-65 (NIST Category 3 / 推奨・標準)</option>
                  <option value="87">ML-DSA-87 (NIST Category 5 / 最高強度)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleGenerateDsaKeys}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>格子署名鍵ペアを新規生成</span>
              </button>
            </div>

            {dsaPubKeyHex && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-300">ML-DSA 検証用公開鍵 (Hex)</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(dsaPubKeyHex, 'dsaPub')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'dsaPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto">
                    {dsaPubKeyHex}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rose-300">ML-DSA 署名用秘密鍵 (Hex)</span>
                      <button
                        type="button"
                        onClick={() => setIsDsaSecRevealed(!isDsaSecRevealed)}
                        className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                      >
                        {isDsaSecRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isDsaSecRevealed ? '伏せる' : '表示'}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(dsaSecKeyHex, 'dsaSec')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedId === 'dsaSec' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className={`p-2 bg-slate-900 rounded font-mono text-slate-300 text-[10px] break-all max-h-24 overflow-y-auto ${
                    !isDsaSecRevealed ? 'filter blur-[3px]' : ''
                  }`}>
                    {dsaSecKeyHex}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Tabs: Sign / Verify */}
          <div className="flex border-b border-slate-800 gap-4">
            <button
              type="button"
              onClick={() => {
                setDsaAction('sign');
                setDsaVerifyResult(null);
              }}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                dsaAction === 'sign'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSignature className="w-3.5 h-3.5" />
              <span>電子署名を作成 (Sign)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDsaAction('verify');
                setDsaVerifyResult(null);
              }}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                dsaAction === 'verify'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>電子署名を検証 (Verify)</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">対象メッセージ</label>
              <textarea
                value={dsaMessage}
                onChange={(e) => setDsaMessage(e.target.value)}
                rows={3}
                placeholder="署名または改竄検証するメッセージを入力..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-teal-500"
              />
            </div>

            {dsaAction === 'sign' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ML-DSA 秘密鍵 (Hex)
                  </label>
                  <textarea
                    value={dsaSecKeyHex}
                    onChange={(e) => setDsaSecKeyHex(e.target.value)}
                    rows={3}
                    placeholder="署名用秘密鍵のHex..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                {dsaError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                    {dsaError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDsaSign}
                  disabled={!dsaSecKeyHex.trim() || !dsaMessage.trim()}
                  className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <FileSignature className="w-4 h-4" />
                  <span>ML-DSA 格子署名を生成</span>
                </button>

                {dsaSignatureHex && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        署名生成完了 (Dilithium FIPS 204)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(dsaSignatureHex, 'dsaSig')}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] flex items-center gap-1"
                      >
                        {copiedId === 'dsaSig' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === 'dsaSig' ? 'コピー完了' : '署名をコピー'}</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={dsaSignatureHex}
                      rows={5}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-teal-300 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ML-DSA 公開鍵 (Hex)
                  </label>
                  <textarea
                    value={dsaPubKeyHex}
                    onChange={(e) => setDsaPubKeyHex(e.target.value)}
                    rows={3}
                    placeholder="検証用公開鍵のHex..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    検証する署名 (Hex)
                  </label>
                  <textarea
                    value={dsaSignatureHex}
                    onChange={(e) => setDsaSignatureHex(e.target.value)}
                    rows={4}
                    placeholder="署名Hexを貼り付け..."
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                {dsaError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                    {dsaError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDsaVerify}
                  disabled={!dsaPubKeyHex.trim() || !dsaSignatureHex.trim() || !dsaMessage.trim()}
                  className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>ML-DSA 署名の真正性を検証</span>
                </button>

                {dsaVerifyResult !== null && (
                  <div
                    className={`p-4 rounded-xl border flex items-center gap-3 ${
                      dsaVerifyResult
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                    }`}
                  >
                    {dsaVerifyResult ? (
                      <>
                        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">署名検証: 正当 (Valid Signature)</div>
                          <div className="text-[11px] text-emerald-400/80">
                            メッセージは改竄されておらず、対応するML-DSA公開鍵所持者によって正当に署名されたことが数学的に証明されました。
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm">署名検証: 不正 (Invalid Signature)</div>
                          <div className="text-[11px] text-rose-400/80">
                            署名が不正であるか、メッセージまたは公開鍵が一致していません。
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
