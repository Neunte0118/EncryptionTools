import React, { useState } from 'react';
import {
  encryptBlowfishText,
  decryptBlowfishText,
  BlowfishMode,
} from '../utils/blowfishUtils';
import { KeyVaultFile } from '../types/crypto';
import { FeatureLibraryBadge } from './FeatureLibraryBadge';
import {
  Lock,
  Unlock,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
  Layers,
} from 'lucide-react';
import { hexToBuffer } from '../utils/cryptoUtils';

interface Props {
  vault?: KeyVaultFile;
  onNavigateToKeyGenerator?: () => void;
}

export const BlowfishTool: React.FC<Props> = ({ vault, onNavigateToKeyGenerator }) => {
  const [action, setAction] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [mode, setMode] = useState<BlowfishMode>('cbc');
  const [keyBits, setKeyBits] = useState<number>(256);
  const [keyInputType, setKeyInputType] = useState<'password' | 'raw'>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rawKeyHex, setRawKeyHex] = useState('');

  // Input & Output
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [generatedKeyHex, setGeneratedKeyHex] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateRandomKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(keyBits / 8));
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setRawKeyHex(hex);
  };

  const handleExecute = async () => {
    setErrorMsg('');
    setOutputText('');
    setGeneratedKeyHex('');

    if (!inputText.trim()) {
      setErrorMsg('入力テキストを入力してください');
      return;
    }

    if (keyInputType === 'password' && !password.trim()) {
      setErrorMsg('パスワードを入力してください');
      return;
    }

    if (keyInputType === 'raw' && !rawKeyHex.trim()) {
      setErrorMsg('16進数形式の鍵を入力してください');
      return;
    }

    setIsProcessing(true);
    try {
      let rawKeyBytes: Uint8Array | undefined;
      if (keyInputType === 'raw') {
        const cleanHex = rawKeyHex.replace(/\s+/g, '');
        rawKeyBytes = new Uint8Array(hexToBuffer(cleanHex));
      }

      if (action === 'encrypt') {
        const res = await encryptBlowfishText(inputText, {
          password: keyInputType === 'password' ? password : undefined,
          rawKey: rawKeyBytes,
          keyBits,
          mode,
        });
        setOutputText(res.resultText);
        setGeneratedKeyHex(res.rawKeyHex);
      } else {
        const decrypted = await decryptBlowfishText(inputText, {
          password: keyInputType === 'password' ? password : undefined,
          rawKey: rawKeyBytes,
        });
        setOutputText(decrypted);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Blowfish処理に失敗しました');
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
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Blowfish 暗号化
                <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Bruce Schneier / 64bit Block
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bruce Schneier 氏設計の著名な共通鍵ブロック暗号。32〜448bit の柔軟な鍵長と CBC / ECB モードに対応
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-7 space-y-4">
          {/* Mode & Key Bits */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">暗号利用モード</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('cbc')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      mode === 'cbc'
                        ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    CBC (8B IV付き・推奨)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('ecb')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-colors ${
                      mode === 'ecb'
                        ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ECB (単純ブロック)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">鍵長 (ビット)</label>
                <select
                  value={keyBits}
                  onChange={(e) => setKeyBits(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value={128}>128 ビット (16 バイト)</option>
                  <option value={192}>192 ビット (24 バイト)</option>
                  <option value={256}>256 ビット (32 バイト・推奨)</option>
                  <option value={448}>448 ビット (56 バイト・最大規格)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Key Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">暗号鍵の指定</label>
              <div className="flex rounded bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setKeyInputType('password')}
                  className={`px-2.5 py-0.5 rounded transition-colors ${
                    keyInputType === 'password'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  パスワード (PBKDF2)
                </button>
                <button
                  type="button"
                  onClick={() => setKeyInputType('raw')}
                  className={`px-2.5 py-0.5 rounded transition-colors ${
                    keyInputType === 'raw'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  生鍵 (Hex)
                </button>
              </div>
            </div>

            {keyInputType === 'password' ? (
              <div>
                <label className="block text-slate-400 text-xs mb-1">パスワード</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Blowfish 暗号化パスワード..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-400">{keyBits}bit 16進数鍵 ({keyBits / 4}文字)</label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomKey}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>乱数鍵を自動生成</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={rawKeyHex}
                  onChange={(e) => setRawKeyHex(e.target.value)}
                  placeholder={`例: ${keyBits / 4}文字の16進数`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Text Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-200">
                {action === 'encrypt' ? '平文メッセージ' : 'Blowfish 暗号化パッケージ (JSON)'}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">{inputText.length} 文字</span>
            </div>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                action === 'encrypt'
                  ? 'Blowfishで暗号化したいメッセージを入力...'
                  : 'Blowfish パッケージ (JSON) を貼り付け...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono resize-y"
            />

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
              <span>{isProcessing ? '処理中...' : action === 'encrypt' ? 'Blowfish 暗号化を実行' : 'Blowfish 復号を実行'}</span>
            </button>
          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-semibold text-slate-200">
                {action === 'encrypt' ? '暗号化結果 (JSON エンベロープ)' : '復号された平文'}
              </h3>
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
              <div className="space-y-3">
                <textarea
                  readOnly
                  rows={10}
                  value={outputText}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-indigo-300 font-mono resize-y focus:outline-none"
                />

                {generatedKeyHex && (
                  <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1 text-xs">
                    <span className="text-[10px] text-slate-400 font-medium block">
                      導出された鍵 ({keyBits}bit Hex):
                    </span>
                    <div className="font-mono text-[11px] text-slate-300 break-all select-all">
                      {generatedKeyHex}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-2">
                <Lock className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                <div className="text-xs">左のパネルで入力して実行すると結果が表示されます</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* External Library & Network Specs */}
      <FeatureLibraryBadge
        library="egoroof-blowfish"
        hasNetwork={false}
        networkDetails="通信なし (100% ブラウザ内ローカル処理・完全オフライン)"
      />
    </div>
  );
};
