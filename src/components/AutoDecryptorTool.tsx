import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  analyzeFile,
  autoDecryptFiles,
  AnalyzedFile,
  DecryptionResult,
  ExtractedFileEntry,
} from '../utils/cryptoAnalyzer';
import { KeyVaultFile } from '../types/crypto';
import {
  Sparkles,
  Upload,
  Download,
  Copy,
  Check,
  FileText,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  FolderArchive,
  ArrowRight,
  ShieldCheck,
  FileArchive,
  FileCheck,
} from 'lucide-react';

interface Props {
  vault?: KeyVaultFile;
  initialFiles?: File[];
}

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AutoDecryptorTool: React.FC<Props> = ({ vault, initialFiles }) => {
  const [analyzedFiles, setAnalyzedFiles] = useState<AnalyzedFile[]>([]);
  const [results, setResults] = useState<DecryptionResult[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [triggerCount, setTriggerCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (newFiles: FileList | File[]) => {
    if (!newFiles || newFiles.length === 0) return;
    setIsAnalyzing(true);
    try {
      const fileArr = Array.from(newFiles);
      const newAnalyzed: AnalyzedFile[] = [];

      for (const f of fileArr) {
        const item = await analyzeFile(f);
        newAnalyzed.push(item);
      }

      setAnalyzedFiles((prev) => {
        const combined = [...prev];
        for (const item of newAnalyzed) {
          if (!combined.some((c) => c.name === item.name && c.size === item.size)) {
            combined.push(item);
          }
        }
        return combined;
      });
    } catch (err) {
      console.error('File analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // If initial files are passed
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFiles(initialFiles);
    }
  }, [initialFiles, handleFiles]);

  // Run auto decrypt whenever analyzedFiles, passwords, or triggerCount change
  useEffect(() => {
    if (analyzedFiles.length === 0) {
      setResults([]);
      return;
    }

    let isMounted = true;
    setIsDecrypting(true);

    autoDecryptFiles(analyzedFiles, passwords, vault)
      .then((res) => {
        if (isMounted) {
          setResults(res);
          setIsDecrypting(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Auto decrypt error:', err);
          setIsDecrypting(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [analyzedFiles, passwords, vault, triggerCount]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setAnalyzedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setAnalyzedFiles([]);
    setResults([]);
    setPasswords({});
    setShowPasswords({});
  };

  const handlePasswordChange = (targetId: string, value: string) => {
    setPasswords((prev) => ({
      ...prev,
      [targetId]: value,
      global: value,
    }));
  };

  const toggleShowPassword = (targetId: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [targetId]: !prev[targetId],
    }));
  };

  const handleExecuteDecrypt = () => {
    setTriggerCount((prev) => prev + 1);
  };

  const handleDownloadBuffer = (buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadResult = (res: DecryptionResult) => {
    let buffer = res.outputBuffer;
    if (!buffer && res.outputText) {
      buffer = new TextEncoder().encode(res.outputText).buffer as ArrayBuffer;
    }
    if (!buffer && res.outputDataUrl) {
      const a = document.createElement('a');
      a.href = res.outputDataUrl;
      a.download = res.outputFileName || 'revealed_secret.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    if (!buffer) {
      alert('ダウンロード可能なデータがありません');
      return;
    }
    const filename = res.outputFileName || `decrypted_${res.sourceFileNames[0] || 'result.dat'}`;
    handleDownloadBuffer(buffer, filename);
  };

  const handleDownloadExtractedItem = (item: ExtractedFileEntry) => {
    handleDownloadBuffer(item.buffer, item.name);
  };

  const handleDownloadAll = () => {
    const successList = results.filter((r) => r.status === 'success');
    for (const item of successList) {
      handleDownloadResult(item);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const successfulResults = results.filter((r) => r.status === 'success');
  const needsKeyResults = results.filter((r) => r.status === 'needs-key');
  const failedResults = results.filter((r) => r.status === 'failed');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">暗号自動解析・一括復号</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono font-medium">
                万能解析エンジン
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              暗号化ファイル（OpenSSL, AES, RSA, ZIP, ChaCha20, PGP, ステガノ等）を自動判定し即座に復号・保存
            </p>
          </div>
        </div>

        {analyzedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            {successfulResults.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-950/40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>全 {successfulResults.length} 件を一括ダウンロード</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-medium border border-slate-800 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>クリア</span>
            </button>
          </div>
        )}
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-950/30 scale-[1.005]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <div className="max-w-md mx-auto space-y-2.5 pointer-events-none">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-850 border border-slate-700/80 flex items-center justify-center text-slate-300">
            {isAnalyzing || isDecrypting ? (
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            ) : (
              <Upload className="w-6 h-6 text-indigo-400" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">
              暗号化ファイルや鍵をドラッグ＆ドロップ
            </div>
            <div className="text-xs text-slate-400 mt-1">
              またはクリックして複数ファイルを選択（一括投入可能）
            </div>
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed">
            OpenSSL（.enc / Salted__）、暗号化ZIP（AES-256 / ZipCrypto）、AES-256、RSA、ChaCha20、OpenPGP、秘密分散シェア、ステガノ画像を自動識別します。
          </div>
        </div>
      </div>

      {/* Dropped Files List */}
      {analyzedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>投入ファイル一覧 ({analyzedFiles.length} 件)</span>
            <span className="text-[11px] text-slate-500 normal-case">
              暗号文と鍵を同時に投入すると自動でペアリングされます
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {analyzedFiles.map((f) => (
              <div
                key={f.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      f.isKeyOrSecret
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                        : 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/60'
                    }`}
                  >
                    {f.isKeyOrSecret ? (
                      <Key className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-slate-200 truncate">{f.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="text-indigo-300 font-medium">{f.typeLabel}</span>
                      <span>·</span>
                      <span className="font-mono text-slate-500">
                        {formatSize(f.size)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(f.id);
                  }}
                  className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors shrink-0"
                  title="削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decryption Status Summary Counter Bar */}
      {analyzedFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className="text-[11px] text-slate-400">投入ファイル</div>
            <div className="text-base font-bold text-slate-100 mt-0.5">{analyzedFiles.length}</div>
          </div>
          <div className="bg-slate-900 border border-emerald-800/50 rounded-xl p-3 text-center">
            <div className="text-[11px] text-emerald-400 font-medium">復号成功 (DL可能)</div>
            <div className="text-base font-bold text-emerald-300 mt-0.5">{successfulResults.length}</div>
          </div>
          <div className="bg-slate-900 border border-amber-800/50 rounded-xl p-3 text-center">
            <div className="text-[11px] text-amber-400 font-medium">パスワード待ち</div>
            <div className="text-base font-bold text-amber-300 mt-0.5">{needsKeyResults.length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className="text-[11px] text-slate-400">エラー / 不可</div>
            <div className="text-base font-bold text-slate-400 mt-0.5">{failedResults.length}</div>
          </div>
        </div>
      )}

      {/* Decryption Execution Results */}
      {results.length > 0 && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>解析および復号結果</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({results.length} 件の対象)
              </span>
            </div>
            {isDecrypting && (
              <span className="text-[11px] text-indigo-400 flex items-center gap-1 font-normal">
                <RefreshCw className="w-3 h-3 animate-spin" />
                解析・復号中...
              </span>
            )}
          </div>

          <div className="space-y-3.5">
            {results.map((res) => {
              const isSuccess = res.status === 'success';
              const needsKey = res.status === 'needs-key';
              const isFailed = res.status === 'failed';

              return (
                <div
                  key={res.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isSuccess
                      ? 'bg-slate-900/95 border-emerald-700/80 shadow-md shadow-emerald-950/20'
                      : needsKey
                      ? 'bg-slate-900/95 border-amber-600/70 shadow-sm'
                      : 'bg-slate-900/90 border-red-800/70'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSuccess
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/70'
                            : needsKey
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-700/70'
                            : 'bg-red-950/80 text-red-400 border border-red-700/70'
                        }`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="w-4.5 h-4.5" />
                        ) : needsKey ? (
                          <Key className="w-4.5 h-4.5" />
                        ) : (
                          <AlertCircle className="w-4.5 h-4.5" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                          <span>{res.algorithm}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              isSuccess
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : needsKey
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-red-950 text-red-300 border border-red-800'
                            }`}
                          >
                            {isSuccess ? '復号成功 (保存可能)' : needsKey ? 'パスワード/鍵 入力待ち' : '復号不可'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          対象: <span className="text-slate-300 font-mono">{res.sourceFileNames.join(', ')}</span>
                          {res.details && (
                            <span className="text-slate-500 ml-2">· {res.details}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prominent Header Download Button when Success */}
                    {isSuccess && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadResult(res)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            {res.outputFileName || '復号ファイル'} を保存
                            {res.outputSize !== undefined && ` (${formatSize(res.outputSize)})`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="pt-3 space-y-3">
                    {/* Success Body */}
                    {isSuccess && (
                      <div className="space-y-3">
                        {/* File summary and download action buttons */}
                        <div className="bg-slate-950/70 border border-emerald-900/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <span className="text-slate-400">復号ファイル名: </span>
                              <span className="font-semibold text-slate-100 font-mono">
                                {res.outputFileName}
                              </span>
                              {res.outputSize !== undefined && (
                                <span className="ml-2 text-slate-400 font-mono text-[11px]">
                                  ({formatSize(res.outputSize)})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {res.outputText && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(res.outputText!, res.id)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-indigo-300 text-xs rounded border border-slate-700 flex items-center gap-1 transition-colors"
                              >
                                {copiedId === res.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>{copiedId === res.id ? 'コピー済' : 'テキストをコピー'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDownloadResult(res)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>ダウンロード</span>
                            </button>
                          </div>
                        </div>

                        {/* Plaintext Preview */}
                        {res.outputText && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>テキスト内容プレビュー</span>
                              <span className="font-mono text-slate-500">
                                {res.outputText.length} 文字
                              </span>
                            </div>
                            <div className="relative">
                              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                                {res.outputText}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Multiple Extracted Files (from ZIP archive) */}
                        {res.extractedFiles && res.extractedFiles.length > 1 && (
                          <div className="space-y-2 pt-1 border-t border-slate-800">
                            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                              <FolderArchive className="w-3.5 h-3.5 text-indigo-400" />
                              <span>展開されたファイル一覧 ({res.extractedFiles.length} 件)</span>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {res.extractedFiles.map((ef, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2 truncate mr-2">
                                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="font-mono text-slate-200 truncate">{ef.name}</span>
                                    <span className="text-[11px] text-slate-500 shrink-0">
                                      ({formatSize(ef.size)})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {ef.text && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(ef.text!, `${res.id}-${idx}`)}
                                        className="p-1 rounded text-slate-400 hover:text-indigo-300 transition-colors"
                                        title="テキストコピー"
                                      >
                                        {copiedId === `${res.id}-${idx}` ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadExtractedItem(ef)}
                                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 text-[11px] font-medium border border-slate-700 flex items-center gap-1 transition-colors"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>保存</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Image Preview (Visual Crypto overlay or Stego image) */}
                        {res.isImage && res.outputDataUrl && (
                          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-2">
                            <img
                              src={res.outputDataUrl}
                              alt="Revealed Secret"
                              className="max-h-72 max-w-full mx-auto rounded border border-slate-700 bg-white"
                            />
                            <div className="text-[11px] text-slate-400">
                              画像をクリックまたは右クリックで直接保存できます
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Needs Key / Password Prompt */}
                    {needsKey && (
                      <div className="space-y-2.5 bg-slate-950/60 border border-amber-900/40 rounded-xl p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-amber-400" />
                            <span>{res.errorMessage || '復号パスワードまたは秘密鍵の入力が必要です'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">Enterキーまたはボタンで即時復号</span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="relative flex-1">
                            <Key className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                            <input
                              type={showPasswords[res.id] ? 'text' : 'password'}
                              placeholder="復号パスワードまたは秘密鍵文字列を入力..."
                              value={passwords[res.id] || ''}
                              onChange={(e) => handlePasswordChange(res.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleExecuteDecrypt();
                                }
                              }}
                              className="w-full pl-8 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowPassword(res.id)}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                              title={showPasswords[res.id] ? 'パスワードを隠す' : 'パスワードを表示'}
                            >
                              {showPasswords[res.id] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Quick fill from vault if matches */}
                          {vault && vault.keys.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  const vk = vault.keys.find((k) => k.id === e.target.value);
                                  if (vk) {
                                    handlePasswordChange(
                                      res.id,
                                      vk.privateKeyPem || vk.rawKeyBase64 || vk.title
                                    );
                                  }
                                }
                              }}
                              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none shrink-0"
                            >
                              <option value="">保管庫の鍵から選択</option>
                              {vault.keys.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.title}
                                </option>
                              ))}
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={handleExecuteDecrypt}
                            disabled={!passwords[res.id]?.trim()}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-sm"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>復号を実行</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Failed Message */}
                    {isFailed && (
                      <div className="space-y-2 bg-slate-950/60 border border-red-900/40 rounded-xl p-3">
                        <div className="text-xs text-red-300 font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>
                            {res.errorMessage || '復号処理に失敗しました。パスワードまたは鍵を確認してください。'}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                          <input
                            type="password"
                            placeholder="別のパスワードや秘密鍵を再入力..."
                            value={passwords[res.id] || ''}
                            onChange={(e) => handlePasswordChange(res.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleExecuteDecrypt();
                              }
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleExecuteDecrypt}
                            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>再試行</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
