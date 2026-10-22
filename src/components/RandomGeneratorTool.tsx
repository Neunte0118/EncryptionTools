import React, { useState, useEffect } from 'react';
import {
  generateFromRegex,
  generateUuidV4,
  generateUuidV7,
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
} from 'lucide-react';

export const RandomGeneratorTool: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'regex' | 'uuid' | 'bytes'>('regex');

  // Regex Mode State
  const [patternInput, setPatternInput] = useState('[A-Za-z0-9]{32}');
  const [regexCount, setRegexCount] = useState<number>(5);
  const [regexResults, setRegexResults] = useState<string[]>([]);
  const [regexError, setRegexError] = useState('');

  // UUID Mode State
  const [uuidVersion, setUuidVersion] = useState<'v7' | 'v4'>('v7');
  const [uuidCount, setUuidCount] = useState<number>(5);
  const [uuidUppercase, setUuidUppercase] = useState(false);
  const [uuidNoHyphens, setUuidNoHyphens] = useState(false);
  const [uuidResults, setUuidResults] = useState<string[]>([]);

  // Bytes Mode State
  const [byteLength, setByteLength] = useState<number>(32);
  const [bytesResults, setBytesResults] = useState<{ hex: string; base64: string }[]>([]);

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

  const handleGenerateRegex = () => {
    setRegexError('');
    if (!patternInput.trim()) {
      setRegexError('パターンを入力してください');
      return;
    }

    try {
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

  const handleGenerateUuids = () => {
    const list: string[] = [];
    for (let i = 0; i < uuidCount; i++) {
      if (uuidVersion === 'v7') {
        list.push(
          generateUuidV7({
            uppercase: uuidUppercase,
            noHyphens: uuidNoHyphens,
          })
        );
      } else {
        list.push(
          generateUuidV4({
            uppercase: uuidUppercase,
            noHyphens: uuidNoHyphens,
          })
        );
      }
    }
    setUuidResults(list);
  };

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Dices className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">暗号論的擬似乱数生成</h2>
        </div>

        <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveMode('regex')}
            className={`px-3 py-1 rounded transition-colors ${
              activeMode === 'regex' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            パターン乱数
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('uuid')}
            className={`px-3 py-1 rounded transition-colors ${
              activeMode === 'uuid' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            UUID
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('bytes')}
            className={`px-3 py-1 rounded transition-colors ${
              activeMode === 'bytes' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            生バイト
          </button>
        </div>
      </div>

      {/* Mode 1: Regex & Pattern */}
      {activeMode === 'regex' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                プリセット
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RANDOM_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="md:col-span-3">
                <label className="block text-slate-300 font-medium mb-1">
                  正規表現パターン
                </label>
                <input
                  type="text"
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  placeholder="例: [A-Za-z0-9]{32}"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  生成件数
                </label>
                <select
                  value={regexCount}
                  onChange={(e) => setRegexCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>1 件</option>
                  <option value={5}>5 件</option>
                  <option value={10}>10 件</option>
                  <option value={20}>20 件</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { label: '[a-z]', snippet: '[a-z]' },
                { label: '[A-Z]', snippet: '[A-Z]' },
                { label: '[0-9]', snippet: '[0-9]' },
                { label: '[A-Za-z0-9]', snippet: '[A-Za-z0-9]' },
                { label: '[0-9a-f]', snippet: '[0-9a-f]' },
                { label: '記号', snippet: '[!@#$%^&*]' },
                { label: '{16}', snippet: '{16}' },
                { label: '{32}', snippet: '{32}' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleAddHelper(chip.snippet)}
                  className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded font-mono text-xs transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleGenerateRegex}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>乱数を再生成</span>
              </button>

              {regexResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleCopyAll(regexResults)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedIndex === 'all' ? '全件コピー完了' : '全件コピー'}</span>
                </button>
              )}
            </div>

            {regexError && (
              <div className="p-2.5 text-xs bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg">
                {regexError}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <span className="text-xs text-slate-400 block pb-1 border-b border-slate-800">
              生成結果 {regexResults.length} 件
            </span>
            <div className="space-y-1.5">
              {regexResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCopy(item, `reg_${idx}`)}
                  className="p-2.5 rounded-lg border bg-slate-950 text-indigo-300 border-slate-800 font-mono text-xs flex items-center justify-between cursor-pointer hover:border-indigo-500"
                >
                  <span className="break-all">{item}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                    {copiedIndex === `reg_${idx}` ? 'コピー完了' : 'コピー'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: UUID */}
      {activeMode === 'uuid' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  バージョン
                </label>
                <select
                  value={uuidVersion}
                  onChange={(e) => setUuidVersion(e.target.value as 'v7' | 'v4')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="v7">UUID v7 時系列</option>
                  <option value="v4">UUID v4 ランダム</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  生成件数
                </label>
                <select
                  value={uuidCount}
                  onChange={(e) => setUuidCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>1 件</option>
                  <option value={5}>5 件</option>
                  <option value={10}>10 件</option>
                  <option value={20}>20 件</option>
                </select>
              </div>

              <div className="flex items-center gap-4 pt-5 sm:col-span-2">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uuidUppercase}
                    onChange={(e) => setUuidUppercase(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600"
                  />
                  <span>大文字</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uuidNoHyphens}
                    onChange={(e) => setUuidNoHyphens(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600"
                  />
                  <span>ハイフンなし</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleGenerateUuids}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>UUIDを生成</span>
              </button>

              {uuidResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleCopyAll(uuidResults)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedIndex === 'all' ? '全件コピー完了' : '全件コピー'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <span className="text-xs text-slate-400 block pb-1 border-b border-slate-800">
              UUID {uuidResults.length} 件
            </span>
            <div className="space-y-1.5">
              {uuidResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCopy(item, `uuid_${idx}`)}
                  className="p-2.5 rounded-lg border bg-slate-950 text-indigo-300 border-slate-800 font-mono text-xs flex items-center justify-between cursor-pointer hover:border-indigo-500"
                >
                  <span className="break-all">{item}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                    {copiedIndex === `uuid_${idx}` ? 'コピー完了' : 'コピー'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Raw Bytes */}
      {activeMode === 'bytes' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  バイト長
                </label>
                <select
                  value={byteLength}
                  onChange={(e) => setByteLength(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={16}>16 bytes</option>
                  <option value={24}>24 bytes</option>
                  <option value={32}>32 bytes</option>
                  <option value={64}>64 bytes</option>
                  <option value={128}>128 bytes</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleGenerateBytes}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>再生成</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <span className="text-xs text-slate-400 block pb-1 border-b border-slate-800">
              生成結果 Hex および Base64
            </span>
            <div className="space-y-3">
              {bytesResults.map((item, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span>Hex</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.hex, `hex_${idx}`)}
                        className="text-slate-300 hover:text-white"
                      >
                        {copiedIndex === `hex_${idx}` ? 'コピー完了' : 'コピー'}
                      </button>
                    </div>
                    <code className="text-xs font-mono block p-2 rounded bg-slate-900 text-indigo-300 border border-slate-800 break-all select-all">
                      {item.hex}
                    </code>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span>Base64</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.base64, `b64_${idx}`)}
                        className="text-slate-300 hover:text-white"
                      >
                        {copiedIndex === `b64_${idx}` ? 'コピー完了' : 'コピー'}
                      </button>
                    </div>
                    <code className="text-xs font-mono block p-2 rounded bg-slate-900 text-emerald-300 border border-slate-800 break-all select-all">
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
