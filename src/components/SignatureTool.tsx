import React, { useState, useEffect, useRef } from 'react';
import {
  signData,
  verifyData,
  stringToBuffer,
  base64ToBuffer,
  hexToBuffer,
  HashAlgorithm,
} from '../utils/cryptoUtils';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
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
} from 'lucide-react';

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

  // Input Data (Sign & Verify)
  const [dataType, setDataType] = useState<'text' | 'file'>('text');
  const [textInput, setTextInput] = useState('');
  const [fileInput, setFileInput] = useState<{ name: string; buffer: ArrayBuffer } | null>(null);

  // Algorithm Parameters
  const [algType, setAlgType] = useState<'rsa-pss' | 'rsa-pkcs1' | 'ecdsa'>('rsa-pss');
  const [hashAlg, setHashAlg] = useState<HashAlgorithm>('SHA-256');
  const [namedCurve, setNamedCurve] = useState<'P-256' | 'P-384' | 'P-521'>('P-256');

  // Keys
  const [selectedVaultKeyId, setSelectedVaultKeyId] = useState<string>('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [publicKeyPem, setPublicKeyPem] = useState('');
  const [isPrivateKeyRevealed, setIsPrivateKeyRevealed] = useState(false);

  // Sign Output
  const [generatedSigBase64, setGeneratedSigBase64] = useState('');
  const [generatedSigHex, setGeneratedSigHex] = useState('');
  const [signError, setSignError] = useState('');

  // Verify Input & Output
  const [verifySigInput, setVerifySigInput] = useState('');
  const [verifySigEncoding, setVerifySigEncoding] = useState<'base64' | 'hex'>('base64');
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync when selectedKey passed from KeyVaultManager
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

      if (selectedKey.key.privateKeyPem) {
        setPrivateKeyPem(selectedKey.key.privateKeyPem);
      }
      if (selectedKey.key.publicKeyPem) {
        setPublicKeyPem(selectedKey.key.publicKeyPem);
      }
      onClearSelectedKey?.();
    }
  }, [selectedKey, onClearSelectedKey]);

  // Load key from vault selector
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      setFileInput({ name: file.name, buffer });
    };
    reader.readAsArrayBuffer(file);
  };

  const getDataBuffer = (): ArrayBuffer => {
    if (dataType === 'text') {
      return stringToBuffer(textInput);
    }
    if (fileInput) {
      return fileInput.buffer;
    }
    throw new Error('署名または検証対象のデータが入力されていません');
  };

  const handleSign = async () => {
    setSignError('');
    setGeneratedSigBase64('');
    setGeneratedSigHex('');

    if (!privateKeyPem.trim()) {
      setSignError('署名に使用する秘密鍵を指定してください');
      return;
    }

    try {
      const data = getDataBuffer();
      const res = await signData({
        type: algType,
        hash: hashAlg,
        namedCurve,
        privateKeyPem: privateKeyPem.trim(),
        data,
      });

      setGeneratedSigBase64(res.base64);
      setGeneratedSigHex(res.hex);
    } catch (e: any) {
      setSignError(`署名生成エラー: ${e.message}`);
    }
  };

  const handleVerify = async () => {
    setVerifyError('');
    setVerificationResult(null);

    if (!publicKeyPem.trim()) {
      setVerifyError('検証に使用する公開鍵を指定してください');
      return;
    }

    if (!verifySigInput.trim()) {
      setVerifyError('検証する署名データを入力してください');
      return;
    }

    try {
      const data = getDataBuffer();
      const sigBuffer =
        verifySigEncoding === 'base64'
          ? base64ToBuffer(verifySigInput.trim())
          : hexToBuffer(verifySigInput.trim());

      const isValid = await verifyData({
        type: algType,
        hash: hashAlg,
        namedCurve,
        publicKeyPem: publicKeyPem.trim(),
        data,
        signature: sigBuffer,
      });

      setVerificationResult(isValid);
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
    URL.revokeObjectURL(url);
  };

  // Filter vault keys that can be used for signatures
  const signableVaultKeys = vault.keys.filter(
    (k) => k.type === 'rsa-pss' || k.type === 'ecdsa' || k.type === 'rsa-pkcs1'
  );

  return (
    <div className="space-y-6">
      {/* Sub tabs: Sign / Verify */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => {
            setMode('sign');
            setVerificationResult(null);
          }}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors shrink-0 ${
            mode === 'sign'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSignature className="w-4 h-4 shrink-0" />
          <span>デジタル署名作成 (Sign)</span>
        </button>

        <button
          onClick={() => {
            setMode('verify');
            setVerificationResult(null);
          }}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors shrink-0 ${
            mode === 'verify'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>署名検証 (Verify)</span>
        </button>
      </div>

      {/* Algorithm & Vault Key Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {/* Key Selection from Vault */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>鍵管理ファイルから選択</span>
            </label>
            <select
              value={selectedVaultKeyId}
              onChange={(e) => handleVaultKeySelect(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">(手動入力または選択)</option>
              {signableVaultKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title} [{k.type.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>

          {/* Algorithm Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              署名アルゴリズム
            </label>
            <select
              value={algType}
              onChange={(e) => setAlgType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="rsa-pss">RSA-PSS (推奨 / 高強度)</option>
              <option value="ecdsa">ECDSA (楕円曲線暗号)</option>
              <option value="rsa-pkcs1">RSASSA-PKCS1-v1_5 (互換)</option>
            </select>
          </div>

          {/* Curve or Hash */}
          {algType === 'ecdsa' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                楕円曲線 (Curve)
              </label>
              <select
                value={namedCurve}
                onChange={(e) => setNamedCurve(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="P-256">P-256 (NIST / 256-bit)</option>
                <option value="P-384">P-384 (NIST / 384-bit)</option>
                <option value="P-521">P-521 (NIST / 521-bit)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                ハッシュ関数
              </label>
              <select
                value={hashAlg}
                onChange={(e) => setHashAlg(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="SHA-256">SHA-256</option>
                <option value="SHA-384">SHA-384</option>
                <option value="SHA-512">SHA-512</option>
              </select>
            </div>
          )}
        </div>

        {/* Key PEM Input */}
        <div>
          {mode === 'sign' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>秘密鍵 (Private Key PEM)</span>
                  <button
                    type="button"
                    onClick={() => setIsPrivateKeyRevealed(!isPrivateKeyRevealed)}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                  >
                    {isPrivateKeyRevealed ? (
                      <EyeOff className="w-3 h-3 text-slate-400" />
                    ) : (
                      <Eye className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{isPrivateKeyRevealed ? '秘密鍵を隠す' : '秘密鍵を表示'}</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-500">PKCS#8 形式</span>
              </label>
              {isPrivateKeyRevealed ? (
                <textarea
                  rows={3}
                  value={privateKeyPem}
                  onChange={(e) => setPrivateKeyPem(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono text-amber-200 focus:outline-none focus:border-indigo-500"
                />
              ) : (
                <div
                  onClick={() => setIsPrivateKeyRevealed(true)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded p-3 text-xs font-mono text-amber-400/70 cursor-pointer flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <span className="truncate">
                    {privateKeyPem
                      ? '•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••• [保護中: クリックまたはボタンで表示]'
                      : '（秘密鍵未入力: ここをクリックまたは「秘密鍵を表示」を押して入力）'}
                  </span>
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded shrink-0 ml-2">
                    表示する
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>公開鍵 (Public Key PEM)</span>
                <span className="text-[11px] text-slate-500">SPKI 形式</span>
              </label>
              <textarea
                rows={3}
                value={publicKeyPem}
                onChange={(e) => setPublicKeyPem(e.target.value)}
                placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Target Data (Text or File) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="text-sm font-semibold text-slate-200">
            {mode === 'sign' ? '署名対象データ' : '検証対象データ'}
          </div>

          {/* Toggle Text / File */}
          <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setDataType('text')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                dataType === 'text'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              テキスト
            </button>
            <button
              onClick={() => setDataType('file')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                dataType === 'file'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ファイル
            </button>
          </div>
        </div>

        {dataType === 'text' ? (
          <div>
            <textarea
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="署名または検証を行うメッセージを入力..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="text-right text-[11px] text-slate-500 mt-1">
              文字数: {textInput.length} | バイト長: {new TextEncoder().encode(textInput).length}
            </div>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center cursor-pointer bg-slate-950/60 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              {fileInput ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-indigo-400 flex items-center justify-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>{fileInput.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    サイズ: {(fileInput.buffer.byteLength / 1024).toFixed(2)} KB (
                    {fileInput.buffer.byteLength.toLocaleString()} バイト)
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    クリックして別のファイルを選択
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-slate-300">
                    ファイルをクリックまたはドラッグ＆ドロップ
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    ローカルメモリ内で直接バイナリ署名・検証を行います
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mode-Specific Actions & Output */}
      {mode === 'sign' ? (
        <div className="space-y-4">
          <button
            onClick={handleSign}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
          >
            <FileSignature className="w-4 h-4" />
            <span>デジタル署名を生成</span>
          </button>

          {signError && (
            <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
              {signError}
            </div>
          )}

          {generatedSigBase64 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>署名が正常に生成されました</span>
                </div>

                <button
                  onClick={sendToVerifyTab}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  <span>検証タブに送ってテスト</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Base64 Signature */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">署名 (Base64)</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(generatedSigBase64, 'sig-b64')}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      {copiedField === 'sig-b64' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedField === 'sig-b64' ? 'コピー済' : 'コピー'}</span>
                    </button>
                    <button
                      onClick={() => handleDownloadSig(generatedSigBase64, 'signature.sig')}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>.sig保存</span>
                    </button>
                  </div>
                </div>
                <div className="relative group">
                  <pre
                    onClick={() => handleCopy(generatedSigBase64, 'sig-b64')}
                    className={`text-xs font-mono p-3 rounded max-h-24 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer transition-all select-all ${
                      copiedField === 'sig-b64'
                        ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-slate-950 text-emerald-300 border-slate-800 hover:border-emerald-500/80 hover:bg-slate-950/90'
                    }`}
                    title="クリックで署名(Base64)をコピー"
                  >
                    {generatedSigBase64}
                  </pre>
                  <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {copiedField === 'sig-b64' ? 'コピー済' : 'クリックでコピー'}
                  </span>
                </div>
              </div>

              {/* Hex Signature */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">署名 (Hex)</span>
                  <button
                    onClick={() => handleCopy(generatedSigHex, 'sig-hex')}
                    className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                  >
                    {copiedField === 'sig-hex' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedField === 'sig-hex' ? 'コピー済' : 'コピー'}</span>
                  </button>
                </div>
                <div className="relative group">
                  <pre
                    onClick={() => handleCopy(generatedSigHex, 'sig-hex')}
                    className={`text-xs font-mono p-2.5 rounded max-h-20 overflow-y-auto whitespace-pre-wrap break-all border cursor-pointer transition-all select-all ${
                      copiedField === 'sig-hex'
                        ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-emerald-500/80 hover:text-slate-300'
                    }`}
                    title="クリックで署名(Hex)をコピー"
                  >
                    {generatedSigHex}
                  </pre>
                  <span className="absolute top-2 right-2 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {copiedField === 'sig-hex' ? 'コピー済' : 'クリックでコピー'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Signature to Verify Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                検証する署名値 (Signature)
              </label>

              <div className="flex rounded-md bg-slate-950 p-1 border border-slate-800">
                <button
                  onClick={() => setVerifySigEncoding('base64')}
                  className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors ${
                    verifySigEncoding === 'base64'
                      ? 'bg-slate-800 text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Base64
                </button>
                <button
                  onClick={() => setVerifySigEncoding('hex')}
                  className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors ${
                    verifySigEncoding === 'hex'
                      ? 'bg-slate-800 text-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
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
              placeholder="Base64またはHex形式の署名値を貼り付け..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={handleVerify}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-md transition-colors shadow-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>署名を検証する</span>
          </button>

          {verifyError && (
            <div className="p-3 text-xs bg-red-950/80 border border-red-800 text-red-200 rounded">
              {verifyError}
            </div>
          )}

          {verificationResult !== null && (
            <div
              className={`p-4 rounded-lg border flex items-start gap-3 transition-colors ${
                verificationResult
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                  : 'bg-red-950/40 border-red-800 text-red-200'
              }`}
            >
              {verificationResult ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-semibold text-sm">
                  {verificationResult
                    ? '✓ 署名が有効です（VERIFICATION PASSED）'
                    : '✕ 署名が無効です（VERIFICATION FAILED）'}
                </div>
                <p className="text-xs opacity-90 leading-relaxed">
                  {verificationResult
                    ? '指定された公開鍵と署名データが完全に一致し、データが送信後に改ざんされていないことが証明されました。'
                    : 'データの内容が改ざんされているか、公開鍵または署名データが一致しません。アルゴリズムや入力データをご確認ください。'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
