import React, { useState, useEffect, useRef } from 'react';
import {
  computeHash,
  stringToBuffer,
  HashAlgorithm,
} from '../utils/cryptoUtils';
import {
  Hash,
  Upload,
  Copy,
  Check,
  FileCheck,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface HashEntry {
  id: HashAlgorithm;
  name: string;
  family: 'sha2' | 'sha3' | 'blake' | 'legacy';
  familyLabel: string;
  bitLength: number;
  standard: string;
}

const ALL_ALGORITHMS: HashEntry[] = [
  // SHA-2
  { id: 'SHA-256', name: 'SHA-256', family: 'sha2', familyLabel: 'SHA-2 (FIPS 180-4)', bitLength: 256, standard: 'NIST FIPS 180-4' },
  { id: 'SHA-512', name: 'SHA-512', family: 'sha2', familyLabel: 'SHA-2 (FIPS 180-4)', bitLength: 512, standard: 'NIST FIPS 180-4' },
  { id: 'SHA-384', name: 'SHA-384', family: 'sha2', familyLabel: 'SHA-2 (FIPS 180-4)', bitLength: 384, standard: 'NIST FIPS 180-4' },
  { id: 'SHA-224', name: 'SHA-224', family: 'sha2', familyLabel: 'SHA-2 (FIPS 180-4)', bitLength: 224, standard: 'NIST FIPS 180-4' },

  // SHA-3 & Keccak
  { id: 'SHA3-256', name: 'SHA3-256', family: 'sha3', familyLabel: 'SHA-3 / Keccak (FIPS 202)', bitLength: 256, standard: 'NIST FIPS 202' },
  { id: 'SHA3-512', name: 'SHA3-512', family: 'sha3', familyLabel: 'SHA-3 / Keccak (FIPS 202)', bitLength: 512, standard: 'NIST FIPS 202' },
  { id: 'Keccak-256', name: 'Keccak-256', family: 'sha3', familyLabel: 'SHA-3 / Keccak (FIPS 202)', bitLength: 256, standard: 'Ethereum EVM standard' },

  // Modern Tree & High Speed
  { id: 'BLAKE3', name: 'BLAKE3', family: 'blake', familyLabel: 'BLAKE High-Performance', bitLength: 256, standard: 'Tree Hash (Ultra Fast)' },
  { id: 'BLAKE2b', name: 'BLAKE2b', family: 'blake', familyLabel: 'BLAKE High-Performance', bitLength: 512, standard: 'RFC 7693 / Argon2' },

  // Legacy & Fingerprint
  { id: 'RIPEMD-160', name: 'RIPEMD-160', family: 'legacy', familyLabel: 'レガシー / 暗号資産アドレス', bitLength: 160, standard: 'ISO/IEC 10118-3 (Bitcoin)' },
  { id: 'SHA-1', name: 'SHA-1', family: 'legacy', familyLabel: 'レガシー / 暗号資産アドレス', bitLength: 160, standard: 'FIPS 180-1 (互換用)' },
  { id: 'MD5', name: 'MD5', family: 'legacy', familyLabel: 'レガシー / 暗号資産アドレス', bitLength: 128, standard: 'RFC 1321 (チェックサム用)' },
];

export const HashTool: React.FC = () => {
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [textData, setTextData] = useState('');
  const [fileData, setFileData] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'sha2' | 'sha3' | 'blake' | 'legacy'>('all');
  const [displayEncoding, setDisplayEncoding] = useState<'hex' | 'base64'>('hex');

  const [hashes, setHashes] = useState<Partial<Record<HashAlgorithm, { hex: string; base64: string }>>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [expectedChecksum, setExpectedChecksum] = useState('');
  const [copiedAlg, setCopiedAlg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function runAllHashes() {
      let buffer: ArrayBuffer;
      if (inputType === 'text') {
        buffer = stringToBuffer(textData);
      } else {
        buffer = fileData ? fileData.buffer : new Uint8Array(0).buffer;
      }

      setIsCalculating(true);
      try {
        const results = await Promise.all(
          ALL_ALGORITHMS.map(async (entry) => {
            const res = await computeHash(buffer, entry.id);
            return [entry.id, res] as const;
          })
        );

        if (active) {
          const newHashes: Partial<Record<HashAlgorithm, { hex: string; base64: string }>> = {};
          for (const [id, val] of results) {
            newHashes[id] = val;
          }
          setHashes(newHashes);
        }
      } catch (err) {
        console.error('Hash error', err);
      } finally {
        if (active) setIsCalculating(false);
      }
    }

    runAllHashes();
    return () => {
      active = false;
    };
  }, [inputType, textData, fileData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      setFileData({
        name: file.name,
        size: file.size,
        buffer,
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAlg(id);
    setTimeout(() => setCopiedAlg(null), 1800);
  };

  const cleanExpected = expectedChecksum.trim().toLowerCase();
  const matchedAlg = ALL_ALGORITHMS.find((entry) => {
    const h = hashes[entry.id];
    if (!h) return false;
    return (
      (h.hex && h.hex.toLowerCase() === cleanExpected) ||
      (h.base64 && h.base64.toLowerCase() === cleanExpected)
    );
  });

  const filteredAlgorithms = ALL_ALGORITHMS.filter(
    (item) => activeTab === 'all' || item.family === activeTab
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Hash className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">暗号学的ハッシュ計算 (全規格網羅)</h2>
        </div>

        <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setInputType('file')}
            className={`px-3 py-1 rounded transition-colors ${
              inputType === 'file' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ファイル
          </button>
          <button
            type="button"
            onClick={() => setInputType('text')}
            className={`px-3 py-1 rounded transition-colors ${
              inputType === 'text' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            テキスト
          </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        {inputType === 'file' ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center cursor-pointer bg-slate-950 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              {fileData ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-indigo-400 flex items-center justify-center gap-1.5">
                    <FileCheck className="w-4 h-4" />
                    <span>{fileData.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {(fileData.size / 1024).toFixed(2)} KB
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  クリックまたはドラッグ＆ドロップでファイルを選択
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">入力テキスト</label>
            <textarea
              rows={3}
              value={textData}
              onChange={(e) => setTextData(e.target.value)}
              placeholder="ハッシュを計算する文字列を入力..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Checksum Verification Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <label className="block text-xs font-semibold text-slate-200">
          照合用期待値 (チェックサム自動照合)
        </label>
        <input
          type="text"
          value={expectedChecksum}
          onChange={(e) => setExpectedChecksum(e.target.value)}
          placeholder="照合したいハッシュ値を入力 (HexまたはBase64)"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
        />

        {cleanExpected && (
          <div className="pt-1">
            {matchedAlg ? (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-lg flex items-center gap-2 text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>{matchedAlg.name}</strong> ({matchedAlg.standard}) と完全一致しました
                </span>
              </div>
            ) : (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg flex items-center gap-2 text-rose-300 text-xs font-medium">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>どの計算済みハッシュアルゴリズムとも一致しません</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calculated Hash Values */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        {/* Family filter tabs & encoding toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            {(
              [
                { id: 'all', label: 'すべて (11規格)' },
                { id: 'sha2', label: 'SHA-2 (4規格)' },
                { id: 'sha3', label: 'SHA-3 / Keccak (3規格)' },
                { id: 'blake', label: 'BLAKE (2規格)' },
                { id: 'legacy', label: 'Legacy / 160bit' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded transition-colors text-xs ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded bg-slate-950 p-0.5 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setDisplayEncoding('hex')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  displayEncoding === 'hex' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Hex
              </button>
              <button
                type="button"
                onClick={() => setDisplayEncoding('base64')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  displayEncoding === 'base64' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Base64
              </button>
            </div>

            {isCalculating && (
              <span className="text-xs text-indigo-400 animate-pulse font-mono">
                計算中...
              </span>
            )}
          </div>
        </div>

        {/* List of Hashes */}
        <div className="space-y-2.5">
          {filteredAlgorithms.map((entry) => {
            const h = hashes[entry.id];
            const val = h ? (displayEncoding === 'hex' ? h.hex : h.base64) : '';
            const isMatched =
              cleanExpected &&
              h &&
              ((h.hex && h.hex.toLowerCase() === cleanExpected) ||
                (h.base64 && h.base64.toLowerCase() === cleanExpected));

            return (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isMatched
                    ? 'bg-emerald-950/20 border-emerald-700/80 ring-1 ring-emerald-600/40'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 font-mono text-xs">
                      {entry.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {entry.bitLength} bit
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({entry.standard})
                    </span>
                    {isMatched && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                        MATCH
                      </span>
                    )}
                  </div>

                  {val && (
                    <button
                      onClick={() => handleCopy(val, entry.id)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      {copiedAlg === entry.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedAlg === entry.id ? 'コピー完了' : 'コピー'}</span>
                    </button>
                  )}
                </div>

                <div
                  onClick={() => val && handleCopy(val, entry.id)}
                  className="font-mono text-xs p-2 rounded break-all border bg-slate-900 border-slate-800 text-slate-300 cursor-pointer select-all hover:border-slate-700"
                >
                  {val || <span className="text-slate-600">計算中...</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
