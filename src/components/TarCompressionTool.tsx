import React, { useState, useRef } from 'react';
import {
  createTarArchive,
  extractTarArchive,
  compressTarToGz,
  decompressGzToTar,
  TarEntry,
} from '../utils/tarUtils';
import {
  FileArchive,
  Upload,
  Download,
  Trash2,
  Check,
  RefreshCw,
  FolderArchive,
  FileCheck,
  FileCode,
} from 'lucide-react';

export const TarCompressionTool: React.FC = () => {
  const [mode, setMode] = useState<'create' | 'extract'>('create');
  const [compressGz, setCompressGz] = useState(true);

  // Create state
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; size: number; data: Uint8Array }[]>([]);
  const [tarName, setTarName] = useState('archive');
  const [isCreating, setIsCreating] = useState(false);
  const [createdBlob, setCreatedBlob] = useState<{ blob: Blob; filename: string } | null>(null);
  const [createError, setCreateError] = useState('');

  // Extract state
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedEntries, setExtractedEntries] = useState<TarEntry[]>([]);
  const [extractError, setExtractError] = useState('');

  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const f of files) {
      const buf = await f.arrayBuffer();
      setSelectedFiles((prev) => [
        ...prev,
        { name: f.name, size: f.size, data: new Uint8Array(buf) },
      ]);
    }
    setCreatedBlob(null);
  };

  const handleCreate = async () => {
    if (selectedFiles.length === 0) {
      return setCreateError('ファイルを選択してください');
    }
    setCreateError('');
    setIsCreating(true);

    try {
      const rawTar = createTarArchive(selectedFiles);
      let finalBytes: Uint8Array;
      let filename = tarName.trim() || 'archive';

      if (compressGz) {
        finalBytes = await compressTarToGz(rawTar);
        if (!filename.endsWith('.tar.gz') && !filename.endsWith('.tgz')) {
          filename = `${filename.replace(/\.tar$/, '')}.tar.gz`;
        }
      } else {
        finalBytes = rawTar;
        if (!filename.endsWith('.tar')) {
          filename = `${filename}.tar`;
        }
      }

      const blob = new Blob([finalBytes as any], { type: 'application/x-tar' });
      setCreatedBlob({ blob, filename });
    } catch (err: any) {
      setCreateError(`TAR作成エラー: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveFile) return setExtractError('TARファイルを選択してください');
    setExtractError('');
    setIsExtracting(true);
    setExtractedEntries([]);

    try {
      const buffer = await archiveFile.arrayBuffer();
      let tarBytes = new Uint8Array(buffer);

      const isGz =
        archiveFile.name.endsWith('.gz') ||
        archiveFile.name.endsWith('.tgz') ||
        (tarBytes[0] === 0x1f && tarBytes[1] === 0x8b);

      if (isGz) {
        tarBytes = await decompressGzToTar(tarBytes);
      }

      const entries = extractTarArchive(tarBytes);
      if (entries.length === 0) {
        throw new Error('アーカイブ内にファイルが見つかりません');
      }
      setExtractedEntries(entries);
    } catch (err: any) {
      setExtractError(`TAR展開エラー: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadExtracted = (entry: TarEntry) => {
    const blob = new Blob([entry.data as any]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-5">
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            mode === 'create'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5" />
          <span>tar / tar.gz アーカイブ作成</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('extract')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            mode === 'extract'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileArchive className="w-3.5 h-3.5" />
          <span>tar / tar.gz 展開</span>
        </button>
      </div>

      {mode === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div>
              <input
                ref={multiFileInputRef}
                type="file"
                multiple
                onChange={handleFilesAdded}
                className="hidden"
              />
              <div
                onClick={() => multiFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-5 text-center cursor-pointer bg-slate-950/60"
              >
                <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                <div className="font-semibold text-slate-200">アーカイブするファイルを追加</div>
                <div className="text-[11px] text-slate-500">複数選択可能</div>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                <div className="flex justify-between text-[11px] text-slate-400 font-semibold px-1">
                  <span>選択中 ({selectedFiles.length} 件):</span>
                  <span>
                    合計: {(selectedFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB
                  </span>
                </div>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 text-[11px]"
                  >
                    <span className="truncate max-w-[240px] text-slate-300 font-medium">{file.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1">出力ファイル名</label>
                <input
                  type="text"
                  value={tarName}
                  onChange={(e) => setTarName(e.target.value)}
                  placeholder="archive"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={compressGz}
                    onChange={(e) => setCompressGz(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                  />
                  <span>gzip 圧縮を適用 (.tar.gz)</span>
                </label>
              </div>
            </div>

            {createError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || selectedFiles.length === 0}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>アーカイブ生成中...</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4" />
                  <span>{compressGz ? '.tar.gz アーカイブを作成' : '.tar アーカイブを作成'}</span>
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-3">
              作成結果
            </h3>

            {createdBlob ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-xs space-y-1 text-emerald-300">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>アーカイブが生成されました</span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    ファイル名: <code className="font-mono text-indigo-300">{createdBlob.filename}</code>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    サイズ: {(createdBlob.blob.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                <a
                  href={URL.createObjectURL(createdBlob.blob)}
                  download={createdBlob.filename}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>ダウンロード</span>
                </a>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
                <FileArchive className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-xs">左のパネルでファイルを選んで作成してください</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <form onSubmit={handleExtract} className="space-y-4">
              <div>
                <input
                  ref={archiveInputRef}
                  type="file"
                  accept=".tar,.gz,.tgz"
                  onChange={(e) => setArchiveFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => archiveInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-5 text-center cursor-pointer bg-slate-950/60"
                >
                  <FileArchive className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                  {archiveFile ? (
                    <div className="text-xs font-semibold text-indigo-300">{archiveFile.name}</div>
                  ) : (
                    <div className="text-xs font-semibold text-slate-200">.tar または .tar.gz ファイルを選択</div>
                  )}
                </div>
              </div>

              {extractError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {extractError}
                </div>
              )}

              <button
                type="submit"
                disabled={isExtracting || !archiveFile}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>アーカイブ展開中...</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4" />
                    <span>アーカイブを展開</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-3">
              展開ファイル一覧 ({extractedEntries.length} 件)
            </h3>

            {extractedEntries.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {extractedEntries.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="truncate max-w-[200px] sm:max-w-[260px]">
                      <div className="font-medium text-slate-200 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-500">{(item.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadExtracted(item)}
                      className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      <span>保存</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
                <FileCode className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-xs">左のパネルでTARファイルを選んで展開してください</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
