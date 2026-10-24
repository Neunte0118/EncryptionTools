import React, { useState, useEffect } from 'react';
import { KeyVaultFile, KeyVaultItem } from './types/crypto';
import { loadVaultFromLocalStorage, saveVaultToLocalStorage } from './utils/vaultStorage';
import { KeyVaultManager } from './components/KeyVaultManager';
import { SignatureTool } from './components/SignatureTool';
import { HashTool } from './components/HashTool';
import { AesTool } from './components/AesTool';
import { RsaTool } from './components/RsaTool';
import { EcdhTool } from './components/EcdhTool';
import { PostQuantumCryptoTool } from './components/PostQuantumCryptoTool';
import { VisualCryptographyTool } from './components/VisualCryptographyTool';
import { KeyGeneratorTool } from './components/KeyGeneratorTool';
import { RandomGeneratorTool } from './components/RandomGeneratorTool';
import { P2PCommunicationTool } from './components/P2PCommunicationTool';
import { FileMetadataTool } from './components/FileMetadataTool';
import { ShamirSecretSharingTool } from './components/ShamirSecretSharingTool';
import { TwoFactorAuthTool } from './components/TwoFactorAuthTool';
import { BinaryConverterStudio } from './components/BinaryConverterStudio';
import { SelfDecryptingPackageTool } from './components/SelfDecryptingPackageTool';
import { TimelockCryptoTool } from './components/TimelockCryptoTool';
import { FileShredderTool } from './components/FileShredderTool';
import { PgpStudioTool } from './components/PgpStudioTool';
import { UnifiedCompressionTool } from './components/UnifiedCompressionTool';
import { UnifiedSteganographyTool } from './components/UnifiedSteganographyTool';
import { ChaCha20Tool } from './components/ChaCha20Tool';
import { ActionPipelinesTool } from './components/ActionPipelinesTool';
import { RingSignatureTool } from './components/RingSignatureTool';
import { FheTool } from './components/FheTool';
import { AbeTool } from './components/AbeTool';
import { AutoDecryptorTool } from './components/AutoDecryptorTool';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  FolderKey,
  FileSignature,
  Hash,
  Lock,
  PlusCircle,
  Binary,
  Dices,
  Radio,
  ShieldCheck,
  Menu,
  X,
  Shield,
  Tag,
  FileArchive,
  Eye,
  Split,
  KeyRound,
  FileCode,
  Hourglass,
  Trash2,
  Search,
  Zap,
  Users,
  Cpu,
  Atom,
  Sparkles,
} from 'lucide-react';

export type Category = 'vault' | 'crypto' | 'share' | 'file';

export type Tab =
  | 'auto-decrypt'
  | 'vault'
  | 'two-factor'
  | 'generator'
  | 'random'
  | 'aes'
  | 'chacha'
  | 'rsa'
  | 'ecdh'
  | 'pqc'
  | 'visual-crypto'
  | 'fhe'
  | 'abe'
  | 'timelock'
  | 'pgp'
  | 'self-decrypt'
  | 'shamir'
  | 'p2p'
  | 'compression'
  | 'shredder'
  | 'metadata'
  | 'steganography'
  | 'hashes'
  | 'binary-studio'
  | 'signatures'
  | 'ring-signature'
  | 'action-pipeline';

export interface ToolItem {
  id: Tab;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  category: Category;
  badge?: string | number;
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'vault', label: '鍵管理' },
  { id: 'crypto', label: '暗号化・復号' },
  { id: 'share', label: '共有' },
  { id: 'file', label: 'ファイル・検証' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('vault');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [vault, setVault] = useState<KeyVaultFile>(() => loadVaultFromLocalStorage());
  const [searchQuery, setSearchQuery] = useState('');
  const [globalDroppedFiles, setGlobalDroppedFiles] = useState<File[]>([]);

  // Routing key actions from KeyVaultManager to relevant tools
  const [selectedKeyForAction, setSelectedKeyForAction] = useState<{
    action: 'sign' | 'verify' | 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null>(null);

  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleWindowDrop = (e: DragEvent) => {
      if (e.defaultPrevented) return;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea') {
          return;
        }
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        setGlobalDroppedFiles(files);
        setActiveTab('auto-decrypt');
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleVaultChange = (updated: KeyVaultFile) => {
    setVault(updated);
    saveVaultToLocalStorage(updated);
  };

  const handleSelectTab = (tab: Tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleSelectKeyForAction = (
    action: 'sign' | 'verify' | 'encrypt' | 'decrypt',
    key: KeyVaultItem
  ) => {
    setSelectedKeyForAction({ action, key });
    if (action === 'sign' || action === 'verify') {
      handleSelectTab('signatures');
    } else if (action === 'encrypt' || action === 'decrypt') {
      if (key.type === 'aes-gcm') {
        handleSelectTab('aes');
      } else if (key.type === 'rsa-oaep') {
        handleSelectTab('rsa');
      } else if (key.type === 'ecdh') {
        handleSelectTab('ecdh');
      } else {
        handleSelectTab('aes');
      }
    }
  };

  const tools: ToolItem[] = [
    // 鍵管理
    { id: 'vault', title: '暗号化鍵保管庫', icon: FolderKey, category: 'vault', badge: vault.keys.length > 0 ? vault.keys.length : undefined },
    { id: 'two-factor', title: '2要素認証管理', icon: KeyRound, category: 'vault' },
    { id: 'generator', title: '暗号鍵生成', icon: PlusCircle, category: 'vault' },
    { id: 'random', title: '暗号論的擬似乱数生成', icon: Dices, category: 'vault' },

    // 暗号化・復号
    { id: 'auto-decrypt', title: '暗号自動解析・一括復号', icon: Sparkles, category: 'crypto' },
    { id: 'aes', title: 'AES-256 暗号化', icon: Lock, category: 'crypto' },
    { id: 'chacha', title: 'ChaCha20-Poly1305', icon: Lock, category: 'crypto' },
    { id: 'rsa', title: 'RSA-OAEP', icon: Lock, category: 'crypto' },
    { id: 'ecdh', title: 'ECDH 鍵共有', icon: Lock, category: 'crypto' },
    { id: 'pqc', title: '耐量子暗号', icon: Atom, category: 'crypto' },
    { id: 'visual-crypto', title: '視覚復号型暗号', icon: Eye, category: 'crypto' },
    { id: 'fhe', title: '完全準同型暗号', icon: Cpu, category: 'crypto' },
    { id: 'abe', title: '属性ベース暗号', icon: Tag, category: 'crypto' },
    { id: 'timelock', title: 'タイムロック暗号', icon: Hourglass, category: 'crypto' },
    { id: 'pgp', title: 'OpenPGP', icon: Shield, category: 'crypto' },

    // 共有
    { id: 'self-decrypt', title: '自己復号パッケージ', icon: FileCode, category: 'share' },
    { id: 'shamir', title: 'シャミア秘密分散法', icon: Split, category: 'share' },
    { id: 'p2p', title: 'P2P暗号通信', icon: Radio, category: 'share' },

    // ファイル・検証
    { id: 'compression', title: 'アーカイブ圧縮・展開', icon: FileArchive, category: 'file' },
    { id: 'shredder', title: 'データ完全消去', icon: Trash2, category: 'file' },
    { id: 'metadata', title: 'メタデータ消去・編集', icon: Tag, category: 'file' },
    { id: 'steganography', title: 'ステガノグラフィ', icon: Eye, category: 'file' },
    { id: 'hashes', title: '暗号学的ハッシュ', icon: Hash, category: 'file' },
    { id: 'binary-studio', title: 'バイナリ・基数変換', icon: Binary, category: 'file' },
    { id: 'signatures', title: '電子署名', icon: FileSignature, category: 'file' },
    { id: 'ring-signature', title: 'リング署名', icon: Users, category: 'file' },
    { id: 'action-pipeline', title: '一括実行パイプライン', icon: Zap, category: 'file' },
  ];

  const currentTool = tools.find((t) => t.id === activeTab) || tools[0];

  const filteredTools = searchQuery.trim()
    ? tools.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : tools;

  const renderNavGroup = (category: Category, label: string) => {
    const groupTools = filteredTools.filter((t) => t.category === category);
    if (groupTools.length === 0) return null;

    return (
      <div key={category} className="space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
          {label}
        </div>
        <div className="space-y-0.5">
          {groupTools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTab === tool.id;

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleSelectTab(tool.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{tool.title}</span>
                </div>
                {tool.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tool.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Minimal Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                    setIsDesktopSidebarOpen((prev) => !prev);
                  } else {
                    setIsMobileMenuOpen((prev) => !prev);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="メニュー"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div
                onClick={() => handleSelectTab('vault')}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Binary className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm text-slate-100 whitespace-nowrap">
                  Local Crypto Vault
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 ml-2 text-slate-400 text-xs">
                <span>/</span>
                <span className="text-slate-200 font-medium">{currentTool.title}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <PWAInstallButton variant="header" />
              <button
                onClick={() => handleSelectTab('vault')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="鍵保管庫"
              >
                <FolderKey className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono font-medium">{vault.keys.length}</span>
                <span className="text-slate-400 text-[11px]">鍵</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar */}
        {isDesktopSidebarOpen && (
          <aside
            className="hidden lg:flex flex-col w-60 border-r border-slate-800 bg-slate-900/50 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto"
            aria-label="ツール選択"
          >
            <div className="p-2.5 border-b border-slate-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="検索..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 p-2 space-y-3">
              {CATEGORIES.map((cat) => renderNavGroup(cat.id, cat.label))}
            </div>
          </aside>
        )}

        {/* Workspace Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full min-w-0">
          <OfflineIndicator />

          {activeTab === 'vault' && (
            <KeyVaultManager
              vault={vault}
              onVaultChange={handleVaultChange}
              onSelectKeyForAction={handleSelectKeyForAction}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}

          {activeTab === 'two-factor' && <TwoFactorAuthTool />}
          {activeTab === 'generator' && (
            <KeyGeneratorTool
              vault={vault}
              onVaultChange={handleVaultChange}
              onNavigateToVault={() => handleSelectTab('vault')}
              onSelectTab={handleSelectTab}
              onSelectKeyForAction={handleSelectKeyForAction}
            />
          )}
          {activeTab === 'random' && <RandomGeneratorTool />}

          {activeTab === 'auto-decrypt' && (
            <AutoDecryptorTool
              vault={vault}
              initialFiles={globalDroppedFiles}
            />
          )}

          {activeTab === 'aes' && (
            <AesTool
              vault={vault}
              selectedKey={
                selectedKeyForAction?.action === 'encrypt' || selectedKeyForAction?.action === 'decrypt'
                  ? (selectedKeyForAction as any)
                  : null
              }
              onClearSelectedKey={() => setSelectedKeyForAction(null)}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}

          {activeTab === 'chacha' && (
            <ChaCha20Tool
              vault={vault}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}

          {activeTab === 'rsa' && (
            <RsaTool
              vault={vault}
              selectedKey={
                selectedKeyForAction?.action === 'encrypt' || selectedKeyForAction?.action === 'decrypt'
                  ? (selectedKeyForAction as any)
                  : null
              }
              onClearSelectedKey={() => setSelectedKeyForAction(null)}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}

          {activeTab === 'ecdh' && (
            <EcdhTool
              vault={vault}
              selectedKey={
                selectedKeyForAction?.action === 'encrypt' || selectedKeyForAction?.action === 'decrypt'
                  ? (selectedKeyForAction as any)
                  : null
              }
              onClearSelectedKey={() => setSelectedKeyForAction(null)}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}

          {activeTab === 'pqc' && (
            <PostQuantumCryptoTool
              vault={vault}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}
          {activeTab === 'visual-crypto' && <VisualCryptographyTool />}
          {activeTab === 'fhe' && (
            <FheTool
              vault={vault}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}
          {activeTab === 'abe' && (
            <AbeTool
              vault={vault}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}
          {activeTab === 'timelock' && <TimelockCryptoTool />}
          {activeTab === 'pgp' && (
            <PgpStudioTool
              vault={vault}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}

          {activeTab === 'self-decrypt' && <SelfDecryptingPackageTool />}
          {activeTab === 'shamir' && <ShamirSecretSharingTool />}
          {activeTab === 'p2p' && (
            <P2PCommunicationTool
              vault={vault}
              onVaultChange={handleVaultChange}
            />
          )}

          {activeTab === 'compression' && <UnifiedCompressionTool />}
          {activeTab === 'shredder' && <FileShredderTool />}
          {activeTab === 'metadata' && <FileMetadataTool />}
          {activeTab === 'steganography' && <UnifiedSteganographyTool />}

          {activeTab === 'hashes' && <HashTool />}
          {activeTab === 'binary-studio' && <BinaryConverterStudio />}
          {activeTab === 'signatures' && (
            <SignatureTool
              vault={vault}
              selectedKey={
                selectedKeyForAction?.action === 'sign' || selectedKeyForAction?.action === 'verify'
                  ? (selectedKeyForAction as any)
                  : null
              }
              onClearSelectedKey={() => setSelectedKeyForAction(null)}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}
          {activeTab === 'ring-signature' && (
            <RingSignatureTool
              vault={vault}
              onNavigateToKeyGenerator={() => handleSelectTab('generator')}
            />
          )}
          {activeTab === 'action-pipeline' && <ActionPipelinesTool vault={vault} />}
        </main>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 z-50 lg:hidden flex flex-col transition-transform ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-100">Local Crypto Vault</span>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 border-b border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="検索..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {CATEGORIES.map((cat) => renderNavGroup(cat.id, cat.label))}
        </div>
      </aside>
    </div>
  );
}
