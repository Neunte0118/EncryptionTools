import React, { useState } from 'react';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import {
  exportEncryptedVault,
  exportJsonVault,
  exportVaultAsZip,
  downloadBlob,
} from '../utils/vaultStorage';
import {
  Lock,
  Download,
  ShieldCheck,
  FileText,
  FolderArchive,
  Key,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
} from 'lucide-react';
import { FeatureLibraryBadge } from './FeatureLibraryBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vault: KeyVaultFile;
  initialSelectedKeyId?: string;
  onExportSuccess?: (mode: 'encrypted' | 'json' | 'zip') => void;
}

export const VaultExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  vault,
  initialSelectedKeyId,
  onExportSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'encrypted' | 'json' | 'zip'>('encrypted');

  // Encrypted Backup state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordHint, setPasswordHint] = useState('');
  const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>(
    initialSelectedKeyId ? [initialSelectedKeyId] : vault.keys.map((k) => k.id)
  );
  const [isExportAll, setIsExportAll] = useState(!initialSelectedKeyId);

  // Plain JSON state
  const [excludePrivateKeys, setExcludePrivateKeys] = useState(false);

  // ZIP state
  const [isZipEncrypted, setIsZipEncrypted] = useState(false);
  const [zipPassword, setZipPassword] = useState('');
  const [showZipPassword, setShowZipPassword] = useState(false);

  // Status
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleToggleSelectKey = (id: string) => {
    setSelectedKeyIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setIsExportAll(checked);
    if (checked) {
      setSelectedKeyIds(vault.keys.map((k) => k.id));
    } else {
      setSelectedKeyIds([]);
    }
  };

  const handleExportEncrypted = async () => {
    setErrorMessage('');
    if (!password) {
      setErrorMessage('バックアップ暗号化用のマスターパスワードを入力してください');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('セキュリティ保護のため、パスワードは8文字以上で設定してください');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('確認用パスワードが一致しません');
      return;
    }
    if (selectedKeyIds.length === 0) {
      setErrorMessage('エクスポートする鍵を1つ以上選択してください');
      return;
    }

    setIsExporting(true);
    try {
      const keysToUse = isExportAll ? undefined : selectedKeyIds;
      const blob = await exportEncryptedVault(
        vault,
        password,
        passwordHint.trim() || undefined,
        keysToUse
      );
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `crypto_vault_backup_${dateStr}.encvault`);
      try {
        localStorage.setItem('local_crypto_vault_last_backup', new Date().toISOString());
      } catch (e) {
        // ignore localStorage error
      }
      onExportSuccess?.('encrypted');
      setSuccessMessage('暗号化バックアップ (.encvault) を保存しました');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    setErrorMessage('');
    if (selectedKeyIds.length === 0) {
      setErrorMessage('エクスポートする鍵を1つ以上選択してください');
      return;
    }

    try {
      const keysToUse = isExportAll ? undefined : selectedKeyIds;
      const blob = exportJsonVault(vault, {
        selectedKeyIds: keysToUse,
        excludePrivateKeys,
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const suffix = excludePrivateKeys ? '_public_only' : '';
      downloadBlob(blob, `crypto_vault_${dateStr}${suffix}.json`);
      try {
        localStorage.setItem('local_crypto_vault_last_backup', new Date().toISOString());
      } catch (e) {
        // ignore
      }
      onExportSuccess?.('json');
      setSuccessMessage('JSONファイルを保存しました');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'エクスポートに失敗しました');
    }
  };

  const handleExportZip = async () => {
    setErrorMessage('');
    if (selectedKeyIds.length === 0) {
      setErrorMessage('エクスポートする鍵を1つ以上選択してください');
      return;
    }

    if (isZipEncrypted && !zipPassword.trim()) {
      setErrorMessage('ZIP暗号化保護用のパスワードを入力してください');
      return;
    }

    setIsExporting(true);
    try {
      const keysToUse = isExportAll ? undefined : selectedKeyIds;
      const blob = await exportVaultAsZip(vault, {
        selectedKeyIds: keysToUse,
        zipPassword: isZipEncrypted && zipPassword.trim() ? zipPassword.trim() : undefined,
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const suffix = isZipEncrypted ? '_encrypted' : '';
      downloadBlob(blob, `crypto_vault_keys_${dateStr}${suffix}.zip`);
      try {
        localStorage.setItem('local_crypto_vault_last_backup', new Date().toISOString());
      } catch (e) {
        // ignore
      }
      onExportSuccess?.('zip');
      setSuccessMessage(isZipEncrypted ? '暗号化ZIPアーカイブを保存しました' : '標準ZIPアーカイブを保存しました');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'ZIPエクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                鍵保管庫のエクスポート・バックアップ
              </h3>
              <p className="text-xs text-slate-400">
                登録済みの暗号鍵を安全にバックアップ・出力します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('encrypted')}
            className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'encrypted'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>暗号化バックアップ</span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1 py-0.2 rounded font-mono">
              推奨
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'json'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>平文 JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('zip')}
            className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'zip'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>ZIP個別ファイル一括</span>
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 text-xs bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Key Selection Area (common for all tabs) */}
        <div className="space-y-2 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="font-semibold flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              エクスポート対象の鍵 ({selectedKeyIds.length} / {vault.keys.length} 件選択中)
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={isExportAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
              />
              <span>すべての鍵を選択</span>
            </label>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pt-1 pr-1">
            {vault.keys.map((k) => {
              const isSelected = selectedKeyIds.includes(k.id);
              return (
                <div
                  key={k.id}
                  onClick={() => handleToggleSelectKey(k.id)}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-800/70 text-slate-100'
                      : 'bg-slate-950 border-slate-800/60 text-slate-400 hover:bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent onClick
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 shrink-0"
                    />
                    <span className="font-medium truncate">{k.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-indigo-300 shrink-0">
                      {k.type}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {k.createdAt.slice(0, 10)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Encrypted Backup */}
        {activeTab === 'encrypted' && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-lg text-indigo-300 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-indigo-200 mb-0.5">
                  AES-256-GCM + PBKDF2 (100,000回) による強固な暗号化
                </span>
                設定したマスターパスワードで保管庫全体を暗号化します。USBメモリやクラウドストレージでの長期保管に安全です。
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  バックアップ用マスターパスワード <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="8文字以上の安全なパスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 pr-8 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  パスワードの確認再入力 <span className="text-red-400">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="パスワードを再入力"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                パスワードのヒント (任意)
              </label>
              <input
                type="text"
                placeholder="例: 私の最初のペットの名前と生年"
                value={passwordHint}
                onChange={(e) => setPasswordHint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                ※ ヒントはインポート時に表示されます。パスワードそのものは含めないでください。
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportEncrypted}
              disabled={isExporting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>暗号化バックアップを出力 (.encvault)</span>
            </button>
          </div>
        )}

        {/* Tab 2: Plain JSON */}
        {activeTab === 'json' && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 bg-amber-950/40 border border-amber-900/60 rounded-lg text-amber-300 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-amber-200 mb-0.5">
                  セキュリティ上の注意
                </span>
                平文 JSON には秘密鍵や共通鍵が暗号化されずにそのまま含まれます。漏洩に注意し、安全なオフライン環境でのみ保管してください。
              </div>
            </div>

            <label className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={excludePrivateKeys}
                onChange={(e) => setExcludePrivateKeys(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
              />
              <div>
                <span className="font-semibold text-slate-200 block">
                  秘密鍵を除外して公開鍵のみエクスポート (安全共有用)
                </span>
                <span className="text-slate-400 text-[11px]">
                  秘密鍵・共通鍵バイナリを取り除き、公開鍵とメタデータのみの安全なJSONを書き出します。
                </span>
              </div>
            </label>

            <button
              type="button"
              onClick={handleExportJson}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>JSONファイルを保存 (.json)</span>
            </button>
          </div>
        )}

        {/* Tab 3: ZIP Archive */}
        {/* Tab 3: ZIP Archive */}
        {activeTab === 'zip' && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-slate-300 leading-relaxed">
              登録されている鍵をそれぞれ独立した標準ファイル（RSA/ECCは <code className="text-indigo-300">.pem</code>、共通鍵は <code className="text-indigo-300">.key</code>、PGPは <code className="text-indigo-300">.asc</code>、メタデータは <code className="text-indigo-300">.json</code>）としてZIPアーカイブ内に整理して出力します。
            </div>

            {/* ZIP Mode Selection */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2.5">
              <label className="block text-slate-300 font-semibold text-xs">
                ZIP 出力形式
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    !isZipEncrypted
                      ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="vaultZipMode"
                    checked={!isZipEncrypted}
                    onChange={() => setIsZipEncrypted(false)}
                    className="text-emerald-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold block text-xs">暗号化なし (標準ZIP)</span>
                    <span className="text-[10px] text-slate-500 block">パスワード不要・即時解凍可能</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isZipEncrypted
                      ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="vaultZipMode"
                    checked={isZipEncrypted}
                    onChange={() => setIsZipEncrypted(true)}
                    className="text-emerald-600 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold block text-xs">パスワード保護 (AES-256 ZIP)</span>
                    <span className="text-[10px] text-slate-500 block">暗号化アーカイブ</span>
                  </div>
                </label>
              </div>
            </div>

            {isZipEncrypted ? (
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  ZIPアーカイブ保護パスワード (必須・AES-256)
                </label>
                <div className="relative">
                  <input
                    type={showZipPassword ? 'text' : 'password'}
                    placeholder="パスワードを入力してください"
                    value={zipPassword}
                    onChange={(e) => setZipPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 pr-8 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowZipPassword(!showZipPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showZipPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-lg text-slate-400 text-[11px]">
                暗号化なしの標準ZIP形式で保存します。WindowsやMacなどの標準機能でそのまま解凍できます。
              </div>
            )}

            <button
              type="button"
              onClick={handleExportZip}
              disabled={isExporting}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50"
            >
              <FolderArchive className="w-4 h-4" />
              <span>
                {isZipEncrypted ? '暗号化 ZIP を出力 (.zip)' : '標準 ZIP を出力 (暗号化なし .zip)'}
              </span>
            </button>
          </div>
        )}

        {/* External Library & Network Specs */}
        <div className="pt-2 border-t border-slate-800/60">
          <FeatureLibraryBadge
            library={
              activeTab === 'zip'
                ? '@zip.js/zip.js'
                : activeTab === 'encrypted'
                ? 'なし (ブラウザ標準 Web Crypto API PBKDF2+AES-GCM)'
                : 'なし (ブラウザ標準 JSON)'
            }
            hasNetwork={false}
            networkDetails="通信なし (100% ブラウザ内ローカル処理・完全オフライン)"
          />
        </div>
      </div>
    </div>
  );
};
