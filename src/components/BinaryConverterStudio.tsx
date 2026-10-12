import React, { useState, useMemo, useCallback } from 'react';
import {
  bytesToUtf8,
  utf8ToBytes,
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  bytesToBase64Url,
  bytesToBinaryString,
  binaryStringToBytes,
  bytesToDecimalArray,
  decimalArrayToBytes,
  generateHexDump,
  parseEndianViews,
  base58Encode,
  base58Decode,
} from '../utils/binaryConverterUtils';
import { base32Encode, base32Decode } from '../utils/totpUtils';
import {
  Binary,
  Copy,
  Check,
  Upload,
  AlertCircle,
  FileCode,
  Hash,
  FileText,
  Cpu,
  Layers,
  Trash2,
  Edit3,
} from 'lucide-react';

type InputFormat =
  | 'utf8'
  | 'hex'
  | 'base64'
  | 'base64url'
  | 'binary'
  | 'decimal'
  | 'base32'
  | 'base58';

export const BinaryConverterStudio: React.FC = () => {
  // Current raw byte buffer - canonical source of truth for all fields
  const [rawBytes, setRawBytes] = useState<Uint8Array>(new Uint8Array(0));
  // Keep track of which format is currently being edited/focused
  const [editingFormat, setEditingFormat] = useState<InputFormat | null>(null);
  // Holds the exact text string of each box while being edited or for override
  const [fieldTexts, setFieldTexts] = useState<Record<InputFormat, string>>({
    utf8: '',
    hex: '',
    base64: '',
    base64url: '',
    binary: '',
    decimal: '',
    base32: '',
    base58: '',
  });

  const [parseErrors, setParseErrors] = useState<Partial<Record<InputFormat, string>>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hexSeparator, setHexSeparator] = useState<'none' | 'space' | 'colon'>('none');
  const [binSeparator, setBinSeparator] = useState<'space' | 'none'>('space');

  // Convert rawBytes to each representation
  const computedValues = useMemo(() => {
    if (!rawBytes || rawBytes.length === 0) {
      return {
        utf8: '',
        hex: '',
        base64: '',
        base64url: '',
        binary: '',
        decimal: '',
        base32: '',
        base58: '',
        hexDump: '',
        endianView: null,
      };
    }

    const hexSep = hexSeparator === 'space' ? ' ' : hexSeparator === 'colon' ? ':' : '';
    const binSep = binSeparator === 'space' ? ' ' : '';

    return {
      utf8: bytesToUtf8(rawBytes),
      hex: bytesToHex(rawBytes, hexSep),
      base64: bytesToBase64(rawBytes),
      base64url: bytesToBase64Url(rawBytes),
      binary: bytesToBinaryString(rawBytes, binSep),
      decimal: bytesToDecimalArray(rawBytes),
      base32: base32Encode(rawBytes),
      base58: base58Encode(rawBytes),
      hexDump: generateHexDump(rawBytes, 16),
      endianView: parseEndianViews(rawBytes),
    };
  }, [rawBytes, hexSeparator, binSeparator]);

  // When a user types in ANY format field, immediately parse and update rawBytes
  const handleFieldChange = useCallback(
    (format: InputFormat, value: string) => {
      setFieldTexts((prev) => ({ ...prev, [format]: value }));
      setEditingFormat(format);

      if (!value.trim()) {
        setRawBytes(new Uint8Array(0));
        setParseErrors((prev) => ({ ...prev, [format]: undefined }));
        return;
      }

      try {
        let bytes: Uint8Array;
        switch (format) {
          case 'utf8':
            bytes = utf8ToBytes(value);
            break;
          case 'hex':
            bytes = hexToBytes(value);
            break;
          case 'base64':
          case 'base64url':
            bytes = base64ToBytes(value);
            break;
          case 'binary':
            bytes = binaryStringToBytes(value);
            break;
          case 'decimal':
            bytes = decimalArrayToBytes(value);
            break;
          case 'base32':
            bytes = base32Decode(value);
            break;
          case 'base58':
            bytes = base58Decode(value);
            break;
          default:
            bytes = new Uint8Array(0);
        }

        setRawBytes(bytes);
        setParseErrors((prev) => ({ ...prev, [format]: undefined }));
      } catch (err: any) {
        setParseErrors((prev) => ({
          ...prev,
          [format]: err?.message || 'パースエラー: 入力形式が不正です',
        }));
      }
    },
    []
  );

  const handleFieldBlur = (format: InputFormat) => {
    if (editingFormat === format) {
      setEditingFormat(null);
    }
  };

  const getDisplayValue = (format: InputFormat): string => {
    // If the user is currently typing in this field, show what they are typing
    if (editingFormat === format) {
      return fieldTexts[format];
    }
    // Otherwise show the computed representation derived from rawBytes
    return computedValues[format];
  };

  const handleClearAll = () => {
    setRawBytes(new Uint8Array(0));
    setEditingFormat(null);
    setFieldTexts({
      utf8: '',
      hex: '',
      base64: '',
      base64url: '',
      binary: '',
      decimal: '',
      base32: '',
      base58: '',
    });
    setParseErrors({});
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      setEditingFormat(null);
      setRawBytes(bytes);
      setParseErrors({});
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
                <Binary className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                バイナリ・エンコーディング変換スタジオ
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              どの欄からでも直接入力・編集可能。UTF-8 / Hex / Base64 / Base64URL / Base32 / Base58 / 2進数ビット列 / 10進Byte配列 がすべてリアルタイム双方向同期されます。
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {rawBytes.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-700/60 text-xs text-slate-300 transition-colors cursor-pointer"
                title="すべての入力フィールドをクリア"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>クリア</span>
              </button>
            )}

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-xs text-slate-200 cursor-pointer transition-colors shadow-sm">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>バイナリファイルを読込</span>
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Global Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-400">
          <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
          <span>双方向リアルタイム同期:</span>
          <span className="text-slate-300 font-sans">
            {editingFormat
              ? `現在「${editingFormat.toUpperCase()}」を編集中`
              : '各入力欄を直接編集してください'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <div>
            サイズ:{' '}
            <span className="text-indigo-400 font-bold tabular-nums">
              {rawBytes.length}
            </span>{' '}
            バイト
          </div>
          <span className="text-slate-700">|</span>
          <div>
            ビット長:{' '}
            <span className="text-indigo-400 font-bold tabular-nums">
              {rawBytes.length * 8}
            </span>{' '}
            bits
          </div>
        </div>
      </div>

      {/* Editable Fields Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. UTF-8 Text */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>UTF-8 文字列 (プレーンテキスト)</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(getDisplayValue('utf8'), 'utf8')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
            >
              {copiedKey === 'utf8' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'utf8' ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
          <textarea
            value={getDisplayValue('utf8')}
            onChange={(e) => handleFieldChange('utf8', e.target.value)}
            onFocus={() => setEditingFormat('utf8')}
            onBlur={() => handleFieldBlur('utf8')}
            rows={3}
            placeholder="UTF-8テキストを直接入力..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none transition-colors"
          />
          {parseErrors.utf8 && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.utf8}</span>
            </div>
          )}
        </div>

        {/* 2. Hex (16進数) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Hash className="w-4 h-4 text-amber-400" />
              <span>Hex (16進数)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <span>区切り:</span>
                <select
                  value={hexSeparator}
                  onChange={(e) => setHexSeparator(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-[10px]"
                >
                  <option value="none">なし</option>
                  <option value="space">空白</option>
                  <option value="colon">コロン (:)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(getDisplayValue('hex'), 'hex')}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
              >
                {copiedKey === 'hex' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'hex' ? 'コピー完了' : 'コピー'}</span>
              </button>
            </div>
          </div>
          <textarea
            value={getDisplayValue('hex')}
            onChange={(e) => handleFieldChange('hex', e.target.value)}
            onFocus={() => setEditingFormat('hex')}
            onBlur={() => handleFieldBlur('hex')}
            rows={3}
            placeholder="16進数文字列 (例: 48656c6c6f または 48 65 6c)..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none break-all transition-colors"
          />
          {parseErrors.hex && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.hex}</span>
            </div>
          )}
        </div>

        {/* 3. Base64 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Base64 (RFC 4648)</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(getDisplayValue('base64'), 'base64')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
            >
              {copiedKey === 'base64' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'base64' ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
          <textarea
            value={getDisplayValue('base64')}
            onChange={(e) => handleFieldChange('base64', e.target.value)}
            onFocus={() => setEditingFormat('base64')}
            onBlur={() => handleFieldBlur('base64')}
            rows={3}
            placeholder="Base64文字列を入力 (例: SGVsbG8=)..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none break-all transition-colors"
          />
          {parseErrors.base64 && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.base64}</span>
            </div>
          )}
        </div>

        {/* 4. Base64URL */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FileCode className="w-4 h-4 text-sky-400" />
              <span>Base64URL (URLセーフ / パディングなし)</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(getDisplayValue('base64url'), 'base64url')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
            >
              {copiedKey === 'base64url' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'base64url' ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
          <textarea
            value={getDisplayValue('base64url')}
            onChange={(e) => handleFieldChange('base64url', e.target.value)}
            onFocus={() => setEditingFormat('base64url')}
            onBlur={() => handleFieldBlur('base64url')}
            rows={3}
            placeholder="Base64URL文字列を入力 (例: JWTトークンパーツ等)..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none break-all transition-colors"
          />
          {parseErrors.base64url && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.base64url}</span>
            </div>
          )}
        </div>

        {/* 5. Base32 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Base32 (RFC 4648 / 2FA互換)</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(getDisplayValue('base32'), 'base32')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
            >
              {copiedKey === 'base32' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'base32' ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
          <textarea
            value={getDisplayValue('base32')}
            onChange={(e) => handleFieldChange('base32', e.target.value)}
            onFocus={() => setEditingFormat('base32')}
            onBlur={() => handleFieldBlur('base32')}
            rows={3}
            placeholder="Base32文字列を入力 (例: JBSWY3DPEHPK3PXP)..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none break-all transition-colors"
          />
          {parseErrors.base32 && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.base32}</span>
            </div>
          )}
        </div>

        {/* 6. Base58 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Layers className="w-4 h-4 text-pink-400" />
              <span>Base58 (Bitcoin / IPFS)</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(getDisplayValue('base58'), 'base58')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
            >
              {copiedKey === 'base58' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'base58' ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
          <textarea
            value={getDisplayValue('base58')}
            onChange={(e) => handleFieldChange('base58', e.target.value)}
            onFocus={() => setEditingFormat('base58')}
            onBlur={() => handleFieldBlur('base58')}
            rows={3}
            placeholder="Base58文字列を入力 (例: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa)..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none break-all transition-colors"
          />
          {parseErrors.base58 && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.base58}</span>
            </div>
          )}
        </div>

        {/* 7. Binary (2進数 ビット列) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Binary className="w-4 h-4 text-teal-400" />
              <span>Binary (2進数 ビット列)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBinSeparator((prev) => (prev === 'space' ? 'none' : 'space'))}
                className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {binSeparator === 'space' ? '区切りあり' : '区切りなし'}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(getDisplayValue('binary'), 'binary')}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
              >
                {copiedKey === 'binary' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === 'binary' ? 'コピー完了' : 'コピー'}</span>
              </button>
            </div>
          </div>
          <textarea
            value={getDisplayValue('binary')}
            onChange={(e) => handleFieldChange('binary', e.target.value)}
            onFocus={() => setEditingFormat('binary')}
            onBlur={() => handleFieldBlur('binary')}
            rows={3}
            placeholder="2進数ビット列を入力 (例: 01001000 01100101)..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none transition-colors"
          />
          {parseErrors.binary && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.binary}</span>
            </div>
          )}
        </div>

        {/* 8. Decimal Byte Array (10進 uint8配列) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Cpu className="w-4 h-4 text-orange-400" />
              <span>Decimal Byte Array (10進 uint8配列)</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(getDisplayValue('decimal'), 'decimal')}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
            >
              {copiedKey === 'decimal' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'decimal' ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
          <textarea
            value={getDisplayValue('decimal')}
            onChange={(e) => handleFieldChange('decimal', e.target.value)}
            onFocus={() => setEditingFormat('decimal')}
            onBlur={() => handleFieldBlur('decimal')}
            rows={3}
            placeholder="10進バイト配列を入力 (例: 72, 101, 108, 108, 111)..."
            className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-slate-200 font-mono text-xs focus:outline-none resize-none transition-colors"
          />
          {parseErrors.decimal && (
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{parseErrors.decimal}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hex Dump Section (xxd style) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Hex ダンプビューア (xxd / hexdump -C 互換)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(computedValues.hexDump, 'hexdump')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-mono transition-colors cursor-pointer"
          >
            {copiedKey === 'hexdump' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedKey === 'hexdump' ? 'コピー完了' : 'ダンプをコピー'}</span>
          </button>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed tabular-nums whitespace-pre">
            {computedValues.hexDump || '(データが入力されていません)'}
          </pre>
        </div>
      </div>

      {/* Numerical Endian Inspector */}
      {computedValues.endianView && rawBytes.length >= 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              エンディアン & 整数型パーサー (Big-Endian / Little-Endian)
            </h3>
            <p className="text-xs text-slate-400">
              バイナリプロトコルやネットワークパケット解析向けの数値解釈テーブル
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3 font-semibold">型 (Type)</th>
                  <th className="py-2 px-3 font-semibold">バイト幅</th>
                  <th className="py-2 px-3 font-semibold">リトルエンディアン (LE)</th>
                  <th className="py-2 px-3 font-semibold">ビッグエンディアン (BE)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-2 px-3 text-slate-400">UInt16</td>
                  <td className="py-2 px-3 text-slate-500">2 bytes</td>
                  <td className="py-2 px-3 text-indigo-300 font-semibold">
                    {computedValues.endianView.uint16LE.slice(0, 4).join(', ') || '-'}
                  </td>
                  <td className="py-2 px-3 text-cyan-300 font-semibold">
                    {computedValues.endianView.uint16BE.slice(0, 4).join(', ') || '-'}
                  </td>
                </tr>
                {rawBytes.length >= 4 && (
                  <>
                    <tr>
                      <td className="py-2 px-3 text-slate-400">UInt32</td>
                      <td className="py-2 px-3 text-slate-500">4 bytes</td>
                      <td className="py-2 px-3 text-indigo-300 font-semibold">
                        {computedValues.endianView.uint32LE.slice(0, 2).join(', ') || '-'}
                      </td>
                      <td className="py-2 px-3 text-cyan-300 font-semibold">
                        {computedValues.endianView.uint32BE.slice(0, 2).join(', ') || '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-400">Float32</td>
                      <td className="py-2 px-3 text-slate-500">4 bytes</td>
                      <td className="py-2 px-3 text-slate-300">
                        {computedValues.endianView.float32LE.slice(0, 2).join(', ') || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {computedValues.endianView.float32BE.slice(0, 2).join(', ') || '-'}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
