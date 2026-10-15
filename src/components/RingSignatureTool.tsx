import React, { useState, useEffect } from 'react';
import {
  generateRingKeyPair,
  generateDummyRingMembers,
  createRingSignature,
  verifyRingSignature,
  RingKeyPair,
  RingMember,
  RingSignaturePackage,
  RingVerificationResult,
} from '../utils/ringSignatureUtils';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  UserCheck,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  FileSignature,
  Download,
  AlertTriangle,
  Info,
  HelpCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const RingSignatureTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sign' | 'verify'>('sign');

  // Signer State
  const [myKeyPair, setMyKeyPair] = useState<RingKeyPair>(() => generateRingKeyPair('私の匿名鍵'));
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [signMessage, setSignMessage] = useState(
    '私は監査対象組織の役員の一人です。2026年第3四半期の不正会計および内部隠蔽の事実を告発・証明します。'
  );
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

  // Initialize ring members with self + 3 decoys
  useEffect(() => {
    initDefaultRing(myKeyPair);
  }, []);

  const initDefaultRing = (key: RingKeyPair) => {
    const decoys = generateDummyRingMembers(3);
    const selfMember: RingMember = {
      publicKeyHex: key.publicKeyHex,
      label: 'あなた (実際の署名者)',
      isSelf: true,
    };
    // Shuffle members so self is not always first
    const list = [selfMember, ...decoys];
    setRingMembers(shuffleArray(list));
  };

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const res = [...arr];
    for (let i = res.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [res[i], res[j]] = [res[j], res[i]];
    }
    return res;
  };

  const handleRegenerateMyKey = () => {
    const newKey = generateRingKeyPair('私の匿名鍵');
    setMyKeyPair(newKey);
    initDefaultRing(newKey);
    setGeneratedSignature(null);
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

    setRingMembers((prev) => [
      ...prev,
      {
        publicKeyHex: cleaned,
        label: newMemberLabel.trim() || `外部公開鍵 (${cleaned.slice(0, 8)}...)`,
        isSelf: cleaned === myKeyPair.publicKeyHex.toLowerCase(),
      },
    ]);
    setNewMemberPub('');
    setNewMemberLabel('');
  };

  const handleRemoveMember = (index: number) => {
    if (ringMembers[index].isSelf) {
      alert('自身の公開鍵は削除できません（署名に必要なため）');
      return;
    }
    if (ringMembers.length <= 2) {
      alert('リングには最低2つ以上の公開鍵が必要です');
      return;
    }
    setRingMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSign = () => {
    setSignError('');
    setGeneratedSignature(null);

    if (!signMessage.trim()) {
      setSignError('署名するメッセージを入力してください');
      return;
    }

    setIsSigning(true);
    try {
      const pubKeys = ringMembers.map((m) => m.publicKeyHex);
      const sig = createRingSignature(signMessage.trim(), pubKeys, myKeyPair.secretKeyHex);
      setGeneratedSignature(sig);
    } catch (err: any) {
      setSignError(err.message || '署名生成に失敗しました');
    } finally {
      setIsSigning(false);
    }
  };

  const handleSendToVerify = () => {
    if (!generatedSignature) return;
    setVerifyInputJson(JSON.stringify(generatedSignature, null, 2));
    setActiveTab('verify');
    // Auto-verify
    const res = verifyRingSignature(generatedSignature);
    setVerificationResult(res);
  };

  const handleVerify = () => {
    if (!verifyInputJson.trim()) {
      setVerificationResult({
        isValid: false,
        ringSize: 0,
        anonymityScore: '0%',
        verifiedAt: Date.now(),
        error: '検証するリング署名JSONを入力してください',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const parsed = JSON.parse(verifyInputJson);
      const res = verifyRingSignature(parsed);
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult({
        isValid: false,
        ringSize: 0,
        anonymityScore: '0%',
        verifiedAt: Date.now(),
        error: `JSON解析エラー: ${err.message}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">リング署名 (Ring Signature)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60 font-mono font-medium">
                Ed25519-SAG 準拠
              </span>
            </div>
            <p className="text-xs text-slate-400">
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
              activeTab === 'sign'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>署名作成</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'verify'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>署名検証</span>
          </button>
        </div>
      </div>

      {/* Info Notice & Concept Accordion */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-violet-300 font-semibold">
            <Info className="w-4 h-4 text-violet-400" />
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
          通常の電子署名は「誰が署名したか」を明かします。一方、<strong>リング署名（Rivest-Shamir-Tauman / Monero方式）</strong>は、署名者が任意のおとり公開鍵群（リング）を指定し、数学的な輪（サイクル方程式）を一周させて閉じることで、<strong className="text-slate-200">「リングに含まれるN人のうち確実に誰か1人が署名した」</strong>ことを100%証明しながら、<strong className="text-slate-200">「誰が署名したのかは確率 1/N で完全に特定不能」</strong>にします。内部告発や匿名投票、秘密送金で極めて重要な技術です。
        </p>

        {showExplanation && (
          <div className="pt-2 mt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-400">
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
              <div className="font-semibold text-slate-200">1. おとりの同意が不要</div>
              <p>リングに含める他者の公開鍵は、本人の許可や事前の協力なしに自由に追加できます。</p>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
              <div className="font-semibold text-slate-200">2. 数学的な否認可能性</div>
              <p>検証者はN個のレスポンスを見ても、どれが本物の鍵でどれがおとり乱数かを区別できません。</p>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 space-y-1">
              <div className="font-semibold text-slate-200">3. 改竄は1ビットでも不可能</div>
              <p>メッセージやリング内の鍵が1文字でも改ざんされると、輪（サイクル）が閉じず検証は即座に失敗します。</p>
            </div>
          </div>
        )}
      </div>

      {/* Mode 1: Sign Tab */}
      {activeTab === 'sign' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Signer Key & Message & Decoys */}
          <div className="lg:col-span-7 space-y-5 text-xs">
            {/* My Key Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-violet-400" />
                  <span>あなたの署名用鍵ペア</span>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateMyKey}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-[11px] transition-colors"
                  title="新しい鍵ペアをランダム生成"
                >
                  <RefreshCw className="w-3 h-3 text-violet-400" />
                  <span>新しい鍵を再生成</span>
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-[11px] text-slate-400 mb-0.5 flex justify-between">
                    <span>あなたの公開鍵 (Ed25519):</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(myKeyPair.publicKeyHex, 'myPub')}
                      className="text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                    >
                      {copiedKey === 'myPub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-emerald-400 break-all select-all">
                    {myKeyPair.publicKeyHex}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-0.5 flex justify-between items-center">
                    <span>あなたの秘密鍵スカラー:</span>
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px]"
                    >
                      {showSecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSecretKey ? '隠す' : '表示'}</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-rose-300 break-all select-all">
                    {showSecretKey
                      ? myKeyPair.secretKeyHex
                      : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                </div>
              </div>
            </div>

            {/* Message Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <label className="block font-bold text-slate-200">
                署名する声明文・内部告発メッセージ
              </label>
              <textarea
                value={signMessage}
                onChange={(e) => setSignMessage(e.target.value)}
                rows={4}
                placeholder="匿名で証明したいメッセージを入力..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-sans focus:outline-none focus:border-violet-500 leading-relaxed"
              />
            </div>

            {/* Ring Members (Decoys) Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-violet-400" />
                    <span>リング構成メンバー ({ringMembers.length} 人)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    現在の匿名度: 署名者特定確率 <strong>1/{ringMembers.length} ({((1 / ringMembers.length) * 100).toFixed(1)}%)</strong>
                  </p>
                </div>

                {/* Quick Add Preset Decoys */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 hidden sm:inline">おとり追加:</span>
                  <button
                    type="button"
                    onClick={() => handleAddDecoys(1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                  >
                    +1人
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddDecoys(3)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                  >
                    +3人
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddDecoys(5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                  >
                    +5人
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {ringMembers.map((member, idx) => {
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                        member.isSelf
                          ? 'bg-violet-950/30 border-violet-700/60 text-violet-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-200 truncate">{member.label}</span>
                          {member.isSelf ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-600 text-white font-medium">
                              あなた
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              おとり #{idx + 1}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                          {member.publicKeyHex}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(member.publicKeyHex, `pub-${idx}`)}
                          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          title="公開鍵をコピー"
                        >
                          {copiedKey === `pub-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {!member.isSelf && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(idx)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                            title="リングから削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Member Form */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newMemberLabel}
                  onChange={(e) => setNewMemberLabel(e.target.value)}
                  placeholder="ラベル (例: 財務部長)"
                  className="sm:w-1/3 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-violet-500 text-[11px]"
                />
                <input
                  type="text"
                  value={newMemberPub}
                  onChange={(e) => setNewMemberPub(e.target.value)}
                  placeholder="Ed25519 公開鍵 (64文字Hex)"
                  className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-violet-500 text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomMember}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1 shrink-0 text-[11px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加</span>
                </button>
              </div>
            </div>

            {signError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                {signError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSign}
              disabled={isSigning || ringMembers.length < 2}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-950/40 transition-all text-sm"
            >
              {isSigning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>リング署名を計算中...</span>
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" />
                  <span>匿名リング署名を生成 ({ringMembers.length}人リング)</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Signature Output */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-violet-400" />
                  <span>生成されたリング署名パッケージ</span>
                </div>
                {generatedSignature && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                    生成成功
                  </span>
                )}
              </div>

              {generatedSignature ? (
                <div className="space-y-3">
                  <div className="p-3 bg-violet-950/20 border border-violet-800/40 rounded-lg space-y-1 text-slate-300">
                    <div className="font-semibold text-violet-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      <span>完全匿名性の数学的保証</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      署名データにはあなたの公開鍵・秘密鍵の識別情報は一切露出しません。第三者から見ると、リング内のどのメンバーも等しい確率で署名者候補となります。
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>署名パッケージ JSON:</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(JSON.stringify(generatedSignature, null, 2), 'sigJson')
                        }
                        className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                      >
                        {copiedKey === 'sigJson' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>JSONコピー</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={JSON.stringify(generatedSignature, null, 2)}
                      rows={12}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[10px] text-slate-300 focus:outline-none select-all"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSendToVerify}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <span>検証タブでテスト検証</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-2">
                  <FileSignature className="w-8 h-8 mx-auto text-slate-600" />
                  <div className="text-slate-400 font-medium">署名が未生成です</div>
                  <div className="text-[11px] text-slate-500">
                    左側のパネルでメッセージを入力し、「匿名リング署名を生成」を実行してください。
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Verify Tab */}
      {activeTab === 'verify' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          {/* Input JSON */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-violet-400" />
                <span>検証対象リング署名 (JSON)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (generatedSignature) {
                    setVerifyInputJson(JSON.stringify(generatedSignature, null, 2));
                  }
                }}
                className="text-[11px] text-violet-400 hover:text-violet-300"
              >
                生成済み署名を貼り付け
              </button>
            </div>

            <textarea
              value={verifyInputJson}
              onChange={(e) => setVerifyInputJson(e.target.value)}
              rows={14}
              placeholder="リング署名パッケージ JSON を貼り付けてください..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-200 focus:outline-none focus:border-violet-500 leading-normal"
            />

            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-950/40 transition-all text-sm"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>リング方程式を検証中...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>署名を数学的に検証 (Verify)</span>
                </>
              )}
            </button>
          </div>

          {/* Verification Results Panel */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 pb-2 border-b border-slate-800">
              検証結果 &amp; 暗号学的証明
            </h3>

            {verificationResult ? (
              <div className="space-y-4">
                {verificationResult.isValid ? (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-700/60 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>真正なリング署名 (VALID)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      このメッセージは、リングに含まれる <strong>{verificationResult.ringSize} 名の誰か1人</strong> によって確実に署名されたことが暗号学的に証明されました。
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-950/30 border border-rose-700/60 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                      <span>署名検証失敗 (INVALID)</span>
                    </div>
                    <p className="text-[11px] text-rose-200 leading-relaxed">
                      {verificationResult.error || 'リング方程式が閉じませんでした。メッセージまたは公開鍵が改ざんされている可能性があります。'}
                    </p>
                  </div>
                )}

                {/* Metrics */}
                <div className="space-y-2 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">リングサイズ (候補人数):</span>
                    <span className="font-mono font-bold text-slate-200">
                      {verificationResult.ringSize} 名
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">署名者特定確率:</span>
                    <span className="font-mono font-bold text-violet-300">
                      {verificationResult.isValid && verificationResult.ringSize > 0
                        ? `1 / ${verificationResult.ringSize} (${((1 / verificationResult.ringSize) * 100).toFixed(1)}%)`
                        : '0%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">匿名性評価:</span>
                    <span className="font-semibold text-emerald-400">
                      {verificationResult.anonymityScore}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">検証アルゴリズム:</span>
                    <span className="font-mono text-slate-300">Ed25519-SAG (Schnorr Ring)</span>
                  </div>
                </div>

                {/* Tamper testing hint */}
                <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1 text-slate-400 text-[11px]">
                  <div className="font-semibold text-slate-300 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-violet-400" />
                    <span>改ざん耐性テスト</span>
                  </div>
                  <p>
                    左のJSONでメッセージ（"message"）の文字を1文字変えるか、公開鍵を1文字でも変更して再検証してみてください。リング方程式が即座に崩壊し、不正が検知されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-2">
                <ShieldAlert className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-slate-400 font-medium">検証が未実行です</div>
                <div className="text-[11px] text-slate-500">
                  左側に署名JSONを入力して「署名を数学的に検証」をクリックしてください。
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
