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
  FileText,
} from 'lucide-react';

export const HashTool: React.FC = () => {
  const [inputType, setInputType] = useState<'text' | 'file'>('text');
  const [textData, setTextData] = useState('');
  const [fileData, setFileData] = useState<{
    name: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);

  // Initial hashes for empty string ""
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

  // Compute hashes whenever data changes
  useEffect(() => {
    let active = true;

    async function runHash() {
      let buffer: ArrayBuffer;
      if (inputType === 'text') {
        buffer = stringToBuffer(textData); // Empty string produces 0-length buffer, matching empty string hash
      } else {
        if (!fileData) {
          buffer = new Uint8Array(0).buffer; // Default to empty data hash
        } else {
          buffer = fileData.buffer;
        }
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
        console.error('Hash calculation error', err);
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

  // Clean comparison check
  const cleanExpected = expectedChecksum.trim().toLowerCase();
  const matchedAlg = (['SHA-256', 'SHA-512', 'SHA-384', 'SHA-1', 'MD5'] as HashAlgorithm[]).find(
    (alg) => hashes[alg].hex && hashes[alg].hex.toLowerCase() === cleanExpected
  );

  return (
    <div className="space-y-6">
      {/* Input Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-indigo-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-100">
              ハッシュ値の計算・完全性確認
            </h2>
          </div>

          <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800 self-start sm:self-auto w-full sm:w-auto">
            <button
              onClick={() => setInputType('file')}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded transition-colors text-center ${
                inputType === 'file'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ファイル検証
            </button>
            <button
              onClick={() => setInputType('text')}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded transition-colors text-center ${
                inputType === 'text'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              テキスト入力
            </button>
          </div>
        </div>

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
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-8 text-center cursor-pointer bg-slate-950/60 transition-colors"
            >
              <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              {fileData ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-indigo-400 flex items-center justify-center gap-2">
                    <FileCheck className="w-4 h-4" />
                    <span>{fileData.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    ファイルサイズ: {(fileData.size / 1024).toFixed(2)} KB (
                    {fileData.size.toLocaleString()} bytes)
                  </div>
                  <div className="text-xs text-slate-500 pt-2">
                    クリックして別のファイルを選択
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    ファイルをドラッグ＆ドロップ、またはクリックして選択
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    ブラウザのメモリ内で直接ストリーム計算されます
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <textarea
              rows={4}
              value={textData}
              onChange={(e) => setTextData(e.target.value)}
              placeholder="ハッシュを計算したいテキストを入力..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Checksum Verification Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
        <label className="block text-xs font-semibold text-slate-200">
          照合用期待値 (Expected Checksum)
        </label>
        <p className="text-xs text-slate-400">
          配布元から提供された SHA-256 / SHA-512 / SHA-1 / MD5 等のハッシュ値を貼り付けると、自動照合を行います。
        </p>
        <input
          type="text"
          value={expectedChecksum}
          onChange={(e) => setExpectedChecksum(e.target.value)}
          placeholder="照合したいハッシュ値を貼り付け (SHA-256 / SHA-512 / MD5 など)"
          className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
        />

        {cleanExpected && (
          <div className="pt-1">
            {matchedAlg ? (
              <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-md flex items-center gap-2 text-emerald-200 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  ✓ {matchedAlg} の計算結果と完全に一致しました（改ざんなし / 完全性確認済）
                </span>
              </div>
            ) : (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-md flex items-center gap-2 text-red-200 text-xs font-medium">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>✕ 計算されたどのアルゴリズムのハッシュ値とも一致しません</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calculated Hash Values */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-200">計算結果 (Hex)</h3>
          {isCalculating && (
            <span className="text-xs text-indigo-400 animate-pulse font-mono">
              計算中...
            </span>
          )}
        </div>

        <div className="space-y-4">
          {(['SHA-256', 'SHA-512', 'SHA-384', 'SHA-1', 'MD5'] as HashAlgorithm[]).map((alg) => {
            const hex = hashes[alg].hex;
            const isMatched = cleanExpected && hex.toLowerCase() === cleanExpected;

            return (
              <div
                key={alg}
                className={`p-3.5 rounded-lg border transition-colors ${
                  isMatched
                    ? 'bg-emerald-950/30 border-emerald-700/80'
                    : 'bg-slate-950 border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300 font-mono">{alg}</span>
                    {isMatched && (
                      <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        MATCH
                      </span>
                    )}
                  </div>

                  {hex && (
                    <div className="flex items-center gap-2">
                      {fileData && (
                        <button
                          onClick={() =>
                            handleCopy(`${hex}  ${fileData.name}`, `${alg}_sum`)
                          }
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                          title="sha256sum 形式でコピー"
                        >
                          {copiedAlg === `${alg}_sum` ? 'コピー済' : 'sum形式コピー'}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(hex, alg)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                      >
                        {copiedAlg === alg ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedAlg === alg ? 'コピー済' : 'コピー'}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div
                  onClick={() => hex && handleCopy(hex, alg)}
                  className={`font-mono text-xs p-2.5 rounded break-all border transition-all cursor-pointer relative group ${
                    copiedAlg === alg
                      ? 'bg-emerald-950/70 text-emerald-200 border-emerald-600 ring-1 ring-emerald-500'
                      : 'bg-slate-900/90 text-slate-300 border-slate-800/60 hover:border-indigo-500/80 hover:bg-slate-900'
                  }`}
                  title="クリックでハッシュ値をコピー"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="select-all">{hex}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-sans shrink-0 transition-opacity ${
                        copiedAlg === alg
                          ? 'bg-emerald-600 text-white opacity-100 font-medium'
                          : 'bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {copiedAlg === alg ? 'コピーしました！' : 'クリックでコピー'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
