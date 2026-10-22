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
          ? `RSA-PSS ${modulusLength}bit ${hash}`
          : keyType === 'rsa-oaep'
          ? `RSA-OAEP ${modulusLength}bit ${hash}`
          : keyType === 'rsa-pkcs1'
          ? `RSA-PKCS#1 ${modulusLength}bit ${hash}`
          : keyType === 'ecdsa'
          ? `ECDSA ${namedCurve}`
          : keyType === 'ecdh'
          ? `ECDH ${namedCurve}`
          : `AES-GCM ${aesLength}bit`;

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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Key className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">暗号鍵ペア生成</h2>
        </div>
      </div>

      {/* Parameter Selection Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              アルゴリズム種別
            </label>
            <select
              value={keyType}
              onChange={(e) => setKeyType(e.target.value as KeyGenOptions['type'])}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <optgroup label="RSA">
                <option value="rsa-pss">RSA-PSS 署名</option>
                <option value="rsa-oaep">RSA-OAEP 暗号化</option>
                <option value="rsa-pkcs1">RSASSA-PKCS1-v1_5</option>
              </optgroup>
              <optgroup label="楕円曲線暗号 ECC">
                <option value="ecdsa">ECDSA 署名</option>
                <option value="ecdh">ECDH 鍵共有</option>
              </optgroup>
              <optgroup label="共通鍵暗号">
                <option value="aes-gcm">AES-GCM</option>
              </optgroup>
            </select>
          </div>

          {keyType.startsWith('rsa') && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                鍵長
              </label>
              <select
                value={modulusLength}
                onChange={(e) => setModulusLength(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={2048}>2048 bit</option>
                <option value={3072}>3072 bit</option>
                <option value={4096}>4096 bit</option>
              </select>
            </div>
          )}

          {(keyType.startsWith('rsa') || keyType === 'ecdsa') && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                ハッシュ関数
              </label>
              <select
                value={hash}
                onChange={(e) => setHash(e.target.value as HashAlgorithm)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="SHA-256">SHA-256</option>
                <option value="SHA-384">SHA-384</option>
                <option value="SHA-512">SHA-512</option>
              </select>
            </div>
          )}

          {(keyType === 'ecdsa' || keyType === 'ecdh') && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                定義済み楕円曲線
              </label>
              <select
                value={namedCurve}
                onChange={(e) => setNamedCurve(e.target.value as 'P-256' | 'P-384' | 'P-521')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="P-256">P-256</option>
                <option value="P-384">P-384</option>
                <option value="P-521">P-521</option>
              </select>
            </div>
          )}

          {keyType === 'aes-gcm' && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                AES鍵長
              </label>
              <select
                value={aesLength}
                onChange={(e) => setAesLength(Number(e.target.value) as 128 | 256)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={256}>256 bit</option>
                <option value={128}>128 bit</option>
              </select>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Key className="w-4 h-4" />
              <span>鍵を生成</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Result Section */}
      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>鍵生成完了</span>
            </span>
          </div>

          {/* Append To Vault Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-xs">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>鍵保管庫に追記</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">タイトル</label>
                <input
                  type="text"
                  value={appendTitle}
                  onChange={(e) => setAppendTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="タイトルを入力"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">メモ</label>
                <input
                  type="text"
                  value={appendMemo}
                  onChange={(e) => setAppendMemo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="用途や保管メモ"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleAppendToVault}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs transition-colors shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>保管庫に追加</span>
              </button>

              {appendSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span>追加完了</span>
                  {onNavigateToVault && (
                    <button
                      type="button"
                      onClick={onNavigateToVault}
                      className="underline hover:text-emerald-300 ml-1"
                    >
                      保管庫で確認
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Keys Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.publicKeyPem && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">公開鍵 SPKI PEM</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(result.publicKeyPem!, 'pub')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                    >
                      {copiedKey === 'pub' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'pub' ? 'コピー完了' : 'コピー'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(result.publicKeyPem!, `public_key_${keyType}.pem`)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
                <pre className="text-xs font-mono p-2 bg-slate-900 border border-slate-800 rounded text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap break-all select-all">
                  {result.publicKeyPem}
                </pre>
              </div>
            )}

            {result.privateKeyPem && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-400 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span>秘密鍵 PKCS#8 PEM</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsPrivateKeyRevealed(!isPrivateKeyRevealed)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                    >
                      {isPrivateKeyRevealed ? '隠す' : '表示'}
                    </button>
                    {isPrivateKeyRevealed && (
                      <button
                        type="button"
                        onClick={() => handleCopy(result.privateKeyPem!, 'priv')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                      >
                        {copiedKey === 'priv' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'priv' ? 'コピー完了' : 'コピー'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownload(result.privateKeyPem!, `private_key_${keyType}.key`)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
                <pre className="text-xs font-mono p-2 bg-slate-900 border border-slate-800 rounded text-amber-300/90 max-h-40 overflow-y-auto whitespace-pre-wrap break-all select-all">
                  {isPrivateKeyRevealed
                    ? result.privateKeyPem
                    : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••\n[保護されています]'}
                </pre>
              </div>
            )}

            {result.rawKeyBase64 && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 col-span-2">
                <span className="font-semibold text-emerald-400 text-xs">AES-GCM 共通鍵</span>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span>Base64</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(result.rawKeyBase64!, 'aes-b64')}
                        className="text-slate-300 hover:text-white"
                      >
                        {copiedKey === 'aes-b64' ? 'コピー完了' : 'コピー'}
                      </button>
                    </div>
                    <code className="text-xs font-mono block p-2 rounded bg-slate-900 text-emerald-300 border border-slate-800 break-all select-all">
                      {result.rawKeyBase64}
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
