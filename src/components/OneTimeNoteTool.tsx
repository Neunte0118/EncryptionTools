import React, { useState, useEffect, useRef } from 'react';
import {
  createOneTimeNoteLink,
  parseNoteFragment,
  decryptOneTimeNote,
  EncryptedNotePackage,
  OneTimeNotePayload,
} from '../utils/oneTimeNoteUtils';
import {
  Flame,
  Timer,
  Lock,
  Unlock,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  ShieldCheck,
  Share2,
  Trash2,
  ExternalLink,
  Info,
  KeyRound,
  Calendar,
} from 'lucide-react';

export const OneTimeNoteTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'read'>('create');

  // Creator state
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  // Expiry Mode: preset duration or specific datetime
  const [expiryMode, setExpiryMode] = useState<'duration' | 'datetime'>('duration');
  const [durationMinutes, setDurationMinutes] = useState<number>(60); // default 1 hour
  const [targetDateTime, setTargetDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [burnAfterSeconds, setBurnAfterSeconds] = useState<number>(60); // default 60s once opened
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdExpiresAt, setCreatedExpiresAt] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');

  // Reader state
  const [customLinkInput, setCustomLinkInput] = useState('');
  const [currentPkg, setCurrentPkg] = useState<EncryptedNotePackage | null>(null);
  const [currentEmbeddedKey, setCurrentEmbeddedKey] = useState<string | null>(null);
  const [readPassword, setReadPassword] = useState('');
  const [showReadPassword, setShowReadPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [readError, setReadError] = useState('');

  // Decrypted note view
  const [decryptedNote, setDecryptedNote] = useState<OneTimeNotePayload | null>(null);
  const [burnCountdown, setBurnCountdown] = useState<number | null>(null);
  const [isBurned, setIsBurned] = useState(false);

  // Auto-detect URL fragment on mount and on hashchange
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash && hash.includes('note=')) {
        setActiveTab('read');
        const res = parseNoteFragment(hash);
        if (res.pkg) {
          setCurrentPkg(res.pkg);
          setCurrentEmbeddedKey(res.keyB64 || null);
          setCustomLinkInput(window.location.href);
          // If no password needed and key is in fragment, automatically prompt or auto-decrypt
        } else if (res.error) {
          setReadError(res.error);
        }
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Burn countdown interval when note is decrypted
  useEffect(() => {
    if (burnCountdown === null || burnCountdown <= 0 || isBurned) {
      if (burnCountdown === 0 && !isBurned) {
        setIsBurned(true);
        setDecryptedNote(null);
        // Clean fragment from URL for privacy
        if (window.location.hash.includes('note=')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
      return;
    }

    const timer = setInterval(() => {
      setBurnCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [burnCountdown, isBurned]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreatedUrl(null);

    if (!noteContent.trim()) {
      setCreateError('ノートの本文を入力してください');
      return;
    }

    if (usePassword && !password.trim()) {
      setCreateError('パスワード保護を有効にした場合はパスワードを入力してください');
      return;
    }

    setIsGenerating(true);
    try {
      let expiresAt: number;
      if (expiryMode === 'datetime') {
        expiresAt = new Date(targetDateTime).getTime();
        if (isNaN(expiresAt) || expiresAt <= Date.now()) {
          setCreateError('有効期限日時は現在より先の未来の日時を指定してください');
          setIsGenerating(false);
          return;
        }
      } else {
        expiresAt = Date.now() + durationMinutes * 60 * 1000;
      }

      const res = await createOneTimeNoteLink(noteContent.trim(), {
        expiresAt,
        burnAfterSeconds,
        title: noteTitle.trim() || undefined,
        password: usePassword ? password.trim() : undefined,
      });

      setCreatedUrl(res.shareableUrl);
      setCreatedExpiresAt(res.expiresAt);
    } catch (err: any) {
      setCreateError(`生成エラー: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleParseManualInput = () => {
    setReadError('');
    setDecryptedNote(null);
    setIsBurned(false);
    if (!customLinkInput.trim()) {
      setReadError('共有リンクまたはURLフラグメントを入力してください');
      return;
    }

    const res = parseNoteFragment(customLinkInput.trim());
    if (res.error) {
      setReadError(res.error);
      setCurrentPkg(null);
      setCurrentEmbeddedKey(null);
      return;
    }

    if (res.pkg) {
      setCurrentPkg(res.pkg);
      setCurrentEmbeddedKey(res.keyB64 || null);
    }
  };

  const handleDecrypt = async () => {
    setReadError('');
    if (!currentPkg) {
      setReadError('復号するノートパッケージが存在しません');
      return;
    }

    const keyOrPass = currentPkg.hasPassword ? readPassword : currentEmbeddedKey;
    if (!keyOrPass) {
      setReadError(
        currentPkg.hasPassword
          ? 'このノートはパスワードで保護されています。パスワードを入力してください'
          : '復号鍵がリンクに含まれていません'
      );
      return;
    }

    setIsDecrypting(true);
    try {
      const payload = await decryptOneTimeNote(currentPkg, keyOrPass);
      setDecryptedNote(payload);
      setIsBurned(false);
      setBurnCountdown(payload.burnAfterSeconds || 60);

      // Clean URL fragment so reloading won't persist
      if (window.location.hash.includes('note=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (err: any) {
      setReadError(err.message || '復号に失敗しました');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleManualBurn = () => {
    setIsBurned(true);
    setDecryptedNote(null);
    setBurnCountdown(0);
    setCurrentPkg(null);
    setCustomLinkInput('');
    if (window.location.hash.includes('note=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return '期限切れ';
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) return `${hours}時間 ${minutes}分`;
    if (minutes > 0) return `${minutes}分 ${seconds}秒`;
    return `${seconds}秒`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Flame className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-slate-100">ワンタイム・ノート</h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
            URLフラグメント完全秘匿
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'create'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>ワンタイムノートを作成</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('read')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'read'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>ノートを開封・復号</span>
          {currentPkg && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* --- CREATE TAB --- */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Note Form */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>秘密メッセージとタイマー設定</span>
            </h3>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  秘密メッセージ (パスワード、鍵、メモ等)
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={6}
                  placeholder="ここに一度だけ安全に渡したい機密情報を入力..."
                  required
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ノートの件名 / タイトル (任意・公開)</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="例: 本番DB接続アカウント / Wi-Fiパスコード"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Expiration Settings */}
              <div className="space-y-3 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>リンク全体の有効期限</span>
                  </span>

                  <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setExpiryMode('duration')}
                      className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors ${
                        expiryMode === 'duration'
                          ? 'bg-slate-800 text-indigo-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      経過時間
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpiryMode('datetime')}
                      className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors ${
                        expiryMode === 'datetime'
                          ? 'bg-slate-800 text-indigo-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      日時指定
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {expiryMode === 'duration' ? (
                    <div>
                      <select
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value={10}>10 分間 (極短期間)</option>
                        <option value={60}>1 時間 (推奨)</option>
                        <option value={360}>6 時間</option>
                        <option value={1440}>24 時間 (1日)</option>
                        <option value={4320}>3 日間</option>
                        <option value={10080}>7 日間 (1週間)</option>
                        <option value={20160}>14 日間 (2週間)</option>
                        <option value={43200}>30 日間 (約1ヶ月)</option>
                      </select>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        期限を過ぎると、リンクを開いても自動的に破棄され復号できなくなります。
                      </span>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="datetime-local"
                        value={targetDateTime}
                        onChange={(e) => setTargetDateTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        指定した日時に到達すると自動消滅し、復号できなくなります。
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400 mb-1 flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-amber-400" />
                      <span>開封後の自爆タイマー:</span>
                    </label>
                    <select
                      value={burnAfterSeconds}
                      onChange={(e) => setBurnAfterSeconds(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={15}>15 秒 (超高速消滅)</option>
                      <option value={30}>30 秒</option>
                      <option value={60}>60 秒 (1分・推奨)</option>
                      <option value={180}>3 分間</option>
                      <option value={300}>5 分間</option>
                    </select>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      相手が「開封」を押してから画面から完全抹消されるまでの時間です。
                    </span>
                  </div>
                </div>
              </div>

              {/* Password Protection Option */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-medium flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePassword}
                      onChange={(e) => setUsePassword(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <span>パスワードによる二重保護（鍵をURLに含めない）</span>
                  </label>
                </div>

                {usePassword && (
                  <div className="space-y-1.5 pt-1 pl-6">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="開封用パスワードを入力"
                        required={usePassword}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs pr-10 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      パスワードは別経路（電話やSMSなど）で相手に伝えてください。リンク単体では復号できなくなります。
                    </span>
                  </div>
                )}
              </div>

              {createError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isGenerating ? (
                  <>
                    <Timer className="w-4 h-4 animate-spin" />
                    <span>暗号化リンクを生成中...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>暗号化ワンタイムリンクを生成</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Creation Output */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>共有リンクの出力</span>
              </h3>

              {createdUrl ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>ワンタイムリンクが生成されました</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      有効期限: <strong className="text-slate-200">{new Date(createdExpiresAt!).toLocaleString()}</strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-medium">共有URL (相手に送付):</label>
                    <textarea
                      readOnly
                      rows={4}
                      value={createdUrl}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300 select-all break-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(createdUrl, 'share-url')}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    {copiedKey === 'share-url' ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey === 'share-url' ? 'URLをコピーしました！' : 'URLをクリップボードにコピー'}</span>
                  </button>

                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                    <div className="font-semibold text-slate-300">渡す際の流れ:</div>
                    <div>1. コピーしたURLをチャットやメール等で相手に送信</div>
                    <div>2. 相手がブラウザで開くと、パスワード（設定した場合）または自動で復号</div>
                    <div>3. 開封後、設定秒数（{burnAfterSeconds}秒）で自動消滅します</div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Flame className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <div className="text-xs">左のフォームにメッセージを入力してリンクを生成してください</div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                完全ゼロナレッジ: サーバーストレージに暗号文は1文字も保存されません。URLフラグメントの中に全てが完結しています。
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --- READ TAB --- */}
      {activeTab === 'read' && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Burned / Expired Alert */}
          {isBurned && (
            <div className="p-6 bg-rose-950/30 border border-rose-800/80 rounded-xl text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-rose-900/40 text-rose-400 flex items-center justify-center mx-auto border border-rose-700/60">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-rose-200">
                このノートは消滅しました (Burned)
              </h3>
              <p className="text-xs text-rose-300/80 max-w-md mx-auto">
                自爆タイマーまたは有効期限が満了したため、メモリおよびブラウザから完全に消去されました。復元することはできません。
              </p>
            </div>
          )}

          {/* Active Decrypted View */}
          {decryptedNote && !isBurned && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4 shadow-xl">
              {/* Header with self-destruct counter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-base font-bold text-slate-100">
                      {decryptedNote.title || '暗号化ワンタイムノート'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    復号成功。タイマー終了と同時に画面から完全破棄されます。
                  </p>
                </div>

                {/* Big Self-Destruct Timer */}
                <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-800/60 px-4 py-2 rounded-xl text-rose-300 self-start sm:self-auto">
                  <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                  <div className="text-xs">
                    自動消滅まで: <strong className="text-sm font-mono font-bold text-rose-200">{burnCountdown}</strong> 秒
                  </div>
                </div>
              </div>

              {/* Note Content Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>復号されたメッセージ内容:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(decryptedNote.content, 'decrypted-copy')}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono text-[11px]"
                  >
                    {copiedKey === 'decrypted-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'decrypted-copy' ? 'コピー完了' : '本文をコピー'}</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-100 whitespace-pre-wrap break-all select-all max-h-72 overflow-y-auto">
                  {decryptedNote.content}
                </div>
              </div>

              {/* Immediate Destroy Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleManualBurn}
                  className="px-4 py-2 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-rose-700/60"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>今すぐこのノートを完全抹消する</span>
                </button>
              </div>
            </div>
          )}

          {/* Pending Decryption Card */}
          {!decryptedNote && !isBurned && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Unlock className="w-4 h-4 text-indigo-400" />
                <span>ワンタイムノートの開封準備</span>
              </h3>

              {/* Manual URL Input if not present in hash */}
              {!currentPkg && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      受け取った共有リンク (URL) を貼り付け:
                    </label>
                    <textarea
                      value={customLinkInput}
                      onChange={(e) => setCustomLinkInput(e.target.value)}
                      rows={3}
                      placeholder="https://...#note=... または #note=..."
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleParseManualInput}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
                  >
                    リンクを解析
                  </button>
                </div>
              )}

              {/* Package Meta Info */}
              {currentPkg && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">件名:</span>
                      <span className="font-semibold text-slate-200">
                        {currentPkg.title || '（タイトルなし）'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">有効期限:</span>
                      <span className="font-mono text-slate-200">
                        {new Date(currentPkg.expiresAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">リンク残り時間:</span>
                      <span className={`font-mono font-bold ${currentPkg.expiresAt > Date.now() ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatRemaining(currentPkg.expiresAt - Date.now())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">開封後の自爆タイマー:</span>
                      <span className="font-mono text-amber-400">
                        {currentPkg.burnAfterSeconds} 秒
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                      <span className="text-slate-400">保護形式:</span>
                      <span className="text-slate-200 font-medium">
                        {currentPkg.hasPassword ? '🔑 パスワード保護' : '⚡ リンク自動解錠 (URL鍵埋め込み)'}
                      </span>
                    </div>
                  </div>

                  {/* Password Input if needed */}
                  {currentPkg.hasPassword && (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-300">
                        このノートを開くためのパスワード:
                      </label>
                      <div className="relative">
                        <input
                          type={showReadPassword ? 'text' : 'password'}
                          value={readPassword}
                          onChange={(e) => setReadPassword(e.target.value)}
                          placeholder="送信者から知らされたパスワードを入力"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 pr-10 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowReadPassword(!showReadPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                        >
                          {showReadPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {readError && (
                    <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                      {readError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDecrypt}
                    disabled={isDecrypting}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    {isDecrypting ? (
                      <>
                        <Timer className="w-4 h-4 animate-spin" />
                        <span>復号処理中...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>ノートを開封して読む（タイマースタート）</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
