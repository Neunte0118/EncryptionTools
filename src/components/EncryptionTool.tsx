import React, { useState, useEffect } from 'react';
import {
  rsaEncrypt,
  rsaDecrypt,
  aesEncrypt,
  aesDecrypt,
  computeEcdhSharedSecret,
  stringToBuffer,
  bufferToString,
  base64ToBuffer,
  bufferToBase64,
  HashAlgorithm,
} from '../utils/cryptoUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import { FileCryptoTool } from './FileCryptoTool';
import {
  Lock,
  Unlock,
  Key,
  Copy,
  Check,
  ArrowRight,
  Share2,
  Eye,
  EyeOff,
  FileLock,
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  selectedKey?: {
    action: 'encrypt' | 'decrypt';
    key: KeyVaultItem;
  } | null;
  onClearSelectedKey?: () => void;
}

export const EncryptionTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'file' | 'rsa' | 'aes' | 'ecdh'>('file');

  // --- RSA-OAEP State ---
  const [rsaMode, setRsaMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [rsaHash, setRsaHash] = useState<HashAlgorithm>('SHA-256');
  const [rsaSelectedVaultKeyId, setRsaSelectedVaultKeyId] = useState('');
  const [rsaPublicKeyPem, setRsaPublicKeyPem] = useState('');
  const [rsaPrivateKeyPem, setRsaPrivateKeyPem] = useState('');
  const [isRsaPrivRevealed, setIsRsaPrivRevealed] = useState(false);
  const [rsaPlaintext, setRsaPlaintext] = useState('');
  const [rsaCiphertext, setRsaCiphertext] = useState('');
  const [rsaDecryptedResult, setRsaDecryptedResult] = useState('');
  const [rsaError, setRsaError] = useState('');

  // --- AES-GCM State ---
  const [aesMode, setAesMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [aesRawKeyBase64, setAesRawKeyBase64] = useState('');
  const [aesPlaintext, setAesPlaintext] = useState('');
  const [aesCiphertext, setAesCiphertext] = useState('');
  const [aesDecryptedResult, setAesDecryptedResult] = useState('');
  const [aesError, setAesError] = useState('');

  // --- ECDH State ---
  const [ecdhCurve, setEcdhCurve] = useState<'P-256' | 'P-384' | 'P-521'>('P-256');
  const [ecdhPrivKeyPem, setEcdhPrivKeyPem] = useState('');
  const [isEcdhPrivRevealed, setIsEcdhPrivRevealed] = useState(false);
  const [ecdhPeerPubKeyPem, setEcdhPeerPubKeyPem] = useState('');
  const [ecdhSharedSecretHex, setEcdhSharedSecretHex] = useState('');
  const [ecdhError, setEcdhError] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync selected key from vault manager
  useEffect(() => {
    if (selectedKey) {
      if (selectedKey.key.type === 'rsa-oaep') {
        setRsaMode(selectedKey.action);
        setRsaSelectedVaultKeyId(selectedKey.key.id);
        if (selectedKey.key.publicKeyPem) setRsaPublicKeyPem(selectedKey.key.publicKeyPem);
        if (selectedKey.key.privateKeyPem) setRsaPrivateKeyPem(selectedKey.key.privateKeyPem);
      }
    }
  }, [selectedKey]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // RSA Vault select
  const handleRsaVaultKeySelect = (id: string) => {
    setRsaSelectedVaultKeyId(id);
    if (!id) return;
    const item = vault.keys.find((k) => k.id === id);
    if (!item) return;
    if (item.publicKeyPem) setRsaPublicKeyPem(item.publicKeyPem);
    if (item.privateKeyPem) setRsaPrivateKeyPem(item.privateKeyPem);
    if (item.algorithmDetails.hash) setRsaHash(item.algorithmDetails.hash as any);
  };

  // RSA Actions
  const handleRsaEncrypt = async () => {
    setRsaError('');
    setRsaCiphertext('');
    if (!rsaPublicKeyPem.trim()) {
      setRsaError('暗号化用の公開鍵 (Public Key PEM) を指定してください');
      return;
    }
    if (!rsaPlaintext) {
      setRsaError('暗号化するテキストを入力してください');
      return;
    }
    try {
      const buffer = stringToBuffer(rsaPlaintext);
      const res = await rsaEncrypt(rsaPublicKeyPem.trim(), rsaHash, buffer);
      setRsaCiphertext(res.base64);
    } catch (e: any) {
      setRsaError(`暗号化エラー: ${e.message}`);
    }
  };

  const handleRsaDecrypt = async () => {
    setRsaError('');
    setRsaDecryptedResult('');
    if (!rsaPrivateKeyPem.trim()) {
      setRsaError('復号用の秘密鍵 (Private Key PEM) を指定してください');
      return;
    }
    if (!rsaCiphertext.trim()) {
      setRsaError('復号する暗号文 (Base64) を入力してください');
      return;
    }
    try {
      const cipherBuf = base64ToBuffer(rsaCiphertext.trim());
      const decryptedBuf = await rsaDecrypt(rsaPrivateKeyPem.trim(), rsaHash, cipherBuf);
      setRsaDecryptedResult(bufferToString(decryptedBuf));
    } catch (e: any) {
      setRsaError(`復号エラー: ${e.message} (秘密鍵またはハッシュパラメータが一致しません)`);
    }
  };

  // AES Actions
  const handleGenerateRandomAesKey = () => {
    const raw = window.crypto.getRandomValues(new Uint8Array(32));
    setAesRawKeyBase64(bufferToBase64(raw.buffer));
  };

  const handleAesEncrypt = async () => {
    setAesError('');
    setAesCiphertext('');
    if (!aesRawKeyBase64.trim()) {
      setAesError('共通鍵 (Base64) を指定するか、「ランダム鍵を生成」を押してください');
      return;
    }
    if (!aesPlaintext) {
      setAesError('暗号化するテキストを入力してください');
      return;
    }
    try {
      const keyBuf = base64ToBuffer(aesRawKeyBase64.trim());
      const plainBuf = stringToBuffer(aesPlaintext);
      const res = await aesEncrypt(keyBuf, plainBuf);
      setAesCiphertext(res.combinedBase64);
    } catch (e: any) {
      setAesError(`AES暗号化エラー: ${e.message}`);
    }
  };

  const handleAesDecrypt = async () => {
    setAesError('');
    setAesDecryptedResult('');
    if (!aesRawKeyBase64.trim()) {
      setAesError('復号用の共通鍵 (Base64) を指定してください');
      return;
    }
    if (!aesCiphertext.trim()) {
      setAesError('復号する暗号文 (Base64) を入力してください');
      return;
    }
    try {
      const keyBuf = base64ToBuffer(aesRawKeyBase64.trim());
      const cipherBuf = base64ToBuffer(aesCiphertext.trim());
      const decryptedBuf = await aesDecrypt(keyBuf, cipherBuf);
      setAesDecryptedResult(bufferToString(decryptedBuf));
    } catch (e: any) {
      setAesError(`AES復号エラー: ${e.message} (鍵が異なるかデータが破損しています)`);
    }
  };

  // ECDH Action
  const handleEcdhDerive = async () => {
    setEcdhError('');
    setEcdhSharedSecretHex('');
    if (!ecdhPrivKeyPem.trim() || !ecdhPeerPubKeyPem.trim()) {
      setEcdhError('自身の秘密鍵と相手の公開鍵の両方を指定してください');
      return;
    }
    try {
      const res = await computeEcdhSharedSecret(
        ecdhPrivKeyPem.trim(),
        ecdhPeerPubKeyPem.trim(),
        ecdhCurve
      );
      setEcdhSharedSecretHex(res.secretHex);
    } catch (e: any) {
      setEcdhError(`ECDH計算エラー: ${e.message}`);
    }
  };

  const rsaOaepKeys = vault.keys.filter((k) => k.type === 'rsa-oaep');

  return (
    <div className="space-y-6">
      {/* Encryption Type Selector */}
      <div className="flex border-b border-slate-800 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveSubTab('file')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 shrink-0 transition-colors ${
            activeSubTab === 'file'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileLock className="w-4 h-4 shrink-0" />
          <span>ファイル暗号化 (AES/ハイブリッド)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rsa')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 shrink-0 transition-colors ${
            activeSubTab === 'rsa'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4 shrink-0" />
          <span>RSA 公開鍵暗号 (テキスト)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('aes')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 shrink-0 transition-colors ${
            activeSubTab === 'aes'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4 shrink-0" />
          <span>共通鍵暗号 (テキスト)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ecdh')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 shrink-0 transition-colors ${
            activeSubTab === 'ecdh'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span>楕円曲線鍵共有 (ECDH)</span>
        </button>
      </div>

      {/* --- FILE ENCRYPTION / DECRYPTION PANEL --- */}
      {activeSubTab === 'file' && (
        <FileCryptoTool
          vault={vault}
          selectedKey={selectedKey}
          onClearSelectedKey={onClearSelectedKey}
        />
      )}

      {/* --- RSA-OAEP PANEL --- */}
      {activeSubTab === 'rsa' && (
        <div className="space-y-5">
          {/* Top Options */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">
                  RSA-OAEP モード選択
                </span>
              </div>

              <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800">
                <button
                  onClick={() => setRsaMode('encrypt')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    rsaMode === 'encrypt'
                      ? 'bg-slate-800 text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  暗号化 (公開鍵)
                </button>
                <button
                  onClick={() => setRsaMode('decrypt')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    rsaMode === 'decrypt'
                      ? 'bg-slate-800 text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  復号 (秘密鍵)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  鍵管理ファイルから選択
                </label>
                <select
                  value={rsaSelectedVaultKeyId}
                  onChange={(e) => handleRsaVaultKeySelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">(手動入力または選択)</option>
                  {rsaOaepKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  OAEP ハッシュ関数
                </label>
                <select
                  value={rsaHash}
                  onChange={(e) => setRsaHash(e.target.value as HashAlgorithm)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="SHA-256">SHA-256 (標準)</option>
                  <option value="SHA-512">SHA-512</option>
                  <option value="SHA-384">SHA-384</option>
                  <option value="SHA-1">SHA-1 (非推奨・互換用)</option>
                </select>
              </div>
            </div>

            {/* Key PEM Input */}
            <div>
              {rsaMode === 'encrypt' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    暗号化用 公開鍵 (Public Key PEM)
                  </label>
                  <textarea
                    rows={3}
                    value={rsaPublicKeyPem}
                    onChange={(e) => setRsaPublicKeyPem(e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>復号用 秘密鍵 (Private Key PEM)</span>
                      <button
                        type="button"
                        onClick={() => setIsRsaPrivRevealed(!isRsaPrivRevealed)}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                      >
                        {isRsaPrivRevealed ? (
                          <EyeOff className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Eye className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{isRsaPrivRevealed ? '秘密鍵を隠す' : '秘密鍵を表示'}</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500">PKCS#8 形式</span>
                  </label>
                  {isRsaPrivRevealed ? (
                    <textarea
                      rows={3}
                      value={rsaPrivateKeyPem}
                      onChange={(e) => setRsaPrivateKeyPem(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-amber-200 focus:outline-none focus:border-indigo-500"
                    />
                  ) : (
                    <div
                      onClick={() => setIsRsaPrivRevealed(true)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded p-3 text-xs font-mono text-amber-400/70 cursor-pointer flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <span className="truncate">
                        {rsaPrivateKeyPem
                          ? '•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••• [保護中: クリックまたはボタンで表示]'
                          : '（秘密鍵未入力: ここをクリックまたは「秘密鍵を表示」を押して入力）'}
                      </span>
                      <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded shrink-0 ml-2">
                        表示する
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Encrypt or Decrypt Content Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            {rsaMode === 'encrypt' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    暗号化する平文 (Plaintext)
                  </label>
                  <textarea
                    rows={3}
                    value={rsaPlaintext}
                    onChange={(e) => setRsaPlaintext(e.target.value)}
                    placeholder="機密メッセージを入力..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={handleRsaEncrypt}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
                >
                  <Lock className="w-4 h-4" />
                  <span>公開鍵で暗号化</span>
                </button>

                {rsaError && (
                  <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
                    {rsaError}
                  </div>
                )}

                {rsaCiphertext && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-200">
                        暗号文 (Base64)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setRsaCiphertext(rsaCiphertext);
                            setRsaMode('decrypt');
                          }}
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
                        >
                          <span>復号モードに送る</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCopy(rsaCiphertext, 'rsa-cipher')}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                        >
                          {copiedId === 'rsa-cipher' ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedId === 'rsa-cipher' ? 'コピー済' : 'コピー'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative group">
                      <pre
                        onClick={() => handleCopy(rsaCiphertext, 'rsa-cipher')}
                        className={`text-xs font-mono p-3 rounded max-h-32 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer select-all transition-all ${
                          copiedId === 'rsa-cipher'
                            ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-slate-950 text-emerald-300 border-slate-800 hover:border-emerald-500/80 hover:bg-slate-950/90'
                        }`}
                        title="クリックで暗号文をコピー"
                      >
                        {rsaCiphertext}
                      </pre>
                      <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {copiedId === 'rsa-cipher' ? 'コピー済' : 'クリックでコピー'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    復号する暗号文 (Base64)
                  </label>
                  <textarea
                    rows={3}
                    value={rsaCiphertext}
                    onChange={(e) => setRsaCiphertext(e.target.value)}
                    placeholder="Base64形式の暗号文を貼り付け..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={handleRsaDecrypt}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
                >
                  <Unlock className="w-4 h-4" />
                  <span>秘密鍵で復号</span>
                </button>

                {rsaError && (
                  <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
                    {rsaError}
                  </div>
                )}

                {rsaDecryptedResult && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-emerald-400">
                        復号されたメッセージ (Plaintext)
                      </span>
                      <button
                        onClick={() => handleCopy(rsaDecryptedResult, 'rsa-decrypted')}
                        className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                      >
                        {copiedId === 'rsa-decrypted' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === 'rsa-decrypted' ? 'コピー済' : 'コピー'}</span>
                      </button>
                    </div>
                    <div className="relative group">
                      <pre
                        onClick={() => handleCopy(rsaDecryptedResult, 'rsa-decrypted')}
                        className={`text-sm font-sans p-3 rounded max-h-48 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer select-all transition-all ${
                          copiedId === 'rsa-decrypted'
                            ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-slate-950 text-slate-100 border-slate-800 hover:border-emerald-500/80 hover:bg-slate-950/90'
                        }`}
                        title="クリックで復号メッセージをコピー"
                      >
                        {rsaDecryptedResult}
                      </pre>
                      <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {copiedId === 'rsa-decrypted' ? 'コピー済' : 'クリックでコピー'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- AES-GCM PANEL --- */}
      {activeSubTab === 'aes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="text-sm font-semibold text-slate-100">
              AES-GCM (256-bit 認証付き共通鍵暗号)
            </div>

            <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => setAesMode('encrypt')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  aesMode === 'encrypt'
                    ? 'bg-slate-800 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                暗号化
              </button>
              <button
                onClick={() => setAesMode('decrypt')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  aesMode === 'decrypt'
                    ? 'bg-slate-800 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                復号
              </button>
            </div>
          </div>

          {/* Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                共通鍵 (256-bit Base64)
              </label>
              <button
                onClick={handleGenerateRandomAesKey}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                ランダム鍵を生成
              </button>
            </div>
            <input
              type="text"
              value={aesRawKeyBase64}
              onChange={(e) => setAesRawKeyBase64(e.target.value)}
              placeholder="32バイトのBase64エンコードキーを入力..."
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Plain / Cipher Inputs */}
          {aesMode === 'encrypt' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  暗号化する平文
                </label>
                <textarea
                  rows={3}
                  value={aesPlaintext}
                  onChange={(e) => setAesPlaintext(e.target.value)}
                  placeholder="メッセージを入力..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleAesEncrypt}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
              >
                <Lock className="w-4 h-4" />
                <span>AES-GCM で暗号化</span>
              </button>

              {aesError && (
                <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
                  {aesError}
                </div>
              )}

              {aesCiphertext && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">
                      暗号文 (IV + Ciphertext Base64)
                    </span>
                    <button
                      onClick={() => handleCopy(aesCiphertext, 'aes-cipher')}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      {copiedId === 'aes-cipher' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedId === 'aes-cipher' ? 'コピー済' : 'コピー'}</span>
                    </button>
                  </div>
                  <div className="relative group">
                    <pre
                      onClick={() => handleCopy(aesCiphertext, 'aes-cipher')}
                      className={`text-xs font-mono p-3 rounded max-h-32 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer select-all transition-all ${
                        copiedId === 'aes-cipher'
                          ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-950 text-emerald-300 border-slate-800 hover:border-emerald-500/80 hover:bg-slate-950/90'
                      }`}
                      title="クリックで暗号文をコピー"
                    >
                      {aesCiphertext}
                    </pre>
                    <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {copiedId === 'aes-cipher' ? 'コピー済' : 'クリックでコピー'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  復号する暗号文 (IV + Ciphertext Base64)
                </label>
                <textarea
                  rows={3}
                  value={aesCiphertext}
                  onChange={(e) => setAesCiphertext(e.target.value)}
                  placeholder="Base64暗号文を貼り付け..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleAesDecrypt}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                <span>AES-GCM で復号</span>
              </button>

              {aesError && (
                <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
                  {aesError}
                </div>
              )}

              {aesDecryptedResult && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-emerald-400">
                      復号されたメッセージ
                    </span>
                    <button
                      onClick={() => handleCopy(aesDecryptedResult, 'aes-decrypted')}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      {copiedId === 'aes-decrypted' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedId === 'aes-decrypted' ? 'コピー済' : 'コピー'}</span>
                    </button>
                  </div>
                  <div className="relative group">
                    <pre
                      onClick={() => handleCopy(aesDecryptedResult, 'aes-decrypted')}
                      className={`text-sm font-sans p-3 rounded max-h-48 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer select-all transition-all ${
                        copiedId === 'aes-decrypted'
                          ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-950 text-slate-100 border-slate-800 hover:border-emerald-500/80 hover:bg-slate-950/90'
                      }`}
                      title="クリックで復号メッセージをコピー"
                    >
                      {aesDecryptedResult}
                    </pre>
                    <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {copiedId === 'aes-decrypted' ? 'コピー済' : 'クリックでコピー'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- ECDH PANEL --- */}
      {activeSubTab === 'ecdh' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="text-sm font-semibold text-slate-100">
              ECDH 楕円曲線ディフィー・ヘルマン鍵共有
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                曲線 (Named Curve)
              </label>
              <select
                value={ecdhCurve}
                onChange={(e) => setEcdhCurve(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="P-256">P-256 (256-bit)</option>
                <option value="P-384">P-384 (384-bit)</option>
                <option value="P-521">P-521 (521-bit)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>あなたの秘密鍵 (Your Private Key PEM)</span>
                  <button
                    type="button"
                    onClick={() => setIsEcdhPrivRevealed(!isEcdhPrivRevealed)}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                  >
                    {isEcdhPrivRevealed ? (
                      <EyeOff className="w-3 h-3 text-slate-400" />
                    ) : (
                      <Eye className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{isEcdhPrivRevealed ? '秘密鍵を隠す' : '秘密鍵を表示'}</span>
                  </button>
                </div>
              </label>
              {isEcdhPrivRevealed ? (
                <textarea
                  rows={3}
                  value={ecdhPrivKeyPem}
                  onChange={(e) => setEcdhPrivKeyPem(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-amber-200 focus:outline-none focus:border-indigo-500"
                />
              ) : (
                <div
                  onClick={() => setIsEcdhPrivRevealed(true)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded p-3 text-xs font-mono text-amber-400/70 cursor-pointer flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <span className="truncate">
                    {ecdhPrivKeyPem
                      ? '•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••• [保護中: クリックまたはボタンで表示]'
                      : '（秘密鍵未入力: ここをクリックまたは「秘密鍵を表示」を押して入力）'}
                  </span>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded shrink-0 ml-2">
                    表示する
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                相手の公開鍵 (Peer's Public Key PEM)
              </label>
              <textarea
                rows={3}
                value={ecdhPeerPubKeyPem}
                onChange={(e) => setEcdhPeerPubKeyPem(e.target.value)}
                placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={handleEcdhDerive}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>共有シークレットを導出</span>
          </button>

          {ecdhError && (
            <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
              {ecdhError}
            </div>
          )}

          {ecdhSharedSecretHex && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-emerald-400">
                  導出された共有シークレット (Hex)
                </span>
                <button
                  onClick={() => handleCopy(ecdhSharedSecretHex, 'ecdh-secret')}
                  className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                >
                  {copiedId === 'ecdh-secret' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedId === 'ecdh-secret' ? 'コピー済' : 'コピー'}</span>
                </button>
              </div>
              <div className="relative group">
                <pre
                  onClick={() => handleCopy(ecdhSharedSecretHex, 'ecdh-secret')}
                  className={`text-xs font-mono p-3 rounded break-all border cursor-pointer select-all transition-all ${
                    copiedId === 'ecdh-secret'
                      ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-slate-950 text-emerald-300 border-slate-800 hover:border-emerald-500/80 hover:bg-slate-950/90'
                  }`}
                  title="クリックで共有シークレットをコピー"
                >
                  {ecdhSharedSecretHex}
                </pre>
                <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {copiedId === 'ecdh-secret' ? 'コピー済' : 'クリックでコピー'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
