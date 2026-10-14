import React, { useState } from 'react';
import { EncryptedZipTool } from './EncryptedZipTool';
import { GzipCompressionTool } from './GzipCompressionTool';
import { FolderArchive, FileArchive, Zap } from 'lucide-react';

export const UnifiedCompressionTool: React.FC = () => {
  const [format, setFormat] = useState<'zip' | 'gzip'>('zip');

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setFormat('zip')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
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
          onClick={() => setFormat('gzip')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            format === 'gzip'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Gzip / Deflate 圧縮・解凍 (高速ストリーム)</span>
        </button>
      </div>

      {format === 'zip' ? <EncryptedZipTool /> : <GzipCompressionTool />}
    </div>
  );
};
