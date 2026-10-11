import React, { useState, useEffect } from 'react';
import { KeyVaultFile, KeyVaultItem } from './types/crypto';
import { loadVaultFromLocalStorage, saveVaultToLocalStorage } from './utils/vaultStorage';
import { KeyVaultManager } from './components/KeyVaultManager';
import { SignatureTool } from './components/SignatureTool';
import { HashTool } from './components/HashTool';
import { EncryptionTool } from './components/EncryptionTool';
import { KeyGeneratorTool } from './components/KeyGeneratorTool';
import { RandomGeneratorTool } from './components/RandomGeneratorTool';
import { P2PCommunicationTool } from './components/P2PCommunicationTool';
import { WebTorrentTool } from './components/WebTorrentTool';
import {
  FolderKey,
  FileSignature,
  Hash,
  Lock,
  PlusCircle,
  Binary,
  Dices,
  Radio,
  Share2,
} from 'lucide-react';

type Tab = 'vault' | 'signatures' | 'hashes' | 'encryption' | 'generator' | 'random' | 'p2p' | 'torrent';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('vault');
  const [vault, setVault] = useState<KeyVaultFile>(() => loadVaultFromLocalStorage());

  // Routing key actions from KeyVaultManager to relevant tools
  const [selectedKeyForAction, setSelectedKeyForAction] = useState<{
    action: 'sign' | 'verify' | 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null>(null);

  const handleVaultChange = (updated: KeyVaultFile) => {
    setVault(updated);
    saveVaultToLocalStorage(updated);
  };

  const handleSelectKeyForAction = (
    action: 'sign' | 'verify' | 'encrypt' | 'decrypt',
    key: KeyVaultItem
  ) => {
    setSelectedKeyForAction({ action, key });
    if (action === 'sign' || action === 'verify') {
      setActiveTab('signatures');
    } else if (action === 'encrypt' || action === 'decrypt') {
      setActiveTab('encryption');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Binary className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-slate-100">
                Local Crypto Vault
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 overflow-x-auto py-1 text-xs sm:text-sm">
              <button
                onClick={() => setActiveTab('vault')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'vault'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <FolderKey className="w-4 h-4" />
                <span>鍵管理ファイル</span>
                {vault.keys.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 text-slate-300">
                    {vault.keys.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('signatures')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'signatures'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <FileSignature className="w-4 h-4" />
                <span>電子署名・検証</span>
              </button>

              <button
                onClick={() => setActiveTab('hashes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'hashes'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Hash className="w-4 h-4" />
                <span>ハッシュ確認</span>
              </button>

              <button
                onClick={() => setActiveTab('encryption')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'encryption'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>暗号化・復号</span>
              </button>

              <button
                onClick={() => setActiveTab('generator')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'generator'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>鍵ペア生成</span>
              </button>

              <button
                onClick={() => setActiveTab('random')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'random'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Dices className="w-4 h-4" />
                <span>乱数・UUID生成</span>
              </button>

              <button
                onClick={() => setActiveTab('p2p')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'p2p'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>P2P通信 (方式A)</span>
              </button>

              <button
                onClick={() => setActiveTab('torrent')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'torrent'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span>WebTorrent (P2P分散共有)</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        {activeTab === 'vault' && (
          <KeyVaultManager
            vault={vault}
            onVaultChange={handleVaultChange}
            onSelectKeyForAction={handleSelectKeyForAction}
          />
        )}

        {activeTab === 'signatures' && (
          <SignatureTool
            vault={vault}
            selectedKey={
              selectedKeyForAction?.action === 'sign' ||
              selectedKeyForAction?.action === 'verify'
                ? (selectedKeyForAction as any)
                : null
            }
            onClearSelectedKey={() => setSelectedKeyForAction(null)}
          />
        )}

        {activeTab === 'hashes' && <HashTool />}

        {activeTab === 'encryption' && (
          <EncryptionTool
            vault={vault}
            selectedKey={
              selectedKeyForAction?.action === 'encrypt' ||
              selectedKeyForAction?.action === 'decrypt'
                ? (selectedKeyForAction as any)
                : null
            }
            onClearSelectedKey={() => setSelectedKeyForAction(null)}
          />
        )}

        {activeTab === 'generator' && (
          <KeyGeneratorTool
            vault={vault}
            onVaultChange={handleVaultChange}
            onNavigateToVault={() => setActiveTab('vault')}
          />
        )}

        {activeTab === 'random' && <RandomGeneratorTool />}

        {activeTab === 'p2p' && (
          <P2PCommunicationTool
            vault={vault}
            onVaultChange={handleVaultChange}
          />
        )}

        {activeTab === 'torrent' && <WebTorrentTool />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        Web Crypto API (SubtleCrypto) Native Implementation
      </footer>
    </div>
  );
}
