import React, { useRef, useState } from 'react';
import { Upload, FileText, Check } from 'lucide-react';
import { bufferToBase64 } from '../utils/cryptoUtils';

interface FileLoaderButtonProps {
  onFileLoaded: (content: string, buffer?: ArrayBuffer, filename?: string) => void;
  mode?: 'text' | 'base64' | 'auto';
  label?: string;
  accept?: string;
  className?: string;
  title?: string;
}

export const FileLoaderButton: React.FC<FileLoaderButtonProps> = ({
  onFileLoaded,
  mode = 'auto',
  label = 'ファイルから読込',
  accept,
  className = '',
  title = 'ファイルを選択またはドラッグ＆ドロップ',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadedName, setLoadedName] = useState<string | null>(null);

  const processFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      let textContent = '';

      if (mode === 'text') {
        textContent = new TextDecoder('utf-8').decode(buffer);
      } else if (mode === 'base64') {
        textContent = bufferToBase64(buffer);
      } else {
        // auto: try UTF-8 text first; if it has many null bytes or fails, fallback to base64
        try {
          textContent = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          textContent = bufferToBase64(buffer);
        }
      }

      setLoadedName(file.name);
      onFileLoaded(textContent, buffer, file.name);
      setTimeout(() => setLoadedName(null), 3000);
    } catch (err: any) {
      console.error('File load error:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="inline-block"
      title={title}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all flex items-center gap-1.5 cursor-pointer ${
          isDragOver
            ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
            : loadedName
            ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
            : 'bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border-slate-700/80'
        } ${className}`}
      >
        {loadedName ? (
          <>
            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[130px]">{loadedName}</span>
          </>
        ) : (
          <>
            <Upload className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{label}</span>
          </>
        )}
      </button>
    </div>
  );
};
