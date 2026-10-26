import React, { useState, useRef, useEffect } from 'react';
import {
  encryptWithPolicy,
  decryptWithUserKey,
  evaluatePolicyTree,
  MasterAuthority,
  UserSecretKey,
  AbeCipherPackage,
  AbeDecryptedResult,
} from '../utils/abeUtils';
import { KeyVaultFile } from '../types/crypto';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Users,
  Plus,
  Trash2,
  Check,
  Download,
  Upload,
  FileText,
  FileCode,
  Tag,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  vault?: KeyVaultFile;
  onNavigateToKeyGenerator?: () => void;
}

// Fallback constant demo authority
const FALLBACK_ABE_AUTHORITY: MasterAuthority = {
  publicParamsId: 'auth-default-sec',
  masterSecretKeyHex: 'a4f89d34e2c8172901fa38b4d0921e42f9b17c802e3a15dc82194e47bc9102ef',
  createdAt: Date.now(),
};

export const AbeTool: React.FC<Props> = ({ vault, onNavigateToKeyGenerator }) => {
  const [activeTab, setActiveTab] = useState<'encrypt' | 'decrypt' | 'keys' | 'authority'>('encrypt');

  const vaultMasterKeys = (vault?.keys || []).filter((k) => k.type === 'abe-master');
  const vaultUserKeys = (vault?.keys || []).filter((k) => k.type === 'abe-user');

  // Authority & Master Key
  const [authority, setAuthority] = useState<MasterAuthority>(() => {
    if (vaultMasterKeys.length > 0) {
      try {
        const item = vaultMasterKeys[0];
        if (item.extraData?.authority) return item.extraData.authority;
        if (item.privateKeyPem) return JSON.parse(item.privateKeyPem);
      } catch (e) {
        // fallback
      }
    }
    return FALLBACK_ABE_AUTHORITY;
  });

  // User Keys List
  const [userKeys, setUserKeys] = useState<UserSecretKey[]>(() => {
    const list: UserSecretKey[] = [];
    for (const item of vaultUserKeys) {
      try {
        if (item.extraData?.userKey) {
          list.push(item.extraData.userKey);
        } else if (item.privateKeyPem) {
          list.push(JSON.parse(item.privateKeyPem));
        }
      } catch (e) {
        // skip
      }
    }
    return list;
  });

  useEffect(() => {
    // Sync vault user keys
    const list: UserSecretKey[] = [];
    for (const item of vaultUserKeys) {
      try {
        if (item.extraData?.userKey) {
          list.push(item.extraData.userKey);
        } else if (item.privateKeyPem) {
          list.push(JSON.parse(item.privateKeyPem));
        }
      } catch (e) {
        // skip
      }
    }
    if (list.length > 0) {
      setUserKeys((prev) => {
        const existingIds = new Set(prev.map((k) => `${k.userId}-${k.userBlindingHex}`));
        const filtered = list.filter((k) => !existingIds.has(`${k.userId}-${k.userBlindingHex}`));
        return [...filtered, ...prev];
      });
    }
  }, [vault]);

  // Encryption State
  const [inputDataType, setInputDataType] = useState<'text' | 'file'>('text');
  const [policyExpr, setPolicyExpr] = useState('');
  const [secretMessage, setSecretMessage] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string; bytes: Uint8Array } | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [generatedCipherPackage, setGeneratedCipherPackage] = useState<AbeCipherPackage | null>(null);
  const [encryptError, setEncryptError] = useState('');

  // Decryption State
  const [cipherPackageToDecrypt, setCipherPackageToDecrypt] = useState<AbeCipherPackage | null>(null);
  const [activeUserKeyForDecrypt, setActiveUserKeyForDecrypt] = useState<UserSecretKey | null>(null);
  const [decryptedResult, setDecryptedResult] = useState<AbeDecryptedResult | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Authority Status Message
  const [authorityStatus, setAuthorityStatus] = useState('');

  // File Inputs
  const encryptFileInputRef = useRef<HTMLInputElement>(null);
  const decryptCipherFileInputRef = useRef<HTMLInputElement>(null);
  const userKeyFileInputRef = useRef<HTMLInputElement>(null);
  const masterKeyFileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // Encryption Handlers
  // -------------------------------------------------------------
  const handleSelectFileToEncrypt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buf = event.target?.result as ArrayBuffer;
      setUploadedFile({
        name: file.name,
        type: file.type || 'application/octet-stream',
        bytes: new Uint8Array(buf),
      });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleRunEncryption = async () => {
    setEncryptError('');
    setGeneratedCipherPackage(null);

    if (!policyExpr.trim()) {
      setEncryptError('アクセスポリシー論理式を指定してください');
      return;
    }

    if (inputDataType === 'text' && !secretMessage.trim()) {
      setEncryptError('暗号化するテキストを入力してください');
      return;
    }

    if (inputDataType === 'file' && !uploadedFile) {
      setEncryptError('暗号化するファイルを選択してください');
      return;
    }

    setIsEncrypting(true);
    try {
      let pkg: AbeCipherPackage;
      if (inputDataType === 'text') {
        pkg = await encryptWithPolicy(secretMessage.trim(), policyExpr.trim(), authority);
      } else {
        pkg = await encryptWithPolicy(uploadedFile!.bytes, policyExpr.trim(), authority, {
          fileName: uploadedFile!.name,
          fileType: uploadedFile!.type,
          isBinary: true,
        });
      }
      setGeneratedCipherPackage(pkg);
    } catch (err: any) {
      setEncryptError(err.message || '暗号化に失敗しました');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDownloadCipherPackage = () => {
    if (!generatedCipherPackage) return;
    const blob = new Blob([JSON.stringify(generatedCipherPackage, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const namePrefix = generatedCipherPackage.fileName || 'policy-encrypted';
    a.download = `${namePrefix}.abe.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // Decryption Handlers
  // -------------------------------------------------------------
  const handleLoadCipherFileForDecrypt = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDecryptError(null);
    setDecryptedResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.algorithm !== 'CP-ABE-AES256GCM' || !json.leafCipherShares) {
          throw new Error('未対応の暗号化ファイルです');
        }
        setCipherPackageToDecrypt(json);
      } catch (err: any) {
        setDecryptError(err.message || '暗号化ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportUserKeyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDecryptError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.format !== 'ABE_USER_KEY' || !json.userId || !json.attributeTokens) {
          throw new Error('無効なユーザー属性秘密鍵ファイルです');
        }
        // Add to list if not already present
        setUserKeys((prev) => {
          const exists = prev.some((k) => k.userId === json.userId && k.createdAt === json.createdAt);
          if (exists) return prev;
          return [json, ...prev];
        });
        setActiveUserKeyForDecrypt(json);
      } catch (err: any) {
        setDecryptError(err.message || '秘密鍵ファイルの解析に失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteDecryption = async () => {
    if (!cipherPackageToDecrypt || !activeUserKeyForDecrypt) return;
    setDecryptError(null);
    setDecryptedResult(null);
    setIsDecrypting(true);

    try {
      const res = await decryptWithUserKey(cipherPackageToDecrypt, activeUserKeyForDecrypt);
      setDecryptedResult(res);
    } catch (err: any) {
      setDecryptError(err.message || '復号に失敗しました');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDownloadDecryptedFile = () => {
    if (!decryptedResult) return;
    if (decryptedResult.isBinary && decryptedResult.binaryData) {
      const blob = new Blob([decryptedResult.binaryData as any], {
        type: decryptedResult.fileType || 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decryptedResult.fileName || 'decrypted-file.bin';
      a.click();
      URL.revokeObjectURL(url);
    } else if (decryptedResult.text) {
      const blob = new Blob([decryptedResult.text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decryptedResult.fileName || 'decrypted-text.txt';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // -------------------------------------------------------------
  // Key Management Handlers
  // -------------------------------------------------------------
  const handleDownloadUserKeyFile = (key: UserSecretKey) => {
    const blob = new Blob([JSON.stringify(key, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key.userId}-attribute-key.abekey.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteUserKey = (idx: number) => {
    setUserKeys((prev) => prev.filter((_, i) => i !== idx));
  };

  // -------------------------------------------------------------
  // Authority Handlers
  // -------------------------------------------------------------

  const handleExportMasterAuthority = () => {
    const blob = new Blob([JSON.stringify(authority, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abe-authority-${authority.publicParamsId}.abemaster.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMasterAuthority = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthorityStatus('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.masterSecretKeyHex || !json.publicParamsId) {
          throw new Error('無効なマスター認証局ファイルです');
        }
        setAuthority(json);
        setAuthorityStatus('認証局マスター鍵を正常にインポートしました');
      } catch (err: any) {
        setAuthorityStatus(err.message || 'マスター鍵の読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-xs">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">属性ベース暗号スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono font-medium">
                CP-ABE 暗号化ファイル対応
              </span>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('encrypt')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'encrypt'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ポリシー暗号化</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('decrypt')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'decrypt'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>暗号化ファイル復号</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'keys'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>属性秘密鍵管理</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('authority')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'authority'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>認証局管理</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Encryption */}
      {activeTab === 'encrypt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>アクセスポリシーと保護対象データ</span>
            </h3>

            {/* Policy Expression */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-slate-300 font-semibold">アクセスポリシー論理式</label>
                <span className="text-[10px] text-slate-500 font-mono">AND または OR で条件指定</span>
              </div>
              <input
                type="text"
                value={policyExpr}
                onChange={(e) => setPolicyExpr(e.target.value)}
                placeholder="例: role:doctor AND dept:surgery"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Target Data Selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputDataType('text')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    inputDataType === 'text'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  テキスト入力
                </button>
                <button
                  type="button"
                  onClick={() => setInputDataType('file')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    inputDataType === 'file'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  ファイル暗号化
                </button>
              </div>

              {inputDataType === 'text' ? (
                <div className="space-y-1">
                  <textarea
                    value={secretMessage}
                    onChange={(e) => setSecretMessage(e.target.value)}
                    rows={4}
                    placeholder="暗号化する機密テキストを入力..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-sans focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              ) : (
                <div className="p-4 bg-slate-950 border border-dashed border-slate-800 rounded-xl space-y-2 text-center">
                  <input
                    ref={encryptFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleSelectFileToEncrypt}
                  />
                  <button
                    type="button"
                    onClick={() => encryptFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold inline-flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>保護するファイルを選択</span>
                  </button>
                  {uploadedFile ? (
                    <div className="text-xs text-slate-300 font-mono mt-1">
                      選択中: {uploadedFile.name} ({uploadedFile.bytes.length.toLocaleString()} bytes)
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      ドキュメント・画像・圧縮ファイルなど形式を問わず暗号化可能
                    </div>
                  )}
                </div>
              )}
            </div>

            {encryptError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                {encryptError}
              </div>
            )}

            <button
              type="button"
              onClick={handleRunEncryption}
              disabled={isEncrypting}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-sm text-xs"
            >
              <Lock className="w-4 h-4" />
              <span>ポリシーで暗号化を実行</span>
            </button>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                <span>暗号化ファイルの出力</span>
              </h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                指定された論理式ポリシーを満たす秘密鍵を持つユーザーだけが復号可能な暗号化ファイルを出力します。
              </p>

              {generatedCipherPackage ? (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">暗号化ステータス:</span>
                    <span className="font-mono text-emerald-400">暗号化完了</span>
                  </div>
                  <div className="text-slate-300 text-[11px] font-mono">
                    対象ポリシー: {generatedCipherPackage.policyExpression}
                  </div>
                  {generatedCipherPackage.fileName && (
                    <div className="text-slate-300 text-[11px] font-mono">
                      元ファイル名: {generatedCipherPackage.fileName}
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-indigo-300/80 truncate">
                    暗号文ペイロード: {generatedCipherPackage.ciphertextBase64.slice(0, 36)}...
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
                  <FileCode className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-slate-400">暗号化ファイルはまだ生成されていません</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadCipherPackage}
              disabled={!generatedCipherPackage}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>暗号化ファイル保存 (.abe.json)</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Decryption */}
      {activeTab === 'decrypt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>暗号化ファイルの読み込み</span>
              </h3>
              <input
                ref={decryptCipherFileInputRef}
                type="file"
                accept=".json,.abe.json"
                className="hidden"
                onChange={handleLoadCipherFileForDecrypt}
              />
              <button
                type="button"
                onClick={() => decryptCipherFileInputRef.current?.click()}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-semibold flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                <span>暗号化ファイル選択</span>
              </button>
            </div>

            {cipherPackageToDecrypt ? (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>埋め込みポリシー:</span>
                  <span className="text-indigo-300 font-bold">{cipherPackageToDecrypt.policyExpression}</span>
                </div>
                {cipherPackageToDecrypt.fileName && (
                  <div className="flex justify-between text-slate-400">
                    <span>内包ファイル名:</span>
                    <span className="text-slate-200">{cipherPackageToDecrypt.fileName}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>暗号化アルゴリズム:</span>
                  <span className="text-slate-200">{cipherPackageToDecrypt.algorithm}</span>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
                <div className="text-slate-400">暗号化ファイルが読み込まれていません</div>
                <p className="text-[11px] text-slate-500">.abe.json ファイルを選択してください</p>
              </div>
            )}

            {/* User key selector */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold">復号に使用するユーザー属性秘密鍵</label>
                <input
                  ref={userKeyFileInputRef}
                  type="file"
                  accept=".json,.abekey.json"
                  className="hidden"
                  onChange={handleImportUserKeyFile}
                />
                <button
                  type="button"
                  onClick={() => userKeyFileInputRef.current?.click()}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium"
                >
                  秘密鍵ファイル読込
                </button>
              </div>

              {userKeys.length === 0 ? (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-1">
                  <div className="text-slate-400">登録された属性秘密鍵がありません</div>
                  <p className="text-[11px] text-slate-500">
                    「秘密鍵ファイル読込」を押すか、「暗号鍵生成」ツールで属性鍵を作成してください。
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {userKeys.map((key, idx) => {
                    const isSelected = activeUserKeyForDecrypt?.userId === key.userId;
                    let willSatisfy = false;
                    if (cipherPackageToDecrypt) {
                      willSatisfy = evaluatePolicyTree(cipherPackageToDecrypt.policyTree, key.attributes);
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveUserKeyForDecrypt(key)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-200 truncate">{key.userId}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {key.attributes.map((a, aIdx) => (
                              <span key={aIdx} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>

                        {cipherPackageToDecrypt && (
                          <div className="shrink-0 text-right">
                            {willSatisfy ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                                条件適合
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                                不適合
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExecuteDecryption}
              disabled={!cipherPackageToDecrypt || !activeUserKeyForDecrypt || isDecrypting}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-sm text-xs"
            >
              <Unlock className="w-4 h-4" />
              <span>選択した属性秘密鍵で復号を実行</span>
            </button>
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>復元結果</span>
            </h3>

            {decryptError && (
              <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl space-y-1.5 text-rose-200">
                <div className="flex items-center gap-2 font-bold text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span>復号拒否</span>
                </div>
                <p className="text-[11px] leading-relaxed">{decryptError}</p>
              </div>
            )}

            {decryptedResult ? (
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Check className="w-4 h-4" />
                    <span>復号に成功しました</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadDecryptedFile}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>復元ファイルを保存</span>
                  </button>
                </div>

                {decryptedResult.isBinary ? (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 text-xs">
                    <div className="text-slate-300 font-semibold">復元ファイル: {decryptedResult.fileName}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      サイズ: {decryptedResult.binaryData?.length.toLocaleString()} bytes
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-sans leading-relaxed whitespace-pre-wrap select-all max-h-60 overflow-y-auto">
                    {decryptedResult.text}
                  </div>
                )}
              </div>
            ) : (
              !decryptError && (
                <div className="p-12 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
                  <div className="text-slate-400 font-medium">復号結果がここに表示されます</div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Key Management */}
      {activeTab === 'keys' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>ユーザー属性秘密鍵の管理・保管</span>
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                属性秘密鍵の発行・生成はすべて「暗号鍵生成」で行います。発行された鍵はここに一覧表示され、復号に使用できます。
              </p>
            </div>
            {onNavigateToKeyGenerator && (
              <button
                type="button"
                onClick={onNavigateToKeyGenerator}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 text-xs shadow-sm self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>「暗号鍵生成」で属性鍵を発行</span>
              </button>
            )}
          </div>

          {/* Keys list */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300">利用可能な属性秘密鍵一覧</span>
              <span className="text-slate-500 font-mono">{userKeys.length} 件</span>
            </div>

            {userKeys.length === 0 ? (
              <div className="p-8 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                <div className="text-slate-400 font-medium">利用可能なユーザー属性秘密鍵がありません</div>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  「暗号鍵生成」ツールで属性秘密鍵を発行して保管庫に保存するか、外部から .abekey.json ファイルを読み込んでください。
                </p>
                {onNavigateToKeyGenerator && (
                  <button
                    type="button"
                    onClick={onNavigateToKeyGenerator}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>「暗号鍵生成」へ移動</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userKeys.map((key, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                        <span>{key.userId}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 font-mono">
                          {key.authorityId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteUserKey(idx)}
                        className="text-slate-500 hover:text-rose-400"
                        title="リストから除外"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400">付与属性セット:</div>
                      <div className="flex flex-wrap gap-1">
                        {key.attributes.map((a, aIdx) => (
                          <span
                            key={aIdx}
                            className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 font-mono"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDownloadUserKeyFile(key)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>秘密鍵ファイル保存 (.abekey.json)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Authority */}
      {activeTab === 'authority' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span>認証局マスター鍵管理</span>
              </h3>
              <p className="text-slate-400 text-[11px] mt-0.5">
                暗号化と属性秘密鍵発行のルートとなるマスター認証局を管理します。鍵の新規作成はすべて「暗号鍵生成」で行います。
              </p>
            </div>
            {onNavigateToKeyGenerator && (
              <button
                type="button"
                onClick={onNavigateToKeyGenerator}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 text-xs border border-indigo-500 shadow-sm self-start sm:self-auto"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>「暗号鍵生成」でマスター鍵を作成</span>
              </button>
            )}
          </div>

          {/* Vault Master Authorities selection */}
          {vaultMasterKeys.length > 0 && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-semibold text-xs">保管庫のマスター認証局:</span>
                <select
                  value={authority.publicParamsId}
                  onChange={(e) => {
                    const found = vaultMasterKeys.find((k) => {
                      const id = k.extraData?.authority?.publicParamsId || k.algorithmDetails?.publicParamsId;
                      return id === e.target.value;
                    });
                    if (found) {
                      try {
                        const auth = found.extraData?.authority || JSON.parse(found.privateKeyPem || '{}');
                        setAuthority(auth);
                        setAuthorityStatus(`マスター認証局「${found.title}」を読み込みました`);
                      } catch (err: any) {
                        setAuthorityStatus('マスター認証局の読み込みに失敗しました');
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-indigo-300 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {vaultMasterKeys.map((k) => {
                    const id = k.extraData?.authority?.publicParamsId || k.algorithmDetails?.publicParamsId || k.id;
                    return (
                      <option key={k.id} value={id}>
                        {k.title} (ID: {id})
                      </option>
                    );
                  })}
                </select>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                保管庫登録マスター鍵: {vaultMasterKeys.length} 件
              </span>
            </div>
          )}

          {authorityStatus && (
            <div className="p-2.5 bg-indigo-950/40 border border-indigo-800 rounded-lg text-indigo-300 font-medium">
              {authorityStatus}
            </div>
          )}

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-200">現在のマスター認証局情報</span>
              <span className="font-mono text-indigo-400">{authority.publicParamsId}</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 font-mono text-[10px] text-slate-400 break-all select-all">
              マスター秘密鍵: {authority.masterSecretKeyHex}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExportMasterAuthority}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>マスター鍵ファイル保存 (.abemaster.json)</span>
              </button>
              <input
                ref={masterKeyFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportMasterAuthority}
              />
              <button
                type="button"
                onClick={() => masterKeyFileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1 border border-slate-700"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>マスター鍵読込</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
