import React, { useState } from 'react';
import { EncryptedZipTool } from './EncryptedZipTool';
import { GzipCompressionTool } from './GzipCompressionTool';
import { TarCompressionTool } from './TarCompressionTool';
import { FileArchive } from 'lucide-react';

export const UnifiedCompressionTool: React.FC = () => {
  const [format, setFormat] = useState<'zip' | 'tar' | 'gzip'>('zip');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <FileArchive className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">アーカイブ圧縮・展開</h2>
        </div>

        <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setFormat('zip')}
            className={`px-3 py-1 rounded transition-colors ${
              format === 'zip' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ZIP 暗号化
          </button>
          <button
            type="button"
            onClick={() => setFormat('tar')}
            className={`px-3 py-1 rounded transition-colors ${
              format === 'tar' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            tar アーカイブ
          </button>
          <button
            type="button"
            onClick={() => setFormat('gzip')}
            className={`px-3 py-1 rounded transition-colors ${
              format === 'gzip' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Gzip 圧縮
          </button>
        </div>
      </div>

      {format === 'zip' && <EncryptedZipTool />}
      {format === 'tar' && <TarCompressionTool />}
      {format === 'gzip' && <GzipCompressionTool />}
    </div>
  );
};
