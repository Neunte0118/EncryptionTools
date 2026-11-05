import React, { useState } from 'react';
import {
  encryptFpeText,
  decryptFpeText,
  FpeAlphabetType,
} from '../utils/fpeUtils';
import { KeyVaultFile } from '../types/crypto';
import { FeatureLibraryBadge } from './FeatureLibraryBadge';
import {
  Lock,
  Unlock,
  Key,
  Copy,
  Check,
  CreditCard,
  Hash,
  Sparkles,
  Shield,
  Layers,
  FileText,
} from 'lucide-react';
import { hexToBuffer } from '../utils/cryptoUtils';

interface Props {
  vault?: KeyVaultFile;
  onNavigateToKeyGenerator?: () => void;
}

export const FpeTool: React.FC<Props> = ({ vault, onNavigateToKeyGenerator }) => {
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [alphabetType, setAlphabetType] = useState<FpeAlphabetType>('digits');
  const [inputText, setInputText] = useState('4532-8419-2049-5831');
  const [tweak, setTweak] = useState('user-context-2026');
  const [rawKeyHex, setRawKeyHex] = useState(
    '2b7e151628aed2a6abf7158809cf4f3c2b7e151628aed2a6abf7158809cf4f3c'
  );

  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateRandomKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setRawKeyHex(hex);
  };

  const handleApplyPreset = (
    text: string,
    type: FpeAlphabetType,
    tweakVal: string
  ) => {
    setInputText(text);
    setAlphabetType(type);
    setTweak(tweakVal);
    setOutputText('');
    setErrorMsg('');
  };

  const handleExecute = () => {
    setErrorMsg('');
    setOutputText('');

    if (!inputText.trim()) {
      setErrorMsg('対象データを入力してください');
      return;
    }

    const cleanKeyHex = rawKeyHex.replace(/\s+/g, '');
    if (cleanKeyHex.length !== 32 && cleanKeyHex.length !== 48 && cleanKeyHex.length !== 64) {
      setErrorMsg('AES-FF1 鍵は 128/192/256 ビット (32/48/64文字の16進数) である必要があります');
      return;
    }

    setIsProcessing(true);
    try {
      const keyBytes = new Uint8Array(hexToBuffer(cleanKeyHex));
      if (action === 'encrypt') {
        const res = encryptFpeText(
          inputText.trim(),
          keyBytes,
          alphabetType,
          undefined,
          tweak.trim() || undefined
        );
        setOutputText(res.formattedCiphertext);
      } else {
        const decrypted = decryptFpeText(
          inputText.trim(),
          keyBytes,
          alphabetType,
          undefined,
          tweak.trim() || undefined
        );
        setOutputText(decrypted);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'FPE処理に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                フォーマット維持暗号 (FPE / FF1)
                <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                  NIST SP 800-38G
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                暗号化後も元の桁数・文字種（数字のみ・英数字）や区切り文字（ハイフン等）をそのまま保持するトークナイゼーション暗号
              </p>
            </div>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setAction('encrypt');
              setOutputText('');
              setErrorMsg('');
            }}
            className={`px-4 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              action === 'encrypt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>暗号化</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAction('decrypt');
              setOutputText('');
              setErrorMsg('');
            }}
            className={`px-4 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              action === 'decrypt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>復号</span>
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <label className="text-xs font-semibold text-slate-300 block">
          フォーマット例・体験プリセット:
        </label>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              handleApplyPreset(
                '4532-8419-2049-5831',
                'digits',
                'card-pan-mask'
              )
            }
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
            <span>クレジットカード 16桁 (ハイフン保持)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleApplyPreset('1234-5678-9012', 'digits', 'my-number-tweak')
            }
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Hash className="w-3.5 h-3.5 text-emerald-400" />
            <span>マイナンバー 12桁</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleApplyPreset('090-1234-5678', 'digits', 'phone-tweak')
            }
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Hash className="w-3.5 h-3.5 text-amber-400" />
            <span>携帯電話番号 11桁</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleApplyPreset('EMP-8492-AX', 'alphanumeric', 'employee-id')
            }
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>英数字社員ID (Radix 62)</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-7 space-y-4">
          {/* Alphabet Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-200">
              対象文字種 (アルファベット基数)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  alphabetType === 'digits'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="fpeAlphabet"
                  checked={alphabetType === 'digits'}
                  onChange={() => setAlphabetType('digits')}
                  className="sr-only"
                />
                <span className="font-semibold block text-[11px]">数字のみ (0-9, Radix 10)</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">カード番号、電話番号、マイナンバー</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  alphabetType === 'alphanumeric'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="fpeAlphabet"
                  checked={alphabetType === 'alphanumeric'}
                  onChange={() => setAlphabetType('alphanumeric')}
                  className="sr-only"
                />
                <span className="font-semibold block text-[11px]">英数字大小 (Radix 62)</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">0-9, a-z, A-Z (社員番号、トークン)</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  alphabetType === 'alphanumeric-lower'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="fpeAlphabet"
                  checked={alphabetType === 'alphanumeric-lower'}
                  onChange={() => setAlphabetType('alphanumeric-lower')}
                  className="sr-only"
                />
                <span className="font-semibold block text-[11px]">英小文字＋数字 (Radix 36)</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">小文字ID、シリアル番号</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  alphabetType === 'hex'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="fpeAlphabet"
                  checked={alphabetType === 'hex'}
                  onChange={() => setAlphabetType('hex')}
                  className="sr-only"
                />
                <span className="font-semibold block text-[11px]">16進数 (0-9, a-f, Radix 16)</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">UUID、ハッシュ値</span>
              </label>
            </div>
          </div>

          {/* Key & Tweak Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-slate-300 font-semibold">AES-FF1 鍵 (256bit Hex)</label>
                <button
                  type="button"
                  onClick={handleGenerateRandomKey}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>ランダム生成</span>
                </button>
              </div>
              <input
                type="text"
                value={rawKeyHex}
                onChange={(e) => setRawKeyHex(e.target.value)}
                placeholder="64文字の16進数..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 block font-medium">
                Tweak (任意・コンテキスト識別文字列)
              </label>
              <input
                type="text"
                value={tweak}
                onChange={(e) => setTweak(e.target.value)}
                placeholder="例: database-table-card-pan"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 block">
                ※ NIST規格のコンテキスト用ソルト。同じ鍵でもTweakが異なると別の暗号文になります。
              </span>
            </div>
          </div>

          {/* Input Data */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-200">
                {action === 'encrypt' ? '暗号化するフォーマット文字列' : '復号する暗号化文字列'}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">{inputText.length} 文字</span>
            </div>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="例: 4532-8419-2049-5831"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <span className="text-[10px] text-slate-500 block">
              ※ ハイフン(-) やスペース等の区切り記号は暗号化されずに同じ位置に保たれます。
            </span>

            {errorMsg && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {action === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isProcessing ? '処理中...' : action === 'encrypt' ? 'フォーマット維持暗号化を実行' : 'フォーマット復号を実行'}</span>
            </button>
          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-semibold text-slate-200">処理結果</h3>
              {outputText && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'コピー完了' : 'コピー'}</span>
                </button>
              )}
            </div>

            {outputText ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 border border-indigo-500/50 rounded-xl space-y-2">
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {action === 'encrypt' ? 'フォーマット維持暗号文:' : '復号結果:'}
                  </span>
                  <div className="text-lg font-mono font-bold text-indigo-300 tracking-wider break-all select-all">
                    {outputText}
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">入力文字数:</span>
                    <span className="font-mono">{inputText.length} 文字</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">出力文字数:</span>
                    <span className="font-mono text-emerald-400 font-bold">{outputText.length} 文字 (完全一致)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">暗号化方式:</span>
                    <span className="font-mono">NIST SP 800-38G FF1 (Feistel 10R)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-2">
                <CreditCard className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                <div className="text-xs">左のパネルで入力して実行すると結果が表示されます</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* External Library & Network Specs */}
      <FeatureLibraryBadge
        library="@noble/ciphers (FF1 / NIST SP 800-38G)"
        hasNetwork={false}
        networkDetails="通信なし (100% ブラウザ内ローカル処理・完全オフライン)"
      />
    </div>
  );
};
