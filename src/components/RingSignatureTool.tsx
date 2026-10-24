import React, { useState, useEffect } from 'react';
import {
  generateDummyRingMembers,
  createRingSignature,
  verifyRingSignature,
  RingKeyPair,
  RingMember,
  RingSignaturePackage,
  RingVerificationResult,
} from '../utils/ringSignatureUtils';
import { KeyVaultFile } from '../types/crypto';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  UserCheck,
  Plus,
  Trash2,
  Copy,
  Check,
  KeyRound,
  FileSignature,
  Download,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface Props {
  vault?: KeyVaultFile;
  onNavigateToKeyGenerator?: () => void;
}

export const RingSignatureTool: React.FC<Props> = ({
  vault,
  onNavigateToKeyGenerator,
}) => {
  const [activeTab, setActiveTab] = useState<'sign' | 'verify'>('sign');

  // Signer State
  const ringVaultKeys = vault?.keys.filter((k) => k.type === 'ring' || k.type === 'ed25519') || [];
  const defaultKey: RingKeyPair = ringVaultKeys.length > 0 && ringVaultKeys[0].publicKeyPem && ringVaultKeys[0].privateKeyPem
    ? {
        publicKeyHex: ringVaultKeys[0].publicKeyPem,
        secretKeyHex: ringVaultKeys[0].privateKeyPem,
        label: ringVaultKeys[0].title,
        createdAt: Date.now(),
      }
    : {
        publicKeyHex: '',
        secretKeyHex: '',
        label: 'あなたの鍵',
        createdAt: Date.now(),
      };

  const [myKeyPair, setMyKeyPair] = useState<RingKeyPair>(defaultKey);
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [signMessage, setSignMessage] = useState('');
  const [ringMembers, setRingMembers] = useState<RingMember[]>([]);
  const [newMemberPub, setNewMemberPub] = useState('');
  const [newMemberLabel, setNewMemberLabel] = useState('');

  const [generatedSignature, setGeneratedSignature] = useState<RingSignaturePackage | null>(null);
  const [signError, setSignError] = useState('');
  const [isSigning, setIsSigning] = useState(false);

  // Verifier State
  const [verifyInputJson, setVerifyInputJson] = useState('');
  const [verificationResult, setVerificationResult] = useState<RingVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Initialize ring with user's own key if available
  useEffect(() => {
    if (myKeyPair.publicKeyHex) {
      initDefaultRing(myKeyPair);
    }
  }, [myKeyPair.publicKeyHex]);

  const initDefaultRing = (key: RingKeyPair) => {
    const selfMember: RingMember = {
      publicKeyHex: key.publicKeyHex,
      label: key.label || 'あなた (署名者)',
      isSelf: true,
    };
    setRingMembers([selfMember]);
  };

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const res = [...arr];
    for (let i = res.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [res[i], res[j]] = [res[j], res[i]];
    }
    return res;
  };

  const handleAddDecoys = (count: number) => {
    const newDecoys = generateDummyRingMembers(count);
    setRingMembers((prev) => shuffleArray([...prev, ...newDecoys]));
  };

  const handleAddCustomMember = () => {
    const cleaned = newMemberPub.trim().toLowerCase();
    if (!cleaned || cleaned.length !== 64) {
      alert('有効な64文字のEd25519公開鍵Hexを入力してください');
      return;
    }
    if (ringMembers.some((m) => m.publicKeyHex.toLowerCase() === cleaned)) {
      alert('この公開鍵はすでにリングに含まれています');
      return;
    }

    const newMember: RingMember = {
      publicKeyHex: cleaned,
      label: newMemberLabel.trim() || `メンバー ${ringMembers.length + 1}`,
      isSelf: false,
    };

    setRingMembers((prev) => shuffleArray([...prev, newMember]));
    setNewMemberPub('');
    setNewMemberLabel('');
  };

  const handleRemoveMember = (pubHex: string) => {
    if (pubHex.toLowerCase() === myKeyPair.publicKeyHex.toLowerCase()) {
      alert('自身の公開鍵をリングから削除することはできません');
      return;
    }
    setRingMembers((prev) => prev.filter((m) => m.publicKeyHex.toLowerCase() !== pubHex.toLowerCase()));
  };

  const handleSign = () => {
    setSignError('');
    setGeneratedSignature(null);

    if (!myKeyPair.secretKeyHex || !myKeyPair.publicKeyHex) {
      setSignError('署名者の鍵ペアが設定されていません。「暗号鍵生成」ツールで生成してください');
      return;
    }

    if (!signMessage.trim()) {
      setSignError('署名対象のメッセージを入力してください');
      return;
    }

    if (ringMembers.length < 2) {
      setSignError('リング署名には最低2名以上（あなた + 1名以上のメンバー/おとり）が必要です');
      return;
    }

    setIsSigning(true);
    try {
      const publicKeys = ringMembers.map((m) => m.publicKeyHex);
      const pkg = createRingSignature(signMessage.trim(), publicKeys, myKeyPair.secretKeyHex);
      setGeneratedSignature(pkg);
    } catch (err: any) {
      setSignError(`リング署名作成エラー: ${err.message}`);
    } finally {
      setIsSigning(false);
    }
  };

  const handleVerify = () => {
    setVerificationResult(null);

    if (!verifyInputJson.trim()) {
      alert('検証対象のリング署名JSONを入力してください');
      return;
    }

    setIsVerifying(true);
    try {
      const pkg: RingSignaturePackage = JSON.parse(verifyInputJson.trim());
      const res = verifyRingSignature(pkg);
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult({
        isValid: false,
        ringSize: 0,
        anonymityScore: 'エラー',
        verifiedAt: Date.now(),
        error: `JSON解析エラーまたは署名形式無効: ${err.message}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadPackage = () => {
    if (!generatedSignature) return;
    const jsonStr = JSON.stringify(generatedSignature, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ring_signature_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">リング署名 (Ring Signature)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                Ed25519-SAG 準拠
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              「グループの誰か1人が署名した」ことを証明しつつ、署名者自身を数学的に完全匿名化
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('sign')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'sign' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>署名作成</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'verify' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>署名検証</span>
          </button>
        </div>
      </div>

      {/* Strict Key Notice Banner */}
      <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
        <span className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-indigo-400 shrink-0" />
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

      {/* Info Notice & Concept Accordion */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold">
            <Info className="w-4 h-4 text-indigo-400" />
            <span>リング署名とは？ なぜ署名者を特定できないのか？</span>
          </div>
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline"
          >
            {showExplanation ? '解説を閉じる' : '仕組みを詳しく'}
          </button>
        </div>
        <p className="text-slate-400 leading-relaxed text-[11px]">
          通常の電子署名は「誰が署名したか」を明かします。一方、<strong>リング署名（Monero / SAG方式）</strong>は、署名者が任意のおとり公開鍵群（リング）を指定し、数学的な輪（サイクル方程式）を一周させて閉じることで、<strong className="text-slate-200">「リングに含まれるN人のうち確実に誰か1人が署名した」</strong>ことを100%証明しながら、<strong className="text-slate-200">「誰が署名したのかは確率 1/N で完全に特定不能」</strong>にします。内部告発や匿名投票で極めて重要な技術です。
        </p>
      </div>

      {/* Mode 1: Sign Tab */}
      {activeTab === 'sign' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Signer Key & Message & Decoys */}
          <div className="lg:col-span-7 space-y-5 text-xs">
            {/* My Key Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  <span>あなたの署名用鍵ペア</span>
                </div>
                {onNavigateToKeyGenerator && (
                  <button
                    type="button"
                    onClick={onNavigateToKeyGenerator}
                    className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 text-[11px] font-semibold transition-colors"
                  >
                    <KeyRound className="w-3 h-3 text-indigo-400" />
                    <span>「暗号鍵生成」で鍵を生成</span>
                  </button>
                )}
              </div>

              {ringVaultKeys.length > 0 && (
                <div>
                  <select
                    value={selectedVaultKeyId}
                    onChange={(e) => {
                      setSelectedVaultKeyId(e.target.value);
                      const k = ringVaultKeys.find((item) => item.id === e.target.value);
                      if (k?.publicKeyPem && k?.privateKeyPem) {
                        const newKey: RingKeyPair = {
                          publicKeyHex: k.publicKeyPem,
                          secretKeyHex: k.privateKeyPem,
                          label: k.title,
                          createdAt: Date.now(),
                        };
                        setMyKeyPair(newKey);
                        initDefaultRing(newKey);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- 保管庫のリング署名キーから選択 --</option>
                    {ringVaultKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <div className="text-[11px] text-slate-400 mb-0.5 flex justify-between">
                    <span>あなたの公開鍵 (Ed25519 Hex):</span>
                    {myKeyPair.publicKeyHex && (
                      <button
                        type="button"
                        onClick={() => handleCopy(myKeyPair.publicKeyHex, 'myPub')}
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                      >
                        {copiedKey === 'myPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>コピー</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={myKeyPair.publicKeyHex}
                    onChange={(e) => {
                      const updated = { ...myKeyPair, publicKeyHex: e.target.value.trim() };
                      setMyKeyPair(updated);
                      if (updated.publicKeyHex) initDefaultRing(updated);
                    }}
                    placeholder="公開鍵Hexを入力または保管庫から選択..."
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-0.5 flex justify-between items-center">
                    <span>あなたの秘密鍵スカラー (Hex):</span>
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
                    >
                      {showSecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSecretKey ? '隠す' : '表示'}</span>
                    </button>
                  </div>
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    value={myKeyPair.secretKeyHex}
                    onChange={(e) => setMyKeyPair({ ...myKeyPair, secretKeyHex: e.target.value.trim() })}
                    placeholder="秘密鍵Hexを入力または保管庫から選択..."
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-rose-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Message Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block font-semibold text-slate-200">
                署名する声明文・内部告発メッセージ
              </label>
              <textarea
                value={signMessage}
                onChange={(e) => setSignMessage(e.target.value)}
                rows={4}
                placeholder="匿名で証明したいメッセージを入力..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-sans focus:outline-none focus:border-indigo-500 leading-relaxed text-xs"
              />
            </div>

            {/* Ring Members Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    <span>リング構成メンバー (計 {ringMembers.length} 名)</span>
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    おとり人数が多いほど匿名確率が上がります (特定確率: 1/{ringMembers.length})
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddDecoys(3)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition-colors"
                  >
                    +3名おとり追加
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddDecoys(5)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition-colors"
                  >
                    +5名おとり追加
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {ringMembers.map((member, idx) => (
                  <div
                    key={member.publicKeyHex + idx}
                    className={`flex items-center justify-between p-2 rounded-lg border text-[11px] ${
                      member.isSelf
                        ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-slate-500 w-4">{idx + 1}.</span>
                      <span className="font-medium truncate max-w-[130px]">{member.label}</span>
                      <span className="font-mono text-slate-400 truncate max-w-[200px]">
                        {member.publicKeyHex.slice(0, 16)}...{member.publicKeyHex.slice(-8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {member.isSelf ? (
                        <span className="px-1.5 py-0.5 bg-indigo-900/60 text-indigo-300 rounded text-[10px] font-semibold">
                          あなた (署名者)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.publicKeyHex)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="リングから削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Custom Member */}
              <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newMemberLabel}
                  onChange={(e) => setNewMemberLabel(e.target.value)}
                  placeholder="ラベル (例: 同僚A)"
                  className="w-full sm:w-28 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={newMemberPub}
                  onChange={(e) => setNewMemberPub(e.target.value)}
                  placeholder="追加するEd25519公開鍵Hex (64文字)..."
                  className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomMember}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shrink-0 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加</span>
                </button>
              </div>
            </div>

            {signError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{signError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSign}
              disabled={isSigning || !myKeyPair.secretKeyHex || !signMessage.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm text-xs"
            >
              <FileSignature className="w-4 h-4" />
              <span>{isSigning ? '署名を計算中...' : 'リング署名を作成 (1/N 匿名化)'}</span>
            </button>
          </div>

          {/* Right Column: Signature Result */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            {generatedSignature ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Check className="w-4 h-4" />
                    <span>リング署名作成完了</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(generatedSignature, null, 2), 'sigJson')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 text-[11px]"
                    >
                      {copiedKey === 'sigJson' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPackage}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 text-[11px]"
                    >
                      <Download className="w-3 h-3" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">匿名化リング規模:</span>
                    <span className="font-mono font-bold text-indigo-300">{generatedSignature.ring.length} 名</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">外部からの特定確率:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      1 / {generatedSignature.ring.length} ({((1 / generatedSignature.ring.length) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    署名パッケージ JSON (署名検証タブへ共有可)
                  </span>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[10px] text-slate-300 max-h-60 overflow-y-auto select-all whitespace-pre-wrap break-all leading-normal">
                    {JSON.stringify(generatedSignature, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-slate-400 font-semibold text-xs">署名が未生成です</div>
                <div className="text-[11px] text-slate-500">
                  左側で鍵とおとりを設定し、メッセージを入力して「リング署名を作成」を実行してください
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Verify Tab */}
      {activeTab === 'verify' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-semibold text-slate-200">検証用 署名パッケージ (JSON)</h3>
              {generatedSignature && (
                <button
                  type="button"
                  onClick={() => setVerifyInputJson(JSON.stringify(generatedSignature, null, 2))}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300"
                >
                  生成済み署名を貼り付け
                </button>
              )}
            </div>

            <textarea
              value={verifyInputJson}
              onChange={(e) => setVerifyInputJson(e.target.value)}
              rows={12}
              placeholder="リング署名パッケージ JSON を貼り付けてください..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 leading-normal"
            />

            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm text-xs"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isVerifying ? 'リング方程式を検証中...' : '署名を数学的に検証 (Verify)'}</span>
            </button>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-200 pb-2 border-b border-slate-800">
              検証結果 &amp; 暗号学的証明
            </h3>

            {verificationResult ? (
              <div className="space-y-4">
                {verificationResult.isValid ? (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-700/60 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>真正なリング署名 (VALID)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      このメッセージは、リングに含まれる <strong>{verificationResult.ringSize} 名の誰か1人</strong> によって確実に署名されたことが暗号学的に証明されました。
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-950/30 border border-rose-700/60 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>署名検証失敗 (INVALID)</span>
                    </div>
                    <p className="text-[11px] text-rose-200 leading-relaxed">
                      {verificationResult.error || 'リング方程式が閉じませんでした。メッセージまたは公開鍵が改ざんされています。'}
                    </p>
                  </div>
                )}

                <div className="space-y-2 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">リングサイズ:</span>
                    <span className="font-mono font-bold text-slate-200">{verificationResult.ringSize} 名</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">署名者特定確率:</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {verificationResult.isValid && verificationResult.ringSize > 0
                        ? `1 / ${verificationResult.ringSize} (${((1 / verificationResult.ringSize) * 100).toFixed(1)}%)`
                        : '0%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">匿名性スコア:</span>
                    <span className="font-semibold text-emerald-400">{verificationResult.anonymityScore}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <ShieldAlert className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-slate-400 font-medium">検証が未実行です</div>
                <div className="text-[11px] text-slate-500">左側に署名JSONを入力して検証を実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
