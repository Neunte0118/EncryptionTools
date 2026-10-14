import React, { useState, useRef } from 'react';
import {
  createEncryptedZip,
  extractEncryptedZip,
  ZipEncryptionStrength,
  ExtractedZipItem,
} from '../utils/zipUtils';
import {
  FileArchive,
  Lock,
  Unlock,
  Upload,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw,
  FolderArchive,
  FileCheck,
  ShieldCheck,
  Plus,
} from 'lucide-react';

export const EncryptedZipTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'extract'>('create');

  // Creator state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [zipPassword, setZipPassword] = useState('');
  const [showZipPassword, setShowZipPassword] = useState(false);
  const [encStrength, setEncStrength] = useState<ZipEncryptionStrength>('aes-256');
  const [zipFilename, setZipFilename] = useState('encrypted-archive.zip');
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [createdZipBlob, setCreatedZipBlob] = useState<Blob | null>(null);
  const [createError, setCreateError] = useState('');

  // Extractor state
  const [extractZipFile, setExtractZipFile] = useState<File | null>(null);
  const [extractPassword, setExtractPassword] = useState('');
  const [showExtractPassword, setShowExtractPassword] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedZipItem[]>([]);
  const [extractError, setExtractError] = useState('');

  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setCreatedZipBlob(null);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setCreatedZipBlob(null);
  };

  const handleCreateZip = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreatedZipBlob(null);

    if (selectedFiles.length === 0) {
      setCreateError('ZIPにまとめるファイルを1つ以上選択してください');
      return;
    }

    if (!zipPassword.trim()) {
      setCreateError('暗号化保護用のパスワードを入力してください');
      return;
    }

    setIsZipping(true);
    setZipProgress({ current: 0, total: selectedFiles.length });

    try {
      const blob = await createEncryptedZip(selectedFiles, {
        password: zipPassword.trim(),
        encryptionStrength: encStrength,
        onProgress: (current, total) => setZipProgress({ current, total }),
      });
      setCreatedZipBlob(blob);
    } catch (err: any) {
      setCreateError(`ZIP暗号化エラー: ${err.message}`);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadZip = () => {
    if (!createdZipBlob) return;
    const url = URL.createObjectURL(createdZipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExtractZip = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtractError('');
    setExtractedItems([]);

    if (!extractZipFile) {
      setExtractError('解凍するZIPファイルを選択してください');
      return;
    }

    setIsExtracting(true);
    try {
      const items = await extractEncryptedZip(extractZipFile, extractPassword || undefined);
      setExtractedItems(items);
    } catch (err: any) {
      setExtractError(`解凍エラー: パスワードが一致しないか、破損しています (${err.message})`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadExtractedItem = (item: ExtractedZipItem) => {
    const url = URL.createObjectURL(item.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <FileArchive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                パスワード付き暗号化 ZIP アーカイバー
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 border border-emerald-800/80 text-emerald-300">
                AES-256 / ZipCrypto 互換
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Windows、Mac、7-Zip、Linux でそのままダブルクリックしてパスワード入力で開ける標準規格の暗号化ZIPを完全ローカルで作成・解凍します。
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'create'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>暗号化 ZIP を作成</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('extract')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'extract'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>暗号化 ZIP を解凍</span>
        </button>
      </div>

      {/* --- CREATE TAB --- */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <FolderArchive className="w-4 h-4 text-indigo-400" />
              <span>ファイル追加 &amp; 暗号化設定</span>
            </h3>

            <form onSubmit={handleCreateZip} className="space-y-4 text-xs">
              {/* File Drop / Select */}
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
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-5 text-center cursor-pointer bg-slate-950/60 transition-colors"
                >
                  <Upload className="w-7 h-7 text-slate-500 mx-auto mb-1.5" />
                  <div className="text-xs font-semibold text-slate-200">
                    ZIPに含めるファイルを追加
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    複数選択可能。文書、画像、ソースコード、バイナリ等
                  </div>
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-semibold px-1">
                    <span>選択中ファイル ({selectedFiles.length} 件):</span>
                    <span>
                      合計: {(selectedFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="space-y-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 text-[11px]"
                      >
                        <span className="truncate max-w-[240px] text-slate-300 font-medium">
                          {file.name}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ZIP 解凍用パスワード (必須)
                </label>
                <div className="relative">
                  <input
                    type={showZipPassword ? 'text' : 'password'}
                    value={zipPassword}
                    onChange={(e) => setZipPassword(e.target.value)}
                    placeholder="パスワードを入力してください"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs pr-10 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowZipPassword(!showZipPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showZipPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Algorithm & Filename */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 mb-1">暗号化方式</label>
                  <select
                    value={encStrength}
                    onChange={(e) => setEncStrength(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="aes-256">AES-256 (強力・推奨)</option>
                    <option value="zipcrypto">ZipCrypto (従来OS互換用)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">ZIP ファイル名</label>
                  <input
                    type="text"
                    value={zipFilename}
                    onChange={(e) => setZipFilename(e.target.value)}
                    placeholder="archive.zip"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {createError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={isZipping || selectedFiles.length === 0}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isZipping ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>圧縮暗号化中... ({zipProgress.current}/{zipProgress.total})</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>暗号化 ZIP を生成</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>生成された暗号化 ZIP</span>
              </h3>

              {createdZipBlob ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-950/20 border border-emerald-900/60 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>暗号化 ZIP の生成が完了しました</span>
                    </div>
                    <div className="text-[11px] text-slate-300 space-y-1">
                      <div>ファイル名: <code className="text-indigo-300 font-mono">{zipFilename}</code></div>
                      <div>アーカイブサイズ: {(createdZipBlob.size / 1024).toFixed(1)} KB</div>
                      <div>格納ファイル数: {selectedFiles.length} 件</div>
                      <div>暗号化規格: {encStrength === 'aes-256' ? 'AES-256' : 'ZipCrypto'}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>暗号化 ZIP をダウンロード</span>
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                  <FileArchive className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <div className="text-xs">左のパネルでファイルを選び、ZIPを生成してください</div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">💡 受取人側の解凍方法:</div>
              <p>Windows 11標準のエクスプローラー、macOS、7-Zip、WinRAR等でそのままパスワード入力で解凍可能です。</p>
            </div>
          </div>
        </div>
      )}

      {/* --- EXTRACT TAB --- */}
      {activeTab === 'extract' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Unlock className="w-4 h-4 text-indigo-400" />
              <span>暗号化 ZIP の解凍</span>
            </h3>

            <form onSubmit={handleExtractZip} className="space-y-4 text-xs">
              <div>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => setExtractZipFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => zipInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-5 text-center cursor-pointer bg-slate-950/60 transition-colors"
                >
                  <FileArchive className="w-7 h-7 text-slate-500 mx-auto mb-1.5" />
                  {extractZipFile ? (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-indigo-300">
                        {extractZipFile.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        サイズ: {(extractZipFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        解凍したい ZIP ファイルを選択
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  解凍パスワード (パスワードなしの場合は空欄可)
                </label>
                <div className="relative">
                  <input
                    type={showExtractPassword ? 'text' : 'password'}
                    value={extractPassword}
                    onChange={(e) => setExtractPassword(e.target.value)}
                    placeholder="パスワードを入力"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs pr-10 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExtractPassword(!showExtractPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showExtractPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {extractError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {extractError}
                </div>
              )}

              <button
                type="submit"
                disabled={isExtracting || !extractZipFile}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>ZIP を解凍中...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>ZIP を解凍して中身を展開</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>展開されたファイル一覧</span>
            </h3>

            {extractedItems.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {extractedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="truncate max-w-[200px] sm:max-w-[260px]">
                      <div className="font-medium text-slate-200 truncate">{item.filename}</div>
                      <div className="text-[10px] text-slate-500">
                        {(item.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    {!item.isDirectory && (
                      <button
                        type="button"
                        onClick={() => handleDownloadExtractedItem(item)}
                        className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        <span>保存</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                <FolderArchive className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <div className="text-xs">左のパネルでZIPファイルを選んで解凍してください</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
