import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Download,
  Smartphone,
  Monitor,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  X,
  ShieldCheck,
  Zap,
  WifiOff,
  Share2,
  PlusSquare,
  HelpCircle,
} from 'lucide-react';

interface Props {
  variant?: 'header' | 'drawer' | 'sidebar';
}

export const PWAInstallButton: React.FC<Props> = ({ variant = 'header' }) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isDesktop,
    isInIframe,
    install,
  } = usePWAInstall();

  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'auto' | 'pc' | 'android' | 'ios'>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'pc'
  );

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const handleButtonClick = async () => {
    // If the browser provides the native one-click prompt (and not in iframe):
    if (isInstallable && !isInIframe) {
      const outcome = await install();
      if (!outcome) {
        // User dismissed or something failed, open guide modal to explain
        setShowModal(true);
      }
    } else {
      // Show full guide modal with environment-specific instructions
      setShowModal(true);
    }
  };

  // If already running as an installed PWA (standalone)
  if (isInstalled) {
    if (variant === 'header') {
      return (
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
          title="PWAスタンドアロンモードで動作中（オフライン利用可能）"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden sm:inline">PWA稼働中</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <div className="font-semibold text-emerald-200">PWAインストール済み</div>
          <div className="text-[10px] text-emerald-400/80">スタンドアロン起動 / 完全オフライン対応</div>
        </div>
      </div>
    );
  }

  // Not yet installed: Always show the install button so user is never confused!
  return (
    <>
      {variant === 'header' && (
        <button
          onClick={handleButtonClick}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm transition-all shadow-indigo-900/30 shrink-0 cursor-pointer"
          title="アプリを端末にインストール (PWA) / ガイドを表示"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">PWAインストール</span>
          <span className="sm:hidden">インストール</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          onClick={handleButtonClick}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-medium transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>アプリをインストール (PWA)</span>
          </div>
          <HelpCircle className="w-3 h-3 text-indigo-400/70" />
        </button>
      )}

      {variant === 'drawer' && (
        <button
          onClick={handleButtonClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>アプリを端末にインストール (PWA)</span>
        </button>
      )}

      {/* Comprehensive PWA Installation Modal / Guide */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    CryptoVault をインストール
                  </h3>
                  <p className="text-xs text-slate-400">
                    ブラウザ標準PWA技術によるネイティブ感覚のローカル実行
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Install CTA button if browser natively supports it right now */}
            {isInstallable && !isInIframe && (
              <div className="p-3.5 rounded-xl bg-indigo-950/70 border border-indigo-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-indigo-200">
                  ブラウザのネイティブインストール準備が完了しています。
                </div>
                <button
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setShowModal(false);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  今すぐインストール実行
                </button>
              </div>
            )}

            {/* AI Studio iframe Warning Notice */}
            {isInIframe && (
              <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-800/60 text-xs text-amber-200 space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                  <span>⚠️ AI Studioプレビュー（iframe内）で表示されています</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Webブラウザのセキュリティ仕様により、埋め込みプレビュー枠内からは直接インストーラーを起動できません。
                  下のボタンで<strong>別タブ（直接URL）</strong>を開いていただくと、ブラウザのアドレスバーから即座にインストール可能になります。
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleOpenNewTab}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    新しいタブで開く (直接URL)
                  </button>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'URLをコピーしました' : 'URLをコピー'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Platform Selector Tabs */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>端末・ブラウザごとの手順</span>
                <span className="text-[11px] text-slate-500">
                  {isDesktop ? 'PC環境' : isIOS ? 'iOS端末' : 'Android端末'} を検出
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveGuideTab('pc')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                    activeGuideTab === 'pc'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>PC (Chrome/Edge)</span>
                </button>
                <button
                  onClick={() => setActiveGuideTab('android')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                    activeGuideTab === 'android'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Android</span>
                </button>
                <button
                  onClick={() => setActiveGuideTab('ios')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                    activeGuideTab === 'ios'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>iPhone / iPad</span>
                </button>
              </div>

              {/* Guide Contents */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5 text-xs text-slate-300">
                {activeGuideTab === 'pc' && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        1
                      </span>
                      <div>
                        ブラウザのアドレスバー（URL欄）右端にある{' '}
                        <strong className="text-white">『インストール』アイコン</strong>（
                        <Download className="w-3 h-3 inline text-indigo-400 mx-0.5" /> または ⊕
                        またはモニタマーク）をクリックします。
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        2
                      </span>
                      <div>
                        または、ブラウザ右上のメニュー(︙)を開き、
                        <strong className="text-white">
                          『アプリをインストール』または『「CryptoVault」をインストール』
                        </strong>
                        を選択します。
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        3
                      </span>
                      <div>
                        確認ダイアログで「インストール」をクリックすると、デスクトップ独立ウィンドウとして登録されます。
                      </div>
                    </div>
                  </>
                )}

                {activeGuideTab === 'android' && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        1
                      </span>
                      <div>
                        Google Chrome右上の <strong className="text-white">メニュー(︙)</strong> をタップします。
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        2
                      </span>
                      <div>
                        メニューから <strong className="text-white">『アプリをインストール』</strong> または{' '}
                        <strong className="text-white">『ホーム画面に追加』</strong> を選択します。
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        3
                      </span>
                      <div>
                        ホーム画面にアプリアイコンが追加され、オフラインでも起動できるようになります。
                      </div>
                    </div>
                  </>
                )}

                {activeGuideTab === 'ios' && (
                  <>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        1
                      </span>
                      <div>
                        Safari下部ツールバーの <strong className="text-white">共有アイコン</strong> (
                        <Share2 className="w-3 h-3 inline text-indigo-400 mx-0.5" />) をタップします。
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        2
                      </span>
                      <div>
                        メニューを下にスクロールし、
                        <strong className="text-white">『ホーム画面に追加』</strong> (
                        <PlusSquare className="w-3 h-3 inline text-indigo-400 mx-0.5" />) をタップします。
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold">
                        3
                      </span>
                      <div>
                        右上の <strong className="text-white">『追加』</strong> をタップします。
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* PWA Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200">完全オフライン</div>
                  <div className="text-[10px] text-slate-400">通信なしでも全機能稼働</div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200">最高セキュリティ</div>
                  <div className="text-[10px] text-slate-400">端末内ローカル完結</div>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-200">高速ネイティブ表示</div>
                  <div className="text-[10px] text-slate-400">ブラウザ枠なし独立起動</div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
};
