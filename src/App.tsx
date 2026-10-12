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
import { TorrentIPChecker } from './components/TorrentIPChecker';
import { FileMetadataTool } from './components/FileMetadataTool';
import { GzipCompressionTool } from './components/GzipCompressionTool';
import { SteganographyTool } from './components/SteganographyTool';
import { ShamirSecretSharingTool } from './components/ShamirSecretSharingTool';
import { TwoFactorAuthTool } from './components/TwoFactorAuthTool';
import { BinaryConverterStudio } from './components/BinaryConverterStudio';
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
  Share2,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  Tag,
  FileArchive,
  Eye,
  Split,
  KeyRound,
} from 'lucide-react';

type Tab =
  | 'vault'
  | 'two-factor'
  | 'binary-studio'
  | 'signatures'
  | 'hashes'
  | 'encryption'
  | 'shamir'
  | 'steganography'
  | 'metadata'
  | 'gzip'
  | 'generator'
  | 'random'
  | 'p2p'
  | 'torrent'
  | 'ip-checker';

interface ToolItem {
  id: Tab;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'vault' | 'crypto' | 'p2p';
  badge?: string | number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('vault');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [vault, setVault] = useState<KeyVaultFile>(() => loadVaultFromLocalStorage());

  // Routing key actions from KeyVaultManager to relevant tools
  const [selectedKeyForAction, setSelectedKeyForAction] = useState<{
    action: 'sign' | 'verify' | 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null>(null);

  // Close mobile drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scroll when mobile menu is open
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

  const handleToggleMenu = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarOpen((prev) => !prev);
    } else {
      setIsMobileMenuOpen((prev) => !prev);
    }
  };

  const tools: ToolItem[] = [
    {
      id: 'vault',
      title: '鍵管理ファイル',
      shortTitle: '鍵管理',
      description: '登録された暗号鍵の一元管理・インポート・エクスポート',
      icon: FolderKey,
      category: 'vault',
      badge: vault.keys.length > 0 ? `${vault.keys.length}` : undefined,
    },
    {
      id: 'generator',
      title: '鍵ペア生成',
      shortTitle: '鍵生成',
      description: 'RSA 2048/4096bit および ECC 楕円曲線鍵ペアの新規生成',
      icon: PlusCircle,
      category: 'vault',
    },
    {
      id: 'random',
      title: '乱数・UUID生成',
      shortTitle: '乱数/UUID',
      description: 'CSPRNG 暗号論的疑似乱数・UUIDv7 (時系列) / v4・ランダムバイト列生成',
      icon: Dices,
      category: 'vault',
    },
    {
      id: 'two-factor',
      title: 'ローカル 2要素認証 (2FA)',
      shortTitle: '2要素認証',
      description: 'TOTP / HOTP ワンタイムパスワード生成・QRコード連携・検証',
      icon: KeyRound,
      category: 'crypto',
      badge: 'TOTP/HOTP',
    },
    {
      id: 'binary-studio',
      title: 'バイナリ変換スタジオ',
      shortTitle: 'バイナリ変換',
      description: 'Hex / Base64 / Base32 / Base58 / 2進 / 10進 / Hexダンプ / エンディアン解析',
      icon: Binary,
      category: 'crypto',
      badge: '開発者向け',
    },
    {
      id: 'signatures',
      title: '電子署名・検証',
      shortTitle: '電子署名',
      description: 'RSA-PSS / PKCS#1 / ECDSA による署名生成と改ざん検証',
      icon: FileSignature,
      category: 'crypto',
    },
    {
      id: 'encryption',
      title: '暗号化・復号',
      shortTitle: '暗号化/復号',
      description: 'AES-GCM / RSA-OAEP / ハイブリッド暗号 / ECDH 鍵共有',
      icon: Lock,
      category: 'crypto',
    },
    {
      id: 'hashes',
      title: 'ハッシュ確認',
      shortTitle: 'ハッシュ',
      description: 'SHA-256 / SHA-512 / SHA-384 / SHA-1 / MD5 ハッシュ値検証',
      icon: Hash,
      category: 'crypto',
    },
    {
      id: 'shamir',
      title: 'シャミアの秘密分散法',
      shortTitle: '秘密分散法',
      description: '(k, n) 閾値法による秘密分割 & 復元 (完全秘匿・情報理論的安全)',
      icon: Split,
      category: 'crypto',
    },
    {
      id: 'steganography',
      title: '画像ステガノグラフィ',
      shortTitle: 'ステガノ',
      description: '画像ピクセル(LSB)へのデータ不可視埋め込み・AES暗号化抽出',
      icon: Eye,
      category: 'crypto',
    },
    {
      id: 'metadata',
      title: 'メタ情報編集・削除',
      shortTitle: 'メタ情報編集',
      description: '画像(Exif/GPS)・音声(ID3 & カバー)・動画・PDFの編集と完全削除',
      icon: Tag,
      category: 'crypto',
    },
    {
      id: 'gzip',
      title: 'Gzip 圧縮・解凍',
      shortTitle: 'Gzip圧縮',
      description: '標準Web API (CompressionStream) による完全ローカル高速圧縮',
      icon: FileArchive,
      category: 'crypto',
      badge: '標準API',
    },
    {
      id: 'p2p',
      title: 'P2P通信 (方式A)',
      shortTitle: 'P2P通信',
      description: 'WebRTC 完全サーバーレス直接通信 (チャット・ファイル・鍵交換)',
      icon: Radio,
      category: 'p2p',
      badge: '方式A',
    },
    {
      id: 'torrent',
      title: 'WebTorrent 分散共有',
      shortTitle: 'WebTorrent',
      description: 'ブラウザ間でのP2P分散ファイル共有 & シード配信',
      icon: Share2,
      category: 'p2p',
    },
    {
      id: 'ip-checker',
      title: 'VPN・Torrent IP診断',
      shortTitle: 'IP診断',
      description: 'WebRTC / STUN / Tracker IPリーク検証 & 匿名性テスト',
      icon: ShieldCheck,
      category: 'p2p',
    },
  ];

  const currentTool = tools.find((t) => t.id === activeTab) || tools[0];

  const handleSelectTab = (tab: Tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Helper renderer for menu category items
  const renderNavGroup = (category: 'vault' | 'crypto' | 'p2p', label: string) => {
    const groupTools = tools.filter((t) => t.category === category);
    return (
      <div className="space-y-1">
        <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        {groupTools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTab === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleSelectTab(tool.id)}
              className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-indigo-600/15 border border-indigo-500/50 text-indigo-200 shadow-sm'
                  : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      isActive ? 'text-indigo-200' : 'text-slate-200'
                    }`}
                  >
                    {tool.title}
                  </span>
                  {tool.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  {tool.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header Bar - Clean & Hamburger Menu Only */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: Hamburger Button & App Brand */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Hamburger Button (Toggles Left Sidebar on PC, Opens Drawer on Mobile) */}
              <button
                type="button"
                onClick={handleToggleMenu}
                className="p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="メニューの表示切り替え"
                title={isDesktopSidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div
                onClick={() => handleSelectTab('vault')}
                className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Binary className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm tracking-tight text-slate-100 whitespace-nowrap">
                    Local Crypto Vault
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:block -mt-0.5">
                    完全ローカル暗号スタジオ
                  </span>
                </div>
              </div>

              {/* Active Tool Badge Pill in Header */}
              <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
                <span className="text-slate-600 hidden xs:inline">/</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-none">
                  <currentTool.icon className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                  <span className="truncate">{currentTool.title}</span>
                </span>
              </div>
            </div>

            {/* Right: Security Indicator & Quick Vault Key Count */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* PWA Install Button */}
              <PWAInstallButton variant="header" />

              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>完全ローカル (オフライン安全)</span>
              </div>

              <button
                onClick={() => handleSelectTab('vault')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/70 transition-colors"
                title="鍵管理ファイルを開く"
              >
                <FolderKey className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono font-medium">{vault.keys.length}</span>
                <span className="text-slate-400 text-[11px]">鍵</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout: Left Vertical Tab Bar + Content Area */}
      <div className="flex-1 flex w-full">
        {/* Desktop Left Vertical Tab Bar (Visible on lg+ screens when toggled open) */}
        {isDesktopSidebarOpen && (
          <aside
            className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-slate-800 bg-slate-900/60 shrink-0 sticky top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-y-auto"
            aria-label="垂直タブバーメニュー"
          >
            {/* Vault Summary Card in Sidebar */}
            <div className="p-3 border-b border-slate-800/80">
              <div
                onClick={() => handleSelectTab('vault')}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-indigo-950 text-indigo-300 flex items-center justify-center border border-indigo-800/60 shrink-0">
                    <FolderKey className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {vault.vaultName || '鍵管理ファイル'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {vault.keys.length} 件保存中
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>

            {/* Vertical Menu Groups */}
            <div className="flex-1 p-3 space-y-4">
              {renderNavGroup('vault', '鍵管理 & 生成')}
              {renderNavGroup('crypto', '暗号化 & デジタル署名')}
              {renderNavGroup('p2p', 'P2P 分散通信 & 診断')}

              <div className="pt-2 border-t border-slate-800/80">
                <PWAInstallButton variant="sidebar" />
              </div>
            </div>

            {/* Sidebar Bottom Status */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                WebCrypto Native
              </span>
              <button
                onClick={() => setIsDesktopSidebarOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                title="垂直タブメニューを隠す"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>
        )}

        {/* Center / Main Content Area */}
        <main className="flex-1 min-w-0 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Quick reopen button on desktop when sidebar is hidden */}
          {!isDesktopSidebarOpen && (
            <div className="hidden lg:flex items-center mb-4">
              <button
                onClick={() => setIsDesktopSidebarOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors shadow-sm"
              >
                <Menu className="w-4 h-4 text-indigo-400" />
                <span>左側メニューを表示</span>
              </button>
            </div>
          )}

          {activeTab === 'vault' && (
            <KeyVaultManager
              vault={vault}
              onVaultChange={handleVaultChange}
              onSelectKeyForAction={handleSelectKeyForAction}
            />
          )}

          {activeTab === 'two-factor' && <TwoFactorAuthTool />}

          {activeTab === 'binary-studio' && <BinaryConverterStudio />}

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

          {activeTab === 'shamir' && (
            <ShamirSecretSharingTool
              vault={vault}
              onImportToVault={(keyItem) => {
                const updatedVault: KeyVaultFile = {
                  ...vault,
                  keys: [keyItem, ...vault.keys],
                  exportedAt: new Date().toISOString(),
                };
                handleVaultChange(updatedVault);
              }}
            />
          )}

          {activeTab === 'steganography' && <SteganographyTool />}

          {activeTab === 'metadata' && <FileMetadataTool />}

          {activeTab === 'gzip' && <GzipCompressionTool />}

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

          {activeTab === 'ip-checker' && <TorrentIPChecker />}
        </main>
      </div>

      {/* Mobile Navigation Drawer (For screens < lg) */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 w-[85vw] max-w-sm bg-slate-900 border-r border-slate-800 z-50 lg:hidden flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-label="ツール選択メニュー"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Binary className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-100">Local Crypto Vault</h2>
              <p className="text-[11px] text-slate-400">暗号 &amp; P2P スタジオ</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="メニューを閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vault Summary Card in Drawer */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/20">
          <div
            onClick={() => handleSelectTab('vault')}
            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-indigo-950 text-indigo-300 flex items-center justify-center border border-indigo-800/60">
                <FolderKey className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  {vault.vaultName || '鍵管理ファイル'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {vault.keys.length} 件の鍵を保存中
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </div>

        {/* Drawer Navigation Categories */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {renderNavGroup('vault', '鍵管理 & 生成')}
          {renderNavGroup('crypto', '暗号化 & デジタル署名')}
          {renderNavGroup('p2p', 'P2P 分散通信 & 診断')}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-3">
          <PWAInstallButton variant="drawer" />

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              100% Client-Side WebCrypto
            </div>
            <p className="text-[10px] text-slate-500">
              秘密鍵・平文データは外部サーバーに一切送信されません。
            </p>
          </div>
        </div>
      </aside>

      {/* Offline Mode Alert */}
      <OfflineIndicator />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-3 text-center text-xs text-slate-500 px-4">
        Web Crypto API (SubtleCrypto) Native Implementation &bull; 完全ローカル実行
      </footer>
    </div>
  );
}

