import React, { useState, useEffect, useRef } from 'react';
import { loadWebTorrent, PUBLIC_TRACKERS, formatBytes, formatSpeed } from '../utils/webtorrentLoader';
import { TorrentIPChecker } from './TorrentIPChecker';
import {
  Share2,
  Download,
  Upload,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  ShieldAlert,
  HardDrive,
  Users,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  Info,
  CheckCircle2,
  RefreshCw,
  Clock,
  Radio,
  FileCheck,
  Film,
  Music,
  Image as ImageIcon,
} from 'lucide-react';

interface TorrentItem {
  id: string; // infoHash
  name: string;
  magnetURI: string;
  infoHash: string;
  totalLength: number;
  downloaded: number;
  uploaded: number;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number; // 0 to 1
  numPeers: number;
  timeRemaining: number; // ms or Infinity
  isDone: boolean;
  isSeedingOnly: boolean;
  files: {
    name: string;
    length: number;
    path: string;
    blobUrl?: string;
  }[];
  rawTorrent?: any;
}

export function WebTorrentTool() {
  const [client, setClient] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [torrents, setTorrents] = useState<TorrentItem[]>([]);
  const [magnetInput, setMagnetInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // File upload state for seeding
  const [seedFiles, setSeedFiles] = useState<FileList | null>(null);
  const [customTorrentName, setCustomTorrentName] = useState('');
  const [isSeedingLoading, setIsSeedingLoading] = useState(false);

  // Global tracker selection
  const [trackers, setTrackers] = useState<string[]>(PUBLIC_TRACKERS);
  const [customTracker, setCustomTracker] = useState('');

  // UI state
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedMagnet, setCopiedMagnet] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize WebTorrent Client
  useEffect(() => {
    let activeClient: any = null;

    async function init() {
      setIsInitializing(true);
      setInitError(null);
      try {
        const WebTorrent = await loadWebTorrent();
        activeClient = new WebTorrent({
          tracker: {
            rtcConfig: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
              ],
            },
          },
        });

        activeClient.on('error', (err: any) => {
          console.error('[WebTorrent Error]', err);
        });

        setClient(activeClient);
      } catch (err: any) {
        console.error('Failed to init WebTorrent:', err);
        setInitError(err.message || 'WebTorrentの初期化に失敗しました。');
      } finally {
        setIsInitializing(false);
      }
    }

    init();

    return () => {
      if (activeClient) {
        try {
          activeClient.destroy();
        } catch (e) {
          console.error('Error destroying client', e);
        }
      }
    };
  }, []);

  // Sync torrent status tick
  useEffect(() => {
    if (!client) return;

    const interval = setInterval(() => {
      if (!client.torrents || client.torrents.length === 0) {
        setTorrents([]);
        return;
      }

      const updatedList: TorrentItem[] = client.torrents.map((t: any) => {
        const files = (t.files || []).map((f: any) => ({
          name: f.name,
          length: f.length,
          path: f.path,
        }));

        return {
          id: t.infoHash,
          name: t.name || 'Unnamed Torrent',
          magnetURI: t.magnetURI,
          infoHash: t.infoHash,
          totalLength: t.length || 0,
          downloaded: t.downloaded || 0,
          uploaded: t.uploaded || 0,
          downloadSpeed: t.downloadSpeed || 0,
          uploadSpeed: t.uploadSpeed || 0,
          progress: t.progress || 0,
          numPeers: t.numPeers || 0,
          timeRemaining: t.timeRemaining || Infinity,
          isDone: t.done || t.progress >= 1,
          isSeedingOnly: t.uploaded > 0 && t.downloaded === 0,
          files,
          rawTorrent: t,
        };
      });

      setTorrents(updatedList);
    }, 1000);

    return () => clearInterval(interval);
  }, [client]);

  // Seed files
  const handleSeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !seedFiles || seedFiles.length === 0) return;

    setIsSeedingLoading(true);
    try {
      const fileArray = Array.from(seedFiles);
      const opts: any = {
        announce: trackers,
      };
      if (customTorrentName.trim()) {
        opts.name = customTorrentName.trim();
      }

      client.seed(fileArray, opts, (torrent: any) => {
        setIsSeedingLoading(false);
        setSeedFiles(null);
        setCustomTorrentName('');
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Immediate state update
        setTorrents((prev) => {
          if (prev.find((x) => x.id === torrent.infoHash)) return prev;
          return [
            ...prev,
            {
              id: torrent.infoHash,
              name: torrent.name || 'Seeding',
              magnetURI: torrent.magnetURI,
              infoHash: torrent.infoHash,
              totalLength: torrent.length || 0,
              downloaded: torrent.length || 0,
              uploaded: 0,
              downloadSpeed: 0,
              uploadSpeed: 0,
              progress: 1,
              numPeers: 0,
              timeRemaining: 0,
              isDone: true,
              isSeedingOnly: true,
              files: (torrent.files || []).map((f: any) => ({
                name: f.name,
                length: f.length,
                path: f.path,
              })),
              rawTorrent: torrent,
            },
          ];
        });
      });
    } catch (err: any) {
      alert('シードの開始に失敗しました: ' + (err.message || String(err)));
      setIsSeedingLoading(false);
    }
  };

  // Add torrent by magnet link or hash
  const handleAddTorrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !magnetInput.trim()) return;

    let torrentId = magnetInput.trim();
    // If it's a 40-char hex infohash, prefix with magnet
    if (/^[0-9a-fA-F]{40}$/.test(torrentId)) {
      torrentId = `magnet:?xt=urn:btih:${torrentId}`;
    }

    setIsAdding(true);
    try {
      client.add(
        torrentId,
        {
          announce: trackers,
        },
        (torrent: any) => {
          setIsAdding(false);
          setMagnetInput('');
          torrent.on('error', (err: any) => {
            console.error('Torrent error:', err);
          });
        }
      );
    } catch (err: any) {
      alert('Torrentの追加に失敗しました: ' + (err.message || String(err)));
      setIsAdding(false);
    }
  };

  // Remove torrent
  const handleRemove = (infoHash: string) => {
    if (!client) return;
    const torrent = client.torrents.find((t: any) => t.infoHash === infoHash);
    if (torrent) {
      torrent.destroy(() => {
        setTorrents((prev) => prev.filter((t) => t.id !== infoHash));
      });
    } else {
      setTorrents((prev) => prev.filter((t) => t.id !== infoHash));
    }
  };

  // Download a single file to browser disk
  const handleDownloadFile = (rawTorrent: any, fileName: string) => {
    if (!rawTorrent || !rawTorrent.files) return;
    const targetFile = rawTorrent.files.find((f: any) => f.name === fileName);
    if (!targetFile) return;

    targetFile.getBlob((err: any, blob: Blob) => {
      if (err) {
        alert('ダウンロードエラー: ' + err.message);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  };

  // Preview media or text
  const handlePreviewFile = (rawTorrent: any, fileName: string) => {
    if (!rawTorrent || !rawTorrent.files) return;
    const targetFile = rawTorrent.files.find((f: any) => f.name === fileName);
    if (!targetFile) return;

    targetFile.getBlob((err: any, blob: Blob) => {
      if (err) {
        alert('プレビューエラー: ' + err.message);
        return;
      }
      const url = URL.createObjectURL(blob);
      let type = 'unknown';
      if (blob.type.startsWith('video/')) type = 'video';
      else if (blob.type.startsWith('audio/')) type = 'audio';
      else if (blob.type.startsWith('image/')) type = 'image';
      else if (blob.type.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.json') || fileName.endsWith('.md'))
        type = 'text';

      setPreviewFile({ name: targetFile.name, url, type });
    });
  };

  const copyToClipboard = (text: string, type: 'hash' | 'magnet') => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(text);
      setTimeout(() => setCopiedHash(null), 2000);
    } else {
      setCopiedMagnet(text);
      setTimeout(() => setCopiedMagnet(null), 2000);
    }
  };

  const addTracker = () => {
    if (customTracker.trim() && !trackers.includes(customTracker.trim())) {
      setTrackers([...trackers, customTracker.trim()]);
      setCustomTracker('');
    }
  };

  const removeTracker = (t: string) => {
    setTrackers(trackers.filter((item) => item !== t));
  };

  return (
    <div className="space-y-6">
      {/* Header & Concept Explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Share2 className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                WebTorrent 分散P2Pファイル共有 (BitTorrent on WebRTC)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              ブラウザ同士がWebRTCメッシュで直接繋がり、ファイルを細かくチャンク（ブロック）分割して群衆（Swarm）で相互分散配信します。
              サーバーにファイルを保存することなく、マグネットリンクひとつでP2P送受信が可能です。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">アクティブ</span>
                <span className="font-semibold text-emerald-400">{torrents.length} 件</span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <span className="text-slate-500 block">総DL速度</span>
                <span className="font-mono text-cyan-400">
                  {formatSpeed(torrents.reduce((acc, t) => acc + t.downloadSpeed, 0))}
                </span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <span className="text-slate-500 block">総UL速度</span>
                <span className="font-mono text-amber-400">
                  {formatSpeed(torrents.reduce((acc, t) => acc + t.uploadSpeed, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & VPN Notice banner */}
        <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-amber-300">プライバシー＆IPアドレスに関する注意事項：</span>
            BitTorrentの仕様上、同じトレント（Swarm）に接続しているピア（受信者・配信者）同士にはWebRTCシグナリングおよび直接通信のためにIPアドレスが共有されます。
            自身のリアルIPアドレスを完全に秘匿したい場合は、**OS側でVPN（ProtonVPN等）を有効にした状態でご利用ください**。
          </div>
        </div>
      </div>

      {/* Real-time Torrent IP & WebRTC VPN Diagnostic Checker */}
      <TorrentIPChecker compact={true} />

      {/* Initialization Status */}
      {isInitializing && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-400 mb-3" />
          <p className="text-sm">WebTorrent WebRTC エンジンを初期化中...</p>
        </div>
      )}

      {initError && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm">WebTorrentエンジンの起動に失敗しました</p>
              <p className="text-xs text-rose-400 mt-1">{initError}</p>
            </div>
          </div>
        </div>
      )}

      {!isInitializing && !initError && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Seeding Box (Upload & Share) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Upload className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm text-slate-200">
                  ファイルをシード（配信開始）
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                ローカルファイルを選択してシードを開始すると、即座にマグネットリンクとInfoHashが発行され、WebRTCを通じて他ピアへ直接配信されます。
              </p>

              <form onSubmit={handleSeed} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    配信するファイルを選択
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={(e) => setSeedFiles(e.target.files)}
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer border border-slate-700/80 rounded-lg p-2 bg-slate-950"
                  />
                  {seedFiles && seedFiles.length > 0 && (
                    <div className="mt-2 text-[11px] text-slate-400 bg-slate-950/70 p-2.5 rounded border border-slate-800">
                      <span className="font-semibold text-slate-300">{seedFiles.length} 個のファイル</span> (合計{' '}
                      {formatBytes(Array.from(seedFiles).reduce((acc, f) => acc + f.size, 0))})
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    トレント名（任意）
                  </label>
                  <input
                    type="text"
                    value={customTorrentName}
                    onChange={(e) => setCustomTorrentName(e.target.value)}
                    placeholder="例: My Shared Documents"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!seedFiles || seedFiles.length === 0 || isSeedingLoading}
                  className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSeedingLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>トレント生成中...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>シード開始 (マグネットリンク発行)</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>シード中は本ブラウザタブを開いたままにしておく必要があります。</span>
            </div>
          </div>

          {/* Download Box (Magnet Link / Hash) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Download className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-sm text-slate-200">
                  マグネットリンクからダウンロード
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                相手から共有されたマグネットリンク（<code>magnet:?xt=urn:btih:...</code>）または40桁のInfoHashを入力して接続します。
              </p>

              <form onSubmit={handleAddTorrent} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    マグネットリンク または InfoHash (40桁HEX)
                  </label>
                  <textarea
                    rows={4}
                    value={magnetInput}
                    onChange={(e) => setMagnetInput(e.target.value)}
                    placeholder="magnet:?xt=urn:btih:... または 40桁のInfoHash"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!magnetInput.trim() || isAdding}
                  className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isAdding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>ピア検索中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>ピアを探索してダウンロード開始</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>パブリックWebRTCトラッカー経由で自動的に配信者ピアとシグナリングを行います。</span>
            </div>
          </div>
        </div>
      )}

      {/* Tracker Settings Accordion */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>使用中のWebRTC WebSocketトラッカー設定 ({trackers.length} 件)</span>
            </div>
            <span className="text-[11px] text-slate-500 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

          <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
            <p className="text-[11px] text-slate-400">
              WebTorrentでは、ブラウザ同士が最初にWebRTC SDPを交換するためにWebSocketトラッカーを利用します。
            </p>

            <div className="flex flex-wrap gap-2">
              {trackers.map((t) => (
                <div
                  key={t}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] font-mono text-slate-300 flex items-center gap-2"
                >
                  <span>{t}</span>
                  <button
                    onClick={() => removeTracker(t)}
                    title="削除"
                    className="text-slate-500 hover:text-rose-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customTracker}
                onChange={(e) => setCustomTracker(e.target.value)}
                placeholder="wss://tracker.example.com"
                className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-slate-200 flex-1 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={addTracker}
                disabled={!customTracker.trim()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs text-slate-200 rounded"
              >
                トラッカー追加
              </button>
            </div>
          </div>
        </details>
      </div>

      {/* Active Torrent Swarms List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm text-slate-200">
              アクティブなトレント一覧 ({torrents.length})
            </h3>
          </div>
          {torrents.length > 0 && (
            <span className="text-[11px] text-slate-400">
              1秒ごとにピア状況・通信速度を自動更新
            </span>
          )}
        </div>

        {torrents.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            現在アクティブなトレントはありません。上のフォームからシードまたはマグネット追加を行ってください。
          </div>
        ) : (
          <div className="space-y-4">
            {torrents.map((t) => (
              <div
                key={t.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`p-1.5 rounded-lg shrink-0 ${
                        t.isDone
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-cyan-500/10 text-cyan-400'
                      }`}
                    >
                      {t.isDone ? (
                        <FileCheck className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4 animate-bounce" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm text-slate-200 truncate">
                        {t.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>合計: {formatBytes(t.totalLength)}</span>
                        <span>•</span>
                        <span>InfoHash: {t.infoHash.substring(0, 10)}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyToClipboard(t.magnetURI, 'magnet')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded text-xs text-slate-300 flex items-center gap-1.5"
                      title="マグネットリンクをコピー"
                    >
                      {copiedMagnet === t.magnetURI ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">コピー完了</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Magnet コピー</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => copyToClipboard(t.infoHash, 'hash')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded text-xs text-slate-300 flex items-center gap-1.5"
                      title="InfoHashをコピー"
                    >
                      {copiedHash === t.infoHash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      <span>Hash</span>
                    </button>

                    <button
                      onClick={() => handleRemove(t.id)}
                      className="p-1.5 bg-slate-900 hover:bg-rose-950/40 border border-slate-700/60 hover:border-rose-500/50 rounded text-slate-400 hover:text-rose-400 transition-colors"
                      title="停止・削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar & Stats */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-300">
                        {(t.progress * 100).toFixed(1)}%
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {formatBytes(t.downloaded)} / {formatBytes(t.totalLength)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Users className="w-3 h-3 text-indigo-400" />
                        ピア: {t.numPeers}
                      </span>
                      <span className="flex items-center gap-1 text-cyan-400">
                        ↓ {formatSpeed(t.downloadSpeed)}
                      </span>
                      <span className="flex items-center gap-1 text-amber-400">
                        ↑ {formatSpeed(t.uploadSpeed)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        t.isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, t.progress * 100))}%` }}
                    />
                  </div>
                </div>

                {/* File list inside this torrent */}
                <div className="mt-3 pt-3 border-t border-slate-850">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                    内包ファイル ({t.files.length})
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {t.files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded text-xs border border-slate-850"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-200 truncate">{file.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                            ({formatBytes(file.length)})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.isDone && (
                            <>
                              <button
                                onClick={() => handlePreviewFile(t.rawTorrent, file.name)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors"
                              >
                                プレビュー
                              </button>
                              <button
                                onClick={() => handleDownloadFile(t.rawTorrent, file.name)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] transition-colors flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>保存</span>
                              </button>
                            </>
                          )}
                          {!t.isDone && (
                            <span className="text-[10px] text-slate-500">DL完了後に保存可能</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Media / File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-sm text-slate-200 truncate pr-4">
                プレビュー: {previewFile.name}
              </h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-lg p-2 border border-slate-800">
              {previewFile.type === 'video' && (
                <video src={previewFile.url} controls autoPlay className="max-h-[55vh] max-w-full rounded" />
              )}
              {previewFile.type === 'audio' && (
                <div className="p-8 w-full text-center">
                  <Music className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                  <audio src={previewFile.url} controls autoPlay className="w-full" />
                </div>
              )}
              {previewFile.type === 'image' && (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[55vh] max-w-full object-contain rounded"
                />
              )}
              {previewFile.type === 'text' && (
                <iframe
                  src={previewFile.url}
                  title="Text Preview"
                  className="w-full h-80 bg-white text-black rounded"
                />
              )}
              {previewFile.type === 'unknown' && (
                <div className="py-8 text-center text-xs text-slate-400">
                  このファイル形式はブラウザ内直接プレビューに対応していません。「保存」を押して端末にダウンロードしてください。
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <a
                href={previewFile.url}
                download={previewFile.name}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ディスクに保存</span>
              </a>
              <button
                onClick={() => setPreviewFile(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
