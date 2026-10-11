import React, { useState, useRef } from 'react';
import {
  KeyVaultFile,
  KeyVaultItem,
  KeyType,
} from '../types/crypto';
import {
  appendKeyToVault,
  deleteKeyFromVault,
  updateKeyInVault,
  exportVaultToFile,
  parseVaultFile,
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
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  onVaultChange: (updated: KeyVaultFile) => void;
  onSelectKeyForAction?: (action: 'sign' | 'verify' | 'encrypt' | 'decrypt', key: KeyVaultItem) => void;
}

export const KeyVaultManager: React.FC<Props> = ({
  vault,
  onVaultChange,
  onSelectKeyForAction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [revealedPrivateKeys, setRevealedPrivateKeys] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsedVault = parseVaultFile(text);
        onVaultChange(parsedVault);
      } catch (err: any) {
        alert(err.message || 'ファイルの読み込みに失敗しました');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
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

  return (
    <div className="space-y-6">
      {/* Top File Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div>
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              {vault.vaultName || '鍵管理ファイル'}
            </h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              {vault.keys.length} 鍵登録済み
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            単一ファイル（JSON）として鍵・タイトル・メモを一元管理します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Load from File */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
            title="既存の鍵管理ファイルを読み込む"
          >
            <Upload className="w-4 h-4 text-sky-400 shrink-0" />
            <span>ファイル読込</span>
          </button>

          {/* Download/Export File */}
          <button
            onClick={() => exportVaultToFile(vault)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-md transition-colors shadow-sm"
            title="現在の全キーを単一ファイルとして保存・ダウンロード"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>ファイル書出 (保存)</span>
          </button>

          {/* Manual Add Key */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>鍵を手動追記</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="タイトル、メモ、アルゴリズムで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">すべての暗号種別</option>
          <option value="rsa-pss">RSA-PSS (署名)</option>
          <option value="rsa-oaep">RSA-OAEP (暗号化)</option>
          <option value="rsa-pkcs1">RSA-PKCS#1</option>
          <option value="ecdsa">ECDSA (楕円曲線署名)</option>
          <option value="ecdh">ECDH (鍵共有)</option>
          <option value="aes-gcm">AES-GCM (共通鍵)</option>
        </select>
      </div>

      {/* Key List */}
      {filteredKeys.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg p-6 bg-slate-900/50">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">鍵が登録されていません</p>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
            「鍵生成」タブから新しい鍵ペアを生成して追記するか、「ファイル読み込み」または「鍵を手動追記」から追加してください。
          </p>
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
                        <span className="font-semibold text-slate-300">公開鍵 (Public Key)</span>
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
                          秘密鍵 (Private Key)
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
                        <span className="font-semibold text-emerald-400">共通鍵 (Base64)</span>
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
    </div>
  );
};
