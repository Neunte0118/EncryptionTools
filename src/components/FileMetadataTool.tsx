import React, { useState, useRef } from 'react';
import {
  SupportedMediaType,
  FileMetadataInfo,
  MetadataUpdatePayload,
  readFileMetadata,
  updateFileMetadata,
  stripAllFileMetadata,
  detectMediaType,
} from '../utils/metadataUtils';
import {
  FileText,
  Music,
  Image as ImageIcon,
  Video,
  FileQuestion,
  Upload,
  Download,
  Trash2,
  Save,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Camera,
  Disc,
  Calendar,
  User,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Tag,
  Layers,
} from 'lucide-react';

export const FileMetadataTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<FileMetadataInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable fields state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [comment, setComment] = useState('');
  const [copyright, setCopyright] = useState('');
  const [software, setSoftware] = useState('');
  const [track, setTrack] = useState('');

  // PDF specific
  const [subject, setSubject] = useState('');
  const [keywords, setKeywords] = useState('');

  // Image specific
  const [cameraMake, setCameraMake] = useState('');
  const [cameraModel, setCameraModel] = useState('');
  const [removeGps, setRemoveGps] = useState(false);

  // Audio Album Art specific
  const [albumArtPreview, setAlbumArtPreview] = useState<string | null>(null);
  const [albumArtBuffer, setAlbumArtBuffer] = useState<ArrayBuffer | null | undefined>(undefined); // undefined: keep existing, null: remove, ArrayBuffer: new
  const [albumArtMime, setAlbumArtMime] = useState<string>('image/jpeg');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const albumArtInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFile(null);
    setMetadata(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setTitle('');
    setArtist('');
    setAlbum('');
    setYear('');
    setGenre('');
    setComment('');
    setCopyright('');
    setSoftware('');
    setTrack('');
    setSubject('');
    setKeywords('');
    setCameraMake('');
    setCameraModel('');
    setRemoveGps(false);
    setAlbumArtPreview(null);
    setAlbumArtBuffer(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (albumArtInputRef.current) albumArtInputRef.current.value = '';
  };

  const handleFileSelect = async (selectedFile: File) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFile(selectedFile);

    try {
      const meta = await readFileMetadata(selectedFile);
      setMetadata(meta);

      // Populate form inputs
      setTitle(meta.title || '');
      setArtist(meta.artist || '');
      setAlbum(meta.album || '');
      setYear(meta.year || '');
      setGenre(meta.genre || '');
      setComment(meta.comment || '');
      setCopyright(meta.copyright || '');
      setSoftware(meta.software || '');
      setTrack(meta.track || '');
      setSubject(meta.subject || '');
      setKeywords(meta.keywords || '');
      setCameraMake(meta.cameraMake || '');
      setCameraModel(meta.cameraModel || '');
      setRemoveGps(false);

      if (meta.albumArt) {
        setAlbumArtPreview(meta.albumArt.dataUrl);
        setAlbumArtBuffer(meta.albumArt.rawBuffer);
        setAlbumArtMime(meta.albumArt.mimeType);
      } else {
        setAlbumArtPreview(null);
        setAlbumArtBuffer(undefined);
      }
    } catch (err: any) {
      console.error('Failed to read metadata:', err);
      setErrorMsg(`メタ情報の読み取りに失敗しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAlbumArtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const artFile = e.target.files?.[0];
    if (!artFile) return;

    if (!artFile.type.startsWith('image/')) {
      setErrorMsg('アルバムアートには画像ファイル(JPEGまたはPNG)を選択してください。');
      return;
    }

    try {
      const buf = await artFile.arrayBuffer();
      const reader = new FileReader();
      reader.onload = () => {
        setAlbumArtPreview(reader.result as string);
        setAlbumArtBuffer(buf);
        setAlbumArtMime(artFile.type);
        setSuccessMsg(`アルバムアート画像（${artFile.name}）を読み込みました。`);
      };
      reader.readAsDataURL(artFile);
    } catch (err) {
      setErrorMsg('アルバムアート画像の読み込みに失敗しました。');
    }
  };

  const handleRemoveAlbumArt = () => {
    setAlbumArtPreview(null);
    setAlbumArtBuffer(null); // Explicit null marks for deletion in ID3 writer
    if (albumArtInputRef.current) albumArtInputRef.current.value = '';
    setSuccessMsg('アルバムアートを削除指定しました。保存時に適用されます。');
  };

  // Strip All Metadata (全て削除)
  const handleStripAll = async () => {
    if (!file) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const cleanBlob = await stripAllFileMetadata(file);

      // Download clean file
      const url = URL.createObjectURL(cleanBlob);
      const a = document.createElement('a');
      const dotIdx = file.name.lastIndexOf('.');
      const baseName = dotIdx !== -1 ? file.name.substring(0, dotIdx) : file.name;
      const ext = dotIdx !== -1 ? file.name.substring(dotIdx) : '';
      a.href = url;
      a.download = `${baseName}_stripped${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const diffKb = Math.max(0, Math.round((file.size - cleanBlob.size) / 1024));
      setSuccessMsg(
        `すべてのメタ情報（Exif/GPS/ID3/作成者情報等）を完全に消去しました！ [消去サイズ: 約 ${diffKb} KB]`
      );
    } catch (err: any) {
      console.error('Failed to strip metadata:', err);
      setErrorMsg(`メタ情報の消去中にエラーが発生しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save modified metadata
  const handleSaveUpdated = async () => {
    if (!file) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: MetadataUpdatePayload = {
        title,
        artist,
        album,
        year,
        genre,
        comment,
        copyright,
        software,
        track,
        subject,
        keywords,
        cameraMake,
        cameraModel,
        clearGps: removeGps,
      };

      if (metadata?.mediaType === 'audio') {
        if (albumArtBuffer !== undefined) {
          payload.albumArtBuffer = albumArtBuffer;
          payload.albumArtMime = albumArtMime;
        }
      }

      const updatedBlob = await updateFileMetadata(file, payload);

      // Trigger download
      const url = URL.createObjectURL(updatedBlob);
      const a = document.createElement('a');
      const dotIdx = file.name.lastIndexOf('.');
      const baseName = dotIdx !== -1 ? file.name.substring(0, dotIdx) : file.name;
      const ext = dotIdx !== -1 ? file.name.substring(dotIdx) : '';
      a.href = url;
      a.download = `${baseName}_updated${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(`メタ情報を反映したファイルをダウンロードしました！ (${a.download})`);
    } catch (err: any) {
      console.error('Failed to update metadata:', err);
      setErrorMsg(`メタ情報の保存中にエラーが発生しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getMediaBadge = (type: SupportedMediaType) => {
    switch (type) {
      case 'image':
        return {
          icon: ImageIcon,
          label: '画像 (JPEG/PNG)',
          color: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
        };
      case 'audio':
        return {
          icon: Music,
          label: '音声 (MP3/ID3)',
          color: 'bg-purple-950/70 border-purple-800 text-purple-300',
        };
      case 'video':
        return {
          icon: Video,
          label: '動画 (MP4/QuickTime)',
          color: 'bg-blue-950/70 border-blue-800 text-blue-300',
        };
      case 'pdf':
        return {
          icon: FileText,
          label: 'PDF ドキュメント',
          color: 'bg-rose-950/70 border-rose-800 text-rose-300',
        };
      default:
        return {
          icon: FileQuestion,
          label: 'その他バイナリ',
          color: 'bg-slate-800 border-slate-700 text-slate-300',
        };
    }
  };

  const badgeInfo = metadata ? getMediaBadge(metadata.mediaType) : null;
  const BadgeIcon = badgeInfo?.icon;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-400" />
            ファイル メタ情報 閲覧・編集・完全削除
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            画像(Exif/GPS)、音声(ID3v2 & アルバムアート)、動画(MP4/QuickTime)、PDFのプロパティをブラウザ内のみで解析・編集・一括匿名化。
          </p>
        </div>

        {file && (
          <button
            onClick={resetForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            別のファイルを選択
          </button>
        )}
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 sm:p-4 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="p-3 sm:p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {/* Step 1: Upload Dropzone if no file selected */}
      {!file && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 sm:p-12 text-center cursor-pointer bg-slate-900/30 hover:bg-slate-900/60 transition-all group"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,audio/*,video/*,application/pdf,.mp3,.mp4,.pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
            }}
          />
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-800 group-hover:bg-indigo-600/20 text-slate-400 group-hover:text-indigo-400 flex items-center justify-center transition-colors mb-4">
            <Upload className="w-7 h-7" />
          </div>
          <p className="text-sm sm:text-base font-semibold text-slate-200">
            ここにファイルをドラッグ＆ドロップ、またはクリックして選択
          </p>
          <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
            対応形式: <strong className="text-indigo-300">画像</strong> (JPEG, PNG, WebP) /{' '}
            <strong className="text-indigo-300">音声</strong> (MP3, WAV等) /{' '}
            <strong className="text-indigo-300">動画</strong> (MP4, MOV等) /{' '}
            <strong className="text-indigo-300">PDF</strong>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <ImageIcon className="w-3 h-3 text-emerald-400" /> Exif・GPS情報
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <Music className="w-3 h-3 text-purple-400" /> ID3タグ &amp; アルバムアート
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <FileText className="w-3 h-3 text-rose-400" /> PDFタイトル・作成者
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <Video className="w-3 h-3 text-blue-400" /> MP4メタ情報
            </span>
          </div>
        </div>
      )}

      {/* When File is Selected */}
      {file && metadata && (
        <div className="space-y-6">
          {/* File Summary Card & Top Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
                {BadgeIcon ? <BadgeIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate max-w-sm sm:max-w-md">
                    {file.name}
                  </h3>
                  {badgeInfo && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${badgeInfo.color}`}
                    >
                      {badgeInfo.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  <span>&bull;</span>
                  <span>{file.type || 'unknown type'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Strip All Button (ユーザー要望：全て削除ボタン) */}
              <button
                onClick={handleStripAll}
                disabled={isLoading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white transition-all shadow-md hover:shadow-rose-900/30 disabled:opacity-50"
                title="GPS、撮影者、著作権、ID3、PDFメタデータなど、すべての個人特定情報を完全に除去してダウンロード"
              >
                <Trash2 className="w-4 h-4" />
                <span>メタ情報を全て削除 (匿名化)</span>
              </button>

              {/* Save Updated Button */}
              <button
                onClick={handleSaveUpdated}
                disabled={isLoading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-all shadow-md hover:shadow-indigo-900/30 disabled:opacity-50"
                title="編集内容を反映したファイルをダウンロード"
              >
                <Save className="w-4 h-4" />
                <span>編集内容を保存</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Editor (8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-5">
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    メタ情報の編集
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    空欄にして保存すると該当タグは消去されます
                  </span>
                </div>

                {/* Common Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      タイトル / ファイル説明 (Title)
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="タイトルを入力 (例: 音声トラック / 風景写真)"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      作成者 / アーティスト (Artist / Author)
                    </label>
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      placeholder="例: 作成者名 / 撮影者"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Audio & Video Fields */}
                {(metadata.mediaType === 'audio' || metadata.mediaType === 'video') && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        アルバム名 (Album)
                      </label>
                      <input
                        type="text"
                        value={album}
                        onChange={(e) => setAlbum(e.target.value)}
                        placeholder="例: Greatest Hits"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        リリース年 / 日付 (Year)
                      </label>
                      <input
                        type="text"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="例: 2026"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        ジャンル (Genre)
                      </label>
                      <input
                        type="text"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder="例: Pop / Rock / Soundtrack"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Audio specific Track */}
                {metadata.mediaType === 'audio' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        トラック番号 (Track No.)
                      </label>
                      <input
                        type="text"
                        value={track}
                        onChange={(e) => setTrack(e.target.value)}
                        placeholder="例: 1 または 1/12"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        著作権 (Copyright)
                      </label>
                      <input
                        type="text"
                        value={copyright}
                        onChange={(e) => setCopyright(e.target.value)}
                        placeholder="例: © 2026 Your Name"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* PDF Specific Fields */}
                {metadata.mediaType === 'pdf' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        サブジェクト (Subject)
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="例: 企画提案書 / レポート"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        キーワード (カンマ区切り)
                      </label>
                      <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="例: finance, 2026, report"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Image Specific Fields */}
                {metadata.mediaType === 'image' && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          カメラメーカー (Make)
                        </label>
                        <input
                          type="text"
                          value={cameraMake}
                          onChange={(e) => setCameraMake(e.target.value)}
                          placeholder="例: Canon / SONY / Apple"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          カメラ型番 (Model)
                        </label>
                        <input
                          type="text"
                          value={cameraModel}
                          onChange={(e) => setCameraModel(e.target.value)}
                          placeholder="例: EOS R5 / iPhone 15 Pro"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                        />
                      </div>
                    </div>

                    {/* GPS strip toggle */}
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-rose-400" />
                        <div>
                          <div className="text-xs font-semibold text-slate-200">
                            GPS 位置情報の削除
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {metadata.gpsLatitude && metadata.gpsLongitude
                              ? `検出位置: 緯度 ${metadata.gpsLatitude.toFixed(4)}°, 経度 ${metadata.gpsLongitude.toFixed(4)}°`
                              : '現在GPSタグは未検出です'}
                          </div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={removeGps}
                          onChange={(e) => setRemoveGps(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Comment / Remarks */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    コメント / 備考 (Comment)
                  </label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="任意のコメントや説明文"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 outline-none"
                  />
                </div>

                {/* Bottom Save Trigger */}
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                  <button
                    onClick={handleSaveUpdated}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>変更を保存してダウンロード</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Audio Album Art Editor & Detected Tag Summary (4-5 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
              {/* Audio Album Art Editor (ユーザー要望: 音声はアルバムアートも編集できるように) */}
              {metadata.mediaType === 'audio' && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Disc className="w-4 h-4 text-purple-400" />
                      アルバムアートの編集
                    </h4>
                    {albumArtPreview && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60 font-mono">
                        {albumArtMime.replace('image/', '').toUpperCase()}
                      </span>
                    )}
                  </div>

                  <input
                    ref={albumArtInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAlbumArtUpload}
                  />

                  {/* Album Art Preview Area */}
                  <div className="flex flex-col items-center">
                    {albumArtPreview ? (
                      <div className="relative group w-44 h-44 sm:w-48 sm:h-48 rounded-xl overflow-hidden border-2 border-purple-500/40 shadow-lg bg-black">
                        <img
                          src={albumArtPreview}
                          alt="Album Art Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                          <button
                            onClick={() => albumArtInputRef.current?.click()}
                            className="px-2.5 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
                          >
                            画像を変更
                          </button>
                          <button
                            onClick={handleRemoveAlbumArt}
                            className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-500"
                          >
                            アートを削除
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => albumArtInputRef.current?.click()}
                        className="w-44 h-44 sm:w-48 sm:h-48 rounded-xl border-2 border-dashed border-slate-700 hover:border-purple-500 flex flex-col items-center justify-center p-4 text-center cursor-pointer bg-slate-950 hover:bg-purple-950/20 transition-all group"
                      >
                        <Disc className="w-10 h-10 text-slate-600 group-hover:text-purple-400 mb-2 transition-colors" />
                        <span className="text-xs font-medium text-slate-300 group-hover:text-purple-200">
                          アルバムアート未設定
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1">
                          クリックして画像(JPEG/PNG)を追加
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 w-full">
                      <button
                        onClick={() => albumArtInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>画像をアップロード</span>
                      </button>

                      {albumArtPreview && (
                        <button
                          onClick={handleRemoveAlbumArt}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition-colors"
                          title="アルバムアートを消去"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>削除</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Detected Raw Metadata Inspection Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-400" />
                    検出された全タグ ({metadata.detectedTags.length}件)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {metadata.mimeType}
                  </span>
                </div>

                {metadata.detectedTags.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    検出された既存メタタグはありません（クリーンなファイルです）
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {metadata.detectedTags.map((tag, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-start justify-between text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-slate-300 block">
                            {tag.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {tag.key}
                          </span>
                        </div>
                        <span className="text-[11px] text-indigo-300 font-mono text-right truncate max-w-[150px]">
                          {tag.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Privacy Warning Card */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>プライバシーとメタデータのリスク</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  デジタル写真には撮影したGPS座標（緯度経度・自宅住所）や端末型番、SNS等への投稿時に個人情報が漏洩するリスクがあります。
                  「メタ情報を全て削除」を実行することで、安全に匿名化して配布可能です。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
