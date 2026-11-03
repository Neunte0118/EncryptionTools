import React, { useState } from 'react';
import {
  KeyVaultFile,
  KeyVaultItem,
  KeyType,
} from '../types/crypto';
import {
  appendKeyToVault,
  deleteKeyFromVault,
  updateKeyInVault,
} from '../utils/vaultStorage';
import {
  Upload,
  Download,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Eye,
  EyeOff,
  Key,
  Shield,
  FileText,
  Search,
  ArrowRight,
  Save,
  X,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VaultExportModal } from './VaultExportModal';
import { VaultImportModal } from './VaultImportModal';
import { FeatureLibraryBadge } from './FeatureLibraryBadge';

interface Props {
  vault: KeyVaultFile;
  onVaultChange: (updated: KeyVaultFile) => void;
  onSelectKeyForAction?: (action: 'sign' | 'verify' | 'encrypt' | 'decrypt', key: KeyVaultItem) => void;
  onNavigateToKeyGenerator?: () => void;
}

export const KeyVaultManager: React.FC<Props> = ({
  vault,
  onVaultChange,
  onSelectKeyForAction,
  onNavigateToKeyGenerator,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [revealedPrivateKeys, setRevealedPrivateKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Export & Import Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportTargetKeyId, setExportTargetKeyId] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<string | null>(null);


  // Backup state & Audit state
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('local_crypto_vault_last_backup');
    } catch {
      return null;
    }
  });
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const handleVaultMerged = (
    updatedVault: KeyVaultFile,
    stats: { added: number; duplicates: number; mode: 'merge' | 'overwrite' }
  ) => {
    onVaultChange(updatedVault);
    const dupText = stats.duplicates > 0 ? ` (${stats.duplicates} 件重複スキップ)` : '';
    setNotification(`インポート完了: ${stats.added} 件の鍵を追加しました${dupText}`);
    setTimeout(() => setNotification(null), 5000);
  };

  // Edit State
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // Manual Append Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [newType, setNewType] = useState<KeyType>('rsa-pss');
  const [newPublicKeyPem, setNewPublicKeyPem] = useState('');
  const [newPrivateKeyPem, setNewPrivateKeyPem] = useState('');
  const [modalError, setModalError] = useState('');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const togglePrivateKeyReveal = (id: string) => {
    setRevealedPrivateKeys((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };



  const handleDeleteKey = (id: string, title: string) => {
    if (window.confirm(`鍵「${title}」をファイルから削除しますか？`)) {
      const updated = deleteKeyFromVault(vault, id);
      onVaultChange(updated);
    }
  };

  const startEditing = (item: KeyVaultItem) => {
    setEditingKeyId(item.id);
    setEditTitle(item.title);
    setEditMemo(item.memo);
  };

  const saveEditing = () => {
    if (!editingKeyId) return;
    const updated = updateKeyInVault(vault, editingKeyId, {
      title: editTitle.trim() || '無題の鍵',
      memo: editMemo,
    });
    onVaultChange(updated);
    setEditingKeyId(null);
  };

  const handleManualAppend = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!newTitle.trim()) {
      setModalError('タイトルを入力してください');
      return;
    }

    if (!newPublicKeyPem.trim() && !newPrivateKeyPem.trim()) {
      setModalError('公開鍵または秘密鍵のPEMを入力してください');
      return;
    }

    const { updatedVault } = appendKeyToVault(vault, {
      title: newTitle.trim(),
      memo: newMemo.trim(),
      type: newType,
      algorithmDetails: {
        name: newType.toUpperCase(),
      },
      publicKeyPem: newPublicKeyPem.trim() || undefined,
      privateKeyPem: newPrivateKeyPem.trim() || undefined,
    });

    onVaultChange(updatedVault);
    setIsAddModalOpen(false);
    setNewTitle('');
    setNewMemo('');
    setNewPublicKeyPem('');
    setNewPrivateKeyPem('');
  };

  const filteredKeys = vault.keys.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.memo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  // Audit Metrics
  const weakRsaKeys = vault.keys.filter((k) => {
    if (k.type.startsWith('rsa') && k.algorithmDetails?.modulusLength) {
      return k.algorithmDetails.modulusLength < 2048;
    }
    return false;
  });
  const legacyPkcs1Keys = vault.keys.filter((k) => k.type === 'rsa-pkcs1');
  const unmemoedKeys = vault.keys.filter((k) => !k.memo || !k.memo.trim());
  const modernKeys = vault.keys.filter(
    (k) =>
      k.type === 'ed25519' ||
      k.type === 'x25519' ||
      k.type === 'ecdsa' ||
      k.type === 'ecdh' ||
      k.type === 'pqc-kem' ||
      k.type === 'pqc-dsa' ||
      (k.type.startsWith('rsa') && (k.algorithmDetails?.modulusLength || 0) >= 2048) ||
      k.type === 'aes-gcm'
  );
  const unbackedUpKeys = vault.keys.filter((k) => {
    if (!lastBackupTime) return true;
    return new Date(k.createdAt).getTime() > new Date(lastBackupTime).getTime();
  });

  let healthScore = 100;
  if (weakRsaKeys.length > 0) healthScore -= weakRsaKeys.length * 25;
  if (legacyPkcs1Keys.length > 0) healthScore -= legacyPkcs1Keys.length * 15;
  if (unmemoedKeys.length > 0) healthScore -= Math.min(unmemoedKeys.length * 5, 20);
  if (vault.keys.length === 0) healthScore = 100;
  healthScore = Math.max(20, healthScore);

  return (
    <div className="space-y-6">
      {/* External Library & Network Specs Badge */}
      <FeatureLibraryBadge
        library="@zip.js/zip.js (ZIP出力時) / ブラウザ標準 Web Crypto API"
        hasNetwork={false}
        networkDetails="通信なし (100% ブラウザ内ローカル処理・完全オフライン)"
      />

      {/* Top File Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">
              {vault.vaultName || '鍵管理ファイル'}
            </h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              {vault.keys.length} 鍵登録済み
            </span>
            {vault.keys.length > 0 && (
              <button
                onClick={() => setIsAuditOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs rounded-md border font-medium transition-colors ${
                  healthScore >= 90
                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50'
                    : healthScore >= 70
                    ? 'bg-amber-950/50 text-amber-300 border-amber-800 hover:bg-amber-900/50'
                    : 'bg-rose-950/50 text-rose-300 border-rose-800 hover:bg-rose-900/50'
                }`}
                title="保管庫セキュリティ診断レポートの表示切替"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>診断: {healthScore}点</span>
                {isAuditOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navigate to Key Generator */}
          {onNavigateToKeyGenerator && (
            <button
              onClick={onNavigateToKeyGenerator}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md transition-colors shadow-sm"
            >
              <Key className="w-3.5 h-3.5 shrink-0" />
              <span>「暗号鍵生成」で新しい鍵を作成</span>
            </button>
          )}

          {/* Import Modal Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
            title="保管庫ファイルのインポート・復元 (.encvault, .json, .zip, .pem)"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>インポート (読込)</span>
          </button>

          {/* Export Modal Button */}
          <button
            onClick={() => {
              setExportTargetKeyId(undefined);
              setIsExportModalOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
            title="保管庫ファイルのエクスポート・バックアップ (暗号化/JSON/ZIP)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>エクスポート (書出)</span>
          </button>

          {/* Manual Add Key */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>鍵を手動追記</span>
          </button>
        </div>
      </div>

      {/* Security & Health Audit Detailed View */}
      {isAuditOpen && vault.keys.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 animate-fade-in shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold text-slate-200">
                保管庫セキュリティ監査・ヘルスチェック
              </h3>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded font-medium ${
                healthScore >= 90
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : healthScore >= 70
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}
            >
              総合スコア: {healthScore} / 100 点 (
              {healthScore >= 90 ? '極めて健全' : healthScore >= 70 ? '改善推奨' : '要見直し'})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2.5">
              <div className="text-slate-400 text-[11px]">推奨暗号鍵 (現代標準)</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                {modernKeys.length} <span className="text-[11px] font-normal text-slate-500">鍵</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Ed25519 / RSA 2048+ / AES-GCM</div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2.5">
              <div className="text-slate-400 text-[11px]">脆弱な鍵長 (&lt; 2048bit)</div>
              <div
                className={`text-base font-bold mt-0.5 ${
                  weakRsaKeys.length > 0 ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {weakRsaKeys.length} <span className="text-[11px] font-normal text-slate-500">件</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {weakRsaKeys.length > 0 ? '⚠️ 2048bit以上へ移行推奨' : '合格 (脆弱な鍵長なし)'}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2.5">
              <div className="text-slate-400 text-[11px]">レガシー暗号 (PKCS#1 v1.5)</div>
              <div
                className={`text-base font-bold mt-0.5 ${
                  legacyPkcs1Keys.length > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {legacyPkcs1Keys.length} <span className="text-[11px] font-normal text-slate-500">件</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {legacyPkcs1Keys.length > 0 ? 'RSA-OAEP / PSSを推奨' : '合格 (レガシーなし)'}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded p-2.5">
              <div className="text-slate-400 text-[11px]">用途・メモ未記載</div>
              <div
                className={`text-base font-bold mt-0.5 ${
                  unmemoedKeys.length > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {unmemoedKeys.length} <span className="text-[11px] font-normal text-slate-500">件</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">用途不明による事故防止</div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Status Reminder Banner */}
      {vault.keys.length > 0 && unbackedUpKeys.length > 0 && (
        <div className="p-3 bg-amber-950/30 border border-amber-800/70 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5 text-amber-200">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-semibold text-amber-100">
                未バックアップの鍵が {unbackedUpKeys.length} 件あります
              </span>
              <span className="text-amber-300/80 ml-2">
                (最終エクスポート:{' '}
                {lastBackupTime ? new Date(lastBackupTime).toLocaleString('ja-JP') : '未実施'})
              </span>
              <p className="text-[11px] text-amber-300/70 mt-0.5">
                ブラウザのキャッシュ消去等による消失を防ぐため、暗号化保管庫 (.encvault) に保存しておくことを推奨します。
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setExportTargetKeyId(undefined);
              setIsExportModalOpen(true);
            }}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-md transition-colors shadow-sm shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>今すぐバックアップ</span>
          </button>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="タイトル、メモ、アルゴリズムで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">すべての暗号種別 ({vault.keys.length})</option>
          <optgroup label="非対称暗号 (公開鍵 / 署名)">
            <option value="rsa-oaep">RSA-OAEP 暗号化</option>
            <option value="rsa-pss">RSA-PSS 署名</option>
            <option value="rsa-pkcs1">RSA-PKCS#1 v1.5</option>
            <option value="ecdsa">ECDSA 楕円曲線署名</option>
            <option value="ecdh">ECDH 鍵共有</option>
            <option value="ed25519">Ed25519 高速署名</option>
            <option value="x25519">X25519 鍵交換</option>
            <option value="secp256k1">secp256k1 (Bitcoin/Ethereum)</option>
          </optgroup>
          <optgroup label="共通鍵暗号">
            <option value="aes-gcm">AES-GCM (認証付き暗号)</option>
            <option value="aes-cbc">AES-CBC (標準ブロック暗号)</option>
            <option value="aes-ctr">AES-CTR (カウンタモード)</option>
            <option value="chacha20">ChaCha20-Poly1305</option>
            <option value="hmac">HMAC 署名鍵</option>
          </optgroup>
          <optgroup label="耐量子暗号 (PQC)">
            <option value="pqc-kem">ML-KEM (Kyber) 鍵カプセル化</option>
            <option value="pqc-dsa">ML-DSA (Dilithium) 電子署名</option>
          </optgroup>
          <optgroup label="高度暗号・セキュリティ">
            <option value="pgp">OpenPGP 鍵</option>
            <option value="ring">環署名 (Ring Signature) 鍵</option>
            <option value="fhe">Paillier 準同型暗号 (FHE) 鍵</option>
            <option value="abe-master">CP-ABE 認証局マスター鍵</option>
            <option value="abe-user">CP-ABE ユーザー属性秘密鍵</option>
            <option value="passphrase">高エントロピーパスフレーズ</option>
          </optgroup>
        </select>
      </div>

      {/* Key List */}
      {filteredKeys.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg p-6 bg-slate-900/50">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">鍵が登録されていません</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredKeys.map((item) => {
            const isEditing = editingKeyId === item.id;
            const isRevealed = !!revealedPrivateKeys[item.id];

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 hover:border-slate-700 transition-colors"
              >
                {/* Header: Title, Type badge, Edit & Delete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                        placeholder="鍵タイトル"
                      />
                    ) : (
                      <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                        {item.title}
                      </h3>
                    )}

                    <span className="text-xs px-2.5 py-0.5 rounded font-mono font-medium uppercase tracking-wide bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                      {item.type}
                    </span>

                    {item.algorithmDetails.namedCurve && (
                      <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400">
                        {item.algorithmDetails.namedCurve}
                      </span>
                    )}
                    {item.algorithmDetails.modulusLength && (
                      <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400">
                        {item.algorithmDetails.modulusLength}bit
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {isEditing ? (
                      <>
                        <button
                          onClick={saveEditing}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>保存</span>
                        </button>
                        <button
                          onClick={() => setEditingKeyId(null)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>キャンセル</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setExportTargetKeyId(item.id);
                            setIsExportModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                          title="この鍵をエクスポート / 保存"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEditing(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                          title="タイトル・メモを編集"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteKey(item.id, item.title)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors"
                          title="この鍵を削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Memo Field */}
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">メモ / 用途:</div>
                  {isEditing ? (
                    <textarea
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      placeholder="用途や保管メモを記入..."
                    />
                  ) : (
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800/60 whitespace-pre-wrap">
                      {item.memo || <span className="text-slate-500 italic">メモなし</span>}
                    </p>
                  )}
                </div>

                {/* Keys preview (Public & Private) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Public Key */}
                  {item.publicKeyPem && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">公開鍵</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(item.publicKeyPem!, `${item.id}_pub`)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                          >
                            {copiedId === `${item.id}_pub` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedId === `${item.id}_pub` ? 'コピー済' : 'コピー'}</span>
                          </button>
                        </div>
                      </div>
                      <div className="relative group">
                        <pre
                          onClick={() => handleCopy(item.publicKeyPem!, `${item.id}_pub`)}
                          className={`text-[11px] font-mono p-2 rounded max-h-24 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all border cursor-pointer transition-all select-all ${
                            copiedId === `${item.id}_pub`
                              ? 'bg-indigo-950/60 text-indigo-200 border-indigo-500 ring-1 ring-indigo-500'
                              : 'bg-slate-900/90 text-slate-400 border-slate-800/60 hover:border-indigo-500/80 hover:text-slate-300'
                          }`}
                          title="クリックで公開鍵をコピー"
                        >
                          {item.publicKeyPem}
                        </pre>
                        <span className="absolute top-1 right-2 text-[10px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {copiedId === `${item.id}_pub` ? 'コピー済' : 'クリックでコピー'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Private Key */}
                  {item.privateKeyPem && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-amber-400/90 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-amber-400" />
                          秘密鍵
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => togglePrivateKeyReveal(item.id)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                          >
                            {isRevealed ? (
                              <EyeOff className="w-3 h-3 text-slate-400" />
                            ) : (
                              <Eye className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{isRevealed ? '秘密鍵を隠す' : '秘密鍵を表示'}</span>
                          </button>
                          {isRevealed && (
                            <button
                              onClick={() => handleCopy(item.privateKeyPem!, `${item.id}_priv`)}
                              className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                            >
                              {copiedId === `${item.id}_priv` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedId === `${item.id}_priv` ? 'コピー済' : 'コピー'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="relative group">
                        <pre
                          onClick={() => {
                            if (!isRevealed) {
                              togglePrivateKeyReveal(item.id);
                            } else {
                              handleCopy(item.privateKeyPem!, `${item.id}_priv`);
                            }
                          }}
                          className={`text-[11px] font-mono p-2 rounded max-h-24 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all border cursor-pointer transition-all ${
                            !isRevealed
                              ? 'bg-slate-900/60 text-slate-500 border-slate-800/60 hover:border-amber-600/60'
                              : copiedId === `${item.id}_priv`
                              ? 'bg-amber-950/60 text-amber-200 border-amber-500 ring-1 ring-amber-500 select-all'
                              : 'bg-slate-900/90 text-amber-300/80 border-slate-800/60 hover:border-amber-500/80 select-all'
                          }`}
                          title={isRevealed ? 'クリックで秘密鍵をコピー' : 'クリックして秘密鍵を表示'}
                        >
                          {isRevealed
                            ? item.privateKeyPem
                            : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••\n[保護されています。「秘密鍵を表示」ボタンを押して確認]'}
                        </pre>
                        <span className="absolute top-1 right-2 text-[10px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {isRevealed
                            ? copiedId === `${item.id}_priv`
                              ? 'コピー済'
                              : 'クリックでコピー'
                            : 'クリックで表示'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Raw Key (AES) */}
                  {item.rawKeyBase64 && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded p-3 space-y-2 col-span-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-emerald-400">共通鍵 Base64</span>
                        <button
                          onClick={() => handleCopy(item.rawKeyBase64!, `${item.id}_raw`)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                        >
                          {copiedId === `${item.id}_raw` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedId === `${item.id}_raw` ? 'コピー済' : 'コピー'}</span>
                        </button>
                      </div>
                      <code
                        onClick={() => handleCopy(item.rawKeyBase64!, `${item.id}_raw`)}
                        className={`text-xs font-mono block p-2 rounded break-all border cursor-pointer select-all transition-all ${
                          copiedId === `${item.id}_raw`
                            ? 'bg-emerald-950 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-slate-900 text-emerald-300 border-slate-800 hover:border-emerald-500/80'
                        }`}
                        title="クリックでコピー"
                      >
                        {item.rawKeyBase64}
                      </code>
                    </div>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <span className="text-[11px]">
                    作成日時: {new Date(item.createdAt).toLocaleString('ja-JP')}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {onSelectKeyForAction && (
                      <>
                        {(item.type === 'rsa-pss' || item.type === 'ecdsa' || item.type === 'rsa-pkcs1') && (
                          <>
                            {item.privateKeyPem && (
                              <button
                                onClick={() => onSelectKeyForAction('sign', item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded transition-colors"
                              >
                                <span>この鍵で署名</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            {item.publicKeyPem && (
                              <button
                                onClick={() => onSelectKeyForAction('verify', item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded transition-colors"
                              >
                                <span>この鍵で検証</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}

                        {item.type === 'rsa-oaep' && (
                          <>
                            {item.publicKeyPem && (
                              <button
                                onClick={() => onSelectKeyForAction('encrypt', item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded transition-colors"
                              >
                                <span>この鍵で暗号化</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            {item.privateKeyPem && (
                              <button
                                onClick={() => onSelectKeyForAction('decrypt', item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded transition-colors"
                              >
                                <span>この鍵で復号</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Append Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>鍵を手動で追記</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
                {modalError}
              </div>
            )}

            <form onSubmit={handleManualAppend} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  鍵のタイトル <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 社内検証用 RSA署名鍵 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  暗号アルゴリズム種別
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as KeyType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="rsa-pss">RSA-PSS (署名用)</option>
                  <option value="rsa-oaep">RSA-OAEP (暗号化用)</option>
                  <option value="rsa-pkcs1">RSASSA-PKCS1-v1_5 (署名用)</option>
                  <option value="ecdsa">ECDSA (楕円曲線署名)</option>
                  <option value="ecdh">ECDH (鍵共有)</option>
                  <option value="aes-gcm">AES-GCM (共通鍵)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  メモ / 用途 (任意)
                </label>
                <textarea
                  rows={2}
                  placeholder="鍵の用途、作成者、有効期限などの備考"
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  公開鍵 PEM (-----BEGIN PUBLIC KEY-----...)
                </label>
                <textarea
                  rows={3}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                  value={newPublicKeyPem}
                  onChange={(e) => setNewPublicKeyPem(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  秘密鍵 PEM (-----BEGIN PRIVATE KEY-----...)
                </label>
                <textarea
                  rows={3}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  value={newPrivateKeyPem}
                  onChange={(e) => setNewPrivateKeyPem(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium text-xs transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs transition-colors shadow-sm"
                >
                  管理ファイルに追記
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vault Export Modal */}
      <VaultExportModal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportTargetKeyId(undefined);
        }}
        vault={vault}
        initialSelectedKeyId={exportTargetKeyId}
        onExportSuccess={(mode) => {
          setLastBackupTime(new Date().toISOString());
          const modeName =
            mode === 'encrypted' ? '暗号化保管庫 (.encvault)' : mode === 'zip' ? 'ZIPアーカイブ' : 'JSON';
          setNotification(`${modeName}のバックアップを保存しました`);
          setTimeout(() => setNotification(null), 5000);
        }}
      />

      {/* Vault Import Modal */}
      <VaultImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        vault={vault}
        onVaultMerged={handleVaultMerged}
      />
    </div>
  );
};
