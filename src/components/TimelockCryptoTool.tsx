import React, { useState, useEffect, useRef } from 'react';
import {
  encryptTimelock,
  decryptTimelock,
  calculateRoundForTime,
  calculateTimeForRound,
  extractRoundFromCiphertext,
  fetchCurrentDrandBeacon,
  DRAND_QUICKNET_INFO,
} from '../utils/timelockUtils';
import {
  Clock,
  Lock,
  Unlock,
  Calendar,
  Hourglass,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
  FileCheck,
  ShieldAlert,
  Radio,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';

export const TimelockCryptoTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'encrypt' | 'decrypt'>('encrypt');

  // Network State
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isFetchingBeacon, setIsFetchingBeacon] = useState(false);

  // Encrypt State
  const [encryptType, setEncryptType] = useState<'text' | 'file'>('text');
  const [plaintextInput, setPlaintextInput] = useState('');
  const [fileToEncrypt, setFileToEncrypt] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);

  // Time Lock Mode: preset duration or specific date/time
  const [lockMode, setLockMode] = useState<'duration' | 'datetime'>('duration');
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [targetDateTime, setTargetDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionResult, setEncryptionResult] = useState<{
    ciphertext: string;
    targetRound: number;
    targetTimeMs: number;
  } | null>(null);
  const [encryptError, setEncryptError] = useState('');

  // Decrypt State
  const [ciphertextInput, setCiphertextInput] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptResult, setDecryptResult] = useState<{
    text?: string;
    buffer: ArrayBuffer;
    downloadUrl?: string;
  } | null>(null);
  const [decryptError, setDecryptError] = useState('');

  // Parsed round info in Decrypt Tab
  const [parsedRoundInfo, setParsedRoundInfo] = useState<{
    round?: number;
    targetTimeMs?: number;
    isMatured?: boolean;
    remainingMs?: number;
  } | null>(null);

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const encryptFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current drand round on mount and periodically
  const refreshBeacon = async () => {
    setIsFetchingBeacon(true);
    setNetworkError(null);
    try {
      const beacon = await fetchCurrentDrandBeacon();
      setCurrentRound(beacon.round);
    } catch (err: any) {
      setNetworkError(err.message || 'drandノードへの接続に失敗しました');
    } finally {
      setIsFetchingBeacon(false);
    }
  };

  useEffect(() => {
    refreshBeacon();
    const interval = setInterval(refreshBeacon, 9000); // Poll every 9s (3 drand rounds)
    return () => clearInterval(interval);
  }, []);

  // Compute target round based on current form values
  const getComputedTargetTime = (): number => {
    if (lockMode === 'duration') {
      return Date.now() + durationMinutes * 60 * 1000;
    }
    const parsed = new Date(targetDateTime).getTime();
    return isNaN(parsed) ? Date.now() + 60 * 1000 : parsed;
  };

  const computedTargetTime = getComputedTargetTime();
  const computedTargetRound = calculateRoundForTime(computedTargetTime);

  // Parse round when ciphertext input changes
  useEffect(() => {
    if (!ciphertextInput.trim()) {
      setParsedRoundInfo(null);
      return;
    }
    const info = extractRoundFromCiphertext(ciphertextInput);
    if (info && info.round) {
      const targetTimeMs = calculateTimeForRound(info.round);
      const remainingMs = targetTimeMs - Date.now();
      setParsedRoundInfo({
        round: info.round,
        targetTimeMs,
        isMatured: remainingMs <= 0,
        remainingMs: Math.max(0, remainingMs),
      });
    } else {
      setParsedRoundInfo(null);
    }
  }, [ciphertextInput, currentRound]);

  // Handle Encrypt
  const handleEncrypt = async () => {
    setEncryptError('');
    setEncryptionResult(null);

    const now = Date.now();
    if (computedTargetTime <= now) {
      setEncryptError('解錠日時は現在時刻より先の未来である必要があります');
      return;
    }

    if (encryptType === 'text' && !plaintextInput.trim()) {
      setEncryptError('暗号化するテキストを入力してください');
      return;
    }

    if (encryptType === 'file' && !fileToEncrypt) {
      setEncryptError('暗号化するファイルを選択してください');
      return;
    }

    setIsEncrypting(true);
    try {
      const dataToEncrypt = encryptType === 'text' ? plaintextInput : fileToEncrypt!.buffer;
      const cipher = await encryptTimelock(dataToEncrypt, computedTargetRound);
      setEncryptionResult({
        ciphertext: cipher,
        targetRound: computedTargetRound,
        targetTimeMs: computedTargetTime,
      });
    } catch (err: any) {
      setEncryptError(`タイムロック暗号化エラー: ${err.message}`);
    } finally {
      setIsEncrypting(false);
    }
  };

  // Handle Decrypt
  const handleDecrypt = async () => {
    setDecryptError('');
    setDecryptResult(null);

    if (!ciphertextInput.trim()) {
      setDecryptError('暗号文 (AGE/tlock形式) を入力してください');
      return;
    }

    setIsDecrypting(true);
    try {
      const res = await decryptTimelock(ciphertextInput.trim());
      let downloadUrl: string | undefined = undefined;
      if (!res.text) {
        const blob = new Blob([res.buffer]);
        downloadUrl = URL.createObjectURL(blob);
      }
      setDecryptResult({
        ...res,
        downloadUrl,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('too early')) {
        setDecryptError(`まだ解錠時刻に達していません。指定のdrandラウンド（時間）が訪れるまで暗号は誰も解けません。\n(${err.message})`);
      } else {
        setDecryptError(`復号エラー: ${err.message}`);
      }
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadCiphertext = () => {
    if (!encryptionResult) return;
    const blob = new Blob([encryptionResult.ciphertext], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timelock-round-${encryptionResult.targetRound}.tlock.age`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return '解錠可能';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}日`);
    if (hours > 0 || days > 0) parts.push(`${hours}時間`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}分`);
    parts.push(`${seconds}秒`);
    return parts.join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 text-indigo-400 border border-indigo-800/80 flex items-center justify-center shrink-0">
              <Hourglass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  drand タイムロック暗号・復号 (tlock)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950/80 border border-indigo-700/80 text-indigo-300">
                  Quicknet 3秒
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                分散型ランダムビーコン「drand」の閾値署名を用い、**指定した未来の時刻が訪れるまで全世界の誰も解錠できない**時限暗号です。
              </p>
            </div>
          </div>

          {/* Network Live Status Indicator */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 flex items-center gap-3 shrink-0">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>drand Quicknet ネットワーク</span>
              </div>
              <div className="text-xs font-mono font-bold text-indigo-300 flex items-center gap-2">
                <span>
                  {currentRound ? `Round #${currentRound.toLocaleString()}` : '取得中...'}
                </span>
                <button
                  type="button"
                  onClick={refreshBeacon}
                  disabled={isFetchingBeacon}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                  title="ビーコンを再取得"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingBeacon ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-300 leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>
            <strong>理論的安全保証:</strong> 秘密鍵は送信者自身も含め存在しません。未来の指定ラウンドに到達した瞬間に、世界中に分散配置されたdrandノード群が閾値BLS署名を公表して初めて、数学的に復号鍵が導出されます。
          </span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('encrypt')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'encrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>タイムロック暗号化 (封印)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('decrypt')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'decrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>タイムロック復号 (解錠)</span>
        </button>
      </div>

      {/* --- ENCRYPTION PANEL --- */}
      {activeTab === 'encrypt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings & Input */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>解錠時刻 (タイムロック設定)</span>
              </h3>

              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setLockMode('duration')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    lockMode === 'duration'
                      ? 'bg-slate-800 text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  経過時間で指定
                </button>
                <button
                  type="button"
                  onClick={() => setLockMode('datetime')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    lockMode === 'datetime'
                      ? 'bg-slate-800 text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  日時を指定
                </button>
              </div>
            </div>

            {/* Time Controls */}
            {lockMode === 'duration' ? (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-300">
                  今からどれだけ未来に解錠可能にするか:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '1分後', min: 1 },
                    { label: '5分後', min: 5 },
                    { label: '10分後', min: 10 },
                    { label: '30分後', min: 30 },
                    { label: '1時間後', min: 60 },
                    { label: '6時間後', min: 360 },
                    { label: '24時間後', min: 1440 },
                    { label: '7日後', min: 10080 },
                  ].map((p) => (
                    <button
                      key={p.min}
                      type="button"
                      onClick={() => setDurationMinutes(p.min)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        durationMinutes === p.min
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-slate-400">カスタム指定:</span>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs text-slate-400">分後</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  解錠日時 (ローカル時刻):
                </label>
                <input
                  type="datetime-local"
                  value={targetDateTime}
                  onChange={(e) => setTargetDateTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Target Calculation Preview Box */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">解錠予定時刻:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {new Date(computedTargetTime).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">目標 drand ラウンド:</span>
                <span className="font-mono text-indigo-300 font-bold">
                  Round #{computedTargetRound.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>解錠までの残り時間:</span>
                <span className="font-mono text-slate-300">
                  約 {formatRemaining(computedTargetTime - Date.now())}
                </span>
              </div>
            </div>

            {/* Payload Input */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  封印するデータ
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEncryptType('text')}
                    className={`text-xs px-2.5 py-0.5 rounded transition-colors ${
                      encryptType === 'text'
                        ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    テキスト
                  </button>
                  <button
                    type="button"
                    onClick={() => setEncryptType('file')}
                    className={`text-xs px-2.5 py-0.5 rounded transition-colors ${
                      encryptType === 'file'
                        ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ファイル
                  </button>
                </div>
              </div>

              {encryptType === 'text' ? (
                <textarea
                  value={plaintextInput}
                  onChange={(e) => setPlaintextInput(e.target.value)}
                  rows={5}
                  placeholder="未来の自分や相手へ届ける機密メッセージ、シークレット鍵、入札金額などを入力..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              ) : (
                <div>
                  <input
                    ref={encryptFileInputRef}
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setFileToEncrypt({
                          name: file.name,
                          size: file.size,
                          buffer: evt.target?.result as ArrayBuffer,
                        });
                      };
                      reader.readAsArrayBuffer(file);
                    }}
                    className="hidden"
                  />
                  <div
                    onClick={() => encryptFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center cursor-pointer bg-slate-950/60 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    {fileToEncrypt ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-indigo-400 flex items-center justify-center gap-1.5">
                          <FileCheck className="w-4 h-4" />
                          <span>{fileToEncrypt.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          サイズ: {(fileToEncrypt.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">
                        クリックしてファイルを選択（タイムロック封印）
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {encryptError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {encryptError}
              </div>
            )}

            <button
              type="button"
              onClick={handleEncrypt}
              disabled={isEncrypting}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isEncrypting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>タイムロック暗号化中...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>指定時刻まで封印（暗号化実行）</span>
                </>
              )}
            </button>
          </div>

          {/* Encryption Result Output */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>暗号化出力 (AGE / tlock フォーマット)</span>
              </h3>

              {encryptionResult ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-emerald-300">
                      ✓ タイムロック封印が完了しました
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      解錠可能日時: <strong className="text-slate-200">{new Date(encryptionResult.targetTimeMs).toLocaleString()}</strong>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      目標Round: <strong className="text-indigo-300 font-mono">#{encryptionResult.targetRound}</strong>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      readOnly
                      rows={10}
                      value={encryptionResult.ciphertext}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300 select-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(encryptionResult.ciphertext, 'cipher-copy')}
                      className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                    >
                      {copiedKey === 'cipher-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'cipher-copy' ? 'コピー完了' : '暗号文をコピー'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadCiphertext}
                      className="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.age 保存</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Clock className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <div className="text-xs">左のフォームで時刻を設定し、暗号化を実行してください</div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">💡 共有と解錠:</div>
              <p>
                この暗号文はメール、チャット、公開掲示板等で誰に渡しても安全です。指定時刻になるまではいかなるスーパーコンピュータでも解読できません。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- DECRYPTION PANEL --- */}
      {activeTab === 'decrypt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Decryption Input */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Unlock className="w-4 h-4 text-indigo-400" />
              <span>暗号文の入力 (AGE / tlock 形式)</span>
            </h3>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                タイムロック暗号文を貼り付け:
              </label>
              <textarea
                value={ciphertextInput}
                onChange={(e) => setCiphertextInput(e.target.value)}
                rows={9}
                placeholder="-----BEGIN AGE ENCRYPTED FILE-----&#10;...&#10;-----END AGE ENCRYPTED FILE-----"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Parsed Meta Information Preview */}
            {parsedRoundInfo && (
              <div className="p-3.5 rounded-lg border bg-slate-950 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">暗号化対象ラウンド:</span>
                  <span className="font-mono font-bold text-indigo-300">
                    Round #{parsedRoundInfo.round?.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">解錠予定時刻:</span>
                  <span className="font-mono text-slate-200">
                    {parsedRoundInfo.targetTimeMs
                      ? new Date(parsedRoundInfo.targetTimeMs).toLocaleString()
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">ステータス:</span>
                  {parsedRoundInfo.isMatured ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>解錠可能（予定時刻到達済）</span>
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium flex items-center gap-1 font-mono">
                      <Hourglass className="w-3.5 h-3.5" />
                      <span>残り: {formatRemaining(parsedRoundInfo.remainingMs || 0)}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {decryptError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs whitespace-pre-wrap">
                {decryptError}
              </div>
            )}

            <button
              type="button"
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isDecrypting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>drand ビーコン取得 & 復号試行中...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>ビーコンを取得して復号する</span>
                </>
              )}
            </button>
          </div>

          {/* Decryption Result */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>復号結果</span>
              </h3>

              {decryptResult ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-xs text-emerald-300 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>正常にタイムロックが解錠されました！</span>
                  </div>

                  {decryptResult.text ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 max-h-60 overflow-y-auto whitespace-pre-wrap break-all">
                        {decryptResult.text}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(decryptResult.text!, 'dec-copy')}
                        className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                      >
                        {copiedKey === 'dec-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'dec-copy' ? 'コピー完了' : '復号テキストをコピー'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        バイナリファイル（{(decryptResult.buffer.byteLength / 1024).toFixed(1)} KB）が正常に復号されました。
                      </p>
                      {decryptResult.downloadUrl && (
                        <a
                          href={decryptResult.downloadUrl}
                          download="timelock-decrypted-file.dat"
                          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>復号ファイルを保存</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Hourglass className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <div className="text-xs">左の入力欄に暗号文を貼り付けて「復号」を押してください</div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/50 text-[11px] text-indigo-300 flex items-start gap-2">
              <Radio className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
              <span>
                復号時には drand の公開分散ノード（HTTP API）から該当ラウンドの確定ランダム値（BLS署名）を取得し、クライアント側の pairing 演算で瞬時に解錠します。
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
