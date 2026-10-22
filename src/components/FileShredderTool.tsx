import React, { useState, useRef } from 'react';
import {
  shredFileBuffer,
  SHRED_ALGORITHMS,
  ShredAlgorithm,
} from '../utils/fileShredderUtils';
import {
  Trash2,
  Upload,
  FileCheck,
  Check,
  Download,
  RefreshCw,
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
      setShredError('100MBを超えるファイルは分割が必要です');
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
    a.download = shreddedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Trash2 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">データ完全消去</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-slate-300 font-medium text-xs mb-1">
              対象ファイル
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center cursor-pointer bg-slate-950 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              {selectedFile ? (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-rose-400" />
                    <span>{selectedFile.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  ファイルを選択
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              上書き規格
            </label>
            <div className="space-y-1.5">
              {(Object.keys(SHRED_ALGORITHMS) as ShredAlgorithm[]).map((key) => {
                const info = SHRED_ALGORITHMS[key];
                return (
                  <div
                    key={key}
                    onClick={() => setAlgorithm(key)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      algorithm === key
                        ? 'bg-rose-950/30 border-rose-600 text-rose-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{info.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {info.standard}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {shredError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
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
                <span>上書き処理中 {progress.percent}%</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>上書き破壊を実行</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Output */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between text-xs">
          <div>
            <h3 className="font-semibold text-slate-200 pb-2 border-b border-slate-800 mb-4">
              抹消データ出力
            </h3>

            {shreddedBuffer ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>不可逆ノイズデータ生成完了</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadShreddedFile}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{shreddedFilename} を上書き保存</span>
                </button>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                <Trash2 className="w-8 h-8 mx-auto text-slate-600 mb-1" />
                <div>ファイルを指定して実行してください</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
