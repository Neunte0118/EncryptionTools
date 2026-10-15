import React, { useState, useRef } from 'react';
import { generateSelfDecryptingHtml } from '../utils/selfDecryptingPackage';
import {
  FileCode,
  Lock,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  Upload,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

export const SelfDecryptingPackageTool: React.FC = () => {
  const [contentType, setContentType] = useState<'text' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; buffer: ArrayBuffer; size: number } | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState('secure-package.html');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setSelectedFile({
        name: file.name,
        buffer: evt.target?.result as ArrayBuffer,
        size: file.size,
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGeneratedHtml(null);

    if (!password.trim()) return setError('復号パスワードを入力してください');
    if (contentType === 'text' && !textContent.trim()) return setError('暗号化するテキストを入力してください');
    if (contentType === 'file' && !selectedFile) return setError('暗号化するファイルを選択してください');

    setIsGenerating(true);
    try {
      const html = await generateSelfDecryptingHtml({
        type: contentType,
        textContent: contentType === 'text' ? textContent.trim() : undefined,
        fileData: contentType === 'file' ? selectedFile!.buffer : undefined,
        fileName: contentType === 'file' ? selectedFile!.name : undefined,
        password: password.trim(),
        title: title.trim() || undefined,
        hint: hint.trim() || undefined,
      });

      setGeneratedHtml(html);
      setOutputFilename(
        contentType === 'file' && selectedFile
          ? `secure-${selectedFile.name}.html`
          : 'secure-package.html'
      );
    } catch (err: any) {
      setError(`生成エラー: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Clean Minimal Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <FileCode className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">自己復号ファイル生成</h2>
        </div>
        <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setContentType('text')}
            className={`px-3 py-1 rounded transition-colors ${
              contentType === 'text' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            テキスト
          </button>
          <button
            type="button"
            onClick={() => setContentType('file')}
            className={`px-3 py-1 rounded transition-colors ${
              contentType === 'file' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ファイル
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Form */}
        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          {contentType === 'text' ? (
            <div>
              <label className="block text-slate-300 font-medium mb-1">暗号化する本文</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                placeholder="秘密メッセージを入力..."
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-slate-300 font-medium mb-1">暗号化するファイル</label>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center cursor-pointer bg-slate-900"
              >
                <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                {selectedFile ? (
                  <div className="text-indigo-400 font-medium truncate">{selectedFile.name}</div>
                ) : (
                  <div className="text-slate-400">ファイルを選択</div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1">復号パスワード (必須)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">タイトル (任意)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 機密文書"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">ヒント (任意)</label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="例: 電話で伝えた合言葉"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>自己復号HTMLを生成</span>
          </button>
        </form>

        {/* Output Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between text-xs">
          <div>
            <h3 className="font-semibold text-slate-200 pb-2 border-b border-slate-800 mb-4">
              出力ファイル
            </h3>

            {generatedHtml ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>HTMLパッケージが生成されました</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    ブラウザで開くだけでオフラインでも解読可能です
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{outputFilename} を保存</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedHtml);
                    setCopiedHtml(true);
                    setTimeout(() => setCopiedHtml(false), 2000);
                  }}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHtml ? 'コピー完了' : 'コードをコピー'}</span>
                </button>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                <FileCode className="w-8 h-8 mx-auto text-slate-600 mb-1" />
                <div>フォームに入力して生成してください</div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 pt-3 border-t border-slate-800">
            受取側に専用アプリは不要です。標準ブラウザのみで復号できます。
          </div>
        </div>
      </div>
    </div>
  );
};
