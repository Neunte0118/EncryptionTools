import React, { useState } from 'react';
import {
  deriveKeyFromPassword,
  computeHash,
  bufferToBase64,
} from '../utils/cryptoUtils';
import {
  FileLock,
  Download,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  FolderArchive,
  FileCheck,
  Hash,
} from 'lucide-react';

export const ActionPipelinesTool: React.FC = () => {
  const [pipelineType, setPipelineType] = useState<'clean-encrypt' | 'hash-sign-pack'>('clean-encrypt');

  // Pipeline 1: Clean Metadata + Encrypt + Download
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [completedResult, setCompletedResult] = useState<{
    downloadUrl: string;
    filename: string;
    sha256: string;
    origSize: number;
    encSize: number;
  } | null>(null);
  const [error, setError] = useState('');

  const handleRunCleanEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFile) return setError('処理するファイルを選択してください');
    if (!password.trim()) return setError('暗号化パスワードを入力してください');

    setError('');
    setCompletedResult(null);
    setIsProcessing(true);

    try {
      // Step 1: Read file
      setProgressStep('ファイルを読み込み中...');
      const buffer = await targetFile.arrayBuffer();

      // Step 2: Compute pre-hash
      setProgressStep('安全なSHA-256ダイジェストを算出中...');
      const origHash = await computeHash(buffer, 'SHA-256');

      // Step 3: Encrypt with AES-256-GCM
      setProgressStep('AES-256-GCM で暗号化中...');
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKeyFromPassword(password.trim(), salt);

      const cipherBuf = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        buffer
      );

      // Pack format: [4b MAGIC 'ENC1'] [16b salt] [12b iv] [cipher+tag]
      const magic = new TextEncoder().encode('ENC1');
      const finalPkg = new Uint8Array(4 + 16 + 12 + cipherBuf.byteLength);
      finalPkg.set(magic, 0);
      finalPkg.set(salt, 4);
      finalPkg.set(iv, 20);
      finalPkg.set(new Uint8Array(cipherBuf), 32);

      const blob = new Blob([finalPkg as any], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const encHash = await computeHash(finalPkg.buffer as ArrayBuffer, 'SHA-256');

      setCompletedResult({
        downloadUrl,
        filename: `${targetFile.name}.encrypted`,
        sha256: encHash,
        origSize: targetFile.size,
        encSize: blob.size,
      });
      setProgressStep('完了しました');
    } catch (err: any) {
      setError(`処理エラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">アクション (一括実行パイプライン)</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Pipeline selector & execution */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-lg space-y-1 text-indigo-200">
            <div className="font-semibold flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>ファイル保護・暗号化・完全性検証 パイプライン</span>
            </div>
            <p className="text-[11px] text-slate-400">
              「ファイルの読み込み → 改ざん防止ハッシュ計算 → AES-256-GCM暗号化 → 安全な暗号ファイル生成」を1クリックで一括処理します。
            </p>
          </div>

          <form onSubmit={handleRunCleanEncrypt} className="space-y-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">対象ファイル</label>
              <input
                type="file"
                onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {targetFile && (
                <div className="text-[11px] text-slate-400 mt-1">
                  サイズ: {(targetFile.size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">暗号化パスワード</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing || !targetFile}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{progressStep}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>パイプラインを一括実行</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Output */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
            パイプライン実行結果
          </h3>

          {completedResult ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>全工程が正常に完了しました</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  暗号化ファイル: <code className="text-indigo-300">{completedResult.filename}</code>
                </div>
                <div className="text-[11px] text-slate-400">
                  暗号後サイズ: {(completedResult.encSize / 1024).toFixed(1)} KB
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                <div className="text-slate-400 font-sans text-xs flex items-center gap-1">
                  <Hash className="w-3 h-3 text-indigo-400" />
                  <span>暗号化成果物の SHA-256 チェックサム:</span>
                </div>
                <div className="text-emerald-300 break-all select-all">{completedResult.sha256}</div>
              </div>

              <a
                href={completedResult.downloadUrl}
                download={completedResult.filename}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>暗号化ファイルを保存</span>
              </a>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
              <FileLock className="w-8 h-8 mx-auto text-slate-600" />
              <div>左のパネルで実行してください</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
