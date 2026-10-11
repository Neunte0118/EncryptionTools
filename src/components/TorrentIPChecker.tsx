import React, { useState, useEffect } from 'react';
import {
  runTorrentIPDiagnosis,
  IPDiagnosticResult,
  STUN_SERVERS,
  maskIpAddress,
  maskTextIps,
} from '../utils/ipLeakChecker';
import { loadWebTorrent, PUBLIC_TRACKERS } from '../utils/webtorrentLoader';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Globe,
  Radio,
  Server,
  Network,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  Eye,
  EyeOff,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Users,
  Lock,
} from 'lucide-react';

interface Props {
  compact?: boolean;
}

export function TorrentIPChecker({ compact = false }: Props) {
  const [result, setResult] = useState<IPDiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  // IP表示・非表示（プライバシー・画面共有保護機能）
  const [hideIp, setHideIp] = useState<boolean>(() => {
    return localStorage.getItem('torrent_ip_hide_mode') === 'true';
  });
  const [maskMode, setMaskMode] = useState<'partial' | 'full'>(() => {
    return (localStorage.getItem('torrent_ip_mask_mode') as 'partial' | 'full') || 'partial';
  });
  const [revealedFields, setRevealedFields] = useState<{ [key: string]: boolean }>({});

  const toggleGlobalHide = () => {
    const next = !hideIp;
    setHideIp(next);
    setRevealedFields({});
    localStorage.setItem('torrent_ip_hide_mode', String(next));
  };

  const toggleFieldReveal = (fieldKey: string) => {
    setRevealedFields((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const isFieldMasked = (fieldKey: string) => {
    if (!hideIp) return false;
    return !revealedFields[fieldKey];
  };

  const getDisplayIp = (ip: string | null | undefined, fieldKey: string) => {
    if (!ip) return '検出なし';
    const masked = isFieldMasked(fieldKey);
    return maskIpAddress(ip, masked, maskMode);
  };

  // 外部クライアント（qBittorrent等）向けのテストMagnetセクション
  const [testTorrentClient, setTestTorrentClient] = useState<any>(null);
  const [testMagnetUri, setTestMagnetUri] = useState<string>('');
  const [testInfoHash, setTestInfoHash] = useState<string>('');
  const [detectedClientPeers, setDetectedClientPeers] = useState<
    { ip: string; clientName?: string; time: string }[]
  >([]);
  const [isTestSeeding, setIsTestSeeding] = useState(false);

  const runTest = async () => {
    setIsLoading(true);
    try {
      const res = await runTorrentIPDiagnosis();
      setResult(res);
    } catch (e) {
      console.error('Diagnosis failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  const copyToClipboard = (text: string, isIp: boolean = false) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    if (isIp && hideIp) {
      setCopyNotification('実際のIPアドレスを安全にコピーしました (画面上は非表示を維持)');
    } else {
      setCopyNotification('クリップボードにコピーしました');
    }
    setTimeout(() => {
      setCopiedText(null);
      setCopyNotification(null);
    }, 2800);
  };

  // 外部クライアント向け「Torrent IPテスト用 Magnetリンク」の生成
  const startExternalTorrentIPTest = async () => {
    setIsTestSeeding(true);
    try {
      const WebTorrent = await loadWebTorrent();
      const client = new WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: STUN_SERVERS.map((s) => ({ urls: s })),
          },
        },
      });
      setTestTorrentClient(client);

      // テスト用の超軽量ダミーファイル
      const uniqueId = Math.random().toString(36).substring(2, 9);
      const testBlob = new Blob(
        [
          `IP-Check-Probe-${uniqueId}\nThis is a temporary probe to detect your Torrent Client IP.\nGenerated at: ${new Date().toISOString()}`,
        ],
        { type: 'text/plain' }
      );
      (testBlob as any).name = `vpn-test-probe-${uniqueId}.txt`;

      client.seed(
        [testBlob],
        {
          name: `VPN-IP-Detector-Probe-${uniqueId}`,
          announce: PUBLIC_TRACKERS,
        },
        (torrent: any) => {
          setTestMagnetUri(torrent.magnetURI);
          setTestInfoHash(torrent.infoHash);

          // 相手クライアント（外部ソフト）が接続してきたらIPを記録
          torrent.on('wire', (wire: any, addr: string) => {
            const peerIp = addr || wire.remoteAddress || '相手ピア';
            const clientName = wire.peerExtendedHandshake?.v || wire.type || 'Torrent Client';
            setDetectedClientPeers((prev) => [
              {
                ip: peerIp,
                clientName,
                time: new Date().toLocaleTimeString(),
              },
              ...prev,
            ]);
          });
        }
      );
    } catch (err: any) {
      console.error('External torrent test setup failed:', err);
    }
  };

  const stopExternalTest = () => {
    if (testTorrentClient) {
      try {
        testTorrentClient.destroy();
      } catch {
        // ignore
      }
      setTestTorrentClient(null);
    }
    setTestMagnetUri('');
    setTestInfoHash('');
    setDetectedClientPeers([]);
    setIsTestSeeding(false);
  };

  const getStatusBadge = () => {
    if (!result) return null;
    switch (result.status) {
      case 'protected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4" />
            <span>VPN保護中 / IP難読化済み</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4" />
            <span>一般回線の生IPの可能性あり</span>
          </span>
        );
      case 'danger':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-4 h-4" />
            <span>WebRTC IPリーク検知 (生IP漏洩)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <HelpCircle className="w-4 h-4" />
            <span>判定不可</span>
          </span>
        );
    }
  };

  const rawTorrentIp = result?.webrtcPublicIps[0] || result?.httpIp || '取得中...';
  const rawHttpIp = result?.httpIp || '取得中...';
  const isMatch = result?.webrtcPublicIps[0] && result?.httpIp ? result.webrtcPublicIps[0] === result.httpIp : true;

  if (compact) {
    const displayCompactTorrentIp = isLoading ? '診断中...' : getDisplayIp(rawTorrentIp, 'compact-torrent');
    const isTorrentMasked = isFieldMasked('compact-torrent');

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        {copyNotification && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{copyNotification}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">相手に見えるTorrent通信IP:</span>
                <span className="font-mono text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  {displayCompactTorrentIp}
                  {hideIp && (
                    <button
                      onClick={() => toggleFieldReveal('compact-torrent')}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                      title={isTorrentMasked ? 'このIPを表示する' : 'このIPを伏字にする'}
                    >
                      {isTorrentMasked ? (
                        <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-slate-200" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                  )}
                </span>
                {hideIp && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                    非表示中
                  </span>
                )}
                {result && getStatusBadge()}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {result?.httpIsp ? `ISP/組織: ${result.httpIsp}` : ''}{' '}
                {result?.httpCountry ? `(${result.httpCountry})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* IP表示 / 非表示トグルボタン */}
            <button
              onClick={toggleGlobalHide}
              className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors border ${
                hideIp
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title={hideIp ? 'すべてのIPアドレスを表示する' : '画面上のIPアドレスを非表示（マスク）にする'}
            >
              {hideIp ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
              <span>{hideIp ? 'IP非表示' : 'IP表示'}</span>
            </button>

            <button
              onClick={runTest}
              disabled={isLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>IP再テスト</span>
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs rounded-lg flex items-center gap-1 transition-colors"
            >
              <span>詳細</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 詳細ドロップダウン（コンパクト時） */}
        {showAdvanced && result && (
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block">WebRTC (WebTorrent) 検出IP:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {result.webrtcPublicIps.map(ip => getDisplayIp(ip, 'compact-webrtc')).join(', ') || 'STUN応答待ち / 検出なし'}
                </span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block">HTTP (Webブラウザ) 検出IP:</span>
                <span className="font-mono text-slate-200 font-semibold">{getDisplayIp(rawHttpIp, 'compact-http')}</span>
              </div>
            </div>
            <div className="p-2 bg-slate-950/60 rounded text-[11px] text-slate-400 leading-relaxed">
              {maskTextIps(result.summary, hideIp)}
            </div>
          </div>
        )}
      </div>
    );
  }

  const displayTorrentIp = getDisplayIp(rawTorrentIp, 'webrtc-main');
  const displayHttpIp = getDisplayIp(result?.httpIp, 'http-main');
  const isTorrentFieldMasked = isFieldMasked('webrtc-main');
  const isHttpFieldMasked = isFieldMasked('http-main');

  return (
    <div className="space-y-6">
      {/* トースト通知 */}
      {copyNotification && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyNotification}</span>
        </div>
      )}

      {/* メインヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                Torrent &amp; WebRTC IP漏洩チェッカー (VPN作動診断)
              </h2>
              {hideIp ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>IP非表示モード (保護中)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  <Eye className="w-3 h-3 text-slate-400" />
                  <span>IP表示モード</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              BitTorrent / WebTorrent通信において、相手ピア（配信者・受信者）や外部トラッカーに実際に通知される
              あなたのグローバルIPアドレスをSTUNサーバー経由でリアルタイム検出し、VPNが正常に保護しているか判定します。
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* IP表示 / 非表示トグルボタン */}
            <button
              onClick={toggleGlobalHide}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all shadow-sm ${
                hideIp
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={hideIp ? 'すべてのIPアドレスを表示する' : '画面上のIPアドレスを非表示（マスク）にする'}
            >
              {hideIp ? (
                <>
                  <EyeOff className="w-4 h-4 text-amber-400" />
                  <span>IPを再表示</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span>IPを非表示</span>
                </>
              )}
            </button>

            {/* マスク形式の切り替え（一部伏字 ⇔ 完全伏字） */}
            {hideIp && (
              <button
                onClick={() => {
                  const next = maskMode === 'partial' ? 'full' : 'partial';
                  setMaskMode(next);
                  localStorage.setItem('torrent_ip_mask_mode', next);
                }}
                className="px-3 py-2 bg-slate-950 border border-slate-800 hover:bg-slate-900 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
                title="伏字のスタイルを切り替えます"
              >
                {maskMode === 'partial' ? '一部伏字 (203.0.***.***)' : '完全伏字 (***.***.***.***)'}
              </button>
            )}

            <button
              onClick={runTest}
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>IPアドレスを再診断</span>
            </button>
          </div>
        </div>
      </div>

      {/* 診断結果カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Torrent / WebRTC 通信IP */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-xs text-slate-300">
                相手ピアに伝わる Torrent (WebRTC) IP
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {isTorrentFieldMasked && (
                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                  非表示保護中
                </span>
              )}
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                STUN srflx
              </span>
            </div>
          </div>

          <div className="my-2">
            {isLoading ? (
              <div className="h-8 flex items-center text-xs text-slate-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>STUNサーバーへ問い合わせ中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-mono font-bold text-slate-100 tracking-wide">
                  {displayTorrentIp}
                </span>

                {/* 個別表示・非表示トグル */}
                {rawTorrentIp && rawTorrentIp !== '検出なし' && rawTorrentIp !== '取得中...' && (
                  <button
                    onClick={() => toggleFieldReveal('webrtc-main')}
                    className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded text-xs transition-colors"
                    title={isTorrentFieldMasked ? 'このIPを表示する' : 'このIPを非表示にする'}
                  >
                    {isTorrentFieldMasked ? (
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </button>
                )}

                {/* コピーボタン（非表示時でも安全にクリップボードへコピー可能） */}
                {rawTorrentIp && rawTorrentIp !== '検出なし' && rawTorrentIp !== '取得中...' && (
                  <button
                    onClick={() => copyToClipboard(rawTorrentIp, true)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded text-xs transition-colors"
                    title="IPをクリップボードにコピー"
                  >
                    {copiedText === rawTorrentIp ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            WebTorrentが相手ピアと直接P2Pデータ転送を行う際、WebRTCのICE candidateとして相手に開示されるパブリックIPアドレスです。
          </p>

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>STUN応答元: Google / Twilio</span>
            <span className="font-mono text-slate-400">UDP</span>
          </div>
        </div>

        {/* Webブラウザ (HTTP) IP */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-xs text-slate-300">
                通常のWebアクセス (HTTP) IP
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {isHttpFieldMasked && (
                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                  非表示保護中
                </span>
              )}
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                Public HTTP
              </span>
            </div>
          </div>

          <div className="my-2">
            {isLoading ? (
              <div className="h-8 flex items-center text-xs text-slate-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>HTTP IP確認中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-mono font-bold text-slate-100 tracking-wide">
                  {displayHttpIp}
                </span>

                {/* 個別表示・非表示トグル */}
                {result?.httpIp && (
                  <button
                    onClick={() => toggleFieldReveal('http-main')}
                    className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded text-xs transition-colors"
                    title={isHttpFieldMasked ? 'このIPを表示する' : 'このIPを非表示にする'}
                  >
                    {isHttpFieldMasked ? (
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </button>
                )}

                {/* コピーボタン */}
                {result?.httpIp && (
                  <button
                    onClick={() => copyToClipboard(result.httpIp!, true)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded text-xs transition-colors"
                    title="IPをクリップボードにコピー"
                  >
                    {copiedText === result.httpIp ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
            <div>
              <span className="text-slate-500">ISP / 組織: </span>
              <span className="text-slate-300 font-medium">
                {result?.httpIsp || result?.httpOrg || '不明'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">所在地 / 国: </span>
              <span className="text-slate-300">
                {result?.httpCity ? `${result.httpCity}, ` : ''}
                {result?.httpCountry || '不明'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>プロトコル: TCP/HTTPS</span>
            <span className="font-mono text-slate-400">Web Traffic</span>
          </div>
        </div>
      </div>

      {/* 判定サマリー & アラート */}
      {result && (
        <div
          className={`rounded-xl p-5 border shadow-sm ${
            result.status === 'protected'
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              : result.status === 'warning'
              ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              : result.status === 'danger'
              ? 'bg-rose-950/25 border-rose-500/40 text-rose-200'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              {result.status === 'protected' && <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />}
              {result.status === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />}
              {result.status === 'danger' && <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />}
              {result.status === 'unknown' && <HelpCircle className="w-6 h-6 text-slate-400 shrink-0" />}
              <div>
                <h3 className="font-bold text-sm text-slate-100">{maskTextIps(result.summary, hideIp)}</h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  最終診断時刻: {result.testedAt.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div>{getStatusBadge()}</div>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {result.details.map((d, idx) => (
              <p key={idx} className="leading-relaxed opacity-90">
                • {maskTextIps(d, hideIp)}
              </p>
            ))}
          </div>

          {!isMatch && (
            <div className="mt-3 p-3 bg-rose-950/50 rounded-lg border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">注意: </span>
                Web通信のIP ({getDisplayIp(rawHttpIp, 'warn-http')}) と WebRTCのIP ({getDisplayIp(rawTorrentIp, 'warn-webrtc')}) が一致していません。
                ブラウザ拡張VPNの「WebRTC漏洩対策」が無効になっているか、VPNを通さない直結ルートが存在する可能性があります。
              </div>
            </div>
          )}
        </div>
      )}

      {/* VPNが本当に作動しているか確かめる3ステップガイド */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-sm text-slate-200">
            VPNが本当に作動しているか確かめる3ステップ
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-850">
            <span className="inline-block px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-bold mb-2">
              STEP 1: VPNをOFFにして確認
            </span>
            <p className="text-slate-300 leading-relaxed">
              まずVPNを切断した状態でこの画面の「IPアドレスを再診断」を押し、あなたの契約している自宅プロバイダのIPをメモします。
            </p>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-855">
            <span className="inline-block px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-[10px] font-bold mb-2">
              STEP 2: VPNをONにして再診断
            </span>
            <p className="text-slate-300 leading-relaxed">
              Windows 10のVPNアプリ（ProtonVPN等）を接続状態にして、再度「IPアドレスを再診断」ボタンを押します。
            </p>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-850">
            <span className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold mb-2">
              STEP 3: 変化を照合
            </span>
            <p className="text-slate-300 leading-relaxed">
              「Torrent(WebRTC) IP」と「HTTP IP」が両方ともSTEP 1と全く違うIP（海外またはVPN会社名）に切り替わっていれば完全成功です！
            </p>
          </div>
        </div>
      </div>

      {/* 外部Torrentクライアント（qBittorrent / μTorrent等）向け IP確認機能 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-sm text-slate-200">
                外部Torrentクライアント (qBittorrent等) のIPテスト
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              WindowsにインストールしたTorrentソフト（qBittorrent, BitComet等）でVPNが効いているか確認するためのテスト用プローブMagnetリンクを発行します。
            </p>
          </div>

          <div>
            {!isTestSeeding ? (
              <button
                onClick={startExternalTorrentIPTest}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>テスト用Magnetリンクを発行</span>
              </button>
            ) : (
              <button
                onClick={stopExternalTest}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                テスト終了・停止
              </button>
            )}
          </div>
        </div>

        {isTestSeeding && (
          <div className="mt-4 p-4 bg-slate-950 border border-purple-500/30 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs text-purple-300 font-semibold">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span>テスト用トレント待機中... 外部ソフトで下記のリンクを開いてください</span>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                テスト用マグネットリンク（qBittorrent等に貼り付けてください）:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={testMagnetUri || '生成中...'}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 flex-1 focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(testMagnetUri)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded font-medium flex items-center gap-1 shrink-0"
                >
                  {copiedText === testMagnetUri ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>コピー完了</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Magnetコピー</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 接続検知ログ */}
            <div className="mt-3 pt-3 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                接続検知ログ（あなたのTorrentソフトから当画面へ届いたIP）:
              </span>

              {detectedClientPeers.length === 0 ? (
                <div className="text-xs text-slate-500 p-3 bg-slate-900/60 rounded border border-slate-800/80">
                  まだ外部ソフトからの接続はありません。Torrentソフトで上記リンクを追加すると、ここに検出されたIPが表示されます。
                </div>
              ) : (
                <div className="space-y-2">
                  {detectedClientPeers.map((peer, idx) => {
                    const masked = isFieldMasked(`client-peer-${idx}`);
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <Users className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300 font-bold">
                            {getDisplayIp(peer.ip, `client-peer-${idx}`)}
                          </span>
                          {hideIp && (
                            <button
                              onClick={() => toggleFieldReveal(`client-peer-${idx}`)}
                              className="p-1 text-slate-400 hover:text-slate-200"
                              title={masked ? '表示する' : '非表示にする'}
                            >
                              {masked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-amber-400" />}
                            </button>
                          )}
                          <span className="text-slate-400 text-[11px]">({peer.clientName})</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">{peer.time}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WebRTC Candidate 詳細技術インスペクター */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>
                技術詳細: WebRTC ICE Candidates (STUN解決パケットログ:{' '}
                {result?.allCandidates.length || 0} 件)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

          <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
            <p className="text-[11px] text-slate-400">
              WebTorrentやWebRTCがNAT/ルーターを越えて直接通信するために生成したICE candidateの一覧です。
              <code>typ srflx</code>（Server Reflexive）行に表示されているIPが、外部から見えるあなたのIPアドレスです。
              {hideIp && '（※現在は非表示モードのため、IP部分は安全にマスキングされています）'}
            </p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {result?.allCandidates.map((c, i) => (
                <div
                  key={i}
                  className="p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-300 flex items-center justify-between border border-slate-850"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        c.type === 'srflx'
                          ? 'bg-amber-500/20 text-amber-300 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {c.type}
                    </span>
                    <span className="font-semibold text-slate-100">{getDisplayIp(c.ip, `cand-${i}`)}</span>
                    {c.port && <span className="text-slate-500">:{c.port}</span>}
                    {c.protocol && <span className="text-slate-500">({c.protocol})</span>}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate max-w-xs ml-2">
                    {maskTextIps(c.raw, hideIp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
