/**
 * IP & WebRTC Leak Detection Utility
 * BitTorrent / WebTorrent通信において外部（相手ピア・STUN・トラッカー）に露出するIPアドレスを検出します。
 */

export interface IPDiagnosticResult {
  httpIp: string | null;
  httpCountry?: string;
  httpCity?: string;
  httpOrg?: string;
  httpIsp?: string;

  webrtcPublicIps: string[];
  webrtcLocalIps: string[];
  allCandidates: {
    type: string;
    ip: string;
    port?: number;
    protocol?: string;
    raw: string;
  }[];

  status: 'protected' | 'warning' | 'danger' | 'unknown';
  summary: string;
  details: string[];
  testedAt: Date;
}

// 信頼できるSTUNサーバー（WebTorrentの既定構成と同一）
export const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:global.stun.twilio.com:3478',
];

/**
 * WebRTCのRTCPeerConnectionを利用して、STUNサーバー経由で外部に露出するIP（srflx）を検出
 */
export async function detectWebRTCIPs(timeoutMs: number = 4000): Promise<{
  publicIps: string[];
  localIps: string[];
  candidates: { type: string; ip: string; port?: number; protocol?: string; raw: string }[];
}> {
  return new Promise((resolve) => {
    const publicIps = new Set<string>();
    const localIps = new Set<string>();
    const candidates: { type: string; ip: string; port?: number; protocol?: string; raw: string }[] = [];

    // WebRTC未対応ブラウザ対策
    const RTCPC =
      window.RTCPeerConnection ||
      (window as any).webkitRTCPeerConnection ||
      (window as any).mozRTCPeerConnection;

    if (!RTCPC) {
      resolve({
        publicIps: [],
        localIps: [],
        candidates: [],
      });
      return;
    }

    let pc: RTCPeerConnection | null = null;
    let timer: any = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (pc) {
        try {
          pc.close();
        } catch {
          // ignore
        }
        pc = null;
      }
    };

    const finish = () => {
      cleanup();
      resolve({
        publicIps: Array.from(publicIps),
        localIps: Array.from(localIps),
        candidates,
      });
    };

    try {
      pc = new RTCPC({
        iceServers: STUN_SERVERS.map((url) => ({ urls: url })),
      });

      // ダミーのデータチャネルを作成してICE Candidateをトリガー
      pc.createDataChannel('torrent-ip-detector');

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (!event || !event.candidate) {
          // ICE gathering complete or null candidate
          return;
        }

        const cand = event.candidate;
        const raw = cand.candidate;
        const candidateType = cand.type || 'unknown';

        // candidate文字列をパース: candidate:foundation component protocol priority ip port typ type ...
        const parts = raw.split(' ');
        let ip = cand.address || '';
        let port = cand.port || undefined;
        let protocol: string | undefined = cand.protocol || undefined;

        if (!ip && parts.length > 4) {
          ip = parts[4];
        }
        if (!port && parts.length > 5) {
          port = parseInt(parts[5], 10);
        }
        if (!protocol && parts.length > 2) {
          protocol = parts[2].toLowerCase();
        }

        candidates.push({
          type: candidateType,
          ip: ip || 'unknown',
          port,
          protocol,
          raw,
        });

        // srflx (server reflexive) = STUNサーバーから見えたパブリックIP
        if (candidateType === 'srflx' && ip) {
          if (!ip.endsWith('.local') && !ip.includes(':')) {
            // IPv4パブリックIP
            publicIps.add(ip);
          } else if (ip.includes(':')) {
            // IPv6パブリックIP
            publicIps.add(ip);
          }
        } else if (candidateType === 'host' && ip) {
          if (!ip.endsWith('.local')) {
            localIps.add(ip);
          }
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc?.iceGatheringState === 'complete') {
          finish();
        }
      };

      // オファーを作成してローカルディスクリプションにセット
      pc.createOffer()
        .then((offer) => pc?.setLocalDescription(offer))
        .catch(() => {
          finish();
        });

      // タイムアウト設定
      timer = setTimeout(() => {
        finish();
      }, timeoutMs);
    } catch (e) {
      console.error('WebRTC detection failed:', e);
      cleanup();
      resolve({
        publicIps: [],
        localIps: [],
        candidates: [],
      });
    }
  });
}

/**
 * 通常のHTTPアクセスで検知されるパブリックIPを取得（複数APIでフォールバック）
 */
export async function fetchHttpPublicIP(): Promise<{
  ip: string | null;
  country?: string;
  city?: string;
  org?: string;
  isp?: string;
}> {
  // 1. ipwho.is (無料・CORS対応・ISP情報あり)
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.ip) {
        return {
          ip: data.ip,
          country: data.country || data.country_code,
          city: data.city,
          org: data.connection?.org || data.connection?.asn,
          isp: data.connection?.isp,
        };
      }
    }
  } catch {
    // fallback
  }

  // 2. ipapi.co (フォールバック)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          ip: data.ip,
          country: data.country_name || data.country,
          city: data.city,
          org: data.org,
          isp: data.org,
        };
      }
    }
  } catch {
    // fallback
  }

  // 3. ipify (純粋なIPのみ)
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          ip: data.ip,
        };
      }
    }
  } catch {
    // fallback
  }

  return { ip: null };
}

/**
 * 包括的な診断を実行し、安全度と警告を判定
 */
export async function runTorrentIPDiagnosis(): Promise<IPDiagnosticResult> {
  const [httpInfo, webrtcInfo] = await Promise.all([
    fetchHttpPublicIP(),
    detectWebRTCIPs(),
  ]);

  const details: string[] = [];
  let status: 'protected' | 'warning' | 'danger' | 'unknown' = 'unknown';
  let summary = '';

  const webrtcIp = webrtcInfo.publicIps[0] || null;
  const httpIp = httpInfo.ip;

  // 典型的な家庭用ISP名（プロバイダ判定用）
  const ispString = `${httpInfo.isp || ''} ${httpInfo.org || ''}`.toLowerCase();
  const isResidentialIsp =
    ispString.includes('ntt') ||
    ispString.includes('ocn') ||
    ispString.includes('kddi') ||
    ispString.includes('softbank') ||
    ispString.includes('so-net') ||
    ispString.includes('biglobe') ||
    ispString.includes('nifty') ||
    ispString.includes('plala') ||
    ispString.includes('jcom') ||
    ispString.includes('optic') ||
    ispString.includes('cable') ||
    ispString.includes('telecom') ||
    ispString.includes('broadband');

  const isVpnOrg =
    ispString.includes('vpn') ||
    ispString.includes('m247') ||
    ispString.includes('datacenter') ||
    ispString.includes('hosting') ||
    ispString.includes('cloudflare') ||
    ispString.includes('digitalocean') ||
    ispString.includes('linode') ||
    ispString.includes('ovh') ||
    ispString.includes('leaseweb');

  if (!httpIp && !webrtcIp) {
    status = 'unknown';
    summary = 'ネットワーク情報を取得できませんでした（オフラインまたは広告ブロッカー等）';
    details.push('ブラウザのセキュリティ設定や広告ブロッカーが外部IP取得APIをブロックしている可能性があります。');
  } else if (webrtcIp && httpIp && webrtcIp !== httpIp) {
    // WebRTC Leak! HTTPのIPとWebRTCのIPが食い違っている
    status = 'danger';
    summary = '⚠️ WebRTC IPリークを検出！Torrent上で生IPが露出している恐れがあります';
    details.push(
      `Webブラウザの通常のHTTP通信IP (${httpIp}) と、WebTorrent/WebRTCのSTUN通信IP (${webrtcIp}) が一致していません。`
    );
    details.push(
      'ブラウザ拡張機能型VPNをお使いの場合、WebRTC通信がVPNトンネルをすり抜けて生IPを漏洩している典型例です。Windows OS全体のVPNアプリを使用することを強く推奨します。'
    );
  } else {
    // HTTPとWebRTCが一致、または片方のみ検出
    const effectiveIp = webrtcIp || httpIp;

    if (isResidentialIsp) {
      status = 'warning';
      summary = '⚠️ 自宅プロバイダ（一般回線）の生IPアドレスの可能性があります';
      details.push(
        `検出されたプロバイダ情報 (${httpInfo.isp || httpInfo.org || '不明'}) は一般的なインターネットサービスプロバイダに見えます。`
      );
      details.push(
        'VPNが無効になっているか、接続が切断されている可能性があります。Torrent/WebTorrentを開始すると、このIPアドレスがすべての接続相手（ピア・トラッカー）に丸見えになります。'
      );
    } else if (isVpnOrg) {
      status = 'protected';
      summary = '🛡️ VPNまたはデータセンター経由で保護されている可能性が高いです';
      details.push(
        `検出されたIP (${effectiveIp}) のプロバイダ・組織名はVPN/ホスティング関連 (${httpInfo.isp || httpInfo.org}) です。`
      );
      details.push('WebRTC(WebTorrent)とWebブラウザの両方の通信がVPNサーバー経由になっており、安全に難読化されています。');
    } else {
      // 判定保留または通常の保護
      status = 'protected';
      summary = `Torrent通信IP: ${effectiveIp} (${httpInfo.country || '国不明'})`;
      details.push(
        `WebTorrent通信時に相手ピアおよびトラッカーへ通知されるIPアドレスは「${effectiveIp}」です。`
      );
      details.push('VPN接続前の生IPアドレスと見比べて、異なるIPアドレスに変化しているかご確認ください。');
    }
  }

  return {
    httpIp: httpInfo.ip,
    httpCountry: httpInfo.country,
    httpCity: httpInfo.city,
    httpOrg: httpInfo.org,
    httpIsp: httpInfo.isp,
    webrtcPublicIps: webrtcInfo.publicIps,
    webrtcLocalIps: webrtcInfo.localIps,
    allCandidates: webrtcInfo.candidates,
    status,
    summary,
    details,
    testedAt: new Date(),
  };
}

/**
 * IPアドレスを伏字・マスキングするヘルパー関数
 * 配信やスクリーンショット、画面共有時のプライバシー保護に使用します。
 */
export function maskIpAddress(
  ip: string | null | undefined,
  hide: boolean,
  mode: 'partial' | 'full' = 'partial'
): string {
  if (!ip) return '';
  if (!hide) return ip;

  // IPv4 チェック
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  if (match) {
    if (mode === 'partial') {
      return `${match[1]}.${match[2]}.***.***`;
    }
    return '***.***.***.***';
  }

  // IPv6 チェック
  if (ip.includes(':')) {
    if (mode === 'partial') {
      const parts = ip.split(':');
      return `${parts.slice(0, 2).join(':')}:****:****`;
    }
    return '****:****:****:****';
  }

  // その他（文字列等）
  return '***.***.***.***';
}

/**
 * 説明文やログテキスト内のIPアドレスを伏字にする
 */
export function maskTextIps(text: string, hide: boolean): string {
  if (!hide || !text) return text;
  return text.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (match) => {
    const parts = match.split('.');
    return `${parts[0]}.${parts[1]}.***.***`;
  });
}
