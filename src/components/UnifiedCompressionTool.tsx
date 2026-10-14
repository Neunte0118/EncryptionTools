import React, { useState } from 'react';
import { EncryptedZipTool } from './EncryptedZipTool';
import { GzipCompressionTool } from './GzipCompressionTool';
import { TarCompressionTool } from './TarCompressionTool';
import { FolderArchive, FileArchive, Zap } from 'lucide-react';

export const UnifiedCompressionTool: React.FC = () => {
  const [format, setFormat] = useState<'zip' | 'tar' | 'gzip'>('zip');

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setFormat('zip')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors shrink-0 ${
            format === 'zip'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>ZIP アーカイブ (AES-256暗号化対応)</span>
        </button>

        <button
          type="button"
          onClick={() => setFormat('tar')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors shrink-0 ${
            format === 'tar'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileArchive className="w-4 h-4" />
          <span>tar / tar.gz アーカイブ</span>
        </button>

        <button
          type="button"
          onClick={() => setFormat('gzip')}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors shrink-0 ${
            format === 'gzip'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Gzip / Deflate 単一ストリーム圧縮</span>
        </button>
      </div>

      {format === 'zip' && <EncryptedZipTool />}
      {format === 'tar' && <TarCompressionTool />}
      {format === 'gzip' && <GzipCompressionTool />}
    </div>
  );
};
