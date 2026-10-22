import React, { useState, useRef, useEffect } from 'react';
import {
  analyzeFile,
  autoDecryptFiles,
  AnalyzedFile,
  DecryptionResult,
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
  Layers,
  FileCode,
  Eye,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

interface Props {
  vault?: KeyVaultFile;
  initialFiles?: File[];
}

export const AutoDecryptorTool: React.FC<Props> = ({ vault, initialFiles }) => {
  const [analyzedFiles, setAnalyzedFiles] = useState<AnalyzedFile[]>([]);
  const [results, setResults] = useState<DecryptionResult[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // If initial files are passed
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFiles(initialFiles);
    }
  }, [initialFiles]);

  const handleFiles = async (newFiles: FileList | File[]) => {
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
        // Avoid duplicate by name & size
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
  };

  // Re-run auto decrypt whenever analyzedFiles or passwords change
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
  }, [analyzedFiles, passwords, vault]);

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
  };

  const handlePasswordChange = (targetId: string, value: string) => {
    setPasswords((prev) => ({
      ...prev,
      [targetId]: value,
      global: value, // Also set as global fallback
    }));
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

  const handleDownloadAll = () => {
    const successList = results.filter((r) => r.status === 'success' && r.outputBuffer);
    for (const item of successList) {
      if (item.outputBuffer && item.outputFileName) {
        handleDownloadBuffer(item.outputBuffer, item.outputFileName);
      }
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const successfulCount = results.filter((r) => r.status === 'success').length;

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
          </div>
        </div>

        {analyzedFiles.length > 0 && (
          <div className="flex items-center gap-2">
            {successfulCount > 1 && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>全 {successfulCount} 件を一括保存</span>
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
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
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
        <div className="max-w-md mx-auto space-y-3 pointer-events-none">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-850 border border-slate-700/80 flex items-center justify-center text-slate-300">
            {isAnalyzing || isDecrypting ? (
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            ) : (
              <Upload className="w-6 h-6 text-indigo-400" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">
              ファイルを1つ以上ドラッグ＆ドロップ
            </div>
            <div className="text-xs text-slate-400 mt-1">
              またはクリックして複数ファイルを選択
            </div>
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed">
            暗号化ファイル、鍵ファイル（PEM/共通鍵）、秘密分散シェア、ステガノ画像、自己復号HTML、タイムロック等を自動識別し、最適なペアリングで復号します。
          </div>
        </div>
      </div>

      {/* Dropped Files Analysis Cards */}
      {analyzedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>投入ファイル一覧 ({analyzedFiles.length} 件)</span>
            <span className="text-[11px] text-slate-500 normal-case">
              暗号文と鍵を同時に投入すると自動で関連付けられます
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
                        {(f.size / 1024).toFixed(1)} KB
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

      {/* Decryption Execution Results */}
      {results.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>解析および復号結果</span>
            {isDecrypting && (
              <span className="text-[11px] text-indigo-400 flex items-center gap-1 font-normal">
                <RefreshCw className="w-3 h-3 animate-spin" />
                解析・復号処理中...
              </span>
            )}
          </div>

          <div className="space-y-3">
            {results.map((res) => {
              const isSuccess = res.status === 'success';
              const needsKey = res.status === 'needs-key';

              return (
                <div
                  key={res.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isSuccess
                      ? 'bg-slate-900 border-emerald-800/70 shadow-sm'
                      : needsKey
                      ? 'bg-slate-900/95 border-amber-800/70'
                      : 'bg-slate-900/90 border-red-800/70'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSuccess
                            ? 'bg-emerald-950/80 text-emerald-400'
                            : needsKey
                            ? 'bg-amber-950/80 text-amber-400'
                            : 'bg-red-950/80 text-red-400'
                        }`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : needsKey ? (
                          <Key className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          <span>{res.algorithm}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            (対象: {res.sourceFileNames.join(', ')})
                          </span>
                        </div>
                        {res.details && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {res.details}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSuccess && res.outputBuffer && res.outputFileName && (
                      <button
                        type="button"
                        onClick={() => handleDownloadBuffer(res.outputBuffer!, res.outputFileName!)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{res.outputFileName} を保存</span>
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="pt-3 space-y-3">
                    {/* Success Body */}
                    {isSuccess && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <div>
                            ファイル名:{' '}
                            <span className="font-semibold text-slate-200">
                              {res.outputFileName}
                            </span>
                            {res.outputSize !== undefined && (
                              <span className="ml-2 font-mono text-[11px] text-slate-500">
                                ({(res.outputSize / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                          {res.outputText && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(res.outputText!, res.id)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                            >
                              {copiedId === res.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedId === res.id ? 'コピー済' : 'テキストをコピー'}</span>
                            </button>
                          )}
                        </div>

                        {/* Plaintext Preview */}
                        {res.outputText && (
                          <div className="relative">
                            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                              {res.outputText}
                            </pre>
                          </div>
                        )}

                        {/* Image Preview (Visual Crypto overlay) */}
                        {res.isImage && res.outputDataUrl && (
                          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center">
                            <img
                              src={res.outputDataUrl}
                              alt="Revealed Secret"
                              className="max-h-72 max-w-full mx-auto rounded border border-slate-700 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Needs Key / Password Prompt */}
                    {needsKey && (
                      <div className="space-y-2">
                        {res.errorMessage && (
                          <div className="text-xs text-amber-300 font-medium">
                            {res.errorMessage}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                          <div className="relative flex-1">
                            <Key className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                            <input
                              type="password"
                              placeholder="パスワードまたは鍵文字列を入力..."
                              value={passwords[res.id] || ''}
                              onChange={(e) => handlePasswordChange(res.id, e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                            />
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
                              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
                            >
                              <option value="">保管庫の鍵から選択</option>
                              {vault.keys.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.title}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Failed Message */}
                    {res.status === 'failed' && (
                      <div className="text-xs text-red-300 font-medium">
                        {res.errorMessage || '復号処理に失敗しました。暗号文または鍵を確認してください。'}
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
