import React, { useState } from 'react';
import { Terminal, Copy, Check, ChevronDown, ChevronUp, Code2, Monitor, ShieldCheck } from 'lucide-react';

interface Props {
  title?: string;
  defaultOpen?: boolean;
  linuxCommand: string;
  powerShellScript: string;
  powerShellCli?: string;
  note?: string;
}

export const CrossPlatformCliPanel: React.FC<Props> = ({
  title = 'Linux & Windows PowerShell 互換コマンド / スクリプト',
  defaultOpen = false,
  linuxCommand,
  powerShellScript,
  powerShellCli,
  note,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'linux' | 'ps-net' | 'ps-cli'>('linux');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const handleCopy = (content: string, tabId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 1800);
  };

  const getActiveContent = () => {
    if (activeTab === 'linux') return linuxCommand;
    if (activeTab === 'ps-net') return powerShellScript;
    if (activeTab === 'ps-cli') return powerShellCli || powerShellScript;
    return '';
  };

  return (
    <div className="border border-indigo-900/40 bg-slate-900/60 rounded-xl overflow-hidden text-xs">
      {/* Header Accordion Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <span>{title}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                100% 互換
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Linux (OpenSSL CLI) および Windows PowerShell (.NET) で同じ暗号文・ファイルを相互に暗号化/復号可能
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-[11px] font-mono">{isOpen ? '閉じる' : 'コマンドを表示'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Accordion Body */}
      {isOpen && (
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 space-y-3">
          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('linux')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'linux'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Linux / macOS (OpenSSL CLI)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ps-net')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ps-net'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Windows PowerShell (.NET ネイティブ)</span>
              </button>

              {powerShellCli && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ps-cli')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === 'ps-cli'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>PowerShell (OpenSSL CLI)</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleCopy(getActiveContent(), activeTab)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 text-[11px] font-semibold border border-slate-700 transition-colors"
            >
              {copiedTab === activeTab ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">コピーしました</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>コマンドをコピー</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer */}
          <div className="relative">
            <pre className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto select-all">
              {getActiveContent()}
            </pre>
          </div>

          {/* Note */}
          {note && (
            <div className="flex items-start gap-2 p-2.5 bg-slate-900/50 border border-slate-800/70 rounded-lg text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
