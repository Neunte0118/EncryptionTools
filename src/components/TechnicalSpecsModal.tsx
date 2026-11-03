import React from 'react';
import {
  ShieldCheck,
  WifiOff,
  Globe,
  Layers,
  X,
  Cpu,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface FeatureSpec {
  category: string;
  name: string;
  library: string;
  hasNetwork: boolean;
  networkDetails: string;
  description: string;
}

export const TECHNICAL_SPECS: FeatureSpec[] = [
  {
    category: '鍵保管庫',
    name: '鍵管理 (Vault) & エクスポート/インポート',
    library: '@zip.js/zip.js (ZIP一括出力時のみ) / ブラウザ標準 Web Crypto API (PBKDF2+AES-GCM)',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理・完全オフライン)',
    description: '鍵の暗号化保管、.encvault 暗号化エクスポート、非暗号化/暗号化ZIPアーカイブ生成、JSON入出力。外部通信は一切行われません。',
  },
  {
    category: '暗号化ツール',
    name: 'AES 暗号化 / 復号 (GCM / CBC / CTR / KW)',
    library: 'なし (ブラウザ標準 Web Crypto API)',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: 'ブラウザネイティブの Web Cryptography API を使用。ファイルやテキストを完全ローカルで暗号化・復号。',
  },
  {
    category: '暗号化ツール',
    name: 'RSA 公開鍵暗号化 / 復号 (RSA-OAEP)',
    library: 'なし (ブラウザ標準 Web Crypto API)',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: 'PKCS#8 PEM形式および標準パディングを使用。ブラウザ内で鍵ペア生成・暗号化・復号を実行。',
  },
  {
    category: '暗号化ツール',
    name: '電子署名・検証 (RSA-PSS / ECDSA)',
    library: 'なし (ブラウザ標準 Web Crypto API)',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: 'ファイルの真正性検証および改ざん検知署名。',
  },
  {
    category: '暗号化ツール',
    name: 'ChaCha20-Poly1305 暗号化 / 復号',
    library: '@noble/ciphers',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: 'RFC 8439 準拠の高精度 AEAD 暗号ストリーム。ローカル環境で高速処理。',
  },
  {
    category: 'アーカイブ圧縮',
    name: 'ZIP 圧縮・解凍 (非暗号化 & AES-256暗号化)',
    library: '@zip.js/zip.js',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: '標準の非暗号化ZIPアーカイブおよび WinZip AE-2 / ZipCrypto 暗号化ZIPを完全ローカルで生成・解凍。',
  },
  {
    category: '暗号化ツール',
    name: 'OpenPGP 暗号化・復号・鍵管理',
    library: 'openpgp (v6)',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: 'RFC 4880 / RFC 9580 標準準拠の PGP Armored 形式の暗号化・署名・鍵生成。',
  },
  {
    category: '耐量子暗号',
    name: '耐量子暗号 (ML-KEM / ML-DSA)',
    library: '@noble/post-quantum',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: 'NIST FIPS 203 (ML-KEM / Kyber) および FIPS 204 (ML-DSA / Dilithium) をブラウザ内で純粋計算。',
  },
  {
    category: '特殊暗号',
    name: 'タイムロック暗号 (Timelock Encryption)',
    library: 'tlock-js, drand-client, @noble/curves',
    hasNetwork: true,
    networkDetails: '通信あり: drand 分散ビーコン API (https://api.drand.sh/)',
    description: '指定時刻まで誰も復号できない暗号。分散暗号ビーコン (League of Entropy) から公開ランダムネスを取得するため、drand API へ GET リクエストを行います (暗号文や平文は送信されません)。',
  },
  {
    category: '共有・通信',
    name: 'P2P 暗号化通信 (WebRTC / BroadcastChannel)',
    library: 'なし (ブラウザ標準 WebRTC / BroadcastChannel API)',
    hasNetwork: true,
    networkDetails: '通信あり (WebRTC モード時: STUN stun:stun.l.google.com によるピア直接接続 / 同一端末タブ間モードは通信なし)',
    description: '端末同士の暗号化直接ファイル・メッセージ送受信。同一ブラウザタブ間テスト時は通信なしのローカル完結です。',
  },
  {
    category: '認証・分散',
    name: '2要素認証 (TOTP) / Shamir 秘密分散',
    library: 'qrcode (QRコード描画時のみ) / 計算は Web Crypto API',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: 'ワンタイムパスワード生成および多項式補間秘密分散。端末内完結。',
  },
  {
    category: 'ファイル処理',
    name: 'メタデータ消去 / ファイル完全消去 (シュレッダー)',
    library: 'piexifjs, browser-id3-writer, pdf-lib (メタデータ削除時)',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: '画像Exif・音声ID3・PDFメタデータの消去、および暗号学的乱数によるDoD 5220.22-M規格ファイル完全上書き消去。',
  },
  {
    category: '特殊暗号',
    name: '属性ベース暗号 (ABE) / 完全準同型暗号 (FHE) / リング署名',
    library: '@noble/curves (楕円曲線演算)',
    hasNetwork: false,
    networkDetails: '通信なし (100% ブラウザ内ローカル処理)',
    description: '暗号化したまま演算可能な準同型暗号および匿名リング署名。',
  },
];

export const TechnicalSpecsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                外部ライブラリ &amp; 通信仕様 一覧
              </h3>
              <p className="text-xs text-slate-400">
                本アプリケーションの各機能で使用している外部ライブラリおよびネットワーク通信の仕様明細
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Banner */}
        <div className="p-4 bg-emerald-950/30 border-b border-emerald-900/40 flex items-start gap-3 text-xs text-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-100">完全ローカル・プライバシー優先設計:</span>
            <p className="text-[11px] text-emerald-300/80 mt-0.5 leading-relaxed">
              原則としてすべての暗号鍵生成、暗号化、復号、署名、ハッシュ計算、ZIP圧縮・解凍はブラウザ内部（端末ローカル）で完結します。
              タイムロック暗号（drand公開ビーコン取得）および WebRTC P2P 通信を除き、外部サーバーへの通信は一切行われません。
            </p>
          </div>
        </div>

        {/* List of Features */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {TECHNICAL_SPECS.map((spec, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2 hover:border-slate-700/80 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] rounded font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                    {spec.category}
                  </span>
                  <h4 className="text-xs font-semibold text-slate-200">{spec.name}</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  {spec.hasNetwork ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-amber-400" />
                      <span>通信あり</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                      <WifiOff className="w-3 h-3 text-emerald-400" />
                      <span>通信なし (100% ローカル)</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 font-medium block">使用外部ライブラリ:</span>
                  <span className="text-indigo-300 font-mono">{spec.library}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 font-medium block">通信詳細:</span>
                  <span className={spec.hasNetwork ? 'text-amber-300' : 'text-emerald-300'}>
                    {spec.networkDetails}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-0.5">
                {spec.description}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
