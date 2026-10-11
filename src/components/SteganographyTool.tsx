import React, { useState, useRef, useEffect } from 'react';
import {
  calculateImageCapacity,
  formatBytes,
  encodeSteganography,
  decodeSteganography,
  inspectStegoHeader,
  generateDiffVisualization,
  ImageCapacity,
  EncodeResult,
  DecodeResult,
  StegoHeaderInfo,
} from '../utils/steganographyUtils';
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  FileText,
  File as FileIcon,
  Download,
  Lock,
  Unlock,
  Key,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileArchive,
  Info,
} from 'lucide-react';

export const SteganographyTool: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'encode' | 'decode'>('encode');

  // ================= ENCODE STATE =================
  const [carrierFile, setCarrierFile] = useState<File | null>(null);
  const [carrierUrl, setCarrierUrl] = useState<string | null>(null);
  const [carrierImageEl, setCarrierImageEl] = useState<HTMLImageElement | null>(null);
  const [carrierCapacity, setCarrierCapacity] = useState<ImageCapacity | null>(null);

  const [payloadType, setPayloadType] = useState<'text' | 'file'>('text');
  const [secretText, setSecretText] = useState<string>('');
  const [secretFile, setSecretFile] = useState<File | null>(null);
  const [secretFileBytes, setSecretFileBytes] = useState<Uint8Array | null>(null);

  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [useCompression, setUseCompression] = useState<boolean>(true);

  const [isEncoding, setIsEncoding] = useState<boolean>(false);
  const [encodeResult, setEncodeResult] = useState<EncodeResult | null>(null);
  const [encodeResultUrl, setEncodeResultUrl] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  const [visualizerMode, setVisualizerMode] = useState<'stego' | 'diff'>('stego');
  const [diffCanvasUrl, setDiffCanvasUrl] = useState<string | null>(null);

  // ================= DECODE STATE =================
  const [decodeFile, setDecodeFile] = useState<File | null>(null);
  const [decodeUrl, setDecodeUrl] = useState<string | null>(null);
  const [decodeImageEl, setDecodeImageEl] = useState<HTMLImageElement | null>(null);
  const [detectedHeader, setDetectedHeader] = useState<StegoHeaderInfo | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  const [decodePassword, setDecodePassword] = useState<string>('');
  const [showDecodePassword, setShowDecodePassword] = useState<boolean>(false);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [decodeResult, setDecodeResult] = useState<DecodeResult | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const carrierInputRef = useRef<HTMLInputElement>(null);
  const secretFileInputRef = useRef<HTMLInputElement>(null);
  const decodeInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (carrierUrl) URL.revokeObjectURL(carrierUrl);
      if (encodeResultUrl) URL.revokeObjectURL(encodeResultUrl);
      if (diffCanvasUrl) URL.revokeObjectURL(diffCanvasUrl);
      if (decodeUrl) URL.revokeObjectURL(decodeUrl);
    };
  }, [carrierUrl, encodeResultUrl, diffCanvasUrl, decodeUrl]);

  // Handle Carrier Image Selection
  const handleCarrierSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setEncodeError('画像ファイル (PNG, JPEG, WebP等) を選択してください。');
      return;
    }
    setEncodeError(null);
    setEncodeResult(null);
    setEncodeResultUrl(null);
    setDiffCanvasUrl(null);

    if (carrierUrl) URL.revokeObjectURL(carrierUrl);
    const url = URL.createObjectURL(file);
    setCarrierFile(file);
    setCarrierUrl(url);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setCarrierImageEl(img);
      const cap = calculateImageCapacity(img.naturalWidth, img.naturalHeight);
      setCarrierCapacity(cap);
    };
    img.src = url;
  };

  // Generate Sample Carrier Image (Gradient canvas)
  const handleGenerateSampleCarrier = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create scenic gradient with crypto patterns
    const grad = ctx.createLinearGradient(0, 0, 1200, 800);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#312e81');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 800);

    // Decorative shapes
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * 1200,
        Math.random() * 800,
        Math.random() * 120 + 20,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = `rgba(${Math.floor(Math.random() * 100 + 100)}, ${Math.floor(
        Math.random() * 100 + 100
      )}, 255, 0.12)`;
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sample Carrier Image', 600, 380);
    ctx.font = '18px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('1200 x 800 (Capacity: ~351 KB)', 600, 425);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'sample_carrier.png', { type: 'image/png' });
        handleCarrierSelect(file);
      }
    }, 'image/png');
  };

  // Handle Secret File Selection
  const handleSecretFileSelect = async (file: File) => {
    setSecretFile(file);
    const buf = await file.arrayBuffer();
    setSecretFileBytes(new Uint8Array(buf));
  };

  // Calculate payload approximate size
  const estimatePayloadSize = (): number => {
    if (payloadType === 'text') {
      return new TextEncoder().encode(secretText).length;
    }
    return secretFileBytes ? secretFileBytes.length : 0;
  };

  const payloadSize = estimatePayloadSize();
  const isOverCapacity = carrierCapacity ? payloadSize + 64 > carrierCapacity.maxBytes : false;

  // Execute Encoding
  const handleEncode = async () => {
    if (!carrierImageEl) {
      setEncodeError('母艦となる画像を選択してください。');
      return;
    }
    if (payloadType === 'text' && !secretText.trim()) {
      setEncodeError('埋め込む秘密テキストを入力してください。');
      return;
    }
    if (payloadType === 'file' && !secretFileBytes) {
      setEncodeError('埋め込む秘密ファイルを選択してください。');
      return;
    }

    setIsEncoding(true);
    setEncodeError(null);

    try {
      // Get original image data for diff visualization
      const origCanvas = document.createElement('canvas');
      origCanvas.width = carrierImageEl.naturalWidth;
      origCanvas.height = carrierImageEl.naturalHeight;
      const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
      if (!origCtx) throw new Error('Canvas context failure');
      origCtx.drawImage(carrierImageEl, 0, 0);
      const originalImageData = origCtx.getImageData(
        0,
        0,
        carrierImageEl.naturalWidth,
        carrierImageEl.naturalHeight
      );

      const result = await encodeSteganography(carrierImageEl, {
        type: payloadType,
        text: secretText,
        fileBytes: secretFileBytes || undefined,
        fileName: secretFile?.name,
        mimeType: secretFile?.type,
        password: password.trim() ? password.trim() : undefined,
        useCompression,
      });

      setEncodeResult(result);
      if (encodeResultUrl) URL.revokeObjectURL(encodeResultUrl);
      const resUrl = URL.createObjectURL(result.pngBlob);
      setEncodeResultUrl(resUrl);

      // Generate Diff Heatmap Visualization
      const diffData = generateDiffVisualization(originalImageData, result.encodedImageData);
      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = carrierImageEl.naturalWidth;
      diffCanvas.height = carrierImageEl.naturalHeight;
      const diffCtx = diffCanvas.getContext('2d');
      if (diffCtx) {
        diffCtx.putImageData(diffData, 0, 0);
        diffCanvas.toBlob((b) => {
          if (b) {
            if (diffCanvasUrl) URL.revokeObjectURL(diffCanvasUrl);
            setDiffCanvasUrl(URL.createObjectURL(b));
          }
        }, 'image/png');
      }
    } catch (err: any) {
      setEncodeError(err?.message || 'エンコード処理中にエラーが発生しました。');
    } finally {
      setIsEncoding(false);
    }
  };

  // Handle Decode Image Select
  const handleDecodeSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setDecodeError('画像ファイルを選択してください。');
      return;
    }
    setDecodeError(null);
    setDecodeResult(null);
    setDetectedHeader(null);

    if (decodeUrl) URL.revokeObjectURL(decodeUrl);
    const url = URL.createObjectURL(file);
    setDecodeFile(file);
    setDecodeUrl(url);

    setIsDetecting(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setDecodeImageEl(img);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
        const header = inspectStegoHeader(imgData);
        setDetectedHeader(header);
      }
      setIsDetecting(false);
    };
    img.onerror = () => {
      setIsDetecting(false);
      setDecodeError('画像の読み込みに失敗しました。');
    };
    img.src = url;
  };

  // Execute Decoding
  const handleDecode = async () => {
    if (!decodeImageEl) {
      setDecodeError('ステガノグラフィ画像を読み込んでください。');
      return;
    }

    setIsDecoding(true);
    setDecodeError(null);

    try {
      const result = await decodeSteganography(
        decodeImageEl,
        decodePassword.trim() ? decodePassword.trim() : undefined
      );
      setDecodeResult(result);
    } catch (err: any) {
      if (err?.message === 'PASSWORD_REQUIRED') {
        setDecodeError('この画像はパスワードで暗号化されています。パスワードを入力してください。');
      } else {
        setDecodeError(err?.message || '抽出処理中にエラーが発生しました。');
      }
    } finally {
      setIsDecoding(false);
    }
  };

  const handleCopySecretText = async () => {
    if (!decodeResult?.text) return;
    try {
      await navigator.clipboard.writeText(decodeResult.text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner / Header */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-900/40 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  画像ステガノグラフィ
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm">
                  LSB 技術
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  AES-256 暗号化対応
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                画像の最下位ビット (LSB) に秘密のメッセージやファイルを不可視に埋め込み・抽出。人間の目には元の画像と全く区別がつかない状態で極秘保管・通信が可能です。
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0 self-start sm:self-center">
            <button
              onClick={() => setActiveMode('encode')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMode === 'encode'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>埋め込み (Encode)</span>
            </button>
            <button
              onClick={() => setActiveMode('decode')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMode === 'decode'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>抽出・復元 (Decode)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: ENCODE (HIDE) */}
      {/* ========================================================================= */}
      {activeMode === 'encode' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Carrier Image */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
                    1
                  </span>
                  母艦画像 (Carrier Image) の選択
                </h2>
                <button
                  onClick={handleGenerateSampleCarrier}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  title="テスト用のサンプル画像を即座に生成"
                >
                  <Sparkles className="w-3 h-3" />
                  サンプル画像を生成
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => carrierInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) handleCarrierSelect(e.dataTransfer.files[0]);
                }}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                  carrierUrl
                    ? 'border-indigo-600/60 bg-indigo-950/20 hover:bg-indigo-950/30'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-950/60 hover:bg-slate-950'
                }`}
              >
                <input
                  type="file"
                  ref={carrierInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleCarrierSelect(e.target.files[0]);
                  }}
                />

                {carrierUrl ? (
                  <div className="space-y-3">
                    <img
                      src={carrierUrl}
                      alt="Carrier Preview"
                      className="max-h-48 mx-auto rounded-lg object-contain shadow-md border border-slate-800 bg-black/40"
                    />
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
                      <span className="font-semibold truncate max-w-[200px]">{carrierFile?.name}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">{carrierFile && formatBytes(carrierFile.size)}</span>
                    </div>
                    <p className="text-[11px] text-indigo-400">クリックまたはドラッグ＆ドロップで画像を変更</p>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-300">
                      画像をドラッグ＆ドロップ、またはクリックして選択
                    </div>
                    <p className="text-[11px] text-slate-500">
                      PNG / JPEG / WebP (解像度が高いほど大容量のデータを隠せます)
                    </p>
                  </div>
                )}
              </div>

              {/* Carrier Capacity Stats */}
              {carrierCapacity && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">画像解像度</span>
                    <span className="font-mono text-slate-200">
                      {carrierCapacity.width} × {carrierCapacity.height} px ({carrierCapacity.totalPixels.toLocaleString()} ピクセル)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">最大埋め込み可能容量</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {carrierCapacity.formattedMaxCapacity}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Secret Payload Input */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
                      2
                    </span>
                    隠す秘密データ (Secret Payload)
                  </h2>

                  {/* Text vs File Toggle */}
                  <div className="flex p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                    <button
                      onClick={() => setPayloadType('text')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        payloadType === 'text'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      テキスト
                    </button>
                    <button
                      onClick={() => setPayloadType('file')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        payloadType === 'file'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileIcon className="w-3 h-3" />
                      ファイル
                    </button>
                  </div>
                </div>

                {/* Text Mode Input */}
                {payloadType === 'text' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>秘密メッセージ / 秘密鍵 / 暗号文:</span>
                      <span className="font-mono">{secretText.length} 文字 ({formatBytes(payloadSize)})</span>
                    </div>
                    <textarea
                      rows={5}
                      value={secretText}
                      onChange={(e) => setSecretText(e.target.value)}
                      placeholder="ここに隠したい秘密のテキストやシークレットキーを入力..."
                      className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono text-slate-200 placeholder-slate-600 transition-colors resize-none"
                    />
                  </div>
                ) : (
                  /* File Mode Input */
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={secretFileInputRef}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleSecretFileSelect(e.target.files[0]);
                      }}
                    />
                    <div
                      onClick={() => secretFileInputRef.current?.click()}
                      className="border border-dashed border-slate-700 hover:border-indigo-500/80 rounded-lg p-5 text-center cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-colors"
                    >
                      {secretFile ? (
                        <div className="space-y-1">
                          <FileIcon className="w-8 h-8 text-indigo-400 mx-auto" />
                          <div className="text-xs font-semibold text-slate-200 truncate">{secretFile.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {formatBytes(secretFile.size)} ({secretFile.type || '不明な形式'})
                          </div>
                          <p className="text-[10px] text-indigo-400 pt-1">クリックでファイル変更</p>
                        </div>
                      ) : (
                        <div className="space-y-1 py-3">
                          <FileIcon className="w-8 h-8 text-slate-500 mx-auto" />
                          <div className="text-xs font-semibold text-slate-300">
                            隠したいファイルを選択
                          </div>
                          <p className="text-[11px] text-slate-500">
                            ZIP / PDF / 画像 / 鍵ファイル など任意形式対応
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Capacity Usage Progress Bar */}
                {carrierCapacity && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">容量使用率</span>
                      <span
                        className={`font-mono font-semibold ${
                          isOverCapacity ? 'text-rose-400' : 'text-indigo-300'
                        }`}
                      >
                        {formatBytes(payloadSize)} / {carrierCapacity.formattedMaxCapacity} (
                        {((payloadSize / carrierCapacity.maxBytes) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isOverCapacity ? 'bg-rose-500' : 'bg-indigo-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(2, (payloadSize / carrierCapacity.maxBytes) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    {isOverCapacity && (
                      <div className="text-[11px] text-rose-400 flex items-center gap-1 font-medium pt-0.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        容量オーバーです。より解像度の高い母艦画像を使用してください。
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Encryption & Compression Options */}
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Password Protection */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3 h-3 text-indigo-400" />
                      パスワード暗号化 (任意)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="AES-256-GCM で保護"
                        className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-slate-200 placeholder-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Gzip Compression Toggle */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/80 self-end">
                    <div className="flex items-center gap-2">
                      <FileArchive className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs text-slate-300 font-medium">Gzip 自動圧縮</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCompression}
                        onChange={(e) => setUseCompression(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                {/* Encode Submit Button */}
                <button
                  onClick={handleEncode}
                  disabled={isEncoding || !carrierImageEl || isOverCapacity}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-900/30 transition-all cursor-pointer"
                >
                  {isEncoding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>LSB エンコード中...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>画像に秘密データを埋め込む</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Encode Error Alert */}
          {encodeError && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{encodeError}</span>
            </div>
          )}

          {/* ENCODE RESULT & VISUALIZER */}
          {encodeResult && encodeResultUrl && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      ステガノグラフィ画像の生成が完了しました！
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      LSBピクセル内に秘密データが不可視状態で埋め込まれました
                    </p>
                  </div>
                </div>

                {/* Visualizer Mode Switcher */}
                <div className="flex p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs shrink-0">
                  <button
                    onClick={() => setVisualizerMode('stego')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                      visualizerMode === 'stego'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    生成画像プレビュー
                  </button>
                  <button
                    onClick={() => setVisualizerMode('diff')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                      visualizerMode === 'diff'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="改変されたLSBピクセルを蛍光色で可視化"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>差分増幅ヒートマップ</span>
                  </button>
                </div>
              </div>

              {/* Stats & Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">埋め込み総データ量</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {formatBytes(encodeResult.usedBytes)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">キャリア消費率</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {encodeResult.usagePercentage}%
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">暗号化ステータス</span>
                  <span className="font-semibold text-indigo-300">
                    {encodeResult.isEncrypted ? 'AES-256-GCM 保護' : '平文'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Gzip 圧縮</span>
                  <span className="font-semibold text-slate-200">
                    {encodeResult.isCompressed ? '有効 (最適化済)' : 'なし'}
                  </span>
                </div>
              </div>

              {/* Image Preview / Diff Display */}
              <div className="relative rounded-xl overflow-hidden bg-black/60 border border-slate-800 p-2 text-center">
                {visualizerMode === 'stego' ? (
                  <div>
                    <img
                      src={encodeResultUrl}
                      alt="Steganography Output"
                      className="max-h-80 mx-auto rounded-lg object-contain shadow-lg"
                    />
                    <p className="text-[11px] text-slate-400 mt-2">
                      見た目は元画像と完全に同一ですが、LSB内にデータが密かに格納されています。
                    </p>
                  </div>
                ) : (
                  <div>
                    {diffCanvasUrl && (
                      <img
                        src={diffCanvasUrl}
                        alt="LSB Diff Heatmap"
                        className="max-h-80 mx-auto rounded-lg object-contain shadow-lg"
                      />
                    )}
                    <p className="text-[11px] text-amber-300 mt-2 flex items-center justify-center gap-1">
                      <Info className="w-3.5 h-3.5 text-amber-400" />
                      蛍光色で表示されている箇所が、実際に秘密データが注入されたピクセル領域です。
                    </p>
                  </div>
                )}
              </div>

              {/* Download Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-slate-400">
                  ⚠️ <strong className="text-slate-300">注意:</strong>{' '}
                  必ずダウンロードされた <strong>PNG 形式</strong> のまま保存してください。
                  JPEG等の不可逆圧縮を通すと最下位ビットが損なわれます。
                </div>
                <a
                  href={encodeResultUrl}
                  download={`stego_${carrierFile?.name.replace(/\.[^/.]+$/, '') || 'image'}.png`}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ステガノグラフィ画像を保存 (PNG)</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: DECODE (EXTRACT) */}
      {/* ========================================================================= */}
      {activeMode === 'decode' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Upload Stego Image */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
                  1
                </span>
                ステガノグラフィ画像 (PNG) の読込
              </h2>

              <div
                onClick={() => decodeInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) handleDecodeSelect(e.dataTransfer.files[0]);
                }}
                className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                  decodeUrl
                    ? 'border-indigo-600/60 bg-indigo-950/20 hover:bg-indigo-950/30'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-950/60 hover:bg-slate-950'
                }`}
              >
                <input
                  type="file"
                  ref={decodeInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleDecodeSelect(e.target.files[0]);
                  }}
                />

                {decodeUrl ? (
                  <div className="space-y-3">
                    <img
                      src={decodeUrl}
                      alt="Decode Preview"
                      className="max-h-48 mx-auto rounded-lg object-contain shadow-md border border-slate-800 bg-black/40"
                    />
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold truncate max-w-[200px]">{decodeFile?.name}</span>
                      <span className="text-slate-500 mx-1.5">•</span>
                      <span className="text-slate-400">{decodeFile && formatBytes(decodeFile.size)}</span>
                    </div>
                    <p className="text-[11px] text-indigo-400">クリックまたはドラッグ＆ドロップで画像を変更</p>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-300">
                      ステガノグラフィ画像をドラッグ＆ドロップ
                    </div>
                    <p className="text-[11px] text-slate-500">
                      埋め込み時にダウンロードした PNG ファイルを選択してください
                    </p>
                  </div>
                )}
              </div>

              {/* Detection Status Box */}
              {decodeUrl && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  {isDetecting ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>ステガノグラフィ署名をスキャン中...</span>
                    </div>
                  ) : detectedHeader ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>有効なステガノグラフィデータを検出しました！</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                        <div>
                          種別:{' '}
                          <span className="text-slate-200 font-medium">
                            {detectedHeader.isFile ? `秘密ファイル (${detectedHeader.fileName})` : '秘密テキスト'}
                          </span>
                        </div>
                        <div>
                          暗号化:{' '}
                          <span
                            className={`font-semibold ${
                              detectedHeader.isEncrypted ? 'text-amber-400' : 'text-slate-200'
                            }`}
                          >
                            {detectedHeader.isEncrypted ? 'パスワード保護あり' : 'なし (平文)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Info className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>この画像には認識可能なステガノグラフィデータが見つかりませんでした。</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Password & Extraction Settings */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold">
                    2
                  </span>
                  復号と抽出の実行
                </h2>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    復号パスワード (暗号化されている場合)
                  </label>
                  <div className="relative">
                    <input
                      type={showDecodePassword ? 'text' : 'password'}
                      value={decodePassword}
                      onChange={(e) => setDecodePassword(e.target.value)}
                      placeholder={detectedHeader?.isEncrypted ? '設定されたパスワードを入力' : 'パスワード（平文データの場合は不要）'}
                      className="w-full pl-3 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-slate-200 placeholder-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDecodePassword(!showDecodePassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showDecodePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {detectedHeader?.isEncrypted && (
                    <p className="text-[11px] text-amber-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      このデータはAES-256-GCMで暗号化されています。正しいパスワードが必須です。
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                  <div className="font-semibold text-slate-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    完全性チェック (CRC32):
                  </div>
                  <p>
                    抽出時にデータのハッシュ検証を行い、ピクセルの改ざんや破損がないか自動検証します。
                  </p>
                </div>
              </div>

              {/* Decode Submit Button */}
              <div className="pt-4 border-t border-slate-800/80">
                <button
                  onClick={handleDecode}
                  disabled={isDecoding || !decodeImageEl}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-900/30 transition-all cursor-pointer"
                >
                  {isDecoding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>抽出・復号処理中...</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>秘密データを抽出・復元する</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Decode Error Alert */}
          {decodeError && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{decodeError}</span>
            </div>
          )}

          {/* DECODE RESULT DISPLAY */}
          {decodeResult && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/40 space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      データの抽出・復元に成功しました！
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>形式: {decodeResult.type === 'file' ? 'ファイル' : 'テキスト'}</span>
                      <span>•</span>
                      {decodeResult.crcValid ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> CRC32整合性検証 合格
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold">CRC32不一致警告</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Result Content Area */}
              {decodeResult.type === 'text' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>復元された秘密メッセージ:</span>
                    <button
                      onClick={handleCopySecretText}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText ? 'コピー完了' : 'クリップボードにコピー'}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap break-all max-h-60 overflow-y-auto selection:bg-indigo-600 selection:text-white">
                    {decodeResult.text}
                  </pre>
                </div>
              ) : (
                /* Restored File Area */
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                        {decodeResult.fileName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        サイズ: {decodeResult.fileSize && formatBytes(decodeResult.fileSize)} • 形式: {decodeResult.mimeType}
                      </div>
                    </div>
                  </div>

                  {decodeResult.fileBlob && (
                    <a
                      href={URL.createObjectURL(decodeResult.fileBlob)}
                      download={decodeResult.fileName || 'extracted_file'}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ファイルをダウンロード</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
