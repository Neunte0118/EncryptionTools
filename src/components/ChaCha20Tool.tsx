import React, { useState } from 'react';
import { chacha20EncryptWithPassword, chacha20DecryptWithPassword } from '../utils/chachaUtils';
import { Lock, Unlock, Copy, Check, ShieldCheck, Eye, EyeOff, RefreshCw, KeyRound, Sparkles } from 'lucide-react';

export const ChaCha20Tool: React.FC = () => {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [plaintext, setPlaintext] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ciphertext, setCiphertext] = useState('');
  const [decryptedText, setDecryptedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCiphertext('');
    if (!plaintext.trim()) return setError('平文を入力してください');
    if (!password.trim()) return setError('暗号化パスワードを入力してください');

    setIsProcessing(true);
    try {
      const res = await chacha20EncryptWithPassword(plaintext, password.trim());
      setCiphertext(res.combinedBase64);
    } catch (err: any) {
      setError(`ChaCha20暗号化エラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDecryptedText('');
    if (!ciphertext.trim()) return setError('暗号文を入力してください');
    if (!password.trim()) return setError('パスワードを入力してください');

    setIsProcessing(true);
    try {
      const res = await chacha20DecryptWithPassword(ciphertext.trim(), password.trim());
      if (res.text !== undefined) {
        setDecryptedText(res.text);
      } else {
        setDecryptedText(`[バイナリデータ: ${res.buffer.byteLength} bytes]`);
      }
    } catch (err: any) {
      setError(err.message || '復号に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">ChaCha20-Poly1305 暗号</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 border border-emerald-800/80 text-emerald-300">
                IETF RFC 8439 AEAD
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AES-GCM と並ぶ現代の最高峰ストリーム暗号。WireGuard、TLS 1.3、SSHで標準採用されている高速認証付き暗号です。
            </p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-800">
        <button
          type="button"
          onClick={() => setMode('encrypt')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            mode === 'encrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>ChaCha20 暗号化</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('decrypt')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            mode === 'decrypt'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Unlock className="w-3.5 h-3.5" />
          <span>ChaCha20 復号</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <form onSubmit={mode === 'encrypt' ? handleEncrypt : handleDecrypt} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {mode === 'encrypt' ? '平文メッセージ' : '暗号文 (Base64形式)'}
              </label>
              <textarea
                value={mode === 'encrypt' ? plaintext : ciphertext}
                onChange={(e) => mode === 'encrypt' ? setPlaintext(e.target.value) : setCiphertext(e.target.value)}
                rows={5}
                placeholder={mode === 'encrypt' ? '暗号化したいテキストを入力...' : 'ChaCha20 暗号化Base64文字列を貼り付け...'}
                required
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                パスワード (PBKDF2-SHA256 で256bit鍵を導出)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="暗号化・復号パスワード"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>処理中...</span>
                </>
              ) : mode === 'encrypt' ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>ChaCha20-Poly1305 で暗号化</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>ChaCha20-Poly1305 で復号</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-3">
            {mode === 'encrypt' ? '暗号化結果' : '復号平文'}
          </h3>

          {mode === 'encrypt' && ciphertext ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>暗号化完了 (Poly1305 認証タグ付き)</span>
              </div>
              <textarea
                readOnly
                rows={8}
                value={ciphertext}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 select-all"
              />
              <button
                type="button"
                onClick={() => handleCopy(ciphertext, 'chacha-cipher')}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
              >
                {copiedKey === 'chacha-cipher' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'chacha-cipher' ? 'コピー完了' : '暗号文をコピー'}</span>
              </button>
            </div>
          ) : mode === 'decrypt' && decryptedText ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>改ざんなし・完全性検証合格</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 max-h-64 overflow-y-auto whitespace-pre-wrap select-all">
                {decryptedText}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(decryptedText, 'chacha-plain')}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
              >
                {copiedKey === 'chacha-plain' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'chacha-plain' ? 'コピー完了' : '平文をコピー'}</span>
              </button>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2 text-xs">
              左のフォームで実行してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
