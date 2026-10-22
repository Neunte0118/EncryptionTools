import React, { useState, useEffect } from 'react';
import {
  computeEcdhSharedSecret,
  generateKeyPairOrKey,
} from '../utils/cryptoUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import { FileLoaderButton } from './FileLoaderButton';
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  selectedKey?: {
    action: 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null;
  onClearSelectedKey?: () => void;
}

export const EcdhTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
}) => {
  const [curve, setCurve] = useState<'P-256' | 'P-384' | 'P-521'>('P-256');
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

  const ecdhVaultKeys = vault.keys.filter((k) => k.type === 'ecdh' || k.type === 'ecdsa');

  // Sync selected key from vault
  useEffect(() => {
    if (selectedKey && (selectedKey.key.type === 'ecdh' || selectedKey.key.type === 'ecdsa')) {
      setSelectedVaultKeyId(selectedKey.key.id);
      if (selectedKey.key.privateKeyPem) setMyPrivKeyPem(selectedKey.key.privateKeyPem);
      if (selectedKey.key.publicKeyPem) setMyPubKeyPem(selectedKey.key.publicKeyPem);
      const nc = selectedKey.key.algorithmDetails?.namedCurve;
      if (nc === 'P-256' || nc === 'P-384' || nc === 'P-521') {
        setCurve(nc);
      }
      onClearSelectedKey?.();
    }
  }, [selectedKey, onClearSelectedKey]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Generate new ephemeral ECDH keypair
  const handleGenerateEphemeralKey = async () => {
    setErrorMsg('');
    try {
      const kp = await generateKeyPairOrKey({
        type: 'ecdh',
        namedCurve: curve,
      });
      if (kp.privateKeyPem) setMyPrivKeyPem(kp.privateKeyPem);
      if (kp.publicKeyPem) setMyPubKeyPem(kp.publicKeyPem);
    } catch (err: any) {
      setErrorMsg(`鍵ペア生成エラー: ${err.message}`);
    }
  };

  // Compute ECDH Shared Secret
  const handleComputeSharedSecret = async () => {
    setErrorMsg('');
    setSharedSecretHex('');
    setDerivedKeyBase64('');

    if (!myPrivKeyPem.trim() || !peerPubKeyPem.trim()) {
      setErrorMsg('あなたの秘密鍵 (PEM) と相手の公開鍵 (PEM) の両方を入力してください');
      return;
    }

    setIsDeriving(true);
    try {
      const res = await computeEcdhSharedSecret(
        myPrivKeyPem.trim(),
        peerPubKeyPem.trim(),
        curve
      );
      setSharedSecretHex(res.secretHex);

      // Derive standard 256-bit AES symmetric key using SHA-256
      const secretBytes = new Uint8Array(
        res.secretHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
      const hashBuf = await crypto.subtle.digest('SHA-256', secretBytes);
      let binary = '';
      const bytes = new Uint8Array(hashBuf);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      setDerivedKeyBase64(btoa(binary));
    } catch (err: any) {
      setErrorMsg(`ECDH共有秘密の計算エラー: ${err.message} (曲線の種類やPEM形式が相手と一致しているか確認してください)`);
    } finally {
      setIsDeriving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">ECDH (Diffie-Hellman鍵共有)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono font-medium">
                Elliptic Curve Diffie-Hellman
              </span>
            </div>
            <p className="text-xs text-slate-400">
              盗聴されている通信路でも、自身の秘密鍵と相手の公開鍵を掛け合わせることで、同一の共通暗号鍵を安全に導出
            </p>
          </div>
        </div>

        {/* Curve Selector */}
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0 text-xs">
          <span className="text-slate-400 font-semibold">曲線:</span>
          <select
            value={curve}
            onChange={(e) => setCurve(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="P-256">NIST P-256 (secp256r1)</option>
            <option value="P-384">NIST P-384 (secp384r1)</option>
            <option value="P-521">NIST P-521</option>
          </select>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Your Key Pair */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-slate-200 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>1. あなたの秘密鍵 &amp; 公開鍵</span>
            </h3>
            <button
              type="button"
              onClick={handleGenerateEphemeralKey}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>使い捨て鍵を即時生成</span>
            </button>
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
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- 保管庫の ECDH / EC キーから選択 --</option>
                {ecdhVaultKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title} ({k.algorithmDetails?.namedCurve || 'P-256'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-300">あなたの秘密鍵 (PEM)</label>
              <div className="flex items-center gap-2">
                <FileLoaderButton
                  label="秘密鍵読込"
                  onFileLoaded={(content) => setMyPrivKeyPem(content)}
                  title="秘密鍵ファイル (.pem, .key) を選択またはドロップ"
                />
                <button
                  type="button"
                  onClick={() => setIsPrivRevealed(!isPrivRevealed)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  {isPrivRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{isPrivRevealed ? '伏せる' : '表示'}</span>
                </button>
              </div>
            </div>
            <textarea
              value={myPrivKeyPem}
              onChange={(e) => setMyPrivKeyPem(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setMyPrivKeyPem(await f.text());
              }}
              rows={4}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              className={`w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500 ${
                !isPrivRevealed ? 'filter blur-[3px] focus:filter-none transition-all' : ''
              }`}
            />
          </div>

          {myPubKeyPem && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-slate-300">あなたの公開鍵</label>
                <button
                  type="button"
                  onClick={() => handleCopy(myPubKeyPem, 'myPub')}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  {copiedId === 'myPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === 'myPub' ? 'コピー完了' : '公開鍵をコピー'}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={myPubKeyPem}
                rows={3}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs font-mono"
              />
            </div>
          )}
        </div>

        {/* Right: Peer's Public Key & Action */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-slate-200 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>2. 通信相手の公開鍵 (Peer Public Key)</span>
            </h3>
            <FileLoaderButton
              label="相手公開鍵読込"
              onFileLoaded={(content) => setPeerPubKeyPem(content)}
              title="相手の公開鍵ファイル (.pem, .pub) を選択またはドロップ"
            />
          </div>

          <div>
            <textarea
              value={peerPubKeyPem}
              onChange={(e) => setPeerPubKeyPem(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setPeerPubKeyPem(await f.text());
              }}
              rows={6}
              placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleComputeSharedSecret}
            disabled={isDeriving || !myPrivKeyPem.trim() || !peerPubKeyPem.trim()}
            className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <Key className="w-4 h-4" />
            <span>ECDH 共有秘密 (Shared Secret) を導出</span>
          </button>
        </div>
      </div>

      {/* Result Area */}
      {sharedSecretHex && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>ECDH 共有秘密の計算に成功しました！通信相手の側でも全く同一の値が算出されます。</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">生の楕円曲線 共有秘密 (Raw Secret Hex)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(sharedSecretHex, 'rawSecret')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] flex items-center gap-1"
                >
                  {copiedId === 'rawSecret' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>コピー</span>
                </button>
              </div>
              <div className="p-2.5 bg-slate-900 rounded font-mono text-cyan-300 text-[11px] break-all">
                {sharedSecretHex}
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">AES-256-GCM 共通暗号鍵 (SHA-256 Base64)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(derivedKeyBase64, 'aesKey')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] flex items-center gap-1"
                >
                  {copiedId === 'aesKey' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>コピー</span>
                </button>
              </div>
              <div className="p-2.5 bg-slate-900 rounded font-mono text-emerald-300 text-[11px] break-all">
                {derivedKeyBase64}
              </div>
              <div className="text-[10px] text-slate-500">
                この共通鍵をコピーして「AES-256」ツールの生鍵入力に貼り付けることで、エンドツーエンド暗号化通信が行えます。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
