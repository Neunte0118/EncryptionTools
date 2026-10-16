import React, { useState, useRef, useEffect } from 'react';
import {
  renderTextToBinaryImageData,
  binarizeImageData,
  generateVisualCryptoShares,
  overlayShares,
  VisualShareResult,
} from '../utils/visualCryptoUtils';
import {
  Eye,
  EyeOff,
  Layers,
  Download,
  Upload,
  RefreshCw,
  Move,
  CheckCircle2,
  Sliders,
  Type,
  PenTool,
  Image as ImageIcon,
  HelpCircle,
  Sparkles,
  Info,
} from 'lucide-react';

export const VisualCryptographyTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'overlay' | 'decode'>('create');

  // Input source mode for secret image
  const [inputMode, setInputMode] = useState<'text' | 'draw' | 'image'>('text');

  // Text Mode State
  const [secretText, setSecretText] = useState('');
  const [fontSize, setFontSize] = useState<number>(36);

  // Drawing Canvas State
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Image Upload State
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(128);
  const [invertImage, setInvertImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generated Shares State
  const [sharesResult, setSharesResult] = useState<VisualShareResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Interactive Overlay State
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [opacity, setOpacity] = useState<number>(1);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Decode Uploaded Shares State
  const [uploadShare1, setUploadShare1] = useState<string | null>(null);
  const [uploadShare2, setUploadShare2] = useState<string | null>(null);
  const decodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [decodeError, setDecodeError] = useState('');

  // Setup drawing canvas on mount or when mode changes to 'draw'
  useEffect(() => {
    if (inputMode === 'draw' && drawCanvasRef.current) {
      const cvs = drawCanvasRef.current;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
      }
    }
  }, [inputMode]);

  // Drawing canvas handlers
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleDraw(e);
  };

  const handleStopDraw = () => {
    setIsDrawing(false);
    const cvs = drawCanvasRef.current;
    if (cvs) {
      const ctx = cvs.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;
    const cvs = drawCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const rect = cvs.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = cvs.width / rect.width;
    const scaleY = cvs.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleClearDrawCanvas = () => {
    const cvs = drawCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.beginPath();
    }
  };

  // Image Upload Handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImageSrc(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Extract Binary ImageData from Current Mode
  const getCurrentBinaryImageData = async (): Promise<ImageData> => {
    if (inputMode === 'text') {
      if (!secretText.trim()) throw new Error('秘密のテキストを入力してください');
      return renderTextToBinaryImageData(secretText.trim(), 320, fontSize);
    } else if (inputMode === 'draw') {
      const cvs = drawCanvasRef.current;
      if (!cvs) throw new Error('キャンバスが見つかりません');
      const ctx = cvs.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('キャンバスコンテキスト取得エラー');
      const raw = ctx.getImageData(0, 0, cvs.width, cvs.height);
      return binarizeImageData(raw, 128);
    } else {
      if (!uploadedImageSrc) throw new Error('画像をアップロードしてください');
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = uploadedImageSrc;
      });

      // Scale down image if large (max 320x240 for crisp performance)
      const maxW = 320;
      const maxH = 240;
      let w = img.width;
      let h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas取得エラー');
      ctx.drawImage(img, 0, 0, w, h);
      const raw = ctx.getImageData(0, 0, w, h);
      return binarizeImageData(raw, threshold, invertImage);
    }
  };

  // Generate Shares Handler
  const handleGenerateShares = async () => {
    setGenerateError('');
    setIsGenerating(true);
    try {
      const binaryImg = await getCurrentBinaryImageData();
      const result = await generateVisualCryptoShares(binaryImg);
      setSharesResult(result);
      setOffsetX(0);
      setOffsetY(0);
      setOpacity(1);
    } catch (err: any) {
      setGenerateError(err.message || 'シェア生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // Update Interactive Overlay Canvas
  useEffect(() => {
    if (activeTab === 'overlay' && sharesResult && overlayCanvasRef.current) {
      const canvas = overlayCanvasRef.current;
      canvas.width = sharesResult.width;
      canvas.height = sharesResult.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img1 = new Image();
      const img2 = new Image();
      img1.src = sharesResult.share1DataUrl;
      img2.src = sharesResult.share2DataUrl;

      let loaded = 0;
      const checkAndDraw = () => {
        loaded++;
        if (loaded === 2) {
          // Clear with white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw Share 1
          ctx.globalAlpha = 1;
          ctx.drawImage(img1, 0, 0);

          // Draw Share 2 with offset and opacity
          ctx.globalAlpha = opacity;
          ctx.drawImage(img2, offsetX, offsetY);
          ctx.globalAlpha = 1;
        }
      };

      img1.onload = checkAndDraw;
      img2.onload = checkAndDraw;
    }
  }, [activeTab, sharesResult, offsetX, offsetY, opacity]);

  // Decode Uploaded Shares
  const handleDecodeUploadedShares = () => {
    setDecodeError('');
    if (!uploadShare1 || !uploadShare2) {
      setDecodeError('シェア画像1とシェア画像2の両方をアップロードしてください');
      return;
    }

    const canvas = decodeCanvasRef.current;
    if (!canvas) return;

    const img1 = new Image();
    const img2 = new Image();
    img1.src = uploadShare1;
    img2.src = uploadShare2;

    let loaded = 0;
    const onBothLoaded = () => {
      loaded++;
      if (loaded === 2) {
        canvas.width = Math.max(img1.width, img2.width);
        canvas.height = Math.max(img1.height, img2.height);
        overlayShares(img1, img2, canvas, 0, 0);
      }
    };

    img1.onload = onBothLoaded;
    img2.onload = onBothLoaded;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30 flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">視覚復号型暗号 (Visual Cryptography)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-950/80 text-pink-300 border border-pink-800/60 font-mono font-medium">
                Naor-Shamir (2,2) 秘密分散法
              </span>
            </div>
            <p className="text-xs text-slate-400">
              コンピュータ不要・透明フィルムの重ね合わせで人間の肉眼が直接復号する数学的秘密分散法
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>シェア生成 (暗号化)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overlay')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'overlay'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>重ね合わせシミュレータ</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('decode')}
            className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'decode'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>画像アップロード復号</span>
          </button>
        </div>
      </div>

      {/* Concept Notice */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-pink-300 font-semibold">
          <Info className="w-4 h-4 text-pink-400" />
          <span>視覚復号型暗号（Visual Cryptography）の数学的原理</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          1994年に暗号学者 Moni Naor と Adi Shamir が考案した視覚秘密分散法です。秘密画像の各ピクセルを $2 \times 2$ サブピクセルに展開し、2枚の透明シート（Share 1 / Share 2）へ分散します。
          <strong>単独のシートは数学的に100%完全なランダムノイズ</strong>であり、シャノンの完全秘匿性を満たします。2枚を重ね合わせる（光のOR演算）と、白ピクセル領域は50%透過、黒ピクセル領域は100%遮光となり、<strong>CPUや電卓を一切使わず人間の目だけで秘密が浮かび上がります</strong>。
        </p>
      </div>

      {/* Tab 1: Create Shares */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                <span>1. 秘密画像の入力方法を選択</span>
              </h3>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    inputMode === 'text'
                      ? 'bg-pink-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Type className="w-3 h-3" />
                  <span>テキスト入力</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('draw')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    inputMode === 'draw'
                      ? 'bg-pink-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PenTool className="w-3 h-3" />
                  <span>手描きスケッチ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('image')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    inputMode === 'image'
                      ? 'bg-pink-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>画像アップロード</span>
                </button>
              </div>
            </div>

            {/* Mode A: Text Input */}
            {inputMode === 'text' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">秘密のテキスト</label>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>フォントサイズ:</span>
                    <input
                      type="range"
                      min={20}
                      max={60}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-24 accent-pink-500"
                    />
                    <span className="font-mono text-pink-300">{fontSize}px</span>
                  </div>
                </div>
                <input
                  type="text"
                  value={secretText}
                  onChange={(e) => setSecretText(e.target.value)}
                  placeholder="暗号化する文字を入力 (例: SECRET, 2026, 合言葉)..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-pink-500 font-bold"
                />
              </div>
            )}

            {/* Mode B: Canvas Drawing */}
            {inputMode === 'draw' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>マウスまたはタッチでキャンバスに文字・サイン・図形を描画してください</span>
                  <button
                    type="button"
                    onClick={handleClearDrawCanvas}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-pink-300 text-[11px]"
                  >
                    キャンバスを消去
                  </button>
                </div>
                <div className="border border-slate-700 rounded-xl overflow-hidden bg-white max-w-sm mx-auto shadow-inner">
                  <canvas
                    ref={drawCanvasRef}
                    width={320}
                    height={160}
                    onMouseDown={handleStartDraw}
                    onMouseMove={handleDraw}
                    onMouseUp={handleStopDraw}
                    onMouseLeave={handleStopDraw}
                    onTouchStart={handleStartDraw}
                    onTouchMove={handleDraw}
                    onTouchEnd={handleStopDraw}
                    className="cursor-crosshair w-full block touch-none"
                  />
                </div>
              </div>
            )}

            {/* Mode C: Image Upload */}
            {inputMode === 'image' && (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-pink-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />
                  <ImageIcon className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-200">
                    {uploadedImageSrc ? '画像が選択されました (クリックして変更)' : '画像を選択またはドラッグ＆ドロップ'}
                  </div>
                </div>

                {uploadedImageSrc && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold">白黒2値化の閾値調整:</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={invertImage}
                            onChange={(e) => setInvertImage(e.target.checked)}
                            className="rounded accent-pink-500"
                          />
                          <span>白黒反転</span>
                        </label>
                        <input
                          type="range"
                          min={30}
                          max={225}
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                          className="w-28 accent-pink-500"
                        />
                        <span className="font-mono text-pink-300 text-[11px]">{threshold}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {generateError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                {generateError}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateShares}
              disabled={isGenerating}
              className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Layers className="w-4 h-4" />
              <span>Naor-Shamir (2,2) 視覚暗号シェアを生成</span>
            </button>
          </div>

          {/* Generated Shares Display */}
          {sharesResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>2枚の視覚暗号シェアが生成されました！各シェア単体は完全な乱数ノイズです。</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('overlay')}
                  className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>重ね合わせシミュレータへ</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Share 1 Card */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-pink-400" />
                      <span className="text-xs font-bold text-slate-200">シェア 1 (透明シート 1)</span>
                    </div>
                    <a
                      href={sharesResult.share1DataUrl}
                      download="visual-crypto-share-1.png"
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-pink-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG保存</span>
                    </a>
                  </div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-white/10 p-2 flex items-center justify-center">
                    <img
                      src={sharesResult.share1DataUrl}
                      alt="Share 1"
                      className="max-h-48 object-contain shadow-md"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 text-center">
                    透明PNG形式。OHPフィルム等の透明シートに印刷可能
                  </div>
                </div>

                {/* Share 2 Card */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      <span className="text-xs font-bold text-slate-200">シェア 2 (透明シート 2)</span>
                    </div>
                    <a
                      href={sharesResult.share2DataUrl}
                      download="visual-crypto-share-2.png"
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG保存</span>
                    </a>
                  </div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-white/10 p-2 flex items-center justify-center">
                    <img
                      src={sharesResult.share2DataUrl}
                      alt="Share 2"
                      className="max-h-48 object-contain shadow-md"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 text-center">
                    透明PNG形式。シェア1と重ねると暗号が解除されます
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Interactive Overlay Simulator */}
      {activeTab === 'overlay' && (
        <div className="space-y-6">
          {!sharesResult ? (
            <div className="p-8 bg-slate-900 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
              <Layers className="w-10 h-10 text-pink-400 mx-auto" />
              <div className="text-slate-200 font-bold text-sm">暗号シェアがまだ生成されていません</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                「シェア生成」タブでテキストやスケッチからシェア1とシェア2を作成してください。
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-colors"
              >
                シェア生成へ戻る
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              {/* Controls */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-pink-400" />
                    <span>重ね合わせ位置・透明度コントロール</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOffsetX(0);
                      setOffsetY(0);
                      setOpacity(1);
                    }}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-pink-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>完全一致スナップ (ズレ解消)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>水平ズレ (Xオフセット):</span>
                      <span className="font-mono text-pink-300">{offsetX}px</span>
                    </div>
                    <input
                      type="range"
                      min={-40}
                      max={40}
                      value={offsetX}
                      onChange={(e) => setOffsetX(Number(e.target.value))}
                      className="w-full accent-pink-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>垂直ズレ (Yオフセット):</span>
                      <span className="font-mono text-pink-300">{offsetY}px</span>
                    </div>
                    <input
                      type="range"
                      min={-40}
                      max={40}
                      value={offsetY}
                      onChange={(e) => setOffsetY(Number(e.target.value))}
                      className="w-full accent-pink-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>シート2 透明度:</span>
                      <span className="font-mono text-pink-300">{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-full accent-pink-500"
                    />
                  </div>
                </div>
              </div>

              {/* Simulation Screen */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">重ね合わせ復号画面 (目視解読プレビュー):</span>
                  {offsetX === 0 && offsetY === 0 && opacity === 1 ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      完全一致: 肉眼で秘密が明瞭に復号されました
                    </span>
                  ) : (
                    <span className="text-amber-400 font-mono text-[11px]">
                      スライダーを動かして位置を一致させると文字が浮かび上がります
                    </span>
                  )}
                </div>

                <div className="border border-slate-700 rounded-xl overflow-hidden bg-white p-3 flex items-center justify-center shadow-lg">
                  <canvas
                    ref={overlayCanvasRef}
                    className="max-h-72 object-contain shadow-sm border border-slate-200"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Decode Uploaded Shares */}
      {activeTab === 'decode' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-200 text-xs">
              2枚のシェア画像 (PNG) をアップロードして重ね合わせ復号
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              以前保存した視覚暗号のシェア1とシェア2の画像を読み込ませると、自動的に重ね合わせて復元します。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <label className="block text-xs font-semibold text-slate-300">シェア 1 画像</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setUploadShare1(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-500 cursor-pointer"
              />
              {uploadShare1 && (
                <div className="border border-slate-800 rounded-lg p-2 bg-white/10 flex items-center justify-center">
                  <img src={uploadShare1} alt="Uploaded Share 1" className="max-h-32 object-contain" />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <label className="block text-xs font-semibold text-slate-300">シェア 2 画像</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setUploadShare2(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-500 cursor-pointer"
              />
              {uploadShare2 && (
                <div className="border border-slate-800 rounded-lg p-2 bg-white/10 flex items-center justify-center">
                  <img src={uploadShare2} alt="Uploaded Share 2" className="max-h-32 object-contain" />
                </div>
              )}
            </div>
          </div>

          {decodeError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
              {decodeError}
            </div>
          )}

          <button
            type="button"
            onClick={handleDecodeUploadedShares}
            disabled={!uploadShare1 || !uploadShare2}
            className="w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <Eye className="w-4 h-4" />
            <span>2枚の画像を重ね合わせて復元</span>
          </button>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-300">復元結果プレビュー:</span>
            <div className="border border-slate-700 rounded-xl overflow-hidden bg-white p-3 flex items-center justify-center">
              <canvas
                ref={decodeCanvasRef}
                className="max-h-72 object-contain border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
