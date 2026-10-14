import React, { useState } from 'react';
import { SteganographyTool } from './SteganographyTool';
import { AudioSteganographyTool } from './AudioSteganographyTool';
import { Image, Volume2 } from 'lucide-react';

export const UnifiedSteganographyTool: React.FC = () => {
  const [mediaType, setMediaType] = useState<'image' | 'audio'>('image');

  return (
    <div className="space-y-6">
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setMediaType('image')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
            mediaType === 'image'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Image className="w-4 h-4" />
          <span>画像ステガノグラフィ (PNG / WebP ピクセル隠蔽)</span>
        </button>

        <button
          type="button"
          onClick={() => setMediaType('audio')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
            mediaType === 'audio'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>音声ステガノグラフィ (WAV 音声波形隠蔽)</span>
        </button>
      </div>

      {mediaType === 'image' ? <SteganographyTool /> : <AudioSteganographyTool />}
    </div>
  );
};
