import React, { useState, useRef } from 'react';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import {
  inspectImportFile,
  decryptImportFile,
  mergeVaultKeys,
  InspectedVaultFile,
} from '../utils/vaultStorage';
import {
  Upload,
  Key,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  FolderArchive,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vault: KeyVaultFile;
  onVaultMerged: (
    updatedVault: KeyVaultFile,
    stats: { added: number; duplicates: number; mode: 'merge' | 'overwrite' }
  ) => void;
}

export const VaultImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  vault,
  onVaultMerged,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspected, setInspected] = useState<InspectedVaultFile | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Decryption state (for encrypted backups)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');

  // Loaded candidate keys
  const [candidateKeys, setCandidateKeys] = useState<KeyVaultItem[]>([]);
  const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');

  const [errorMessage, setErrorMessage] = useState('');
  const [successStats, setSuccessStats] = useState<{
    added: number;
    duplicates: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setSelectedFile(null);
    setInspected(null);
    setPassword('');
    setDecryptError('');
    setCandidateKeys([]);
    setSelectedKeyIds([]);
    setErrorMessage('');
    setSuccessStats(null);
  };

  const handleFileChange = async (file: File) => {
    handleReset();
    setSelectedFile(file);
    setIsInspecting(true);

    try {
      const res = await inspectImportFile(file);
      setInspected(res);

      if (res.error) {
        setErrorMessage(res.error);
      } else if (!res.isEncrypted && res.candidateKeys) {
        setCandidateKeys(res.candidateKeys);
        setSelectedKeyIds(res.candidateKeys.map((k) => k.id));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'ファイル解析エラー');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleDecrypt = async () => {
    if (!selectedFile) return;
    setDecryptError('');
    if (!password) {
      setDecryptError('復号パスワードを入力してください');
      return;
    }

    setIsDecrypting(true);
    try {
      const decryptedVault = await decryptImportFile(selectedFile, password);
      setCandidateKeys(decryptedVault.keys);
      setSelectedKeyIds(decryptedVault.keys.map((k) => k.id));
    } catch (err: any) {
      setDecryptError(err.message || '復号に失敗しました');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleToggleSelectKey = (id: string) => {
    setSelectedKeyIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeyIds(candidateKeys.map((k) => k.id));
    } else {
      setSelectedKeyIds([]);
    }
  };

  const isKeyDuplicate = (item: KeyVaultItem): boolean => {
    return vault.keys.some(
      (existing) =>
        existing.id === item.id ||
        (existing.privateKeyPem && existing.privateKeyPem === item.privateKeyPem) ||
        (existing.publicKeyPem && existing.publicKeyPem === item.publicKeyPem) ||
        (existing.rawKeyBase64 && existing.rawKeyBase64 === item.rawKeyBase64)
    );
  };

  const handleExecuteImport = () => {
    setErrorMessage('');
    if (selectedKeyIds.length === 0) {
      setErrorMessage('取り込む鍵を1つ以上選択してください');
      return;
    }

    const keysToImport = candidateKeys.filter((k) => selectedKeyIds.includes(k.id));
    const result = mergeVaultKeys(vault, keysToImport, importMode);

    setSuccessStats({
      added: result.addedCount,
      duplicates: result.duplicateCount,
    });

    onVaultMerged(result.updatedVault, {
      added: result.addedCount,
      duplicates: result.duplicateCount,
      mode: importMode,
    });

    setTimeout(() => {
      onClose();
      handleReset();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 text-sky-400 border border-sky-800/60 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                鍵保管庫のインポート・復元
              </h3>
              <p className="text-xs text-slate-400">
                バックアップファイル (.encvault, .json, .zip, .pem) から鍵を取り込みます
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

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successStats && (
          <div className="p-3 text-xs bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              インポートが完了しました！ ({successStats.added} 件追加
              {successStats.duplicates > 0 ? `、${successStats.duplicates} 件重複スキップ` : ''})
            </span>
          </div>
        )}

        {/* Step 1: File Drop Zone */}
        {!selectedFile && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950 rounded-xl p-8 text-center cursor-pointer transition-all space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".encvault,.json,.zip,.pem,.key,.asc,.txt"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">
                インポートするファイルを選択
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                クリックまたはドラッグ＆ドロップ
              </div>
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed max-w-md mx-auto">
              暗号化バックアップ（<code className="text-indigo-300">.encvault</code>）、平文保管庫（<code className="text-indigo-300">.json</code>）、一括アーカイブ（<code className="text-indigo-300">.zip</code>）、単体鍵（<code className="text-indigo-300">.pem / .key / .asc</code>）に対応
            </div>
          </div>
        )}

        {/* Step 2: Selected File Info & Inspection */}
        {selectedFile && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2.5 truncate">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-200 truncate">{selectedFile.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB · 形式:{' '}
                    {inspected?.type === 'encrypted-vault'
                      ? '暗号化バックアップ'
                      : inspected?.type === 'zip-archive'
                      ? 'ZIPアーカイブ'
                      : inspected?.type === 'raw-pem'
                      ? 'PEM / キーファイル'
                      : '平文JSON'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-colors shrink-0"
              >
                別ファイルを選択
              </button>
            </div>

            {/* If Encrypted: Prompt for Password */}
            {inspected?.isEncrypted && candidateKeys.length === 0 && (
              <div className="p-4 bg-indigo-950/40 border border-indigo-900/70 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <span>暗号化バックアップの復号</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  このファイルは AES-256-GCM によりパスワード保護されています。エクスポート時に設定したマスターパスワードを入力してください。
                </p>

                {inspected.hint && (
                  <div className="p-2 bg-indigo-950/80 border border-indigo-800/80 rounded text-[11px] text-indigo-200">
                    <span className="font-semibold">ヒント: </span>
                    {inspected.hint}
                  </div>
                )}

                {decryptError && (
                  <div className="p-2.5 bg-red-950/80 border border-red-800 text-red-200 rounded text-xs">
                    {decryptError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="保管庫マスターパスワードを入力..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDecrypt();
                      }}
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

                  <button
                    type="button"
                    onClick={handleDecrypt}
                    disabled={isDecrypting || !password}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm shrink-0"
                  >
                    {isDecrypting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                    <span>復号して確認</span>
                  </button>
                </div>
              </div>
            )}

            {/* If Keys Available: Preview & Conflict Mode Selector */}
            {candidateKeys.length > 0 && (
              <div className="space-y-4">
                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 block">
                    取り込み方式の選択
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div
                      onClick={() => setImportMode('merge')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        importMode === 'merge'
                          ? 'bg-indigo-950/40 border-indigo-600 text-slate-100 ring-1 ring-indigo-500/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="text-indigo-600 focus:ring-0"
                        />
                        <span>マージ・新規追加 (推奨)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-5 leading-relaxed">
                        現在の保管庫の鍵をすべて保持し、新規鍵のみを安全に追加します。既存と重複する鍵は自動スキップされます。
                      </p>
                    </div>

                    <div
                      onClick={() => setImportMode('overwrite')}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        importMode === 'overwrite'
                          ? 'bg-red-950/30 border-red-700 text-slate-100 ring-1 ring-red-500/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-red-300">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'overwrite'}
                          onChange={() => setImportMode('overwrite')}
                          className="text-red-600 focus:ring-0"
                        />
                        <span>上書き (全置換)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-5 leading-relaxed">
                        現在登録されている鍵を破棄し、インポートファイルの内容で完全に上書きします。
                      </p>
                    </div>
                  </div>
                </div>

                {/* Candidate Keys List */}
                <div className="space-y-2 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-sky-400" />
                      取り込む鍵の選択 ({selectedKeyIds.length} / {candidateKeys.length} 件選択中)
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedKeyIds.length === candidateKeys.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span>すべて選択</span>
                    </label>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 pt-1 pr-1">
                    {candidateKeys.map((k) => {
                      const isSelected = selectedKeyIds.includes(k.id);
                      const isDup = isKeyDuplicate(k);

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
                              onChange={() => {}}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 shrink-0"
                            />
                            <span className="font-medium truncate">{k.title}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-indigo-300 shrink-0">
                              {k.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isDup && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                既存重複
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono">
                              {k.createdAt ? k.createdAt.slice(0, 10) : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Import Button */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400">
                    選択中: <span className="font-bold text-slate-200">{selectedKeyIds.length}</span> 件
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={selectedKeyIds.length === 0}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{selectedKeyIds.length} 件の鍵をインポート</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
