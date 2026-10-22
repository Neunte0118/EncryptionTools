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
} from 'lucide-react';

export const HashTool: React.FC = () => {
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [textData, setTextData] = useState('');
  const [fileData, setFileData] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);

  const [hashes, setHashes] = useState<Record<HashAlgorithm, { hex: string; base64: string }>>({
    'SHA-256': {
      hex: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      base64: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
    },
    'SHA-512': {
      hex: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
      base64: 'z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuzvY7kxvUdBevGlODJ6+SfaPg==',
    },
    'SHA-384': {
      hex: '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
      base64: 'OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb',
    },
    'SHA-1': {
      hex: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
      base64: '2jmj7l5rSw0yVb/vlWAYkK/YBwk=',
    },
    'MD5': {
      hex: 'd41d8cd98f00b204e9800998ecf8427e',
      base64: '1B2M2Y8AsgTpgAmY7PhCfg==',
    },
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [expectedChecksum, setExpectedChecksum] = useState('');
  const [copiedAlg, setCopiedAlg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function runHash() {
      let buffer: ArrayBuffer;
      if (inputType === 'text') {
        buffer = stringToBuffer(textData);
      } else {
        buffer = fileData ? fileData.buffer : new Uint8Array(0).buffer;
      }

      setIsCalculating(true);
      try {
        const [sha256, sha512, sha384, sha1, md5Result] = await Promise.all([
          computeHash(buffer, 'SHA-256'),
          computeHash(buffer, 'SHA-512'),
          computeHash(buffer, 'SHA-384'),
          computeHash(buffer, 'SHA-1'),
          computeHash(buffer, 'MD5'),
        ]);

        if (active) {
          setHashes({
            'SHA-256': sha256,
            'SHA-512': sha512,
            'SHA-384': sha384,
            'SHA-1': sha1,
            'MD5': md5Result,
          });
        }
      } catch (err) {
        console.error('Hash error', err);
      } finally {
        if (active) setIsCalculating(false);
      }
    }

    runHash();
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
  const matchedAlg = (['SHA-256', 'SHA-512', 'SHA-384', 'SHA-1', 'MD5'] as HashAlgorithm[]).find(
    (alg) => hashes[alg].hex && hashes[alg].hex.toLowerCase() === cleanExpected
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Hash className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">暗号学的ハッシュ計算</h2>
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

      {/* Input */}
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
                  ファイルを選択
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">入力テキスト</label>
            <textarea
              rows={4}
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
          照合用期待値
        </label>
        <input
          type="text"
          value={expectedChecksum}
          onChange={(e) => setExpectedChecksum(e.target.value)}
          placeholder="照合したいハッシュ値を入力"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
        />

        {cleanExpected && (
          <div className="pt-1">
            {matchedAlg ? (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-lg flex items-center gap-2 text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{matchedAlg} と一致しました</span>
              </div>
            ) : (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg flex items-center gap-2 text-rose-300 text-xs font-medium">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>一致しません</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calculated Hash Values */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-xs font-semibold text-slate-200">計算結果</h3>
          {isCalculating && (
            <span className="text-xs text-indigo-400 animate-pulse font-mono">
              計算中
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {(['SHA-256', 'SHA-512', 'SHA-384', 'SHA-1', 'MD5'] as HashAlgorithm[]).map((alg) => {
            const hex = hashes[alg].hex;
            const isMatched = cleanExpected && hex.toLowerCase() === cleanExpected;

            return (
              <div
                key={alg}
                className={`p-3 rounded-lg border transition-colors ${
                  isMatched
                    ? 'bg-emerald-950/20 border-emerald-700/80'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300 font-mono">{alg}</span>
                    {isMatched && (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                        MATCH
                      </span>
                    )}
                  </div>

                  {hex && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(hex, alg)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                      >
                        {copiedAlg === alg ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedAlg === alg ? 'コピー完了' : 'コピー'}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div
                  onClick={() => hex && handleCopy(hex, alg)}
                  className="font-mono text-xs p-2 rounded break-all border bg-slate-900 border-slate-800 text-slate-300 cursor-pointer select-all"
                >
                  {hex}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
