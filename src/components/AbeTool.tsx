import React, { useState } from 'react';
import {
  generateMasterAuthority,
  issueUserKey,
  encryptWithPolicy,
  decryptWithUserKey,
  evaluatePolicyTree,
  MasterAuthority,
  UserSecretKey,
  AbeCipherPackage,
} from '../utils/abeUtils';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Users,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  FileText,
  Tag,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const AbeTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encrypt' | 'decrypt' | 'keys'>('encrypt');

  // Authority & Master Key
  const [authority] = useState<MasterAuthority>(() => generateMasterAuthority());

  // Available Presets for Personas
  const [userKeys, setUserKeys] = useState<UserSecretKey[]>(() => [
    issueUserKey(authority, 'Dr. Alice (外科部長)', ['role:doctor', 'dept:surgery', 'level:lead']),
    issueUserKey(authority, 'Dr. Bob (腫瘍内科医)', ['role:doctor', 'dept:oncology']),
    issueUserKey(authority, 'Nurse Carol (看護師)', ['role:nurse', 'dept:surgery']),
    issueUserKey(authority, 'Director Dave (病院長)', ['role:director']),
  ]);

  // Persona Creation State
  const [newUserId, setNewUserId] = useState('');
  const [newUserAttributes, setNewUserAttributes] = useState('');

  // Encryption State
  const [policyExpr, setPolicyExpr] = useState(
    '(role:doctor AND dept:surgery) OR role:director'
  );
  const [secretMessage, setSecretMessage] = useState(
    '極秘手術計画書: 患者ID #98421 に関する機密カルテ情報および執刀プロトコルです。'
  );
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [cipherPackage, setCipherPackage] = useState<AbeCipherPackage | null>(null);
  const [encryptError, setEncryptError] = useState('');

  // Decryption State
  const [selectedUserIndex, setSelectedUserIndex] = useState<number>(0);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const handleAddUser = () => {
    if (!newUserId.trim() || !newUserAttributes.trim()) return;
    const attrs = newUserAttributes
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const uKey = issueUserKey(authority, newUserId.trim(), attrs);
    setUserKeys((prev) => [...prev, uKey]);
    setNewUserId('');
    setNewUserAttributes('');
  };

  const handleEncrypt = async () => {
    setEncryptError('');
    setCipherPackage(null);
    setDecryptedText(null);
    setDecryptError(null);

    if (!policyExpr.trim() || !secretMessage.trim()) {
      setEncryptError('アクセスポリシーと秘密メッセージを入力してください');
      return;
    }

    setIsEncrypting(true);
    try {
      const pkg = await encryptWithPolicy(secretMessage.trim(), policyExpr.trim(), authority);
      setCipherPackage(pkg);
    } catch (err: any) {
      setEncryptError(err.message || '暗号化に失敗しました');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleAttemptDecrypt = async () => {
    if (!cipherPackage) return;
    setDecryptedText(null);
    setDecryptError(null);

    const targetUser = userKeys[selectedUserIndex];
    if (!targetUser) return;

    try {
      const plaintext = await decryptWithUserKey(cipherPackage, targetUser, authority);
      setDecryptedText(plaintext);
    } catch (err: any) {
      setDecryptError(err.message || '復号に失敗しました');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">属性ベース暗号 (CP-ABE) スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono font-medium">
                Ciphertext-Policy ABE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              「役職:医師 AND 診療科:外科」などの属性論理式ポリシーで暗号化し、条件を満たす人のみ数学的に復号
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('encrypt')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'encrypt'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ポリシー暗号化 &amp; 復号テスト</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('keys')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'keys'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>ユーザー属性鍵の管理 ({userKeys.length}名)</span>
          </button>
        </div>
      </div>

      {/* Concept Notice */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-semibold">
          <Info className="w-4 h-4 text-amber-400" />
          <span>属性ベース暗号（ABE: Attribute-Based Encryption）の仕組み</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          従来の公開鍵暗号では「特定の宛先 1 人の公開鍵」に対して暗号化していました。
          <strong>CP-ABE（Ciphertext-Policy ABE）</strong>は、暗号文そのものに<strong>「誰が開けられるかのアクセス論理式」</strong>を直接埋め込みます。受信者の秘密鍵は「所持する属性セット」に紐づいており、論理式を満たす人だけが暗号文の木構造（Shamir秘密分散シェア）を数学的に復元して復号できます。
        </p>
      </div>

      {/* Main Tab: Encryption & Decryption Simulation */}
      {activeTab === 'encrypt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Policy & Message Input */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>1. アクセスポリシーと秘密メッセージの指定</span>
            </h3>

            {/* Policy Expression */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-slate-300 font-semibold">アクセスポリシー論理式</label>
                <span className="text-[10px] text-slate-500 font-mono">AND, OR, 括弧 () に対応</span>
              </div>
              <input
                type="text"
                value={policyExpr}
                onChange={(e) => setPolicyExpr(e.target.value)}
                placeholder="例: (role:doctor AND dept:surgery) OR role:director"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
              />

              {/* Policy Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500">プリセット例:</span>
                {[
                  '(role:doctor AND dept:surgery) OR role:director',
                  'role:doctor AND dept:oncology',
                  'dept:surgery OR role:director',
                  '(role:doctor OR role:nurse) AND dept:surgery',
                ].map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPolicyExpr(preset)}
                    className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Secret Message */}
            <div className="space-y-1.5">
              <label className="block text-slate-300 font-semibold">保護する秘密メッセージ</label>
              <textarea
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                rows={4}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-sans focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>

            {encryptError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                {encryptError}
              </div>
            )}

            <button
              type="button"
              onClick={handleEncrypt}
              disabled={isEncrypting}
              className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-sm text-xs"
            >
              <Lock className="w-4 h-4" />
              <span>ポリシーで暗号化を実行</span>
            </button>

            {cipherPackage && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">暗号化パッケージ作成完了:</span>
                  <span className="font-mono text-emerald-400">CP-ABE-AES256GCM</span>
                </div>
                <div className="font-mono text-[10px] text-amber-300/80 truncate">
                  暗号文 (AES-GCM): {cipherPackage.ciphertextBase64.slice(0, 48)}...
                </div>
                <div className="text-[10px] text-slate-500">
                  暗号文にはポリシー木構造と各葉ノードの分散暗号シェアが含まれています。
                </div>
              </div>
            )}
          </div>

          {/* Right: Decryption Simulation */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Unlock className="w-4 h-4 text-amber-400" />
              <span>2. 受信者の属性によるアクセス制御・復号テスト</span>
            </h3>

            <div className="space-y-1.5">
              <label className="block text-slate-300 font-semibold">復号を試みるユーザーを選択</label>
              <div className="space-y-1.5">
                {userKeys.map((u, idx) => {
                  const isSelected = selectedUserIndex === idx;
                  let willSatisfy = false;
                  if (cipherPackage) {
                    willSatisfy = evaluatePolicyTree(cipherPackage.policyTree, u.attributes);
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedUserIndex(idx);
                        setDecryptedText(null);
                        setDecryptError(null);
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-950/30 border-amber-500 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-200 truncate">{u.userId}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {u.attributes.map((attr, aIdx) => (
                            <span
                              key={aIdx}
                              className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono"
                            >
                              {attr}
                            </span>
                          ))}
                        </div>
                      </div>

                      {cipherPackage && (
                        <div className="shrink-0 text-right">
                          {willSatisfy ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                              条件一致 (可)
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                              条件不一致 (不可)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAttemptDecrypt}
              disabled={!cipherPackage}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-sm text-xs"
            >
              <Unlock className="w-4 h-4" />
              <span>選択したユーザーの属性鍵で復号を試行</span>
            </button>

            {decryptedText && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-700/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>復号成功！ポリシーを満たしています</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-sans leading-relaxed select-all">
                  {decryptedText}
                </div>
              </div>
            )}

            {decryptError && (
              <div className="p-4 bg-rose-950/30 border border-rose-700/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>アクセス拒否 (復号不可)</span>
                </div>
                <p className="text-[11px] text-rose-200 leading-relaxed">{decryptError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Keys & Persona Management */}
      {activeTab === 'keys' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>ユーザー属性鍵の発行センター (Key Distribution Center)</span>
              </h3>
              <p className="text-slate-400 text-[11px]">
                マスターオーソリティ（認証局）が、各ユーザーの身元と役職属性に紐づく秘密鍵を発行します。
              </p>
            </div>
            <span className="font-mono text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              Authority ID: {authority.publicParamsId}
            </span>
          </div>

          {/* User keys list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userKeys.map((u, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div className="font-bold text-slate-200 text-xs">{u.userId}</div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Token #{idx + 1}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400">付与された属性セット:</div>
                  <div className="flex flex-wrap gap-1">
                    {u.attributes.map((a, aIdx) => (
                      <span
                        key={aIdx}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-amber-300 font-mono"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-1 text-[10px] font-mono text-slate-500 truncate">
                  ブラインディング値: {u.userBlindingHex.slice(0, 16)}...
                </div>
              </div>
            ))}
          </div>

          {/* Add custom persona form */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>新しいユーザー属性秘密鍵を発行</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <input
                type="text"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="ユーザー名 (例: Dr. Frank)"
                className="sm:col-span-4 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={newUserAttributes}
                onChange={(e) => setNewUserAttributes(e.target.value)}
                placeholder="カンマ区切りの属性 (例: role:doctor, dept:cardiology, level:senior)"
                className="sm:col-span-6 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddUser}
                className="sm:col-span-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center justify-center gap-1 text-xs shadow-sm"
              >
                <span>発行</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
