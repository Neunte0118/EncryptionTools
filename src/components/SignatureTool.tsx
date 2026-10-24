import React, { useState, useEffect, useRef } from 'react';
import {
  signData,
  verifyData,
  stringToBuffer,
  base64ToBuffer,
  hexToBuffer,
  HashAlgorithm,
} from '../utils/cryptoUtils';
import {
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  generateSecp256k1KeyPair,
  signSecp256k1,
  verifySecp256k1,
} from '../utils/curveUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import { FileLoaderButton } from './FileLoaderButton';
import {
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Upload,
  ArrowRight,
  ShieldCheck,
  FileSignature,
  FileText,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

export type SignatureAlgorithmType =
  | 'ed25519'
  | 'secp256k1'
  | 'rsa-pss'
  | 'ecdsa'
  | 'rsa-pkcs1';

interface Props {
  vault: KeyVaultFile;
  selectedKey?: {
    action: 'sign' | 'verify';
    key: KeyVaultItem;
  } | null;
  onClearSelectedKey?: () => void;
}

export const SignatureTool: React.FC<Props> = ({
  vault,
  selectedKey,
  onClearSelectedKey,
}) => {
  const [mode, setMode] = useState<'sign' | 'verify'>('sign');
  const [dataType, setDataType] = useState<'text' | 'file'>('text');
  const [textInput, setTextInput] = useState('');
  const [fileInput, setFileInput] = useState<{ name: string; buffer: ArrayBuffer } | null>(null);

  const [algType, setAlgType] = useState<SignatureAlgorithmType>('ed25519');
  const [hashAlg, setHashAlg] = useState<HashAlgorithm>('SHA-256');
  const [namedCurve, setNamedCurve] = useState<'P-256' | 'P-384' | 'P-521'>('P-256');
  const [secpHash, setSecpHash] = useState<'SHA-256' | 'Keccak-256'>('SHA-256');

  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState<string>('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [publicKeyPem, setPublicKeyPem] = useState('');
  const [isPrivateKeyRevealed, setIsPrivateKeyRevealed] = useState(false);

  const [generatedSigBase64, setGeneratedSigBase64] = useState('');
  const [generatedSigHex, setGeneratedSigHex] = useState('');
  const [signError, setSignError] = useState('');

  const [verifySigInput, setVerifySigInput] = useState('');
  const [verifySigEncoding, setVerifySigEncoding] = useState<'base64' | 'hex'>('base64');
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedKey) {
      setMode(selectedKey.action);
      setSelectedVaultKeyId(selectedKey.key.id);

      if (selectedKey.key.type === 'rsa-pss') setAlgType('rsa-pss');
      else if (selectedKey.key.type === 'rsa-pkcs1') setAlgType('rsa-pkcs1');
      else if (selectedKey.key.type === 'ecdsa') setAlgType('ecdsa');

      if (selectedKey.key.algorithmDetails.namedCurve) {
        setNamedCurve(selectedKey.key.algorithmDetails.namedCurve as any);
      }
      if (selectedKey.key.algorithmDetails.hash) {
        setHashAlg(selectedKey.key.algorithmDetails.hash as any);
      }

      if (selectedKey.key.privateKeyPem) setPrivateKeyPem(selectedKey.key.privateKeyPem);
      if (selectedKey.key.publicKeyPem) setPublicKeyPem(selectedKey.key.publicKeyPem);
      onClearSelectedKey?.();
    }
  }, [selectedKey, onClearSelectedKey]);

  const handleVaultKeySelect = (id: string) => {
    setSelectedVaultKeyId(id);
    if (!id) return;
    const item = vault.keys.find((k) => k.id === id);
    if (!item) return;

    if (item.type === 'rsa-pss') setAlgType('rsa-pss');
    else if (item.type === 'rsa-pkcs1') setAlgType('rsa-pkcs1');
    else if (item.type === 'ecdsa') setAlgType('ecdsa');

    if (item.algorithmDetails.namedCurve) {
      setNamedCurve(item.algorithmDetails.namedCurve as any);
    }
    if (item.algorithmDetails.hash) {
      setHashAlg(item.algorithmDetails.hash as any);
    }

    if (item.privateKeyPem) setPrivateKeyPem(item.privateKeyPem);
    if (item.publicKeyPem) setPublicKeyPem(item.publicKeyPem);
  };

  const handleGenerateEphemeralKey = () => {
    try {
      if (algType === 'ed25519') {
        const kp = generateEd25519KeyPair();
        setPrivateKeyPem(kp.privateKeyHex);
        setPublicKeyPem(kp.publicKeyHex);
      } else if (algType === 'secp256k1') {
        const kp = generateSecp256k1KeyPair();
        setPrivateKeyPem(kp.privateKeyHex);
        setPublicKeyPem(kp.publicKeyHex);
      }
    } catch (e: any) {
      setSignError(`鍵生成エラー: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileInput({
        name: file.name,
        buffer: event.target?.result as ArrayBuffer,
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const getTargetBuffer = (): ArrayBuffer => {
    if (dataType === 'text') {
      return stringToBuffer(textInput);
    }
    if (!fileInput) throw new Error('ファイルが選択されていません');
    return fileInput.buffer;
  };

  const handleSign = async () => {
    setSignError('');
    setGeneratedSigBase64('');
    setGeneratedSigHex('');

    if (!privateKeyPem.trim()) {
      setSignError('秘密鍵を入力または生成してください');
      return;
    }

    try {
      const dataBuffer = getTargetBuffer();
      const u8 = new Uint8Array(dataBuffer);

      if (algType === 'ed25519') {
        const res = signEd25519(u8, privateKeyPem.trim());
        setGeneratedSigBase64(res.base64);
        setGeneratedSigHex(res.hex);
      } else if (algType === 'secp256k1') {
        const res = signSecp256k1(u8, privateKeyPem.trim(), secpHash);
        setGeneratedSigBase64(res.base64);
        setGeneratedSigHex(res.hex);
      } else {
        const res = await signData({
          data: dataBuffer,
          privateKeyPem,
          type: algType,
          hash: hashAlg,
          namedCurve,
        });
        setGeneratedSigBase64(res.base64);
        setGeneratedSigHex(res.hex);
      }
    } catch (e: any) {
      setSignError(`署名エラー: ${e.message}`);
    }
  };

  const handleVerify = async () => {
    setVerifyError('');
    setVerificationResult(null);

    if (!publicKeyPem.trim()) {
      setVerifyError('公開鍵を入力または選択してください');
      return;
    }
    if (!verifySigInput.trim()) {
      setVerifyError('検証する署名値を入力してください');
      return;
    }

    try {
      const dataBuffer = getTargetBuffer();
      const u8 = new Uint8Array(dataBuffer);

      if (algType === 'ed25519') {
        const isValid = verifyEd25519(u8, verifySigInput.trim(), publicKeyPem.trim());
        setVerificationResult(isValid);
      } else if (algType === 'secp256k1') {
        const isValid = verifySecp256k1(u8, verifySigInput.trim(), publicKeyPem.trim(), secpHash);
        setVerificationResult(isValid);
      } else {
        const sigBuffer =
          verifySigEncoding === 'base64'
            ? base64ToBuffer(verifySigInput.trim())
            : hexToBuffer(verifySigInput.trim().replace(/\s+/g, ''));

        const isValid = await verifyData({
          data: dataBuffer,
          signature: sigBuffer,
          publicKeyPem,
          type: algType,
          hash: hashAlg,
          namedCurve,
        });

        setVerificationResult(isValid);
      }
    } catch (e: any) {
      setVerifyError(`検証エラー: ${e.message}`);
    }
  };

  const sendToVerifyTab = () => {
    setVerifySigInput(generatedSigBase64);
    setVerifySigEncoding('base64');
    setMode('verify');
    setVerificationResult(null);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleDownloadSig = (content: string, filename: string) => {
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

  const signableVaultKeys = vault.keys.filter(
    (k) => k.type === 'rsa-pss' || k.type === 'ecdsa' || k.type === 'rsa-pkcs1'
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Unified Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <FileSignature className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-bold text-slate-100">電子署名 (全規格網羅)</h2>
            <p className="text-[11px] text-slate-400">
              Ed25519 (RFC 8032), secp256k1 (Bitcoin/Ethereum), RSA-PSS, RSASSA-PKCS1, ECDSA (NIST)
            </p>
          </div>
        </div>

        <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('sign');
              setVerificationResult(null);
            }}
            className={`px-3 py-1 rounded transition-colors ${
              mode === 'sign' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            署名作成
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('verify');
              setVerificationResult(null);
            }}
            className={`px-3 py-1 rounded transition-colors ${
              mode === 'verify' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            署名検証
          </button>
        </div>
      </div>

      {/* Algorithm & Key Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">暗号署名規格</label>
            <select
              value={algType}
              onChange={(e) => {
                setAlgType(e.target.value as SignatureAlgorithmType);
                setGeneratedSigBase64('');
                setGeneratedSigHex('');
                setVerificationResult(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-indigo-300 font-medium focus:outline-none focus:border-indigo-500"
            >
              <optgroup label="現代 Edwards / Koblitz 曲線">
                <option value="ed25519">Ed25519 (RFC 8032 / 高速・高安全性)</option>
                <option value="secp256k1">secp256k1 (Bitcoin / Ethereum / Nostr)</option>
              </optgroup>
              <optgroup label="NIST 楕円曲線 (ECDSA)">
                <option value="ecdsa">ECDSA (NIST P-256 / P-384 / P-521)</option>
              </optgroup>
              <optgroup label="RSA 署名規格 (PKCS #1)">
                <option value="rsa-pss">RSA-PSS (RFC 8017 / 確率的署名)</option>
                <option value="rsa-pkcs1">RSASSA-PKCS1-v1_5 (レガシー確定署名)</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {algType === 'ecdsa'
                ? '曲線'
                : algType === 'secp256k1'
                ? 'ハッシュ関数'
                : algType === 'ed25519'
                ? '仕様'
                : 'ハッシュ関数'}
            </label>
            {algType === 'ed25519' ? (
              <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 font-mono text-xs">
                SHA-512 内部統合 (RFC 8032)
              </div>
            ) : algType === 'secp256k1' ? (
              <select
                value={secpHash}
                onChange={(e) => setSecpHash(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="SHA-256">SHA-256 (Bitcoin / Nostr 標準)</option>
                <option value="Keccak-256">Keccak-256 (Ethereum 標準)</option>
              </select>
            ) : algType === 'ecdsa' ? (
              <select
                value={namedCurve}
                onChange={(e) => setNamedCurve(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="P-256">NIST P-256 (secp256r1)</option>
                <option value="P-384">NIST P-384 (secp384r1)</option>
                <option value="P-521">NIST P-521</option>
              </select>
            ) : (
              <select
                value={hashAlg}
                onChange={(e) => setHashAlg(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="SHA-256">SHA-256</option>
                <option value="SHA-384">SHA-384</option>
                <option value="SHA-512">SHA-512</option>
                <option value="SHA-1">SHA-1 (レガシー)</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">保管庫の鍵</label>
            <select
              value={selectedVaultKeyId}
              onChange={(e) => handleVaultKeySelect(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">手動入力または選択</option>
              {signableVaultKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Key Input */}
        <div>
          {mode === 'sign' ? (
            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="text-slate-300 font-medium">
                  秘密鍵 {algType === 'ed25519' || algType === 'secp256k1' ? '(Hex / Base64 / PEM)' : 'PEM'}
                </span>
                <div className="flex items-center gap-2">
                  {(algType === 'ed25519' || algType === 'secp256k1') && (
                    <button
                      type="button"
                      onClick={handleGenerateEphemeralKey}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>即時生成</span>
                    </button>
                  )}
                  <FileLoaderButton
                    label="秘密鍵読込"
                    onFileLoaded={(content) => setPrivateKeyPem(content)}
                    title="秘密鍵ファイル (.pem, .key, .txt) を選択またはドロップ"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPrivateKeyRevealed(!isPrivateKeyRevealed)}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    {isPrivateKeyRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isPrivateKeyRevealed ? '隠す' : '表示'}</span>
                  </button>
                </div>
              </div>
              <textarea
                rows={3}
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) setPrivateKeyPem(await f.text());
                }}
                placeholder={
                  algType === 'ed25519' || algType === 'secp256k1'
                    ? '32バイト秘密鍵 (Hex または Base64 / 即時生成も可能)'
                    : '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
                }
                className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-amber-200 focus:outline-none focus:border-indigo-500 ${
                  !isPrivateKeyRevealed ? 'filter blur-[3px] focus:filter-none transition-all' : ''
                }`}
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1 text-xs">
                <label className="text-slate-300 font-medium">
                  公開鍵 {algType === 'ed25519' || algType === 'secp256k1' ? '(Hex / Base64 / PEM)' : 'PEM'}
                </label>
                <FileLoaderButton
                  label="公開鍵読込"
                  onFileLoaded={(content) => setPublicKeyPem(content)}
                  title="公開鍵ファイル (.pem, .pub, .crt, .txt) を選択またはドロップ"
                />
              </div>
              <textarea
                rows={3}
                value={publicKeyPem}
                onChange={(e) => setPublicKeyPem(e.target.value)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) setPublicKeyPem(await f.text());
                }}
                placeholder={
                  algType === 'ed25519'
                    ? '32バイト公開鍵 (Hex または Base64)'
                    : algType === 'secp256k1'
                    ? '33バイト圧縮公開鍵または65バイト非圧縮公開鍵 (Hex または Base64)'
                    : '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Target Data */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-200">
            {mode === 'sign' ? '署名対象データ' : '検証対象データ'}
          </span>
          <div className="flex items-center gap-2">
            {dataType === 'text' && (
              <FileLoaderButton
                label="ファイルから読込"
                onFileLoaded={(content) => setTextInput(content)}
              />
            )}
            <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setDataType('text')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  dataType === 'text' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                テキスト
              </button>
              <button
                type="button"
                onClick={() => setDataType('file')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  dataType === 'file' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ファイル
              </button>
            </div>
          </div>
        </div>

        {dataType === 'text' ? (
          <textarea
            rows={4}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setTextInput(await f.text());
            }}
            placeholder="メッセージを入力..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
        ) : (
          <div>
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center cursor-pointer bg-slate-950"
            >
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
              {fileInput ? (
                <div className="text-indigo-400 font-medium text-xs">{fileInput.name}</div>
              ) : (
                <div className="text-slate-400 text-xs">クリックまたはドラッグ＆ドロップでファイルを選択</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Execution & Output */}
      {mode === 'sign' ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleSign}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <FileSignature className="w-4 h-4" />
            <span>署名を生成 ({algType})</span>
          </button>

          {signError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-lg">
              {signError}
            </div>
          )}

          {generatedSigBase64 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>署名生成完了 ({algType})</span>
                </span>
                <button
                  type="button"
                  onClick={sendToVerifyTab}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>検証へ送る</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-semibold text-slate-300">署名 Base64</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedSigBase64, 'sig-b64')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                      >
                        {copiedField === 'sig-b64' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'sig-b64' ? 'コピー完了' : 'コピー'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSig(generatedSigBase64, 'signature.sig')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>保存</span>
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs font-mono p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 break-all select-all">
                    {generatedSigBase64}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-semibold text-slate-300">署名 Hex (16進数)</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedSigHex, 'sig-hex')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                    >
                      {copiedField === 'sig-hex' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'sig-hex' ? 'コピー完了' : 'Hexコピー'}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 break-all select-all">
                    {generatedSigHex}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                検証する署名値 ({algType})
              </label>
              <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setVerifySigEncoding('base64')}
                  className={`px-2 py-0.5 rounded ${
                    verifySigEncoding === 'base64' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Base64
                </button>
                <button
                  type="button"
                  onClick={() => setVerifySigEncoding('hex')}
                  className={`px-2 py-0.5 rounded ${
                    verifySigEncoding === 'hex' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Hex
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={verifySigInput}
              onChange={(e) => setVerifySigInput(e.target.value)}
              placeholder="署名値を貼り付け (Base64 または Hex)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={handleVerify}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>署名を検証 ({algType})</span>
          </button>

          {verifyError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-lg">
              {verifyError}
            </div>
          )}

          {verificationResult !== null && (
            <div
              className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${
                verificationResult
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {verificationResult ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>署名は有効です ({algType} での暗号学的正当性を確認しました)</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>署名は無効です (データが改ざんされているか、公開鍵または署名が異なります)</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
