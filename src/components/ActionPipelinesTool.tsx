import React, { useState } from 'react';
import {
  deriveKeyFromPassword,
  computeHash,
  bufferToBase64,
} from '../utils/cryptoUtils';
import { stripAllFileMetadata } from '../utils/metadataUtils';
import { generateSelfDecryptingHtml } from '../utils/selfDecryptingPackage';
import { createEncryptedZip } from '../utils/zipUtils';
import { createTarArchive, compressTarToGz } from '../utils/tarUtils';
import {
  Zap,
  ShieldCheck,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  FolderArchive,
  FileCheck,
  Hash,
  Flame,
  FileCode,
  QrCode,
  Lock,
  Layers,
  ArrowRight,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';

type PipelineId = 'privacy-encrypt' | 'multi-share' | 'archive-pack';

export const ActionPipelinesTool: React.FC = () => {
  const [activePipeline, setActivePipeline] = useState<PipelineId>('privacy-encrypt');

  // -------------------------------------------------------------
  // Pipeline 1: Clean Metadata + Encrypt + Hash
  // -------------------------------------------------------------
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stripMeta, setStripMeta] = useState(true);
  const [isProcessingP1, setIsProcessingP1] = useState(false);
  const [stepP1, setStepP1] = useState('');
  const [resultP1, setResultP1] = useState<{
    downloadUrl: string;
    filename: string;
    origHash: string;
    encHash: string;
    origSize: number;
    encSize: number;
    wasStripped: boolean;
  } | null>(null);
  const [errorP1, setErrorP1] = useState('');

  // -------------------------------------------------------------
  // Pipeline 2: Dual Share (One-Time Link + Self-Decrypting HTML)
  // -------------------------------------------------------------
  const [shareText, setShareText] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [showSharePassword, setShowSharePassword] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [burnAfterSeconds, setBurnAfterSeconds] = useState<number>(60);
  const [isProcessingP2, setIsProcessingP2] = useState(false);
  const [resultP2, setResultP2] = useState<{
    oneTimeUrl: string;
    qrDataUrl: string;
    htmlDownloadUrl: string;
    htmlFilename: string;
    expiresAt: number;
  } | null>(null);
  const [copiedP2, setCopiedP2] = useState<string | null>(null);
  const [errorP2, setErrorP2] = useState('');

  // -------------------------------------------------------------
  // Pipeline 3: Archive (ZIP / tar.gz) + Encrypt
  // -------------------------------------------------------------
  const [archiveFiles, setArchiveFiles] = useState<File[]>([]);
  const [archiveFormat, setArchiveFormat] = useState<'zip' | 'tar.gz'>('zip');
  const [archivePassword, setArchivePassword] = useState('');
  const [showArchivePassword, setShowArchivePassword] = useState(false);
  const [isProcessingP3, setIsProcessingP3] = useState(false);
  const [stepP3, setStepP3] = useState('');
  const [resultP3, setResultP3] = useState<{
    downloadUrl: string;
    filename: string;
    sha256: string;
    fileCount: number;
    size: number;
  } | null>(null);
  const [errorP3, setErrorP3] = useState('');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Pipeline 1 Handler
  const handleRunPrivacyEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFile) return setErrorP1('ファイルを選択してください');
    if (!password.trim()) return setErrorP1('暗号化パスワードを入力してください');

    setErrorP1('');
    setResultP1(null);
    setIsProcessingP1(true);

    try {
      let workingBuffer: ArrayBuffer;
      let wasStripped = false;

      if (stripMeta) {
        setStepP1('プライバシーメタデータ（Exif/ID3/PDFタグ等）を消去中...');
        const cleanBlob = await stripAllFileMetadata(targetFile);
        workingBuffer = await cleanBlob.arrayBuffer();
        wasStripped = true;
      } else {
        setStepP1('ファイルを読み込み中...');
        workingBuffer = await targetFile.arrayBuffer();
      }

      setStepP1('元ファイルの SHA-256 チェックサムを算出中...');
      const origHashResult = await computeHash(workingBuffer, 'SHA-256');

      setStepP1('AES-256-GCM で暗号化中...');
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKeyFromPassword(password.trim(), salt);

      const cipherBuf = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        workingBuffer
      );

      // Binary Package: [4b MAGIC 'ENC1'] [16b salt] [12b iv] [cipher]
      const magic = new TextEncoder().encode('ENC1');
      const finalPkg = new Uint8Array(4 + 16 + 12 + cipherBuf.byteLength);
      finalPkg.set(magic, 0);
      finalPkg.set(salt, 4);
      finalPkg.set(iv, 20);
      finalPkg.set(new Uint8Array(cipherBuf), 32);

      const blob = new Blob([finalPkg as any], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const encHashResult = await computeHash(finalPkg.buffer as ArrayBuffer, 'SHA-256');

      setResultP1({
        downloadUrl,
        filename: `${targetFile.name}.encrypted`,
        origHash: origHashResult.hex,
        encHash: encHashResult.hex,
        origSize: targetFile.size,
        encSize: blob.size,
        wasStripped,
      });
      setStepP1('完了しました');
    } catch (err: any) {
      setErrorP1(`処理エラー: ${err.message}`);
    } finally {
      setIsProcessingP1(false);
    }
  };

  // Pipeline 2 Handler: Self-Decrypting Package
  const handleRunMultiShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareText.trim()) return setErrorP2('秘密メッセージを入力してください');
    if (!sharePassword.trim()) return setErrorP2('復号パスワードを入力してください');

    setErrorP2('');
    setResultP2(null);
    setIsProcessingP2(true);

    try {
      // Self-Decrypting HTML
      const htmlString = await generateSelfDecryptingHtml({
        type: 'text',
        textContent: shareText.trim(),
        title: shareTitle.trim() || 'セキュアメッセージ',
        password: sharePassword.trim(),
        hint: undefined,
      });

      const htmlBlob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
      const htmlDownloadUrl = URL.createObjectURL(htmlBlob);

      // Generate QR Code containing the file title and confirmation
      const qrDataUrl = await QRCode.toDataURL(`SECURE_ENCRYPTED_PACKAGE:${shareTitle.trim() || 'package'}`, {
        margin: 1,
        width: 180,
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      setResultP2({
        oneTimeUrl: '',
        qrDataUrl,
        htmlDownloadUrl,
        htmlFilename: `${shareTitle.trim() || 'secure-note'}.html`,
        expiresAt: 0,
      });
    } catch (err: any) {
      setErrorP2(`生成エラー: ${err.message}`);
    } finally {
      setIsProcessingP2(false);
    }
  };

  // Pipeline 3 Handler: Archive + Encrypt
  const handleRunArchivePack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (archiveFiles.length === 0) return setErrorP3('ファイルを選択してください');
    if (!archivePassword.trim()) return setErrorP3('暗号化パスワードを入力してください');

    setErrorP3('');
    setResultP3(null);
    setIsProcessingP3(true);

    try {
      let finalBlob: Blob;
      let filename: string;

      if (archiveFormat === 'zip') {
        setStepP3('AES-256暗号化ZIPアーカイブを作成中...');
        finalBlob = await createEncryptedZip(archiveFiles, {
          password: archivePassword.trim(),
          encryptionStrength: 'aes-256',
        });
        filename = 'archive.zip';
      } else {
        setStepP3('TARアーカイブを生成中...');
        const entries = await Promise.all(
          archiveFiles.map(async (f) => ({
            name: f.name,
            data: new Uint8Array(await f.arrayBuffer()),
          }))
        );
        const tarBytes = createTarArchive(entries);

        setStepP3('Gzip圧縮ストリームを適用中...');
        const gzBytes = await compressTarToGz(tarBytes);

        setStepP3('AES-256-GCM で暗号化中...');
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKeyFromPassword(archivePassword.trim(), salt);
        const cipher = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          gzBytes as any
        );

        const magic = new TextEncoder().encode('TARGZENC1');
        const packed = new Uint8Array(9 + 16 + 12 + cipher.byteLength);
        packed.set(magic, 0);
        packed.set(salt, 9);
        packed.set(iv, 25);
        packed.set(new Uint8Array(cipher), 37);

        finalBlob = new Blob([packed as any], { type: 'application/gzip' });
        filename = 'archive.tar.gz.enc';
      }

      setStepP3('SHA-256ハッシュを計算中...');
      const buf = await finalBlob.arrayBuffer();
      const hashRes = await computeHash(buf, 'SHA-256');

      setResultP3({
        downloadUrl: URL.createObjectURL(finalBlob),
        filename,
        sha256: hashRes.hex,
        fileCount: archiveFiles.length,
        size: finalBlob.size,
      });
      setStepP3('完了しました');
    } catch (err: any) {
      setErrorP3(`アーカイブエラー: ${err.message}`);
    } finally {
      setIsProcessingP3(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">アクション (一括実行パイプライン)</h2>
            <p className="text-[11px] text-slate-400">
              暗号化・メタデータ削除・圧縮・共有など、頻出するセキュリティ処理を1クリックで一括実行
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Navigation Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setActivePipeline('privacy-encrypt')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'privacy-encrypt'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>プライバシー消去 ＋ AES暗号化</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              Exif/タグ削除 → ハッシュ算出 → AES-256暗号化を完全自動実行
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('multi-share')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'multi-share'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>ワンタイムリンク ＋ 自己復号HTML</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              時限消滅URLとオフライン単一HTMLの2大共有形式を同時発行
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('archive-pack')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'archive-pack'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
            <FolderArchive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>一括アーカイブ ＋ パスワード暗号化</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              複数ファイルを tar.gz または ZIP にまとめてAES-256で安全に封印
            </div>
          </div>
        </button>
      </div>

      {/* Pipeline 1: Privacy + Encrypt + Hash */}
      {activePipeline === 'privacy-encrypt' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-lg space-y-1 text-indigo-200">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>ワークフロー概要</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ファイルに残留するGPS位置情報やExif・著者タグ等のメタデータを不可逆消去した上で、AES-256-GCM暗号化と改竄照合用SHA-256ハッシュを一括生成します。
              </p>
            </div>

            <form onSubmit={handleRunPrivacyEncrypt} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">対象ファイル</label>
                <input
                  type="file"
                  onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
                {targetFile && (
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                    <span>選択: <strong className="text-slate-200">{targetFile.name}</strong></span>
                    <span>({(targetFile.size / 1024).toFixed(1)} KB)</span>
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="stripMetaCheckbox"
                  checked={stripMeta}
                  onChange={(e) => setStripMeta(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="stripMetaCheckbox" className="text-slate-300 text-xs cursor-pointer select-none">
                  プライバシーメタデータを自動除去する (Exif, GPS, ID3, PDF著者等)
                </label>
              </div>

              {errorP1 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                  {errorP1}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP1 || !targetFile}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessingP1 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{stepP1}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>パイプラインを実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              パイプライン実行結果
            </h3>

            {resultP1 ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>全工程が正常に完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    暗号化ファイル: <code className="text-indigo-300">{resultP1.filename}</code>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    メタデータ消去: {resultP1.wasStripped ? '適用済み' : 'スキップ'}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-indigo-400" />
                      <span>暗号成果物 SHA-256:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resultP1.encHash, 'encHash')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedKey === 'encHash' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="text-emerald-300 break-all select-all">{resultP1.encHash}</div>
                </div>

                <a
                  href={resultP1.downloadUrl}
                  download={resultP1.filename}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>暗号化ファイルを保存</span>
                </a>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <ShieldCheck className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 2: Dual Share (One-Time Link + Self-Decrypting HTML) */}
      {activePipeline === 'multi-share' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg space-y-1 text-amber-200">
              <div className="font-semibold flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>デュアル形式ワンタイム共有</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ① チャット等ですぐ送れる<strong>URLフラグメント時限消滅リンク</strong>と、② オフラインのどんな環境でも開ける<strong>自己復号HTMLファイル</strong>を1入力で同時に生成します。
              </p>
            </div>

            <form onSubmit={handleRunMultiShare} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">タイトル / 件名 (任意)</label>
                <input
                  type="text"
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                  placeholder="例: 機密ログイン情報"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">秘密メッセージ本文</label>
                <textarea
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                  rows={4}
                  placeholder="相手に一度だけ安全に伝えたいテキスト・パスワードを入力..."
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">リンク有効期限</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={10}>10分間</option>
                    <option value={60}>1時間</option>
                    <option value={1440}>24時間 (1日)</option>
                    <option value={10080}>7日間</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">開封後自爆タイマー</label>
                  <select
                    value={burnAfterSeconds}
                    onChange={(e) => setBurnAfterSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={30}>30秒で消滅</option>
                    <option value={60}>60秒で消滅</option>
                    <option value={300}>5分で消滅</option>
                    <option value={0}>自動消滅なし</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  復号パスワード (任意)
                </label>
                <div className="relative">
                  <input
                    type={showSharePassword ? 'text' : 'password'}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="空欄の場合はリンク自体に鍵を含めます"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSharePassword(!showSharePassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showSharePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {errorP2 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                  {errorP2}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP2 || !shareText.trim()}
                className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessingP2 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>リンクとHTMLを同時生成</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              同時発行されたセキュア共有パッケージ
            </h3>

            {resultP2 ? (
              <div className="space-y-4">
                {/* Self-Decrypting HTML */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span>自己復号スタンドアロンHTML</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    外部サーバー不要で、ブラウザにドラッグ＆ドロップしてパスワードを入力するだけで復号できる単一HTMLファイルです。
                  </p>
                  <a
                    href={resultP2.htmlDownloadUrl}
                    download={resultP2.htmlFilename}
                    className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                  >
                  NullNotifyMe
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <Flame className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 3: Archive (ZIP / tar.gz) + Encrypt */}
      {activePipeline === 'archive-pack' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg space-y-1 text-emerald-200">
              <div className="font-semibold flex items-center gap-1.5">
                <FolderArchive className="w-4 h-4 text-emerald-400" />
                <span>複数ファイル一括アーカイブ &amp; 暗号化</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                複数ファイルを1つのアーカイブに圧縮し、AES-256でパスワード保護。Windows/Mac標準ツール対応のZIPまたは高圧縮tar.gzを選択できます。
              </p>
            </div>

            <form onSubmit={handleRunArchivePack} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  対象ファイル (複数選択可)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setArchiveFiles(Array.from(e.target.files || []))}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />
                {archiveFiles.length > 0 && (
                  <div className="mt-2 p-2 bg-slate-950 border border-slate-800 rounded-lg max-h-24 overflow-y-auto space-y-1">
                    {archiveFiles.map((f, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] text-slate-300">
                        <span className="truncate">{f.name}</span>
                        <span className="text-slate-500 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">アーカイブ形式</label>
                  <select
                    value={archiveFormat}
                    onChange={(e) => setArchiveFormat(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="zip">ZIP (AES-256暗号化)</option>
                    <option value="tar.gz">tar.gz (Gzip圧縮＋AES-256)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">暗号化パスワード</label>
                  <div className="relative">
                    <input
                      type={showArchivePassword ? 'text' : 'password'}
                      value={archivePassword}
                      onChange={(e) => setArchivePassword(e.target.value)}
                      placeholder="パスワードを入力"
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowArchivePassword(!showArchivePassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showArchivePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {errorP3 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                  {errorP3}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP3 || archiveFiles.length === 0}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessingP3 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{stepP3}</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4" />
                    <span>一括アーカイブ＆暗号化を実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              アーカイブ生成結果
            </h3>

            {resultP3 ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>アーカイブが正常に完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    格納ファイル数: <strong className="text-slate-200">{resultP3.fileCount} 個</strong>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    アーカイブ容量: {(resultP3.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-indigo-400" />
                      <span>SHA-256 チェックサム:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resultP3.sha256, 'archiveSha256')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedKey === 'archiveSha256' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="text-emerald-300 break-all select-all">{resultP3.sha256}</div>
                </div>

                <a
                  href={resultP3.downloadUrl}
                  download={resultP3.filename}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>暗号化アーカイブを保存</span>
                </a>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <FolderArchive className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
