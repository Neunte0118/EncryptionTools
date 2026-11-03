import React from 'react';
import { ShieldCheck, WifiOff, Globe, Layers } from 'lucide-react';

interface Props {
  library: string;
  hasNetwork?: boolean;
  networkDetails?: string;
  className?: string;
}

export const FeatureLibraryBadge: React.FC<Props> = ({
  library,
  hasNetwork = false,
  networkDetails = '通信なし (100% ブラウザ内ローカル処理・外部送信なし)',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 ${className}`}
    >
      {/* External Library */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-slate-400 text-[11px]">外部ライブラリ:</span>
        <span className="font-mono text-[11px] text-indigo-300 bg-indigo-950/60 border border-indigo-900/50 px-1.5 py-0.5 rounded truncate">
          {library}
        </span>
      </div>

      {/* Network Communication Status */}
      <div className="flex items-center gap-1.5 shrink-0">
        {hasNetwork ? (
          <>
            <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">ネットワーク通信:</span>
            <span className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-900/50 px-1.5 py-0.5 rounded">
              {networkDetails}
            </span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">ネットワーク通信:</span>
            <span className="text-[11px] text-emerald-300 bg-emerald-950/60 border border-emerald-900/50 px-1.5 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{networkDetails}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
};
