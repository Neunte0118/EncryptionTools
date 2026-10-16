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
import { SteganographyTool } from './components/SteganographyTool';
import { ShamirSecretSharingTool } from './components/ShamirSecretSharingTool';
import { TwoFactorAuthTool } from './components/TwoFactorAuthTool';
import { BinaryConverterStudio } from './components/BinaryConverterStudio';
import { SelfDecryptingPackageTool } from './components/SelfDecryptingPackageTool';
import { TimelockCryptoTool } from './components/TimelockCryptoTool';
import { OneTimeNoteTool } from './components/OneTimeNoteTool';
import { FileShredderTool } from './components/FileShredderTool';
import { PgpStudioTool } from './components/PgpStudioTool';
import { UnifiedCompressionTool } from './components/UnifiedCompressionTool';
import { UnifiedSteganographyTool } from './components/UnifiedSteganographyTool';
import { ChaCha20Tool } from './components/ChaCha20Tool';
import { ActionPipelinesTool } from './components/ActionPipelinesTool';
import { RingSignatureTool } from './components/RingSignatureTool';
import { FheTool } from './components/FheTool';
import { AbeTool } from './components/AbeTool';
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
  ChevronRight,
  ChevronDown,
  Shield,
  Tag,
  FileArchive,
  Eye,
  Split,
  KeyRound,
  FileCode,
  Hourglass,
  Flame,
  Trash2,
  Star,
  Clock,
  Search,
  Zap,
  Users,
  Cpu,
  Atom,
} from 'lucide-react';

export type Category = 'action' | 'vault' | 'crypto' | 'share' | 'file' | 'verify';

export type Tab =
  // アクション (一括実行)
  | 'action-pipeline'
  // 鍵管理
  | 'vault'
  | 'two-factor'
  | 'generator'
  | 'random'
  // 暗号化・復号
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
  // 共有
  | 'onetime-note'
  | 'self-decrypt'
  | 'shamir'
  | 'p2p'
  // ファイル編集
  | 'compression'
  | 'shredder'
  | 'metadata'
  | 'steganography'
  // 検証
  | 'hashes'
  | 'binary-studio'
  | 'signatures'
  | 'ring-signature';

export interface ToolItem {
  id: Tab;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: Category;
  badge?: string | number;
}

export const CATEGORIES: { id: Category; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'action', label: 'アクション', icon: Zap },
  { id: 'vault', label: '鍵管理', icon: FolderKey },
  { id: 'crypto', label: '暗号化・復号', icon: Lock },
  { id: 'share', label: '共有', icon: Radio },
  { id: 'file', label: 'ファイル編集', icon: FileArchive },
  { id: 'verify', label: '検証', icon: ShieldCheck },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('vault');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [vault, setVault] = useState<KeyVaultFile>(() => loadVaultFromLocalStorage());

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Favorites (pinned tools) saved in localStorage
  const [favorites, setFavorites] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem('lcv_pinned_favorites');
      return saved ? JSON.parse(saved) : ['vault', 'onetime-note', 'aes'];
    } catch {
      return ['vault', 'onetime-note', 'aes'];
    }
  });

  // Recent tools saved in localStorage (max 4)
  const [recents, setRecents] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem('lcv_recent_tools');
      return saved ? JSON.parse(saved) : ['vault', 'two-factor', 'onetime-note'];
    } catch {
      return ['vault', 'two-factor', 'onetime-note'];
    }
  });

  // Category collapsed state in sidebar
  const [collapsedCategories, setCollapsedCategories] = useState<Record<Category, boolean>>({
    action: false,
    vault: false,
    crypto: false,
    share: false,
    file: false,
    verify: false,
  });

  // Routing key actions from KeyVaultManager to relevant tools
  const [selectedKeyForAction, setSelectedKeyForAction] = useState<{
    action: 'sign' | 'verify' | 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null>(null);

  // Check URL fragment for note= on mount
  useEffect(() => {
    if (window.location.hash && window.location.hash.includes('note=')) {
      setActiveTab('onetime-note');
    }
  }, []);

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

  const handleToggleFavorite = (tab: Tab, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const exists = prev.includes(tab);
      const next = exists ? prev.filter((id) => id !== tab) : [...prev, tab];
      try {
        localStorage.setItem('lcv_pinned_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelectTab = (tab: Tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);

    // Update Recents
    setRecents((prev) => {
      const filtered = prev.filter((id) => id !== tab);
      const next = [tab, ...filtered].slice(0, 4);
      try {
        localStorage.setItem('lcv_recent_tools', JSON.stringify(next));
      } catch {}
      return next;
    });
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

  const toggleCategoryCollapse = (cat: Category) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const tools: ToolItem[] = [
    // 0. アクション (一括実行)
    {
      id: 'action-pipeline',
      title: '一括実行パイプライン',
      description: 'メタデータ消去・完全性ハッシュ・AES暗号化パッケージを一括実行',
      icon: Zap,
      category: 'action',
    },

    // 1. 鍵管理
    {
      id: 'vault',
      title: '暗号化鍵保管庫',
      description: '単一暗号化ファイルによる鍵ペア・共通鍵の安全な保管と管理',
      icon: FolderKey,
      category: 'vault',
      badge: vault.keys.length > 0 ? vault.keys.length : undefined,
    },
    {
      id: 'two-factor',
      title: 'TOTP (二要素認証)',
      description: 'RFC 6238 タイムスタンプ型ワンタイム認証コード生成・インポート',
      icon: KeyRound,
      category: 'vault',
    },
    {
      id: 'generator',
      title: '暗号鍵ペア生成 (RSA / EC / AES)',
      description: 'RSA / ECDSA / ECDH / AES-GCM 鍵ペア生成とエクスポート',
      icon: PlusCircle,
      category: 'vault',
    },
    {
      id: 'random',
      title: '暗号論的擬似乱数 (CSPRNG / UUIDv7)',
      description: '暗号論的疑似乱数（CSPRNG）・パスワード・UUIDv7生成',
      icon: Dices,
      category: 'vault',
    },

    // 2. 暗号化・復号
    {
      id: 'aes',
      title: 'AES-256 (GCM / CBC)',
      description: 'NIST FIPS 197 256-bit共通鍵認証付き暗号化（テキスト・ファイル）',
      icon: Lock,
      category: 'crypto',
    },
    {
      id: 'chacha',
      title: 'ChaCha20-Poly1305',
      description: 'RFC 8439 高速認証付きストリーム暗号（テキスト・ファイル）',
      icon: Lock,
      category: 'crypto',
    },
    {
      id: 'rsa',
      title: 'RSA-OAEP',
      description: 'PKCS#1 v2.2 OAEP 公開鍵暗号化およびハイブリッドファイル暗号化',
      icon: Lock,
      category: 'crypto',
    },
    {
      id: 'ecdh',
      title: 'ECDH (楕円曲線ディフィー・ヘルマン)',
      description: 'P-256 / P-384 / P-521 楕円曲線ディフィー・ヘルマン共通鍵導出',
      icon: Lock,
      category: 'crypto',
    },
    {
      id: 'pqc',
      title: '耐量子暗号 (ML-KEM / ML-DSA)',
      description: 'NIST標準格子暗号 FIPS 203 ML-KEM (Kyber) & FIPS 204 ML-DSA (Dilithium)',
      icon: Atom,
      category: 'crypto',
    },
    {
      id: 'visual-crypto',
      title: '視覚復号型暗号 (Visual Cryptography)',
      description: 'Naor-Shamir (2,2) 視覚秘密分散法。計算不要・透明シート重ね合わせ肉眼復号',
      icon: Eye,
      category: 'crypto',
    },
    {
      id: 'fhe',
      title: '完全準同型暗号 (FHE / DGHV & Paillier)',
      description: '暗号化状態での論理回路・全加算器・統計合算計算',
      icon: Cpu,
      category: 'crypto',
    },
    {
      id: 'abe',
      title: '属性ベース暗号 (CP-ABE)',
      description: 'Ciphertext-Policy ABE による役職・属性論理式ポリシーアクセス制御',
      icon: Tag,
      category: 'crypto',
    },
    {
      id: 'timelock',
      title: 'タイムロック暗号 (Timelock / drand)',
      description: 'drand Quicknet 分散ビーコンによる未来指定時刻までの時限暗号封印',
      icon: Hourglass,
      category: 'crypto',
    },
    {
      id: 'pgp',
      title: 'OpenPGP (RFC 4880)',
      description: 'RFC 4880 OpenPGP 鍵生成・ASCIIアーマー暗号化・復号・署名',
      icon: Shield,
      category: 'crypto',
    },

    // 3. 共有
    {
      id: 'onetime-note',
      title: 'ワンタイム暗号共有 (Zero-Knowledge Note)',
      description: 'URLフラグメント完全秘匿・有効期限切れ自動破棄・自爆タイマー',
      icon: Flame,
      category: 'share',
    },
    {
      id: 'self-decrypt',
      title: '自己復号パッケージ (Self-Decrypting HTML)',
      description: 'Web Crypto API内蔵・ブラウザ単体で復号可能な単一自己完結HTML',
      icon: FileCode,
      category: 'share',
    },
    {
      id: 'shamir',
      title: 'シャミア秘密分散法 (Shamir SSS)',
      description: '秘密情報を (k, n) 閾値シェアに分割・復元',
      icon: Split,
      category: 'share',
    },
    {
      id: 'p2p',
      title: 'WebRTC E2EE (P2P通信)',
      description: 'WebRTC 完全サーバーレス直接通信（チャット・ファイル・鍵交換）',
      icon: Radio,
      category: 'share',
    },

    // 4. ファイル編集
    {
      id: 'compression',
      title: 'アーカイブ圧縮・展開 (ZIP / Tar / Gzip)',
      description: 'AES-256 暗号化ZIP作成・解凍および高速Gzipストリーミング',
      icon: FileArchive,
      category: 'file',
    },
    {
      id: 'shredder',
      title: 'データ完全消去 (DoD 5220.22-M / Gutmann)',
      description: 'DoD 5220.22-M / Gutmann 準拠の不可逆ノイズ上書き破壊',
      icon: Trash2,
      category: 'file',
    },
    {
      id: 'metadata',
      title: 'メタデータ消去・編集 (Exif / ID3 / PDF)',
      description: '画像Exif・音声・動画・PDFメタデータの閲覧・編集・完全消去',
      icon: Tag,
      category: 'file',
    },
    {
      id: 'steganography',
      title: 'ステガノグラフィ (LSB画像・WAV音声)',
      description: '画像ピクセル・WAV音声波形へのデータ不可視埋め込み・抽出',
      icon: Eye,
      category: 'file',
    },

    // 5. 検証
    {
      id: 'hashes',
      title: '暗号学的ハッシュ (SHA-2 / SHA-3 / MD5)',
      description: 'SHA-256 / SHA-512 / SHA-384 / SHA-1 / MD5 ハッシュ計算と改竄照合',
      icon: Hash,
      category: 'verify',
    },
    {
      id: 'binary-studio',
      title: 'バイナリ・基数変換 (Hex / Base64 / Base58)',
      description: 'Hex / Base64 / Base58 / 2進 / 10進数相互変換とHexダンプ解析',
      icon: Binary,
      category: 'verify',
    },
    {
      id: 'signatures',
      title: '電子署名 (ECDSA / Ed25519 / RSA-PSS)',
      description: 'RSA-PSS / PKCS#1 / ECDSA による署名生成と改竄検証',
      icon: FileSignature,
      category: 'verify',
    },
    {
      id: 'ring-signature',
      title: 'リング署名 (Ed25519-SAG)',
      description: 'Ed25519-SAG 準拠の完全匿名グループ署名作成と数学的検証',
      icon: Users,
      category: 'verify',
    },
  ];

  const currentTool = tools.find((t) => t.id === activeTab) || tools[0];

  // Filter tools by search query if any
  const filteredTools = searchQuery.trim()
    ? tools.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tools;

  // Render Category in Nav
  const renderNavGroup = (category: Category, label: string) => {
    const groupTools = filteredTools.filter((t) => t.category === category);
    if (groupTools.length === 0) return null;

    const isCollapsed = collapsedCategories[category] && !searchQuery.trim();

    return (
      <div key={category} className="space-y-1">
        <button
          type="button"
          onClick={() => toggleCategoryCollapse(category)}
          className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 hover:text-slate-200 transition-colors uppercase select-none"
        >
          <span>{label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isCollapsed ? '-rotate-90 text-slate-500' : 'text-slate-400'
            }`}
          />
        </button>

        {!isCollapsed && (
          <div className="space-y-0.5">
            {groupTools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTab === tool.id;
              const isFav = favorites.includes(tool.id);

              return (
                <div
                  key={tool.id}
                  onClick={() => handleSelectTab(tool.id)}
                  className={`group relative w-full text-left flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 border border-indigo-500/50 text-indigo-200 shadow-sm'
                      : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isActive ? 'text-indigo-200' : 'text-slate-200'
                        }`}
                      >
                        {tool.title}
                      </span>
                      {tool.badge !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {tool.description}
                    </p>
                  </div>

                  {/* Pin / Favorite Star */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(tool.id, e)}
                    className={`absolute right-2 top-2.5 p-1 rounded transition-opacity ${
                      isFav
                        ? 'text-amber-400 opacity-100'
                        : 'text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100'
                    }`}
                    title={isFav ? 'ピン留めを解除' : 'お気に入りにピン留め'}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: Hamburger Button & App Brand */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                    setIsDesktopSidebarOpen((prev) => !prev);
                  } else {
                    setIsMobileMenuOpen((prev) => !prev);
                  }
                }}
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
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 flex items-center gap-1.5 truncate max-w-[160px] sm:max-w-none">
                  <currentTool.icon className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                  <span className="truncate">{currentTool.title}</span>
                </span>
              </div>
            </div>

            {/* Right: Security Indicator & Quick Vault Key Count */}
            <div className="flex items-center gap-2 sm:gap-3">
              <PWAInstallButton variant="header" />

              <button
                onClick={() => handleSelectTab('vault')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/70 transition-colors"
                title="鍵保管庫を開く"
              >
                <FolderKey className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono font-medium">{vault.keys.length}</span>
                <span className="text-slate-400 text-[11px]">鍵</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex w-full">
        {/* Desktop Left Vertical Tab Bar */}
        {isDesktopSidebarOpen && (
          <aside
            className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-slate-800 bg-slate-900/60 shrink-0 sticky top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-y-auto"
            aria-label="ツール選択サイドバー"
          >
            {/* Search Input Box */}
            <div className="p-3 border-b border-slate-800/80">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ツールをクイック検索..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Quick Favorites (Pinned) */}
            {!searchQuery.trim() && favorites.length > 0 && (
              <div className="p-3 border-b border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider px-1">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>お気に入り (ピン留め)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {favorites.map((favId) => {
                    const tool = tools.find((t) => t.id === favId);
                    if (!tool) return null;
                    const isActive = activeTab === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleSelectTab(tool.id)}
                        className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 border transition-all ${
                          isActive
                            ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <tool.icon className="w-3 h-3 text-indigo-400" />
                        <span>{tool.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Tools */}
            {!searchQuery.trim() && recents.length > 0 && (
              <div className="px-3 pt-2 pb-2 border-b border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>最近使用したツール</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recents.map((recId) => {
                    const tool = tools.find((t) => t.id === recId);
                    if (!tool) return null;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleSelectTab(tool.id)}
                        className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-950/40 border border-slate-800 hover:text-slate-200 hover:border-slate-700 transition-colors"
                      >
                        {tool.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category Groups */}
            <div className="flex-1 p-3 space-y-3">
              {CATEGORIES.map((cat) => renderNavGroup(cat.id, cat.label))}

              <div className="pt-2 border-t border-slate-800/80">
                <PWAInstallButton variant="sidebar" />
              </div>
            </div>

            {/* Sidebar Bottom Status */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                100% Client-Side Native
              </span>
              <button
                onClick={() => setIsDesktopSidebarOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                title="サイドバーを隠す"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </aside>
        )}

        {/* Content Area */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0">
          <OfflineIndicator />

          {/* 0. アクション */}
          {activeTab === 'action-pipeline' && <ActionPipelinesTool />}

          {/* 1. 鍵管理 */}
          {activeTab === 'vault' && (
            <KeyVaultManager
              vault={vault}
              onVaultChange={handleVaultChange}
              onSelectKeyForAction={handleSelectKeyForAction}
            />
          )}

          {activeTab === 'two-factor' && <TwoFactorAuthTool />}

          {activeTab === 'generator' && (
            <KeyGeneratorTool
              vault={vault}
              onVaultChange={handleVaultChange}
              onNavigateToVault={() => handleSelectTab('vault')}
            />
          )}

          {activeTab === 'random' && <RandomGeneratorTool />}

          {/* 2. 暗号化・復号 (アルゴリズム個別表示) */}
          {activeTab === 'aes' && (
            <AesTool
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

          {activeTab === 'chacha' && <ChaCha20Tool />}

          {activeTab === 'rsa' && (
            <RsaTool
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

          {activeTab === 'ecdh' && (
            <EcdhTool
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

          {activeTab === 'pqc' && <PostQuantumCryptoTool />}

          {activeTab === 'visual-crypto' && <VisualCryptographyTool />}

          {activeTab === 'fhe' && <FheTool />}

          {activeTab === 'abe' && <AbeTool />}

          {activeTab === 'timelock' && <TimelockCryptoTool />}

          {activeTab === 'pgp' && <PgpStudioTool />}

          {/* 3. 共有 */}
          {activeTab === 'onetime-note' && <OneTimeNoteTool />}

          {activeTab === 'self-decrypt' && <SelfDecryptingPackageTool />}

          {activeTab === 'shamir' && <ShamirSecretSharingTool />}

          {activeTab === 'p2p' && (
            <P2PCommunicationTool
              vault={vault}
              onVaultChange={handleVaultChange}
            />
          )}

          {/* 4. ファイル編集 */}
          {activeTab === 'compression' && <UnifiedCompressionTool />}

          {activeTab === 'shredder' && <FileShredderTool />}

          {activeTab === 'metadata' && <FileMetadataTool />}

          {activeTab === 'steganography' && <UnifiedSteganographyTool />}

          {/* 5. 検証 */}
          {activeTab === 'hashes' && <HashTool />}

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

          {activeTab === 'ring-signature' && <RingSignatureTool />}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
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
              <p className="text-[11px] text-slate-400">暗号 &amp; セキュリティスタジオ</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Search Input */}
        <div className="p-3 border-b border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ツールを検索..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Mobile Drawer Navigation Groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {CATEGORIES.map((cat) => renderNavGroup(cat.id, cat.label))}
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
              外部サーバーへデータが送信されることは一切ありません
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
