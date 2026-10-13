import React, { useState, useRef } from 'react';
import { createSelfDecryptingHtml } from '../utils/selfDecryptingPackage';
import {
  FileCode,
  Lock,
  Download,
  Eye,
  EyeOff,
  Upload,
  FileCheck,
  Check,
  Copy,
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw,
  FileText,
} from 'lucide-react';

export const SelfDecryptingPackageTool: React.FC = () => {
  const [contentType, setContentType] = useState<'text' | 'file'>('text');
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [textContent, setTextContent] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fileData, setFileData] = useState<{
    name: string;
    size: number;
    type: string;
    buffer: ArrayBuffer;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState<string>('secure-vault.html');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedHtml, setCopiedHtml] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      setFileData({
        name: file.name,
        size: file.size,
        type: file.type,
        buffer,
      });
      if (!title) {
        setTitle(`${file.name} (暗号化保護)`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setGeneratedHtml(null);

    if (!password) {
      setErrorMsg('暗号化パスワードを指定してください');
      return;
    }

    if (contentType === 'text' && !textContent.trim()) {
      setErrorMsg('暗号化するテキストを入力してください');
      return;
    }

    if (contentType === 'file' && !fileData) {
      setErrorMsg('暗号化するファイルを選択してください');
      return;
    }

    setIsGenerating(true);
    try {
      const dataToEncrypt = contentType === 'text' ? textContent : fileData!.buffer;
      const html = await createSelfDecryptingHtml(dataToEncrypt, password, {
        title: title.trim() || (contentType === 'text' ? '暗号化メッセージ' : `${fileData!.name} (保護中)`),
        hint: hint.trim(),
        payloadType: contentType,
        filename: contentType === 'file' ? fileData!.name : 'secure-message.txt',
        mimeType: contentType === 'file' ? fileData!.type : 'text/plain',
      });

      setGeneratedHtml(html);
      const safeName = (title.trim() || 'encrypted-package')
        .toLowerCase()
        .replace(/[^a-z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF_-]+/g, '-')
        .slice(0, 30);
      setOutputFilename(`${safeName || 'secure-package'}.html`);
    } catch (err: any) {
      setErrorMsg(`生成エラー: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyHtml = () => {
    if (!generatedHtml) return;
    navigator.clipboard.writeText(generatedHtml);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Description Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">自己復号型 HTML パッケージ生成</h2>
            <p className="text-xs text-slate-400">
              パスワードでAES-256暗号化されたメッセージやファイルを、**「ダブルクリックで開くだけで動く単一の.htmlファイル」**として作成します。
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
          受取側のPC・スマホに専用アプリやこのサイトがなくても、ブラウザで開いてパスワードを入力するだけで安全に復号できます。完全ローカルかつオフライン（機内モード）で動作します。
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creation Form */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>暗号化パッケージの構成</span>
            </h3>

            {/* Type Switcher */}
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setContentType('text')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  contentType === 'text'
                    ? 'bg-slate-800 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                テキスト暗号化
              </button>
              <button
                type="button"
                onClick={() => setContentType('file')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  contentType === 'file'
                    ? 'bg-slate-800 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ファイル暗号化
              </button>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4 text-xs">
            {/* Title & Hint */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">パッケージタイトル (任意)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 社外秘プロジェクト情報"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">パスワードのヒント (任意・公開表示)</label>
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="例: 先週のミーティングで伝えた共通合言葉"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">復号用パスワード (必須)</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? '隠す' : '表示'}</span>
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="強固なパスワードを入力してください"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-sm tracking-wide"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                PBKDF2-SHA256 (100,000回反復ストレッチング) と AES-256-GCM により保護されます。
              </span>
            </div>

            {/* Content Input */}
            {contentType === 'text' ? (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">暗号化するテキスト内容</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={6}
                  placeholder="ここに暗号化したいメッセージ、シークレットメモ、認証情報などを入力..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">暗号化するファイル</label>
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
                  {fileData ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-indigo-400 flex items-center justify-center gap-2">
                        <FileCheck className="w-4 h-4" />
                        <span>{fileData.name}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        サイズ: {(fileData.size / 1024).toFixed(1)} KB ({fileData.size.toLocaleString()} bytes)
                      </div>
                      <div className="text-xs text-slate-500 pt-1">
                        クリックして別のファイルを選択
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-slate-200">
                        暗号化したいファイルを選択
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        PDF、画像、文書、バイナリなどあらゆるファイルを埋め込み可能
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>暗号化パッケージを生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>単一の自己復号HTMLファイルを生成</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Output & Download Panel */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>生成されたパッケージ</span>
            </h3>

            {generatedHtml ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>自己復号HTMLパッケージの生成が完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div>ファイル名: <code className="text-indigo-300 font-mono">{outputFilename}</code></div>
                    <div>ファイルサイズ: {(new Blob([generatedHtml]).size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleDownloadHtml}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>.html ファイルをダウンロード</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyHtml}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-slate-700"
                  >
                    {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedHtml ? 'コードをコピーしました' : 'HTMLコードをコピー'}</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                  <div className="font-semibold text-slate-300">受け渡し手順:</div>
                  <div>1. ダウンロードした <code className="text-indigo-300">.html</code> をメールやチャット、USBメモリ等で相手に送付</div>
                  <div>2. 相手はファイルをダブルクリックしてブラウザで開く</div>
                  <div>3. パスワードを入力するだけでブラウザ内で即時復号され、中身を閲覧・保存できます</div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
                <FileCode className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <div className="text-xs">左のフォームに必要事項を入力して「生成」を実行してください</div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-[11px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              100% クライアントサイド完結。生成されたHTMLも完全自己完結型のため、インターネット接続不要で半永久的に復号可能です。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
