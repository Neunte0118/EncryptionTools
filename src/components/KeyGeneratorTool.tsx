import React, { useState } from 'react';
import {
  KeyGenOptions,
  GeneratedKeyResult,
  generateKeyPairOrKey,
  HashAlgorithm,
} from '../utils/cryptoUtils';
import { KeyVaultFile } from '../types/crypto';
import { appendKeyToVault } from '../utils/vaultStorage';
import {
  Key,
  Download,
  Copy,
  Check,
  PlusCircle,
  Shield,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  onVaultChange: (updated: KeyVaultFile) => void;
  onNavigateToVault?: () => void;
}

export const KeyGeneratorTool: React.FC<Props> = ({
  vault,
  onVaultChange,
  onNavigateToVault,
}) => {
  const [keyType, setKeyType] = useState<KeyGenOptions['type']>('rsa-pss');
  const [modulusLength, setModulusLength] = useState<number>(2048);
  const [hash, setHash] = useState<HashAlgorithm>('SHA-256');
  const [namedCurve, setNamedCurve] = useState<'P-256' | 'P-384' | 'P-521'>('P-256');
  const [aesLength, setAesLength] = useState<128 | 256>(256);

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedKeyResult | null>(null);
  const [isPrivateKeyRevealed, setIsPrivateKeyRevealed] = useState(false);

  // Vault Append Form
  const [appendTitle, setAppendTitle] = useState('');
  const [appendMemo, setAppendMemo] = useState('');
  const [appendSuccess, setAppendSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setAppendSuccess(false);
    setIsPrivateKeyRevealed(false);
    try {
      const generated = await generateKeyPairOrKey({
        type: keyType,
        modulusLength,
        hash,
        namedCurve,
        aesLength,
      });
      setResult(generated);

      const typeLabel =
        keyType === 'rsa-pss'
          ? `RSA-PSS (${modulusLength}bit, ${hash})`
          : keyType === 'rsa-oaep'
          ? `RSA-OAEP (${modulusLength}bit, ${hash})`
          : keyType === 'rsa-pkcs1'
          ? `RSA-PKCS#1 (${modulusLength}bit, ${hash})`
          : keyType === 'ecdsa'
          ? `ECDSA (${namedCurve})`
          : keyType === 'ecdh'
          ? `ECDH (${namedCurve})`
          : `AES-GCM (${aesLength}bit)`;

      setAppendTitle(typeLabel);
      setAppendMemo(`生成日: ${new Date().toLocaleDateString('ja-JP')}`);
    } catch (e: any) {
      alert(`鍵の生成に失敗しました: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAppendToVault = () => {
    if (!result) return;
    if (!appendTitle.trim()) {
      alert('鍵のタイトルを入力してください');
      return;
    }

    const { updatedVault } = appendKeyToVault(vault, {
      title: appendTitle.trim(),
      memo: appendMemo.trim(),
      type: keyType,
      algorithmDetails: {
        name: keyType.toUpperCase(),
        modulusLength: keyType.startsWith('rsa') ? modulusLength : undefined,
        hash: keyType.startsWith('rsa') || keyType === 'ecdsa' ? hash : undefined,
        namedCurve: keyType === 'ecdsa' || keyType === 'ecdh' ? namedCurve : undefined,
        length: keyType === 'aes-gcm' ? aesLength : undefined,
      },
      publicKeyPem: result.publicKeyPem,
      privateKeyPem: result.privateKeyPem,
      rawKeyBase64: result.rawKeyBase64,
    });

    onVaultChange(updatedVault);
    setAppendSuccess(true);
    setTimeout(() => setAppendSuccess(false), 4000);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Parameter Selection Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Key className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-slate-100">
            暗号鍵ペア / 共通鍵の新規生成
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {/* Key Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              アルゴリズム種別
            </label>
            <select
              value={keyType}
              onChange={(e) => setKeyType(e.target.value as KeyGenOptions['type'])}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <optgroup label="RSA (公開鍵暗号・電子署名)">
                <option value="rsa-pss">RSA-PSS (高セキュリティ署名)</option>
                <option value="rsa-oaep">RSA-OAEP (公開鍵暗号化)</option>
                <option value="rsa-pkcs1">RSASSA-PKCS1-v1_5 (互換署名)</option>
              </optgroup>
              <optgroup label="楕円曲線暗号 (ECC)">
                <option value="ecdsa">ECDSA (楕円曲線電子署名)</option>
                <option value="ecdh">ECDH (鍵共有)</option>
              </optgroup>
              <optgroup label="共通鍵暗号">
                <option value="aes-gcm">AES-GCM (高速認証付き暗号)</option>
              </optgroup>
            </select>
          </div>

          {/* RSA-specific: Modulus Length */}
          {keyType.startsWith('rsa') && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                鍵長 (Modulus Length)
              </label>
              <select
                value={modulusLength}
                onChange={(e) => setModulusLength(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={2048}>2048 bit (標準)</option>
                <option value={3072}>3072 bit (高強度)</option>
                <option value={4096}>4096 bit (最高強度)</option>
              </select>
            </div>
          )}

          {/* Hash Algorithm for RSA & ECDSA */}
          {(keyType.startsWith('rsa') || keyType === 'ecdsa') && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                ハッシュ関数
              </label>
              <select
                value={hash}
                onChange={(e) => setHash(e.target.value as HashAlgorithm)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="SHA-256">SHA-256</option>
                <option value="SHA-384">SHA-384</option>
                <option value="SHA-512">SHA-512</option>
              </select>
            </div>
          )}

          {/* Curve for ECDSA & ECDH */}
          {(keyType === 'ecdsa' || keyType === 'ecdh') && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                定義済み楕円曲線 (Named Curve)
              </label>
              <select
                value={namedCurve}
                onChange={(e) => setNamedCurve(e.target.value as 'P-256' | 'P-384' | 'P-521')}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="P-256">P-256 (NIST / 256-bit)</option>
                <option value="P-384">P-384 (NIST / 384-bit)</option>
                <option value="P-521">P-521 (NIST / 521-bit)</option>
              </select>
            </div>
          )}

          {/* AES Length */}
          {keyType === 'aes-gcm' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                AES鍵長
              </label>
              <select
                value={aesLength}
                onChange={(e) => setAesLength(Number(e.target.value) as 128 | 256)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={256}>256 bit (AES-256)</option>
                <option value={128}>128 bit (AES-128)</option>
              </select>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>鍵を生成する</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generated Result Section */}
      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>鍵の生成が完了しました</span>
            </h3>
          </div>

          {/* Append To Vault Card */}
          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
              <PlusCircle className="w-4 h-4" />
              <span>鍵管理ファイルに追記して保存</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  鍵のタイトル
                </label>
                <input
                  type="text"
                  value={appendTitle}
                  onChange={(e) => setAppendTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-400"
                  placeholder="タイトルを入力"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  メモ / 用途
                </label>
                <input
                  type="text"
                  value={appendMemo}
                  onChange={(e) => setAppendMemo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-400"
                  placeholder="用途や保管メモ"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleAppendToVault}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs transition-colors shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>鍵管理ファイルに追記</span>
              </button>

              {appendSuccess && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium animate-fadeIn">
                  <span>✓ 鍵管理ファイルに追加されました</span>
                  {onNavigateToVault && (
                    <button
                      onClick={onNavigateToVault}
                      className="underline hover:text-emerald-300 ml-1"
                    >
                      鍵管理タブで確認
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Keys Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Public Key */}
            {result.publicKeyPem && (
              <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    公開鍵 (SPKI PEM)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(result.publicKeyPem!, 'pub')}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      {copiedKey === 'pub' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'pub' ? 'コピー済' : 'コピー'}</span>
                    </button>
                    <button
                      onClick={() =>
                        handleDownload(result.publicKeyPem!, `public_key_${keyType}.pem`)
                      }
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.pem保存</span>
                    </button>
                  </div>
                </div>
                <div className="relative group">
                  <pre
                    onClick={() => handleCopy(result.publicKeyPem!, 'pub')}
                    className={`text-[11px] font-mono p-2.5 rounded max-h-48 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer transition-all select-all ${
                      copiedKey === 'pub'
                        ? 'bg-indigo-950/60 text-indigo-200 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-900 text-slate-300 border-slate-800/60 hover:border-indigo-500/80 hover:bg-slate-900/90'
                    }`}
                    title="クリックで公開鍵をコピー"
                  >
                    {result.publicKeyPem}
                  </pre>
                  <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {copiedKey === 'pub' ? 'コピー済' : 'クリックでコピー'}
                  </span>
                </div>
              </div>
            )}

            {/* Private Key */}
            {result.privateKeyPem && (
              <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-400 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    秘密鍵 (PKCS#8 PEM)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsPrivateKeyRevealed(!isPrivateKeyRevealed)}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      {isPrivateKeyRevealed ? (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{isPrivateKeyRevealed ? '秘密鍵を隠す' : '秘密鍵を表示'}</span>
                    </button>
                    {isPrivateKeyRevealed && (
                      <button
                        onClick={() => handleCopy(result.privateKeyPem!, 'priv')}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                      >
                        {copiedKey === 'priv' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'priv' ? 'コピー済' : 'コピー'}</span>
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handleDownload(result.privateKeyPem!, `private_key_${keyType}.key`)
                      }
                      className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.key保存</span>
                    </button>
                  </div>
                </div>
                <div className="relative group">
                  <pre
                    onClick={() => {
                      if (!isPrivateKeyRevealed) {
                        setIsPrivateKeyRevealed(true);
                      } else {
                        handleCopy(result.privateKeyPem!, 'priv');
                      }
                    }}
                    className={`text-[11px] font-mono p-2.5 rounded max-h-48 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer transition-all ${
                      !isPrivateKeyRevealed
                        ? 'bg-slate-900/60 text-slate-500 border-slate-800/60 hover:border-amber-600/60'
                        : copiedKey === 'priv'
                        ? 'bg-amber-950/60 text-amber-200 border-amber-500 ring-1 ring-amber-500 select-all'
                        : 'bg-slate-900 text-amber-300/90 border-slate-800/60 hover:border-amber-500/80 select-all'
                    }`}
                    title={isPrivateKeyRevealed ? 'クリックで秘密鍵をコピー' : 'クリックして秘密鍵を表示'}
                  >
                    {isPrivateKeyRevealed
                      ? result.privateKeyPem
                      : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••\n[保護されています。「秘密鍵を表示」ボタンを押して確認]'}
                  </pre>
                  <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {isPrivateKeyRevealed
                      ? copiedKey === 'priv'
                        ? 'コピー済'
                        : 'クリックでコピー'
                      : 'クリックで表示'}
                  </span>
                </div>
              </div>
            )}

            {/* Raw AES Key */}
            {result.rawKeyBase64 && (
              <div className="bg-slate-950 border border-slate-800 rounded-md p-4 space-y-3 col-span-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400">
                    AES-GCM 鍵データ
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Base64</span>
                      <button
                        onClick={() => handleCopy(result.rawKeyBase64!, 'aes-b64')}
                        className="text-slate-300 hover:text-white"
                      >
                        {copiedKey === 'aes-b64' ? 'コピー済' : 'コピー'}
                      </button>
                    </div>
                    <code
                      onClick={() => handleCopy(result.rawKeyBase64!, 'aes-b64')}
                      className={`text-xs font-mono block p-2 rounded break-all border cursor-pointer select-all transition-all ${
                        copiedKey === 'aes-b64'
                          ? 'bg-emerald-950 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-900 text-emerald-300 border-slate-800 hover:border-emerald-500/80'
                      }`}
                      title="クリックでコピー"
                    >
                      {result.rawKeyBase64}
                    </code>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Hex</span>
                      <button
                        onClick={() => handleCopy(result.rawKeyHex!, 'aes-hex')}
                        className="text-slate-300 hover:text-white"
                      >
                        {copiedKey === 'aes-hex' ? 'コピー済' : 'コピー'}
                      </button>
                    </div>
                    <code
                      onClick={() => handleCopy(result.rawKeyHex!, 'aes-hex')}
                      className={`text-xs font-mono block p-2 rounded break-all border cursor-pointer select-all transition-all ${
                        copiedKey === 'aes-hex'
                          ? 'bg-emerald-950 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                          : 'bg-slate-900 text-emerald-300/80 border-slate-800 hover:border-emerald-500/80'
                      }`}
                      title="クリックでコピー"
                    >
                      {result.rawKeyHex}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
