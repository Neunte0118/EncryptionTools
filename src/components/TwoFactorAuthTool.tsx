import React, { useState, useEffect } from 'react';
import {
  generateTOTP,
  generateHOTP,
  verifyTOTP,
  parseOtpAuthUri,
  TotpAlgorithm,
} from '../utils/totpUtils';
import {
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Plus,
  Trash2,
  FileDown,
  FileUp,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  X,
  Save,
} from 'lucide-react';

export interface Stored2FAAccount {
  id: string;
  label: string;
  issuer?: string;
  secret: string;
  type: 'totp' | 'hotp';
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  counter: number;
  createdAt: string;
}

const STORAGE_KEY = 'encryption_tools_local_2fa_accounts';

export const TwoFactorAuthTool: React.FC = () => {
  const [accounts, setAccounts] = useState<Stored2FAAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((a) => a.id !== 'demo-1' && a.label !== 'developer@example.com');
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [now, setNow] = useState<number>(Date.now());
  const [activeTab, setActiveTab] = useState<'authenticator' | 'generator' | 'verify' | 'import-export'>('authenticator');

  // Codes map
  const [codes, setCodes] = useState<
    Record<string, { code: string; remainingSeconds: number; period: number }>
  >({});

  // New account form state
  const [newLabel, setNewLabel] = useState('');
  const [newIssuer, setNewIssuer] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [showNewSecret, setShowNewSecret] = useState(false);
  const [newType, setNewType] = useState<'totp' | 'hotp'>('totp');
  const [newAlgo, setNewAlgo] = useState<TotpAlgorithm>('SHA-1');
  const [newDigits, setNewDigits] = useState<number>(6);
  const [newPeriod, setNewPeriod] = useState<number>(30);

  // Edit account state
  const [editingAccount, setEditingAccount] = useState<Stored2FAAccount | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIssuer, setEditIssuer] = useState('');
  const [editSecret, setEditSecret] = useState('');
  const [showEditSecret, setShowEditSecret] = useState(false);
  const [editType, setEditType] = useState<'totp' | 'hotp'>('totp');
  const [editAlgo, setEditAlgo] = useState<TotpAlgorithm>('SHA-1');
  const [editDigits, setEditDigits] = useState<number>(6);
  const [editPeriod, setEditPeriod] = useState<number>(30);
  const [editCounter, setEditCounter] = useState<number>(0);

  // Verifier tool state
  const [verifySecret, setVerifySecret] = useState('');
  const [showVerifySecret, setShowVerifySecret] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyWindow, setVerifyWindow] = useState<number>(1);
  const [verifyResult, setVerifyResult] = useState<{
    tested: boolean;
    valid?: boolean;
    message?: string;
  }>({ tested: false });

  // URI parser tool state
  const [rawUriInput, setRawUriInput] = useState('');
  const [uriParseError, setUriParseError] = useState<string | null>(null);

  // Copy status
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Save accounts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.error('Failed to save 2FA accounts:', e);
    }
  }, [accounts]);

  // Tick clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recalculate OTP codes for all accounts
  useEffect(() => {
    let cancelled = false;

    async function updateCodes() {
      const nextCodes: Record<string, { code: string; remainingSeconds: number; period: number }> = {};
      for (const acc of accounts) {
        if (acc.type === 'totp') {
          try {
            const res = await generateTOTP(acc.secret, {
              period: acc.period,
              digits: acc.digits,
              algorithm: acc.algorithm,
              timestampMs: now,
            });
            nextCodes[acc.id] = {
              code: res.code,
              remainingSeconds: res.remainingSeconds,
              period: res.period,
            };
          } catch {
            nextCodes[acc.id] = { code: 'ERR', remainingSeconds: 0, period: 30 };
          }
        } else {
          try {
            const code = await generateHOTP(acc.secret, acc.counter, {
              digits: acc.digits,
              algorithm: acc.algorithm,
            });
            nextCodes[acc.id] = { code, remainingSeconds: 0, period: 0 };
          } catch {
            nextCodes[acc.id] = { code: 'ERR', remainingSeconds: 0, period: 0 };
          }
        }
      }
      if (!cancelled) {
        setCodes(nextCodes);
      }
    }

    updateCodes();
    return () => {
      cancelled = true;
    };
  }, [accounts, now]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleAddAccount = () => {
    if (!newSecret.trim()) return;
    const newAccount: Stored2FAAccount = {
      id: `2fa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      label: newLabel.trim() || 'アカウント',
      issuer: newIssuer.trim() || undefined,
      secret: newSecret.trim().toUpperCase(),
      type: newType,
      algorithm: newAlgo,
      digits: newDigits,
      period: newPeriod,
      counter: 0,
      createdAt: new Date().toISOString(),
    };
    setAccounts((prev) => [newAccount, ...prev]);
    setNewSecret('');
    setNewLabel('');
    setNewIssuer('');
    setActiveTab('authenticator');
  };

  const handleStartEdit = (account: Stored2FAAccount) => {
    setEditingAccount(account);
    setEditLabel(account.label);
    setEditIssuer(account.issuer || '');
    setEditSecret(account.secret);
    setShowEditSecret(false);
    setEditType(account.type);
    setEditAlgo(account.algorithm);
    setEditDigits(account.digits);
    setEditPeriod(account.period || 30);
    setEditCounter(account.counter || 0);
  };

  const handleSaveEdit = () => {
    if (!editingAccount || !editSecret.trim()) return;

    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id === editingAccount.id) {
          return {
            ...a,
            label: editLabel.trim() || 'アカウント',
            issuer: editIssuer.trim() || undefined,
            secret: editSecret.trim().toUpperCase(),
            type: editType,
            algorithm: editAlgo,
            digits: editDigits,
            period: editPeriod,
            counter: editCounter,
          };
        }
        return a;
      })
    );
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    if (editingAccount?.id === id) {
      setEditingAccount(null);
    }
  };

  const handleIncrementHotpCounter = async (id: string) => {
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return { ...a, counter: a.counter + 1 };
        }
        return a;
      })
    );
  };

  const handleImportUri = () => {
    try {
      setUriParseError(null);
      const parsed = parseOtpAuthUri(rawUriInput);
      const newAccount: Stored2FAAccount = {
        id: `2fa-${Date.now()}`,
        label: parsed.label,
        issuer: parsed.issuer,
        secret: parsed.secret,
        type: parsed.type,
        algorithm: parsed.algorithm || 'SHA-1',
        digits: parsed.digits || 6,
        period: parsed.period || 30,
        counter: parsed.counter || 0,
        createdAt: new Date().toISOString(),
      };
      setAccounts((prev) => [newAccount, ...prev]);
      setRawUriInput('');
      setActiveTab('authenticator');
    } catch (err: any) {
      setUriParseError(err.message || 'URIの解析に失敗しました');
    }
  };

  const handleVerifyCheck = async () => {
    if (!verifySecret || !verifyCode) return;
    try {
      const res = await verifyTOTP(verifyCode, verifySecret, {
        window: verifyWindow,
        timestampMs: Date.now(),
      });
      if (res.valid) {
        const deltaVal = res.delta ?? 0;
        setVerifyResult({
          tested: true,
          valid: true,
          message:
            deltaVal === 0
              ? '認証成功: コードは現在ステップと完全に一致しています。'
              : `認証成功: 時間ドリフト ${deltaVal > 0 ? `+${deltaVal}` : deltaVal} ステップを許容して認証されました。`,
        });
      } else {
        setVerifyResult({
          tested: true,
          valid: false,
          message: '認証失敗: トークンが無効か、有効期限が切れています。シークレットキーと時刻を確認してください。',
        });
      }
    } catch (err: any) {
      setVerifyResult({
        tested: true,
        valid: false,
        message: `エラー: ${err.message || '検証処理に失敗しました'}`,
      });
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(accounts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `local-2fa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setAccounts((prev) => {
            const existingSecrets = new Set(prev.map((p) => p.secret));
            const fresh = json.filter((j: any) => j.secret && !existingSecrets.has(j.secret));
            return [...fresh, ...prev];
          });
          setActiveTab('authenticator');
        }
      } catch (err) {
        console.error('JSON parse error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">2要素認証管理</h2>
        </div>

        <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('authenticator')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'authenticator'
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            コード一覧
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('generator')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'generator'
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            新規登録
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'verify'
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            検証
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import-export')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'import-export'
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            入出力
          </button>
        </div>
      </div>

      {/* Tab: Authenticator Dashboard */}
      {activeTab === 'authenticator' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>登録済みアカウント {accounts.length} 件</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-400 tabular-nums">
                現在時刻: {new Date(now).toLocaleTimeString()}
              </span>
              <button
                onClick={() => setActiveTab('generator')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>アカウント追加</span>
              </button>
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
              <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">
                2FA アカウントが登録されていません
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                「アカウント新規登録」タブからシークレットキーを入力またはURIを読み込んでアカウントを作成してください。
              </p>
              <button
                onClick={() => setActiveTab('generator')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                アカウントを新規登録
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => {
                const info = codes[acc.id] || { code: '------', remainingSeconds: 0, period: 30 };
                const isHotp = acc.type === 'hotp';
                const percent = isHotp
                  ? 100
                  : Math.max(0, Math.min(100, (info.remainingSeconds / (acc.period || 30)) * 100));

                return (
                  <div
                    key={acc.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all shadow-sm space-y-3"
                  >
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {acc.issuer && (
                          <div className="text-xs font-semibold text-indigo-400 truncate">
                            {acc.issuer}
                          </div>
                        )}
                        <div className="text-sm font-bold text-slate-200 truncate">
                          {acc.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(acc)}
                          className="p-1 rounded text-slate-500 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                          title="アカウントを編集"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="アカウントを削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* OTP Display */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-2xl font-mono font-bold tracking-widest text-slate-100 tabular-nums">
                          {info.code.length === 6
                            ? `${info.code.slice(0, 3)} ${info.code.slice(3)}`
                            : info.code}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {acc.algorithm} · {acc.digits}桁 {isHotp ? `· カウンタ: ${acc.counter}` : `· ${acc.period}秒周期`}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isHotp ? (
                          <button
                            onClick={() => handleIncrementHotpCounter(acc.id)}
                            className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="カウンタを進めて次を生成"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="relative w-8 h-8 flex items-center justify-center">
                            <svg className="w-8 h-8 transform -rotate-90">
                              <circle
                                cx="16"
                                cy="16"
                                r="12"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className="text-slate-800"
                                fill="transparent"
                              />
                              <circle
                                cx="16"
                                cy="16"
                                r="12"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className={`transition-all duration-300 ${
                                  info.remainingSeconds <= 5
                                    ? 'text-rose-500'
                                    : info.remainingSeconds <= 10
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                                }`}
                                fill="transparent"
                                strokeDasharray={75.4}
                                strokeDashoffset={75.4 - (75.4 * percent) / 100}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-[10px] font-mono tabular-nums font-semibold text-slate-300">
                              {info.remainingSeconds}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => handleCopy(info.code, acc.id)}
                          className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="コードをコピー"
                        >
                          {copiedId === acc.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>アカウント情報の編集</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Issuer・サービス名</label>
                <input
                  type="text"
                  value={editIssuer}
                  onChange={(e) => setEditIssuer(e.target.value)}
                  placeholder="例: GitHub, Google, AWS"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">アカウント名・ユーザー識別子</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="ユーザー名 または メールアドレス"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">シークレットキー Base32形式</label>
                  <button
                    type="button"
                    onClick={() => setShowEditSecret(!showEditSecret)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {showEditSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showEditSecret ? 'マスクする' : '表示する'}</span>
                  </button>
                </div>
                <input
                  type={showEditSecret ? 'text' : 'password'}
                  value={editSecret}
                  onChange={(e) => setEditSecret(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">認証タイプ</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="totp">TOTP 時間同期</option>
                    <option value="hotp">HOTP カウンタ同期</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">アルゴリズム</label>
                  <select
                    value={editAlgo}
                    onChange={(e) => setEditAlgo(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="SHA-1">SHA-1 標準</option>
                    <option value="SHA-256">SHA-256</option>
                    <option value="SHA-512">SHA-512</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">桁数</label>
                  <select
                    value={editDigits}
                    onChange={(e) => setEditDigits(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={6}>6桁 標準</option>
                    <option value={8}>8桁</option>
                  </select>
                </div>
                {editType === 'totp' ? (
                  <div>
                    <label className="block text-slate-400 mb-1">更新周期 秒</label>
                    <input
                      type="number"
                      value={editPeriod}
                      onChange={(e) => setEditPeriod(Number(e.target.value) || 30)}
                      min={10}
                      max={120}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-400 mb-1">カウンタ値</label>
                    <input
                      type="number"
                      value={editCounter}
                      onChange={(e) => setEditCounter(Number(e.target.value) || 0)}
                      min={0}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editSecret.trim()}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>変更を保存</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Generator & New Account */}
      {activeTab === 'generator' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                2FA アカウントの手動追加
              </h3>
              <p className="text-xs text-slate-400">
                外部サービスの2段階認証設定画面に表示されたシークレットキーを入力して登録します。
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Issuer・サービス名</label>
                <input
                  type="text"
                  value={newIssuer}
                  onChange={(e) => setNewIssuer(e.target.value)}
                  placeholder="例: GitHub, AWS, Google"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">アカウント名・ユーザー識別子</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="ユーザー名 または メールアドレス"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">シークレットキー Base32形式</label>
                  <button
                    type="button"
                    onClick={() => setShowNewSecret(!showNewSecret)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showNewSecret ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>マスクする</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>表示する</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewSecret ? 'text' : 'password'}
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value.toUpperCase())}
                    placeholder="Base32シークレットキーを入力"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs pr-10"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  RFC 4648 Base32規格 A-Z, 2-7
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1">認証タイプ</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="totp">TOTP 時間同期 30秒</option>
                    <option value="hotp">HOTP カウンタ同期</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">ハッシュアルゴリズム</label>
                  <select
                    value={newAlgo}
                    onChange={(e) => setNewAlgo(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="SHA-1">SHA-1 標準</option>
                    <option value="SHA-256">SHA-256</option>
                    <option value="SHA-512">SHA-512</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">桁数</label>
                  <select
                    value={newDigits}
                    onChange={(e) => setNewDigits(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={6}>6 桁 標準</option>
                    <option value={8}>8 桁</option>
                  </select>
                </div>

                {newType === 'totp' && (
                  <div>
                    <label className="block text-slate-400 mb-1">更新周期 秒</label>
                    <input
                      type="number"
                      value={newPeriod}
                      onChange={(e) => setNewPeriod(Number(e.target.value) || 30)}
                      min={10}
                      max={120}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleAddAccount}
                  disabled={!newSecret.trim()}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs transition-colors shadow-sm"
                >
                  このアカウントをローカル認証器に追加
                </button>
              </div>

              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  外部サーバーへのシークレット送信はありません。ブラウザ内ローカルでのみ安全に保持されます。
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Verifier */}
      {activeTab === 'verify' && (
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              2FA トークン検証
            </h3>
            <p className="text-xs text-slate-400">
              サーバー側認証ロジックに基づき、ワンタイムトークンの妥当性と時刻同期許容幅を検証します。
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400">検証用シークレットキー Base32形式</label>
                <button
                  type="button"
                  onClick={() => setShowVerifySecret(!showVerifySecret)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showVerifySecret ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>マスクする</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>表示する</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showVerifySecret ? 'text' : 'password'}
                  value={verifySecret}
                  onChange={(e) => setVerifySecret(e.target.value.toUpperCase())}
                  placeholder="Base32シークレットキーを入力"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono pr-10"
                />
                <div className="absolute right-3 top-2.5 text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1">検証するワンタイムパスワード</label>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="例: 123456"
                  maxLength={8}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-lg tracking-widest"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">時刻ドリフト許容ステップ</label>
                <select
                  value={verifyWindow}
                  onChange={(e) => setVerifyWindow(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 h-[42px]"
                >
                  <option value={0}>0ステップ 完全一致のみ</option>
                  <option value={1}>1ステップ 前後30秒許容 標準</option>
                  <option value={2}>2ステップ 前後60秒許容</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleVerifyCheck}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-sm"
            >
              トークンを検証する
            </button>

            {verifyResult.tested && (
              <div
                className={`p-4 rounded-xl border transition-all ${
                  verifyResult.valid
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {verifyResult.valid ? (
                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-sm font-bold">
                      {verifyResult.valid ? '検証成功' : '検証失敗'}
                    </div>
                    <p className="text-xs mt-1 text-slate-300">{verifyResult.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Import & Export */}
      {activeTab === 'import-export' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* URI Import */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <FileUp className="w-4 h-4 text-indigo-400" />
              otpauth URI のインポート
            </h3>
            <p className="text-xs text-slate-400">
              各種サービスや二次元バーコードからコピーした URI 文字列を貼り付けて登録します。
            </p>

            <div className="space-y-3 text-xs">
              <textarea
                value={rawUriInput}
                onChange={(e) => setRawUriInput(e.target.value)}
                rows={4}
                placeholder="otpauth://totp/サービス名:ユーザー名?secret=...&issuer=..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />

              {uriParseError && (
                <div className="p-3 rounded bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
                  {uriParseError}
                </div>
              )}

              <button
                onClick={handleImportUri}
                disabled={!rawUriInput.trim()}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition-colors"
              >
                URI を解析してアカウントを追加
              </button>
            </div>
          </div>

          {/* Backup & JSON */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <FileDown className="w-4 h-4 text-emerald-400" />
                ローカル保管データのバックアップと復元
              </h3>
              <p className="text-xs text-slate-400">
                本ツールの2FAデータはブラウザのLocalStorageに保存されています。デバイス変更やバックアップ用にJSONファイルとしてエクスポート・インポートできます。
              </p>

              <div className="pt-2 space-y-3">
                <button
                  onClick={handleExportJson}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  バックアップ JSON をダウンロード
                </button>

                <div>
                  <label className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <FileUp className="w-4 h-4 text-indigo-400" />
                    バックアップ JSON から復元
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportJsonFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              バックアップファイルには平文のシークレットキーが含まれます。安全なストレージに保管してください。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
