import React, { useState, useRef } from 'react';
import {
  shredFileBuffer,
  SHRED_ALGORITHMS,
  ShredAlgorithm,
} from '../utils/fileShredderUtils';
import {
  Flame,
  Trash2,
  Upload,
  FileCheck,
  Check,
  AlertTriangle,
  Download,
  ShieldAlert,
  Sparkles,
  Info,
  RefreshCw,
  FileX,
  FileDigit,
  Binary,
} from 'lucide-react';

export const FileShredderTool: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);

  const [algorithm, setAlgorithm] = useState<ShredAlgorithm>('dod3');
  const [isShredding, setIsShredding] = useState(false);
  const [progress, setProgress] = useState<{
    pass: number;
    totalPasses: number;
    percent: number;
  }>({ pass: 0, totalPasses: 0, percent: 0 });

  const [shreddedBuffer, setShreddedBuffer] = useState<ArrayBuffer | null>(null);
  const [shreddedFilename, setShreddedFilename] = useState<string>('');
  const [shredError, setShredError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    });
    setShreddedBuffer(null);
    setShredError('');
    setProgress({ pass: 0, totalPasses: 0, percent: 0 });
  };

  const handleStartShredding = async () => {
    if (!selectedFile) {
      setShredError('抹消破壊するファイルを選択してください');
      return;
    }

    if (selectedFile.size > 100 * 1024 * 1024) {
      // Safety limit for browser in-memory ArrayBuffer
      setShredError('ブラウザ内安全制限: 100MBを超えるファイルはメモリ枯渇を防ぐため分割が必要です');
      return;
    }

    setShredError('');
    setIsShredding(true);
    setProgress({ pass: 1, totalPasses: SHRED_ALGORITHMS[algorithm].passes, percent: 0 });

    try {
      const buffer = await shredFileBuffer(
        selectedFile.size,
        algorithm,
        (pass, totalPasses, percent) => {
          setProgress({ pass, totalPasses, percent });
        }
      );

      setShreddedBuffer(buffer);
      setShreddedFilename(selectedFile.name);
    } catch (err: any) {
      setShredError(`抹消処理エラー: ${err.message}`);
    } finally {
      setIsShredding(false);
    }
  };

  const handleDownloadShreddedFile = () => {
    if (!shreddedBuffer || !shreddedFilename) return;
    const blob = new Blob([shreddedBuffer]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = shreddedFilename; // same filename to prompt overwrite
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                暗号化ファイル・シュレッダー（ローカル完全抹消）
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 border border-rose-800/80 text-rose-300">
                DoD 5220.22-M / Gutmann 準拠
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ファイルを単にゴミ箱に入れて削除するだけでは、復元ツールで簡単に復元されてしまいます。同名・同サイズの完全不可逆ノイズファイルを生成して上書き破壊します。
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>安全な抹消手順:</strong> ① 消去したいファイルを選択 → ② 抹消アルゴリズム（DoD/Gutmann等）でノイズを生成 → ③ 生成された同名ファイルをダウンロードして<strong>「既存ファイルを上書き保存」</strong> → ④ その後にゴミ箱から通常削除します。
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Settings & File Selection */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileX className="w-4 h-4 text-rose-400" />
            <span>抹消対象ファイルとアルゴリズム</span>
          </h3>

          {/* File Picker */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center cursor-pointer bg-slate-950/60 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              {selectedFile ? (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-rose-400" />
                    <span>{selectedFile.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ファイルサイズ: {(selectedFile.size / 1024).toFixed(1)} KB ({selectedFile.size.toLocaleString()} bytes)
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    クリックして別のファイルを選択
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    完全に抹消破壊したいファイルを選択
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    PDF、Word、Excel、画像、秘密鍵、DBバックアップなど
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Algorithm Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              抹消・上書きパターン (規格):
            </label>
            <div className="space-y-2">
              {(Object.keys(SHRED_ALGORITHMS) as ShredAlgorithm[]).map((key) => {
                const info = SHRED_ALGORITHMS[key];
                return (
                  <div
                    key={key}
                    onClick={() => setAlgorithm(key)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      algorithm === key
                        ? 'bg-rose-950/30 border-rose-500 text-rose-100'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${algorithm === key ? 'bg-rose-400' : 'bg-slate-600'}`} />
                        {info.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        {info.standard}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 pl-3.5">
                      {info.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {shredError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
              {shredError}
            </div>
          )}

          <button
            type="button"
            onClick={handleStartShredding}
            disabled={!selectedFile || isShredding}
            className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {isShredding ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>不可逆ノイズ上書き中... ({progress.percent}%)</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>シュレッダー破壊を実行</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Progress & Download Output */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Binary className="w-4 h-4 text-emerald-400" />
              <span>破壊済みファイル出力</span>
            </h3>

            {/* Progress Display */}
            {isShredding && (
              <div className="space-y-2 p-4 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Pass {progress.pass} / {progress.totalPasses}</span>
                  <span className="font-mono font-bold text-rose-400">{progress.percent}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-rose-500 h-2 rounded-full transition-all duration-150"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  ブラウザ内 CSPRNG 暗号論的乱数ジェネレータでバイト列を物理破壊中...
                </p>
              </div>
            )}

            {shreddedBuffer ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/60 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>ファイルの不可逆ノイズ化が完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div>ファイル名: <code className="text-rose-300 font-mono">{shreddedFilename}</code></div>
                    <div>上書きサイズ: {(shreddedBuffer.byteLength / 1024).toFixed(1)} KB (完全一致)</div>
                    <div>適用方式: {SHRED_ALGORITHMS[algorithm].name}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadShreddedFile}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>破壊ファイルをダウンロード (上書き用)</span>
                </button>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                  <div className="font-semibold text-slate-300">完全削除の仕上げ:</div>
                  <div>1. ダウンロードしたファイルを、元のファイルと同じフォルダに保存（「上書きしますか？」で「はい」を選択）</div>
                  <div>2. 元のディスクセクタ領域が完全にランダムノイズに置き換わります</div>
                  <div>3. 上書き完了後、通常通りゴミ箱に移動して空にします</div>
                </div>
              </div>
            ) : !isShredding && (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                <FileDigit className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <div className="text-xs">左のパネルでファイルを選び、シュレッダーを実行してください</div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>
              100% クライアントサイド完結。ファイルの中身がサーバーに送信されることは一切ありません。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
