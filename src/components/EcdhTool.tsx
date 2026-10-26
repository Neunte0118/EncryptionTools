import React, { useState, useEffect } from 'react';
import {
  computeEcdhSharedSecret,
  aesEncryptAdvanced,
  aesDecryptAdvanced,
  stringToBuffer,
  bufferToString,
  base64ToBuffer,
  bufferToBase64,
} from '../utils/cryptoUtils';
import {
  computeX25519SharedSecret,
  computeSecp256k1SharedSecret,
} from '../utils/curveUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import { FileLoaderButton } from './FileLoaderButton';
import {
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  Unlock,
  ArrowRight,
  ShieldCheck,
  Zap,
  AlertCircle,
} from 'lucide-react';

export type EcdhCurveType = 'P-256' | 'P-384' | 'P-521' | 'X25519' | 'secp256k1';

interface Props {
  vault: KeyVaultFile;
  selectedKey?: {
    action: 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null;
  onClearSelectedKey?: () => void;
  onNavigateToKeyGenerator?: () => void;
}

export const EcdhTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
  onNavigateToKeyGenerator,
}) => {
  const [curve, setCurve] = useState<EcdhCurveType>('P-256');
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');
  const [myPrivKeyPem, setMyPrivKeyPem] = useState('');
  const [myPubKeyPem, setMyPubKeyPem] = useState('');
  const [isPrivRevealed, setIsPrivRevealed] = useState(false);
  const [peerPubKeyPem, setPeerPubKeyPem] = useState('');

  const [sharedSecretHex, setSharedSecretHex] = useState('');
  const [derivedKeyBase64, setDerivedKeyBase64] = useState('');
  const [isDeriving, setIsDeriving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Message encryption with shared secret
  const [msgAction, setMsgAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [cipherType, setCipherType] = useState<'AES-GCM' | 'AES-CBC'>('AES-GCM');
  const [messageInput, setMessageInput] = useState('');
  const [messageOutput, setMessageOutput] = useState('');
  const [msgError, setMsgError] = useState('');

  const ecdhVaultKeys = vault.keys.filter(
    (k) =>
      k.type === 'ecdh' ||
      k.type === 'ecdsa' ||
      k.type === 'x25519' ||
      k.type === 'secp256k1'
  );

  // Sync selected key from vault
  useEffect(() => {
    if (
      selectedKey &&
      (selectedKey.key.type === 'ecdh' ||
        selectedKey.key.type === 'ecdsa' ||
        selectedKey.key.type === 'x25519' ||
        selectedKey.key.type === 'secp256k1')
    ) {
      setSelectedVaultKeyId(selectedKey.key.id);
      if (selectedKey.key.privateKeyPem) setMyPrivKeyPem(selectedKey.key.privateKeyPem);
      if (selectedKey.key.publicKeyPem) setMyPubKeyPem(selectedKey.key.publicKeyPem);
      const nc = selectedKey.key.algorithmDetails?.namedCurve || selectedKey.key.type;
      if (nc === 'P-256' || nc === 'P-384' || nc === 'P-521') {
        setCurve(nc);
      } else if (nc === 'x25519' || selectedKey.key.type === 'x25519') {
        setCurve('X25519');
      } else if (nc === 'secp256k1' || selectedKey.key.type === 'secp256k1') {
        setCurve('secp256k1');
      }
      onClearSelectedKey?.();
    }
  }, [selectedKey, onClearSelectedKey]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Compute ECDH Shared Secret
  const handleComputeSharedSecret = async () => {
    setErrorMsg('');
    setSharedSecretHex('');
    setDerivedKeyBase64('');

    if (!myPrivKeyPem.trim() || !peerPubKeyPem.trim()) {
      setErrorMsg('あなたの秘密鍵と相手の公開鍵の両方を指定してください（「暗号鍵生成」ツールで生成できます）');
      return;
    }

    setIsDeriving(true);
    try {
      if (curve === 'X25519') {
        const res = computeX25519SharedSecret(myPrivKeyPem.trim(), peerPubKeyPem.trim());
        setSharedSecretHex(res.secretHex);
        setDerivedKeyBase64(res.derivedKeyBase64);
      } else if (curve === 'secp256k1') {
        const res = computeSecp256k1SharedSecret(myPrivKeyPem.trim(), peerPubKeyPem.trim());
        setSharedSecretHex(res.secretHex);
        setDerivedKeyBase64(res.derivedKeyBase64);
      } else {
        const res = await computeEcdhSharedSecret(
          myPrivKeyPem.trim(),
          peerPubKeyPem.trim(),
          curve
        );
        setSharedSecretHex(res.secretHex);

        const secretBytes = new Uint8Array(
          res.secretHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );
        const hashBuf = await crypto.subtle.digest('SHA-256', secretBytes);
        setDerivedKeyBase64(bufferToBase64(hashBuf));
      }
    } catch (err: any) {
      setErrorMsg(`ECDH共有秘密の計算エラー: ${err.message} (鍵の曲線やフォーマットが一致しているか確認してください)`);
    } finally {
      setIsDeriving(false);
    }
  };

  const handleMessageAction = async () => {
    setMsgError('');
    setMessageOutput('');
    if (!derivedKeyBase64) {
      setMsgError('共有鍵が導出されていません。先にステップ1で共有秘密を計算してください');
      return;
    }
    if (!messageInput.trim()) {
      setMsgError('メッセージを入力してください');
      return;
    }

    try {
      const rawKeyBuffer = base64ToBuffer(derivedKeyBase64);
      if (msgAction === 'encrypt') {
        const plainBuf = stringToBuffer(messageInput);
        const enc = await aesEncryptAdvanced(rawKeyBuffer, plainBuf, cipherType);
        setMessageOutput(enc.combinedBase64);
      } else {
        const cipherBuf = base64ToBuffer(messageInput.trim());
        const dec = await aesDecryptAdvanced(rawKeyBuffer, cipherBuf, cipherType);
        setMessageOutput(bufferToString(dec));
      }
    } catch (e: any) {
      setMsgError(`処理エラー: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">ECDH (楕円曲線ディフィー・ヘルマン鍵共有)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                {curve}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              盗聴路でも安全に秘密を共有。NIST規格に加え、X25519、ビットコイン等のsecp256k1を完全実装
            </p>
          </div>
        </div>

        {/* Curve Selector */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0 text-xs">
          <span className="text-slate-400 font-semibold">曲線規格:</span>
          <select
            value={curve}
            onChange={(e) => {
              setCurve(e.target.value as EcdhCurveType);
              setSharedSecretHex('');
              setDerivedKeyBase64('');
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500 font-medium"
          >
            <optgroup label="RFC 7748 (Montgomery 現代標準)">
              <option value="X25519">X25519 (Curve25519 / TLS 1.3 / Signal)</option>
            </optgroup>
            <optgroup label="SECG SEC 2 (暗号資産 / Web3)">
              <option value="secp256k1">secp256k1 (Bitcoin / Ethereum)</option>
            </optgroup>
            <optgroup label="NIST SP 800-56A (Weierstrass)">
              <option value="P-256">NIST P-256 (prime256v1)</option>
              <option value="P-384">NIST P-384</option>
              <option value="P-521">NIST P-521</option>
            </optgroup>
          </select>
        </div>
      </div>


      {/* Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Your Key Pair */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>1. あなたの秘密鍵 &amp; 公開鍵 ({curve})</span>
            </h3>
            {onNavigateToKeyGenerator && (
              <button
                type="button"
                onClick={onNavigateToKeyGenerator}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <Key className="w-3.5 h-3.5" />
                <span>「暗号鍵生成」で鍵を生成</span>
              </button>
            )}
          </div>

          {ecdhVaultKeys.length > 0 && (
            <div>
              <select
                value={selectedVaultKeyId}
                onChange={(e) => {
                  setSelectedVaultKeyId(e.target.value);
                  const k = ecdhVaultKeys.find((item) => item.id === e.target.value);
                  if (k?.privateKeyPem) setMyPrivKeyPem(k.privateKeyPem);
                  if (k?.publicKeyPem) setMyPubKeyPem(k.publicKeyPem);
                  const nc = k?.algorithmDetails?.namedCurve;
                  if (nc === 'P-256' || nc === 'P-384' || nc === 'P-521') setCurve(nc);
                  else if (k?.type === 'x25519') setCurve('X25519');
                  else if (k?.type === 'secp256k1') setCurve('secp256k1');
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- 保管庫の ECDH / EC キーから選択 --</option>
                {ecdhVaultKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-300">
                あなたの秘密鍵 {curve === 'X25519' || curve === 'secp256k1' ? '(Hex / PEM)' : '(PEM)'}
              </label>
              <div className="flex items-center gap-2">
                <FileLoaderButton
                  label="秘密鍵読込"
                  onFileLoaded={(content) => setMyPrivKeyPem(content.trim())}
                />
                <button
                  type="button"
                  onClick={() => setIsPrivRevealed(!isPrivRevealed)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  {isPrivRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isPrivRevealed ? '隠す' : '表示'}</span>
                </button>
              </div>
            </div>
            <textarea
              rows={3}
              value={isPrivRevealed ? myPrivKeyPem : myPrivKeyPem.replace(/[^-]/g, '*')}
              onChange={(e) => setMyPrivKeyPem(e.target.value)}
              placeholder="あなたの秘密鍵を入力または保管庫から選択..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-300">
                あなたの公開鍵 (相手に送信する鍵)
              </label>
              <button
                type="button"
                onClick={() => handleCopy(myPubKeyPem, 'myPub')}
                className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1"
              >
                {copiedId === 'myPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === 'myPub' ? 'コピー完了' : '公開鍵をコピー'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={myPubKeyPem}
              onChange={(e) => setMyPubKeyPem(e.target.value)}
              placeholder="あなたの公開鍵..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Right: Peer Public Key & Compute */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>2. 通信相手の公開鍵 ({curve})</span>
            </h3>
            <FileLoaderButton
              label="相手の公開鍵読込"
              onFileLoaded={(content) => setPeerPubKeyPem(content.trim())}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              通信相手から送られてきた公開鍵
            </label>
            <textarea
              rows={4}
              value={peerPubKeyPem}
              onChange={(e) => setPeerPubKeyPem(e.target.value)}
              placeholder={`相手の公開鍵 (${curve === 'X25519' || curve === 'secp256k1' ? 'HexまたはPEM' : 'PEM'}) を貼り付け...`}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            disabled={isDeriving || !myPrivKeyPem.trim() || !peerPubKeyPem.trim()}
            onClick={handleComputeSharedSecret}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Zap className="w-4 h-4" />
            <span>{isDeriving ? '計算中...' : 'Diffie-Hellman 共有秘密を計算'}</span>
          </button>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Derived Secret & Message Encryption */}
      {derivedKeyBase64 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>ECDH 共有秘密キーの導出に成功しました</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(derivedKeyBase64, 'derived')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
              >
                {copiedId === 'derived' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>共通鍵(Base64)コピー</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">共有シークレット (Raw Secret Hex):</span>
              <pre className="text-xs font-mono p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                {sharedSecretHex}
              </pre>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400">AES-256用 導出共通鍵 (Base64):</span>
              <pre className="text-xs font-mono p-2 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 overflow-x-auto whitespace-pre-wrap break-all">
                {derivedKeyBase64}
              </pre>
            </div>
          </div>

          {/* Integrated Encrypt/Decrypt with Derived Key */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>導出鍵によるメッセージ暗号化 / 復号</span>
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={cipherType}
                  onChange={(e) => setCipherType(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
                >
                  <option value="AES-GCM">AES-GCM (推奨)</option>
                  <option value="AES-CBC">AES-CBC</option>
                </select>
                <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMsgAction('encrypt')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      msgAction === 'encrypt' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                    }`}
                  >
                    暗号化
                  </button>
                  <button
                    type="button"
                    onClick={() => setMsgAction('decrypt')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      msgAction === 'decrypt' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                    }`}
                  >
                    復号
                  </button>
                </div>
              </div>
            </div>

            <textarea
              rows={3}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={msgAction === 'encrypt' ? '暗号化する平文メッセージを入力...' : '復号するBase64暗号文を入力...'}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />

            <button
              type="button"
              onClick={handleMessageAction}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              {msgAction === 'encrypt' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{msgAction === 'encrypt' ? '導出鍵で暗号化' : '導出鍵で復号'}</span>
            </button>

            {msgError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs">
                {msgError}
              </div>
            )}

            {messageOutput && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">処理結果:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(messageOutput, 'msg-out')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                  >
                    {copiedId === 'msg-out' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>コピー</span>
                  </button>
                </div>
                <pre className="text-xs font-mono p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 select-all whitespace-pre-wrap break-all">
                  {messageOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
