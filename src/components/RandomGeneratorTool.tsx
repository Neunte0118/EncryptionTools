import React, { useState, useEffect } from 'react';
import {
  generateFromRegex,
  generateUuidV4,
  getRandomBytes,
  RANDOM_PRESETS,
  RandomPreset,
} from '../utils/randomUtils';
import { bufferToHex, bufferToBase64 } from '../utils/cryptoUtils';
import {
  Dices,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  Binary,
  Fingerprint,
  Info,
} from 'lucide-react';

export const RandomGeneratorTool: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'regex' | 'uuid' | 'bytes'>('regex');

  // Regex Mode State
  const [patternInput, setPatternInput] = useState('[A-Za-z0-9]{32}');
  const [regexCount, setRegexCount] = useState<number>(5);
  const [regexResults, setRegexResults] = useState<string[]>([]);
  const [regexError, setRegexError] = useState('');

  // UUID Mode State
  const [uuidCount, setUuidCount] = useState<number>(5);
  const [uuidUppercase, setUuidUppercase] = useState(false);
  const [uuidNoHyphens, setUuidNoHyphens] = useState(false);
  const [uuidResults, setUuidResults] = useState<string[]>([]);

  // Bytes Mode State
  const [byteLength, setByteLength] = useState<number>(32);
  const [bytesResults, setBytesResults] = useState<{ hex: string; base64: string }[]>([]);

  // Copy Feedback
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const handleCopyAll = (items: string[]) => {
    navigator.clipboard.writeText(items.join('\n'));
    setCopiedIndex('all');
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  // Generate Regex Strings
  const handleGenerateRegex = () => {
    setRegexError('');
    if (!patternInput.trim()) {
      setRegexError('正規表現またはパターンを入力してください');
      return;
    }

    try {
      // Validate pattern syntax
      new RegExp(patternInput);
      const generated: string[] = [];
      for (let i = 0; i < regexCount; i++) {
        generated.push(generateFromRegex(patternInput.trim()));
      }
      setRegexResults(generated);
    } catch (err: any) {
      setRegexError(`パターン解析エラー: ${err.message}`);
    }
  };

  // Generate UUIDs
  const handleGenerateUuids = () => {
    const list: string[] = [];
    for (let i = 0; i < uuidCount; i++) {
      list.push(
        generateUuidV4({
          uppercase: uuidUppercase,
          noHyphens: uuidNoHyphens,
        })
      );
    }
    setUuidResults(list);
  };

  // Generate Raw Bytes
  const handleGenerateBytes = () => {
    const list: { hex: string; base64: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const bytes = getRandomBytes(byteLength);
      list.push({
        hex: bufferToHex(bytes.buffer as ArrayBuffer),
        base64: bufferToBase64(bytes.buffer as ArrayBuffer),
      });
    }
    setBytesResults(list);
  };

  // Run initial generations
  useEffect(() => {
    handleGenerateRegex();
    handleGenerateUuids();
    handleGenerateBytes();
  }, []);

  const handleSelectPreset = (preset: RandomPreset) => {
    setPatternInput(preset.pattern);
    setRegexError('');
    try {
      const generated: string[] = [];
      for (let i = 0; i < regexCount; i++) {
        generated.push(generateFromRegex(preset.pattern));
      }
      setRegexResults(generated);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleAddHelper = (snippet: string) => {
    setPatternInput((prev) => prev + snippet);
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Navigation */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveMode('regex')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 shrink-0 transition-colors ${
            activeMode === 'regex'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>正規表現・カスタムパターン</span>
        </button>

        <button
          onClick={() => setActiveMode('uuid')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 shrink-0 transition-colors ${
            activeMode === 'uuid'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          <span>UUID v4 一括生成</span>
        </button>

        <button
          onClick={() => setActiveMode('bytes')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 shrink-0 transition-colors ${
            activeMode === 'bytes'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Binary className="w-4 h-4" />
          <span>暗号乱数生バイト (Hex / Base64)</span>
        </button>
      </div>

      {/* --- REGEX & CUSTOM PATTERN MODE --- */}
      {activeMode === 'regex' && (
        <div className="space-y-6">
          {/* Pattern Inputs */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Dices className="w-4 h-4 text-indigo-400" />
                <span>正規表現・パターン指定（CSPRNG 暗号論的乱数）</span>
              </div>
            </div>

            {/* Presets Quick Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                プリセットテンプレートから選択:
              </label>
              <div className="flex flex-wrap gap-2">
                {RANDOM_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors"
                    title={p.description}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern Input & Count */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  正規表現 / パターン構文
                </label>
                <input
                  type="text"
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  placeholder="例: [A-Za-z0-9]{32} または sk_[0-9a-z]{24}"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  生成件数
                </label>
                <select
                  value={regexCount}
                  onChange={(e) => setRegexCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>1 件</option>
                  <option value={5}>5 件</option>
                  <option value={10}>10 件</option>
                  <option value={20}>20 件</option>
                  <option value={50}>50 件</option>
                </select>
              </div>
            </div>

            {/* Quick Helper Chips */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-500" />
                <span>クリックしてパターンに追加:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { label: '[a-z]', snippet: '[a-z]' },
                  { label: '[A-Z]', snippet: '[A-Z]' },
                  { label: '[0-9]', snippet: '[0-9]' },
                  { label: '[A-Za-z0-9]', snippet: '[A-Za-z0-9]' },
                  { label: '[0-9a-f]', snippet: '[0-9a-f]' },
                  { label: '記号 [!@#$%^&*]', snippet: '[!@#$%^&*]' },
                  { label: '{16}', snippet: '{16}' },
                  { label: '{32}', snippet: '{32}' },
                  { label: '{8,16}', snippet: '{8,16}' },
                  { label: 'ハイフン -', snippet: '-' },
                  { label: 'アンダースコア _', snippet: '_' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => handleAddHelper(chip.snippet)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleGenerateRegex}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>乱数を再生成</span>
              </button>

              {regexResults.length > 0 && (
                <button
                  onClick={() => handleCopyAll(regexResults)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {copiedIndex === 'all' ? '全件コピー完了' : '全件まとめてコピー'}
                  </span>
                </button>
              )}
            </div>

            {regexError && (
              <div className="p-3 text-xs bg-red-950/70 border border-red-800 text-red-200 rounded">
                {regexError}
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>生成結果 ({regexResults.length} 件)</span>
              <span className="text-[11px] text-slate-500">
                テキスト枠をクリックで即座にコピー
              </span>
            </div>

            <div className="space-y-2">
              {regexResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCopy(item, `reg_${idx}`)}
                  className={`p-3 rounded-md border font-mono text-xs transition-all cursor-pointer relative group flex items-center justify-between select-all ${
                    copiedIndex === `reg_${idx}`
                      ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-slate-950 text-indigo-300 border-slate-800/80 hover:border-indigo-500/80 hover:bg-slate-950/90'
                  }`}
                  title="クリックでコピー"
                >
                  <span className="break-all">{item}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-sans shrink-0 ml-2 transition-opacity ${
                      copiedIndex === `reg_${idx}`
                        ? 'bg-emerald-600 text-white opacity-100 font-medium'
                        : 'bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {copiedIndex === `reg_${idx}` ? 'コピー済！' : 'クリックでコピー'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- UUID GENERATOR MODE --- */}
      {activeMode === 'uuid' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-indigo-400" />
                <span>UUID v4 生成（RFC 4122 暗号論的一意識別子）</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  生成件数
                </label>
                <select
                  value={uuidCount}
                  onChange={(e) => setUuidCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>1 件</option>
                  <option value={5}>5 件</option>
                  <option value={10}>10 件</option>
                  <option value={20}>20 件</option>
                  <option value={50}>50 件</option>
                </select>
              </div>

              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uuidUppercase}
                    onChange={(e) => setUuidUppercase(e.target.checked)}
                    className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>大文字表記 (A-F)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uuidNoHyphens}
                    onChange={(e) => setUuidNoHyphens(e.target.checked)}
                    className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>ハイフンなし (32桁)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleGenerateUuids}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>UUID を生成</span>
              </button>

              {uuidResults.length > 0 && (
                <button
                  onClick={() => handleCopyAll(uuidResults)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {copiedIndex === 'all' ? '全件コピー完了' : '全件まとめてコピー'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* UUID Results */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>生成された UUID ({uuidResults.length} 件)</span>
              <span className="text-[11px] text-slate-500">
                クリックで即座にコピー
              </span>
            </div>

            <div className="space-y-2">
              {uuidResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCopy(item, `uuid_${idx}`)}
                  className={`p-3 rounded-md border font-mono text-xs transition-all cursor-pointer relative group flex items-center justify-between select-all ${
                    copiedIndex === `uuid_${idx}`
                      ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-slate-950 text-indigo-300 border-slate-800/80 hover:border-indigo-500/80 hover:bg-slate-950/90'
                  }`}
                  title="クリックでコピー"
                >
                  <span className="break-all">{item}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-sans shrink-0 ml-2 transition-opacity ${
                      copiedIndex === `uuid_${idx}`
                        ? 'bg-emerald-600 text-white opacity-100 font-medium'
                        : 'bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {copiedIndex === `uuid_${idx}` ? 'コピー済！' : 'クリックでコピー'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- RAW BYTES (HEX / BASE64) MODE --- */}
      {activeMode === 'bytes' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Binary className="w-4 h-4 text-indigo-400" />
                <span>暗号論的乱数生バイト生成 (CSPRNG Raw Bytes)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  バイト長 (Byte Length)
                </label>
                <select
                  value={byteLength}
                  onChange={(e) => setByteLength(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={16}>16 bytes (128 bit)</option>
                  <option value={24}>24 bytes (192 bit)</option>
                  <option value={32}>32 bytes (256 bit)</option>
                  <option value={48}>48 bytes (384 bit)</option>
                  <option value={64}>64 bytes (512 bit)</option>
                  <option value={128}>128 bytes (1024 bit)</option>
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={handleGenerateBytes}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ランダムバイトを再生成</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bytes Results */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="text-xs text-slate-400 border-b border-slate-800 pb-2">
              生成結果 (Hex & Base64) - クリックでコピー
            </div>

            <div className="space-y-3">
              {bytesResults.map((item, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-md p-3 space-y-2">
                  {/* Hex */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Hex ({byteLength * 2} 文字)</span>
                      <button
                        onClick={() => handleCopy(item.hex, `hex_${idx}`)}
                        className="text-slate-300 hover:text-white"
                      >
                        {copiedIndex === `hex_${idx}` ? 'コピー済' : 'コピー'}
                      </button>
                    </div>
                    <code
                      onClick={() => handleCopy(item.hex, `hex_${idx}`)}
                      className={`text-xs font-mono block p-2 rounded break-all border cursor-pointer select-all transition-all ${
                        copiedIndex === `hex_${idx}`
                          ? 'bg-emerald-950 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-900 text-indigo-300 border-slate-800 hover:border-indigo-500/80'
                      }`}
                      title="クリックでコピー"
                    >
                      {item.hex}
                    </code>
                  </div>

                  {/* Base64 */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Base64</span>
                      <button
                        onClick={() => handleCopy(item.base64, `b64_${idx}`)}
                        className="text-slate-300 hover:text-white"
                      >
                        {copiedIndex === `b64_${idx}` ? 'コピー済' : 'コピー'}
                      </button>
                    </div>
                    <code
                      onClick={() => handleCopy(item.base64, `b64_${idx}`)}
                      className={`text-xs font-mono block p-2 rounded break-all border cursor-pointer select-all transition-all ${
                        copiedIndex === `b64_${idx}`
                          ? 'bg-emerald-950 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-900 text-emerald-300 border-slate-800 hover:border-emerald-500/80'
                      }`}
                      title="クリックでコピー"
                    >
                      {item.base64}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
