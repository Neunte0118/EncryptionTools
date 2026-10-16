import React, { useState, useRef } from 'react';
import { hideDataInWav, extractDataFromWav } from '../utils/audioSteganographyUtils';
import {
  Volume2,
  Lock,
  Unlock,
  Upload,
  Download,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  FileAudio,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export const AudioSteganographyTool: React.FC = () => {
  const [mode, setMode] = useState<'embed' | 'extract'>('embed');

  // Embed state
  const [embedWavFile, setEmbedWavFile] = useState<File | null>(null);
  const [secretText, setSecretText] = useState('');
  const [embedPassword, setEmbedPassword] = useState('');
  const [showEmbedPassword, setShowEmbedPassword] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embedResultBlob, setEmbedResultBlob] = useState<{ url: string; size: number } | null>(null);
  const [embedError, setEmbedError] = useState('');

  // Extract state
  const [extractWavFile, setExtractWavFile] = useState<File | null>(null);
  const [extractPassword, setExtractPassword] = useState('');
  const [showExtractPassword, setShowExtractPassword] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [extractError, setExtractError] = useState('');
  const [copied, setCopied] = useState(false);

  const embedFileInputRef = useRef<HTMLInputElement>(null);
  const extractFileInputRef = useRef<HTMLInputElement>(null);

  const handleEmbed = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmbedError('');
    setEmbedResultBlob(null);

    if (!embedWavFile) return setEmbedError('カバーとなるWAV音声ファイルを選択してください');
    if (!secretText.trim()) return setEmbedError('埋め込む秘密メッセージを入力してください');

    setIsEmbedding(true);
    try {
      const buffer = await embedWavFile.arrayBuffer();
      const stegoBuffer = await hideDataInWav(buffer, secretText.trim(), embedPassword || undefined);
      const blob = new Blob([stegoBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setEmbedResultBlob({ url, size: blob.size });
    } catch (err: any) {
      setEmbedError(err.message || '埋め込みに失敗しました');
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtractError('');
    setExtractedText('');

    if (!extractWavFile) return setExtractError('解析するWAV音声ファイルを選択してください');

    setIsExtracting(true);
    try {
      const buffer = await extractWavFile.arrayBuffer();
      const res = await extractDataFromWav(buffer, extractPassword || undefined);
      setExtractedText(res.text);
    } catch (err: any) {
      setExtractError(err.message || '抽出に失敗しました');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setMode('embed')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            mode === 'embed'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>音声へ秘密を埋め込む (封印)</span>
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
          <Unlock className="w-3.5 h-3.5" />
          <span>音声から秘密を抽出 (復号)</span>
        </button>
      </div>

      {mode === 'embed' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <form onSubmit={handleEmbed} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  カバー音声ファイル (.wav)
                </label>
                <input
                  ref={embedFileInputRef}
                  type="file"
                  accept="audio/wav,audio/x-wav,.wav"
                  onChange={(e) => setEmbedWavFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => embedFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-5 text-center cursor-pointer bg-slate-950/60"
                >
                  <FileAudio className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                  {embedWavFile ? (
                    <div className="font-semibold text-indigo-300">{embedWavFile.name} ({(embedWavFile.size / 1024).toFixed(1)} KB)</div>
                  ) : (
                    <div>
                      <div className="font-semibold text-slate-200">WAV 音声ファイルを選択</div>
                      <div className="text-[11px] text-slate-500">非圧縮リニアPCM形式のWAVに対応</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  隠蔽する秘密メッセージ
                </label>
                <textarea
                  value={secretText}
                  onChange={(e) => setSecretText(e.target.value)}
                  rows={4}
                  placeholder="音声の波形データ内に不可視埋め込みするメッセージを入力..."
                  required
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">暗号化パスワード (任意・AES-256-GCM)</label>
                <div className="relative">
                  <input
                    type={showEmbedPassword ? 'text' : 'password'}
                    value={embedPassword}
                    onChange={(e) => setEmbedPassword(e.target.value)}
                    placeholder="パスワードを入力（空欄の場合は平文埋め込み）"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmbedPassword(!showEmbedPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showEmbedPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {embedError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {embedError}
                </div>
              )}

              <button
                type="submit"
                disabled={isEmbedding || !embedWavFile}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isEmbedding ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>音声LSB埋め込み処理中...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>音声を生成して秘密を埋め込む</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-3">
              生成されたステガノ音声
            </h3>

            {embedResultBlob ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-xs space-y-1 text-emerald-300">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>秘密の不可視埋め込みが完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    人間の耳には元の音声と完全に区別がつかない極小の波形ビット変調です。
                  </div>
                </div>

                <audio controls src={embedResultBlob.url} className="w-full rounded" />

                <a
                  href={embedResultBlob.url}
                  download="stego-audio.wav"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>ステガノWAVを保存 (stego-audio.wav)</span>
                </a>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
                <Volume2 className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-xs">左のパネルでWAVを選択して実行してください</div>
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
                  ref={extractFileInputRef}
                  type="file"
                  accept="audio/wav,audio/x-wav,.wav"
                  onChange={(e) => setExtractWavFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => extractFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-5 text-center cursor-pointer bg-slate-950/60"
                >
                  <FileAudio className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                  {extractWavFile ? (
                    <div className="font-semibold text-indigo-300">{extractWavFile.name}</div>
                  ) : (
                    <div className="font-semibold text-slate-200">解析するWAV音声ファイルを選択</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">復号パスワード (設定されている場合)</label>
                <div className="relative">
                  <input
                    type={showExtractPassword ? 'text' : 'password'}
                    value={extractPassword}
                    onChange={(e) => setExtractPassword(e.target.value)}
                    placeholder="パスワードを入力"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
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
                disabled={isExtracting || !extractWavFile}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>音声波形を解析中...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>音声から秘密を抽出</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-3">
              抽出されたメッセージ
            </h3>

            {extractedText ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-100 max-h-64 overflow-y-auto whitespace-pre-wrap select-all">
                  {extractedText}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'コピー完了' : 'メッセージをコピー'}</span>
                </button>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
                <Volume2 className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-xs">左のパネルでWAVを選択して抽出を実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
