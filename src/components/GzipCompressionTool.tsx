import React, { useState, useRef } from 'react';
import {
  CompressionFormat,
  compressBuffer,
  decompressBuffer,
  compressStringToBase64,
  decompressBase64ToString,
  isGzipBuffer,
} from '../utils/compressionUtils';
import {
  FileArchive,
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  Minimize2,
  Maximize2,
  FileText,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Zap,
} from 'lucide-react';

export const GzipCompressionTool: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'file' | 'text'>('file');
  const [format, setFormat] = useState<CompressionFormat>('gzip');

  // File mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileAction, setFileAction] = useState<'compress' | 'decompress'>('compress');
  const [resultBlob, setResultBlob] = useState<{
    blob: Blob;
    fileName: string;
    originalSize: number;
    resultSize: number;
    durationMs: number;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Text mode state
  const [textMode, setTextMode] = useState<'compress' | 'decompress'>('compress');
  const [textInput, setTextInput] = useState('');
  const [textOutput, setTextOutput] = useState('');
  const [textEncoding, setTextEncoding] = useState<'base64' | 'hex'>('base64');
  const [textStats, setTextStats] = useState<{
    originalBytes: number;
    compressedBytes: number;
    ratio: string;
  } | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File handling
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setResultBlob(null);
    setFileError(null);

    // Auto-detect if file is .gz or gzip-compressed
    const isGzExt = file.name.toLowerCase().endsWith('.gz');
    try {
      const slice = await file.slice(0, 4).arrayBuffer();
      if (isGzExt || isGzipBuffer(slice)) {
        setFileAction('decompress');
      } else {
        setFileAction('compress');
      }
    } catch {
      setFileAction(isGzExt ? 'decompress' : 'compress');
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setFileError(null);
    setResultBlob(null);

    const startTime = performance.now();

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();

      if (fileAction === 'compress') {
        const compressed = await compressBuffer(arrayBuffer, format);
        const duration = Math.round(performance.now() - startTime);
        const blob = new Blob([compressed.buffer as ArrayBuffer], {
          type: 'application/gzip',
        });
        const outName = `${selectedFile.name}.gz`;

        setResultBlob({
          blob,
          fileName: outName,
          originalSize: selectedFile.size,
          resultSize: compressed.byteLength,
          durationMs: duration,
        });
      } else {
        // Decompress
        const decompressed = await decompressBuffer(arrayBuffer, format);
        const duration = Math.round(performance.now() - startTime);
        const blob = new Blob([decompressed.buffer as ArrayBuffer], {
          type: 'application/octet-stream',
        });

        // Compute decompressed file name
        let outName = selectedFile.name;
        if (outName.toLowerCase().endsWith('.gz')) {
          outName = outName.substring(0, outName.length - 3);
        } else {
          outName = `decompressed_${selectedFile.name}`;
        }

        setResultBlob({
          blob,
          fileName: outName,
          originalSize: selectedFile.size,
          resultSize: decompressed.byteLength,
          durationMs: duration,
        });
      }
    } catch (err: any) {
      console.error('Compression/Decompression error:', err);
      setFileError(
        `処理に失敗しました: ${err?.message || '破損しているか形式が一致しません'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadFile = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultBlob.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Text handling
  const handleProcessText = async () => {
    if (!textInput.trim()) return;
    setTextError(null);

    try {
      if (textMode === 'compress') {
        const encoder = new TextEncoder();
        const inputBytes = encoder.encode(textInput);
        const compressed = await compressBuffer(inputBytes, format);

        let out = '';
        if (textEncoding === 'base64') {
          let binary = '';
          const len = compressed.byteLength;
          const chunkSize = 8192;
          for (let i = 0; i < len; i += chunkSize) {
            const chunk = compressed.subarray(i, Math.min(i + chunkSize, len));
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
          }
          out = btoa(binary);
        } else {
          // Hex
          out = Array.from(compressed)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        }

        setTextOutput(out);
        const ratio =
          inputBytes.byteLength > 0
            ? (((inputBytes.byteLength - compressed.byteLength) / inputBytes.byteLength) * 100).toFixed(1)
            : '0';

        setTextStats({
          originalBytes: inputBytes.byteLength,
          compressedBytes: compressed.byteLength,
          ratio,
        });
      } else {
        // Decompress
        let compressedBytes: Uint8Array;
        const cleaned = textInput.trim().replace(/\s+/g, '');

        if (textEncoding === 'base64') {
          const binary = atob(cleaned);
          compressedBytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            compressedBytes[i] = binary.charCodeAt(i);
          }
        } else {
          // Hex
          const match = cleaned.match(/.{1,2}/g);
          if (!match) throw new Error('無効なHex文字列です');
          compressedBytes = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
        }

        const decompressed = await decompressBuffer(compressedBytes, format);
        const decoded = new TextDecoder('utf-8').decode(decompressed);

        setTextOutput(decoded);
        setTextStats({
          originalBytes: compressedBytes.byteLength,
          compressedBytes: decompressed.byteLength,
          ratio: '復元完了',
        });
      }
    } catch (err: any) {
      console.error('Text process error:', err);
      setTextError(`解凍/圧縮に失敗しました: ${err?.message || '無効なデータ形式です'}`);
    }
  };

  const handleCopyOutput = () => {
    if (!textOutput) return;
    navigator.clipboard.writeText(textOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSampleText = () => {
    const sample = JSON.stringify(
      {
        service: "Local Crypto Vault Studio",
        standardLibrary: "CompressionStream ('gzip')",
        offlineSafe: true,
        features: [
          "AES-GCM",
          "RSA-OAEP",
          "ECDSA",
          "P2P WebRTC Direct",
          "Metadata Stripper",
          "Native Gzip"
        ],
        sampleData: Array(10).fill({
          timestamp: new Date().toISOString(),
          status: "SUCCESS",
          message: "このサンプルデータは反復パターンが多いため、gzip圧縮で90%以上小さくなります。"
        })
      },
      null,
      2
    );
    setTextInput(sample);
    setTextMode('compress');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-indigo-400" />
            標準ライブラリ Gzip 圧縮・解凍 (CompressionStream)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            W3C標準 Web API（<code className="text-indigo-300">CompressionStream</code> / <code className="text-indigo-300">DecompressionStream</code>）を採用。外部依存ライブラリなしで完全ローカルに高速処理。
          </p>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <span className="text-[11px] text-slate-400 px-2 font-medium">形式:</span>
          {(['gzip', 'deflate', 'deflate-raw'] as CompressionFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                format === fmt
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tabs (File / Text) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('file')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'file'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileArchive className="w-4 h-4" />
          <span>ファイル圧縮・解凍 (.gz)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'text'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>テキスト / Base64 圧縮</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. FILE MODE */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'file' && (
        <div className="space-y-6">
          {fileError && (
            <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{fileError}</div>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 sm:p-10 text-center cursor-pointer bg-slate-900/30 hover:bg-slate-900/60 transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
            />
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 group-hover:bg-indigo-600/20 text-slate-400 group-hover:text-indigo-400 flex items-center justify-center transition-colors mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-200">
              {selectedFile ? selectedFile.name : 'ファイルをドラッグ＆ドロップ、またはクリックして選択'}
            </p>
            <p className="text-xs text-slate-400 mt-1.5">
              任意のファイル形式に対応。 <code className="text-indigo-300">.gz</code> ファイルは自動で解凍モードに設定されます。
            </p>
          </div>

          {/* Controls & Action */}
          {selectedFile && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
                    <FileArchive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      サイズ: {(selectedFile.size / 1024).toFixed(1)} KB ({selectedFile.size.toLocaleString()} bytes)
                    </p>
                  </div>
                </div>

                {/* Operation Switcher (Compress vs Decompress) */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => {
                      setFileAction('compress');
                      setResultBlob(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                      fileAction === 'compress'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Gzip 圧縮</span>
                  </button>
                  <button
                    onClick={() => {
                      setFileAction('decompress');
                      setResultBlob(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                      fileAction === 'decompress'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Gzip 解凍</span>
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={handleProcessFile}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-all shadow-md disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>
                    {isProcessing
                      ? '処理中...'
                      : fileAction === 'compress'
                      ? '今すぐGzip圧縮を実行'
                      : '今すぐGzip解凍を実行'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setResultBlob(null);
                    setFileError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>リセット</span>
                </button>
              </div>

              {/* Results Card */}
              {resultBlob && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {fileAction === 'compress' ? '圧縮が完了しました！' : '解凍が完了しました！'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      処理時間: {resultBlob.durationMs} ms
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">元ファイルサイズ</div>
                      <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
                        {(resultBlob.originalSize / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">
                        {fileAction === 'compress' ? '圧縮後サイズ' : '解凍後サイズ'}
                      </div>
                      <div className="text-sm font-mono font-semibold text-emerald-300 mt-0.5">
                        {(resultBlob.resultSize / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">削減率 / 圧縮率</div>
                      <div className="text-sm font-mono font-semibold text-indigo-300 mt-0.5">
                        {fileAction === 'compress'
                          ? `-${(
                              ((resultBlob.originalSize - resultBlob.resultSize) /
                                resultBlob.originalSize) *
                              100
                            ).toFixed(1)}%`
                          : `+${(
                              ((resultBlob.resultSize - resultBlob.originalSize) /
                                resultBlob.originalSize) *
                              100
                            ).toFixed(1)}%`}
                      </div>
                    </div>
                  </div>

                  {/* Download Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleDownloadFile}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md hover:shadow-emerald-900/30"
                    >
                      <Download className="w-4 h-4" />
                      <span>{resultBlob.fileName} をダウンロード</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. TEXT / BASE64 MODE */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'text' && (
        <div className="space-y-6">
          {textError && (
            <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{textError}</div>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTextMode('compress');
                  setTextOutput('');
                  setTextStats(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  textMode === 'compress'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                テキスト → Gzip (Base64/Hex)
              </button>
              <button
                onClick={() => {
                  setTextMode('decompress');
                  setTextOutput('');
                  setTextStats(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  textMode === 'decompress'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Gzip (Base64/Hex) → 復元テキスト
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">エンコード:</span>
              <button
                onClick={() => setTextEncoding('base64')}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  textEncoding === 'base64'
                    ? 'bg-slate-800 text-indigo-300 border border-indigo-700/60'
                    : 'text-slate-500'
                }`}
              >
                Base64
              </button>
              <button
                onClick={() => setTextEncoding('hex')}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  textEncoding === 'hex'
                    ? 'bg-slate-800 text-indigo-300 border border-indigo-700/60'
                    : 'text-slate-500'
                }`}
              >
                Hex
              </button>

              <button
                onClick={loadSampleText}
                className="ml-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                title="サンプルのJSONデータを入力"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>サンプル挿入</span>
              </button>
            </div>
          </div>

          {/* Text Areas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold">
                  {textMode === 'compress' ? '入力テキスト (UTF-8)' : `入力Gzip文字列 (${textEncoding.toUpperCase()})`}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {textInput.length} 文字
                </span>
              </div>
              <textarea
                rows={10}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  textMode === 'compress'
                    ? 'ここに圧縮したいテキストやJSONを貼り付け...'
                    : `ここに解凍したいGzipの${textEncoding.toUpperCase()}文字列を貼り付け...`
                }
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-600 outline-none resize-none transition-colors"
              />
            </div>

            {/* Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold">
                  {textMode === 'compress' ? `圧縮結果 (${textEncoding.toUpperCase()})` : '解凍・復元テキスト'}
                </span>
                {textOutput && (
                  <button
                    onClick={handleCopyOutput}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>コピー</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                readOnly
                rows={10}
                value={textOutput}
                placeholder="処理を実行するとここに結果が表示されます..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm font-mono text-emerald-300 placeholder-slate-700 outline-none resize-none"
              />
            </div>
          </div>

          {/* Action & Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <button
              onClick={handleProcessText}
              disabled={!textInput.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-all shadow-md disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>{textMode === 'compress' ? 'Gzip圧縮を実行' : 'Gzip解凍を実行'}</span>
            </button>

            {textStats && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500">元:</span>{' '}
                  <span className="text-slate-200">{textStats.originalBytes} B</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                <div>
                  <span className="text-slate-500">処理後:</span>{' '}
                  <span className="text-emerald-400 font-semibold">{textStats.compressedBytes} B</span>
                </div>
                {textMode === 'compress' && (
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                    削減: -{textStats.ratio}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
