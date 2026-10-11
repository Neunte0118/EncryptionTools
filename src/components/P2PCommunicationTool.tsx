import React, { useState, useEffect, useRef } from 'react';
import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import {
  computeHash,
  signData,
  verifyData,
  stringToBuffer,
  bufferToString,
  bufferToHex,
  base64ToBuffer,
  bufferToBase64,
  HashAlgorithm,
} from '../utils/cryptoUtils';
import { appendKeyToVault } from '../utils/vaultStorage';
import {
  Radio,
  Wifi,
  WifiOff,
  Send,
  Download,
  Upload,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Key,
  ShieldCheck,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldAlert,
  Share2,
  Laptop,
  Lock,
  PlusCircle,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  onVaultChange: (updated: KeyVaultFile) => void;
}

interface ChatMessage {
  id: string;
  sender: 'self' | 'peer';
  text: string;
  timestamp: string;
  signature?: {
    signatureHex: string;
    algorithm: string;
    publicKeyPem: string;
    verified?: boolean;
    verificationError?: string;
  };
}

interface SharedKeyPayload {
  title: string;
  memo: string;
  type: KeyVaultItem['type'];
  algorithmDetails: KeyVaultItem['algorithmDetails'];
  publicKeyPem: string;
}

interface ReceivedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  sha256Expected: string;
  sha256Actual?: string;
  isVerified?: boolean;
  chunksReceived: number;
  totalChunks: number;
  dataChunks: Uint8Array[];
  blobUrl?: string;
  completed: boolean;
}

const CHUNK_SIZE = 16384; // 16KB chunks for RTCDataChannel safety

export const P2PCommunicationTool: React.FC<Props> = ({ vault, onVaultChange }) => {
  // Connection Mode: WebRTC manual signaling (Approach A) vs Local Tabs (BroadcastChannel)
  const [connectMode, setConnectMode] = useState<'webrtc' | 'broadcast'>('webrtc');

  // WebRTC Role: host (create offer) or join (create answer)
  const [role, setRole] = useState<'host' | 'join'>('host');
  const [useStun, setUseStun] = useState<boolean>(true);

  // WebRTC Signaling States
  const [isGatheringIce, setIsGatheringIce] = useState(false);
  const [localSignalText, setLocalSignalText] = useState('');
  const [remoteSignalText, setRemoteSignalText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [statusMessage, setStatusMessage] = useState('未接続');

  // Broadcast Channel State
  const [channelName, setChannelName] = useState('crypto-local-p2p');

  // Copy feedback tracking
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Active Tool Tab inside connected view
  const [activeTab, setActiveTab] = useState<'chat' | 'file' | 'keys'>('chat');

  // Chat message input & list
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [signMessageWithVaultKey, setSignMessageWithVaultKey] = useState(false);
  const [signingVaultKeyId, setSigningVaultKeyId] = useState('');
  const [isSigningKeyRevealed, setIsSigningKeyRevealed] = useState(false);

  // File Transfer State
  const [selectedSendFile, setSelectedSendFile] = useState<File | null>(null);
  const [sendFileHash, setSendFileHash] = useState<string>('');
  const [sendFileProgress, setSendFileProgress] = useState<number | null>(null);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);

  // Key Sharing State
  const [selectedVaultKeyToShare, setSelectedVaultKeyToShare] = useState('');
  const [receivedSharedKeys, setReceivedSharedKeys] = useState<SharedKeyPayload[]>([]);
  const [addedKeyTitles, setAddedKeyTitles] = useState<Set<string>>(new Set());

  // WebRTC references
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Receiving files buffer in-progress
  const activeReceivingFilesRef = useRef<{ [id: string]: ReceivedFile }>({});

  const handleCopy = (text: string, fieldId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => {
      setCopiedField((prev) => (prev === fieldId ? null : prev));
    }, 2000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupConnections();
    };
  }, []);

  const cleanupConnections = () => {
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch {}
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.close();
      } catch {}
      broadcastChannelRef.current = null;
    }
    setConnectionStatus('disconnected');
    setStatusMessage('未接続');
  };

  // --- WebRTC Setup (Approach A: Pure Serverless Manual Signaling) ---

  const createPeerConnection = () => {
    cleanupConnections();

    const config: RTCConfiguration = {
      iceServers: useStun
        ? [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
        : [],
    };

    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('connected');
        setStatusMessage('P2P 接続確立 (WebRTC DataChannel 稼働中)');
      } else if (
        pc.iceConnectionState === 'disconnected' ||
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'closed'
      ) {
        setConnectionStatus('disconnected');
        setStatusMessage(`接続終了 (${pc.iceConnectionState})`);
      }
    };

    return pc;
  };

  // Helper to wait for ICE candidate gathering to finish (Vanilla ICE / single payload)
  const waitForIceCandidates = (pc: RTCPeerConnection): Promise<void> => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', checkState);
      // Fallback timeout in case slow/no candidates after 2500ms
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 2500);
    });
  };

  const setupDataChannelEvents = (dc: RTCDataChannel) => {
    dataChannelRef.current = dc;

    dc.onopen = () => {
      setConnectionStatus('connected');
      setStatusMessage('P2P 暗号化データチャンネル確立 (通信可能)');
    };

    dc.onclose = () => {
      setConnectionStatus('disconnected');
      setStatusMessage('データチャンネルが切断されました');
    };

    dc.onerror = (err) => {
      console.error('DataChannel error:', err);
      setStatusMessage('データチャンネルエラーが発生しました');
    };

    dc.onmessage = (event) => {
      handleIncomingRawData(event.data);
    };
  };

  // 1. Host creates Offer (方式A Step 1)
  const handleHostCreateOffer = async () => {
    try {
      setConnectionStatus('connecting');
      setStatusMessage('接続コード (Offer SDP) を生成中...');
      setIsGatheringIce(true);
      setLocalSignalText('');

      const pc = createPeerConnection();

      // Create RTCDataChannel
      const dc = pc.createDataChannel('crypto-vault-channel', {
        ordered: true,
      });
      setupDataChannelEvents(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for complete ICE gathering
      await waitForIceCandidates(pc);

      setIsGatheringIce(false);
      const fullSdp = pc.localDescription;
      if (fullSdp) {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(fullSdp))));
        setLocalSignalText(encoded);
        setStatusMessage('Offer 生成完了。相手に接続コードを共有してください');
      }
    } catch (err: any) {
      setIsGatheringIce(false);
      setConnectionStatus('error');
      setStatusMessage(`Offer生成エラー: ${err?.message || err}`);
    }
  };

  // 2. Joiner creates Answer (方式A Step 2)
  const handleJoinerCreateAnswer = async () => {
    if (!remoteSignalText.trim()) {
      alert('ホストから受け取った接続コード (Offer) を入力してください');
      return;
    }

    try {
      setConnectionStatus('connecting');
      setStatusMessage('応答コード (Answer SDP) を生成中...');
      setIsGatheringIce(true);
      setLocalSignalText('');

      const pc = createPeerConnection();

      pc.ondatachannel = (event) => {
        setupDataChannelEvents(event.channel);
      };

      // Parse remote offer
      let offerDesc: RTCSessionDescriptionInit;
      try {
        const decoded = decodeURIComponent(escape(atob(remoteSignalText.trim())));
        offerDesc = JSON.parse(decoded);
      } catch {
        offerDesc = JSON.parse(remoteSignalText.trim());
      }

      await pc.setRemoteDescription(offerDesc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for complete ICE gathering
      await waitForIceCandidates(pc);

      setIsGatheringIce(false);
      const fullAnswer = pc.localDescription;
      if (fullAnswer) {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(fullAnswer))));
        setLocalSignalText(encoded);
        setStatusMessage('Answer 生成完了。ホストに応答コードを渡してください');
      }
    } catch (err: any) {
      setIsGatheringIce(false);
      setConnectionStatus('error');
      setStatusMessage(`Answer生成エラー: ${err?.message || err}`);
    }
  };

  // 3. Host completes connection with Answer (方式A Step 3)
  const handleHostApplyAnswer = async () => {
    if (!remoteSignalText.trim()) {
      alert('相手から受け取った応答コード (Answer) を入力してください');
      return;
    }
    if (!pcRef.current) {
      alert('先に「接続コード (Offer) を生成」を行ってください');
      return;
    }

    try {
      setStatusMessage('応答コードを適用中...');
      let answerDesc: RTCSessionDescriptionInit;
      try {
        const decoded = decodeURIComponent(escape(atob(remoteSignalText.trim())));
        answerDesc = JSON.parse(decoded);
      } catch {
        answerDesc = JSON.parse(remoteSignalText.trim());
      }

      await pcRef.current.setRemoteDescription(answerDesc);
      setStatusMessage('相手のAnswerを適用しました。ICE接続待機中...');
    } catch (err: any) {
      setStatusMessage(`Answer適用エラー: ${err?.message || err}`);
    }
  };

  // --- BroadcastChannel Mode (同一端末タブ間テスト) ---
  const handleConnectBroadcast = () => {
    cleanupConnections();
    try {
      const bc = new BroadcastChannel(channelName || 'crypto-local-p2p');
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        handleIncomingRawData(event.data);
      };

      setConnectionStatus('connected');
      setStatusMessage(`同一端末タブ間 P2P 接続有効 (チャンネル: ${channelName})`);

      // Send ping message
      sendP2PPayload({
        type: 'system-ping',
        text: 'ピアがチャンネルに参加しました',
      });
    } catch (err: any) {
      setConnectionStatus('error');
      setStatusMessage(`BroadcastChannel 接続エラー: ${err?.message || err}`);
    }
  };

  // --- Unified Payload Dispatcher & Receiver ---

  const sendP2PPayload = (payload: any) => {
    const jsonStr = JSON.stringify(payload);
    if (connectMode === 'webrtc') {
      if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
        throw new Error('WebRTC データチャンネルが開いていません');
      }
      dataChannelRef.current.send(jsonStr);
    } else {
      if (!broadcastChannelRef.current) {
        throw new Error('BroadcastChannel が開いていません');
      }
      broadcastChannelRef.current.postMessage(jsonStr);
    }
  };

  const handleIncomingRawData = async (raw: any) => {
    try {
      let data: any;
      if (typeof raw === 'string') {
        data = JSON.parse(raw);
      } else {
        data = raw;
      }

      if (data.type === 'chat') {
        const msg: ChatMessage = {
          id: data.id || Math.random().toString(36).slice(2),
          sender: 'peer',
          text: data.text,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
          signature: data.signature,
        };

        // If message has signature, verify it
        if (msg.signature && msg.signature.publicKeyPem) {
          try {
            const dataBuf = stringToBuffer(msg.text);
            const sigBuf = base64ToBuffer(msg.signature.signatureHex);
            const isValid = await verifyData({
              type: msg.signature.algorithm as any,
              hash: 'SHA-256',
              publicKeyPem: msg.signature.publicKeyPem,
              data: dataBuf,
              signature: sigBuf,
            });
            msg.signature.verified = isValid;
          } catch (verErr: any) {
            msg.signature.verified = false;
            msg.signature.verificationError = verErr?.message || '検証失敗';
          }
        }

        setMessages((prev) => [...prev, msg]);
      } else if (data.type === 'file-start') {
        // Prepare file receiver
        activeReceivingFilesRef.current[data.id] = {
          id: data.id,
          name: data.name,
          size: data.size,
          mimeType: data.mimeType || 'application/octet-stream',
          sha256Expected: data.sha256,
          chunksReceived: 0,
          totalChunks: data.totalChunks,
          dataChunks: new Array(data.totalChunks),
          completed: false,
        };
        // Update state
        setReceivedFiles((prev) => [
          activeReceivingFilesRef.current[data.id],
          ...prev.filter((f) => f.id !== data.id),
        ]);
        setActiveTab('file');
      } else if (data.type === 'file-chunk') {
        const target = activeReceivingFilesRef.current[data.id];
        if (!target) return;

        const chunkBuf = new Uint8Array(base64ToBuffer(data.chunkBase64));
        target.dataChunks[data.index] = chunkBuf;
        target.chunksReceived += 1;

        if (target.chunksReceived >= target.totalChunks) {
          // All chunks received! Concatenate
          let totalLen = 0;
          for (const c of target.dataChunks) {
            totalLen += c.length;
          }
          const fullBuf = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of target.dataChunks) {
            fullBuf.set(c, offset);
            offset += c.length;
          }

          // Compute SHA-256 hash to verify integrity
          const computedHash = await computeHash(fullBuf.buffer, 'SHA-256');
          target.sha256Actual = computedHash.hex;
          target.isVerified =
            computedHash.hex.toLowerCase() === target.sha256Expected.toLowerCase();
          target.completed = true;

          const blob = new Blob([fullBuf], { type: target.mimeType });
          target.blobUrl = URL.createObjectURL(blob);
        }

        // Trigger UI update
        setReceivedFiles((prev) => [
          { ...target },
          ...prev.filter((f) => f.id !== target.id),
        ]);
      } else if (data.type === 'key-share') {
        setReceivedSharedKeys((prev) => [data.payload, ...prev]);
        setActiveTab('keys');
      } else if (data.type === 'system-ping') {
        console.log('Peer system message:', data.text);
      }
    } catch (err) {
      console.error('Failed to parse incoming P2P data:', err);
    }
  };

  // --- Sending Chat Message ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    if (connectionStatus !== 'connected') {
      alert('P2P 接続が確立されていません');
      return;
    }

    try {
      const msgText = chatInput.trim();
      const timestamp = new Date().toLocaleTimeString();
      const msgId = Math.random().toString(36).slice(2);

      let signatureData: ChatMessage['signature'] = undefined;

      // Optional signature using selected vault key
      if (signMessageWithVaultKey && signingVaultKeyId) {
        const keyItem = vault.keys.find((k) => k.id === signingVaultKeyId);
        if (keyItem && keyItem.privateKeyPem) {
          const dataBuf = stringToBuffer(msgText);
          const sigRes = await signData({
            type: keyItem.type as any,
            hash: 'SHA-256',
            privateKeyPem: keyItem.privateKeyPem,
            data: dataBuf,
          });
          signatureData = {
            signatureHex: sigRes.base64,
            algorithm: keyItem.type,
            publicKeyPem: keyItem.publicKeyPem || '',
            verified: true,
          };
        }
      }

      const payload = {
        type: 'chat',
        id: msgId,
        text: msgText,
        timestamp,
        signature: signatureData,
      };

      sendP2PPayload(payload);

      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          sender: 'self',
          text: msgText,
          timestamp,
          signature: signatureData,
        },
      ]);

      setChatInput('');
    } catch (err: any) {
      alert(`送信エラー: ${err?.message || err}`);
    }
  };

  // --- Sending File ---
  const handleSendFileChange = async (file: File) => {
    setSelectedSendFile(file);
    setSendFileProgress(null);
    try {
      const ab = await file.arrayBuffer();
      const hashRes = await computeHash(ab, 'SHA-256');
      setSendFileHash(hashRes.hex);
    } catch (err) {
      console.error('File hash error:', err);
    }
  };

  const handleStartSendFile = async () => {
    if (!selectedSendFile) return;
    if (connectionStatus !== 'connected') {
      alert('P2P 接続が確立されていません');
      return;
    }

    setIsSendingFile(true);
    setSendFileProgress(0);

    try {
      const fileId = Math.random().toString(36).slice(2);
      const ab = await selectedSendFile.arrayBuffer();
      const totalBytes = ab.byteLength;
      const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

      // 1. Send file metadata
      sendP2PPayload({
        type: 'file-start',
        id: fileId,
        name: selectedSendFile.name,
        size: totalBytes,
        mimeType: selectedSendFile.type,
        sha256: sendFileHash,
        totalChunks,
      });

      // 2. Stream chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalBytes);
        const chunkBuf = ab.slice(start, end);
        const chunkBase64 = bufferToBase64(chunkBuf);

        sendP2PPayload({
          type: 'file-chunk',
          id: fileId,
          index: i,
          chunkBase64,
        });

        const progressPercent = Math.round(((i + 1) / totalChunks) * 100);
        setSendFileProgress(progressPercent);

        // Allow microtask breather for browser rendering
        if (i % 8 === 0) {
          await new Promise((r) => setTimeout(r, 4));
        }
      }

      setIsSendingFile(false);
      alert(`ファイル「${selectedSendFile.name}」の P2P 送信が完了しました！`);
    } catch (err: any) {
      setIsSendingFile(false);
      alert(`ファイル送信エラー: ${err?.message || err}`);
    }
  };

  // --- Sharing Vault Key to Peer ---
  const handleShareKey = () => {
    if (!selectedVaultKeyToShare) return;
    if (connectionStatus !== 'connected') {
      alert('P2P 接続が確立されていません');
      return;
    }

    const keyItem = vault.keys.find((k) => k.id === selectedVaultKeyToShare);
    if (!keyItem) return;

    if (!keyItem.publicKeyPem && !keyItem.rawKeyBase64) {
      alert('この鍵には共有可能な公開鍵情報がありません');
      return;
    }

    const payload: SharedKeyPayload = {
      title: keyItem.title,
      memo: keyItem.memo,
      type: keyItem.type,
      algorithmDetails: keyItem.algorithmDetails,
      publicKeyPem: keyItem.publicKeyPem || '',
    };

    sendP2PPayload({
      type: 'key-share',
      payload,
    });

    alert(`公開鍵「${keyItem.title}」をピアに送信しました！`);
  };

  // Add received key to user's Vault file
  const handleSaveReceivedKeyToVault = (shared: SharedKeyPayload) => {
    const { updatedVault } = appendKeyToVault(vault, {
      title: `${shared.title} (P2P受信)`,
      memo: `${shared.memo || ''} [P2P経由で受信]`,
      type: shared.type,
      algorithmDetails: shared.algorithmDetails,
      publicKeyPem: shared.publicKeyPem,
    });
    onVaultChange(updatedVault);
    setAddedKeyTitles((prev) => new Set(prev).add(shared.title));
  };

  // Filter keys for signing
  const signingKeys = vault.keys.filter(
    (k) =>
      k.privateKeyPem &&
      (k.type === 'rsa-pss' || k.type === 'rsa-pkcs1' || k.type === 'ecdsa')
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400" />
            完全サーバーレス P2P 通信 (WebRTC / Local)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            シグナリングサーバー不使用。ブラウザ標準の WebRTC DataChannel (方式A: 手動SDP交換)
            または同一端末タブ間連携により、サーバーを介さずブラウザ同士で暗号化テキスト・ファイル・公開鍵を直接送受信します。
          </p>
        </div>

        {/* Global Connection Status Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : connectionStatus === 'connecting'
                ? 'bg-amber-950/80 text-amber-300 border-amber-700/60 animate-pulse'
                : connectionStatus === 'error'
                ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : connectionStatus === 'connecting' ? (
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            ) : (
              <WifiOff className="w-4 h-4 text-slate-500" />
            )}
            <span>{statusMessage}</span>
          </div>

          {connectionStatus !== 'disconnected' && (
            <button
              onClick={cleanupConnections}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded border border-slate-800 transition-colors"
            >
              切断 / リセット
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 flex gap-2">
        <button
          onClick={() => {
            setConnectMode('webrtc');
            cleanupConnections();
          }}
          className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            connectMode === 'webrtc'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>方式A: WebRTC 手動シグナリング (別PC・別端末間 / サーバーゼロ)</span>
        </button>

        <button
          onClick={() => {
            setConnectMode('broadcast');
            cleanupConnections();
          }}
          className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            connectMode === 'broadcast'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>同一端末テスト (BroadcastChannel / 別タブとワンクリック接続)</span>
        </button>
      </div>

      {/* Connection Setup Card (When not connected) */}
      {connectionStatus !== 'connected' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-5">
          {connectMode === 'webrtc' ? (
            <>
              {/* WebRTC Role Select */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    WebRTC 手動シグナリング手順 (方式A)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    1台が「ホスト (Offer作成)」、もう1台が「ゲスト (Answer作成)」を選択し、コードを1度コピペ交換するだけで接続できます。
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRole('host')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      role === 'host'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    ホスト (接続を開始)
                  </button>
                  <button
                    onClick={() => setRole('join')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      role === 'join'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    ゲスト (接続に参加)
                  </button>
                </div>
              </div>

              {/* STUN Configuration Option */}
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded border border-slate-800/60 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span className="text-slate-300 font-medium">STUN サーバー設定:</span>
                  <span className="text-slate-400">
                    {useStun
                      ? '標準 STUN (Google) 有効 (NAT/ルーター越え対応)'
                      : 'STUN 無効 (完全オフライン / 同一LAN・エアギャップ環境専用)'}
                  </span>
                </div>
                <button
                  onClick={() => setUseStun(!useStun)}
                  className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  {useStun ? 'STUN を無効化する' : 'STUN を有効化する'}
                </button>
              </div>

              {/* Host Flow */}
              {role === 'host' && (
                <div className="space-y-4">
                  {/* Step 1: Create Offer */}
                  <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                        <span className="w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 flex items-center justify-center text-[11px]">
                          1
                        </span>
                        接続コード (Offer SDP) の生成
                      </div>

                      <button
                        onClick={handleHostCreateOffer}
                        disabled={isGatheringIce}
                        className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        {isGatheringIce ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ICE候補収集 &amp; 生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            接続コード (Offer) を生成
                          </>
                        )}
                      </button>
                    </div>

                    {localSignalText && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>
                            生成された接続コード (これを相手にチャット等で送ってください):
                          </span>
                          <span className="text-[11px] text-indigo-400">クリックでコピー可能</span>
                        </div>
                        <div
                          onClick={() => handleCopy(localSignalText, 'host-offer')}
                          className={`font-mono text-xs p-3 rounded bg-slate-900 border transition-all cursor-pointer relative group break-all max-h-28 overflow-y-auto select-all ${
                            copiedField === 'host-offer'
                              ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-300'
                              : 'border-slate-800 text-slate-300 hover:border-indigo-500/50'
                          }`}
                        >
                          {localSignalText}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/90 px-2 py-0.5 rounded text-[10px] text-slate-200 pointer-events-none">
                            {copiedField === 'host-offer' ? 'コピー完了！' : 'クリックでコピー'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2 & 3: Paste Answer and Finish */}
                  <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/70 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                      <span className="w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 flex items-center justify-center text-[11px]">
                        2
                      </span>
                      相手からの応答コード (Answer SDP) を貼り付け
                    </div>

                    <textarea
                      value={remoteSignalText}
                      onChange={(e) => setRemoteSignalText(e.target.value)}
                      placeholder="相手（ゲスト）から受け取った応答コード (Answer) をここに貼り付けてください..."
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={handleHostApplyAnswer}
                        disabled={!remoteSignalText.trim()}
                        className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        接続を完了する (Connect)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Joiner Flow */}
              {role === 'join' && (
                <div className="space-y-4">
                  {/* Step 1: Paste Host Offer */}
                  <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/70 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                      <span className="w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 flex items-center justify-center text-[11px]">
                        1
                      </span>
                      ホストから受け取った接続コード (Offer SDP) を貼り付け
                    </div>

                    <textarea
                      value={remoteSignalText}
                      onChange={(e) => setRemoteSignalText(e.target.value)}
                      placeholder="ホストから送られてきた接続コード (Offer) をここに貼り付けてください..."
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={handleJoinerCreateAnswer}
                        disabled={!remoteSignalText.trim() || isGatheringIce}
                        className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        {isGatheringIce ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            ICE候補収集 &amp; 応答生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            応答コード (Answer) を生成
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Step 2: Show Answer to copy */}
                  {localSignalText && (
                    <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800/70 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                        <span className="w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 flex items-center justify-center text-[11px]">
                          2
                        </span>
                        生成された応答コード (ホストに返信してください)
                      </div>

                      <div
                        onClick={() => handleCopy(localSignalText, 'join-answer')}
                        className={`font-mono text-xs p-3 rounded bg-slate-900 border transition-all cursor-pointer relative group break-all max-h-28 overflow-y-auto select-all ${
                          copiedField === 'join-answer'
                            ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-300'
                            : 'border-slate-800 text-slate-300 hover:border-indigo-500/50'
                        }`}
                      >
                        {localSignalText}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/90 px-2 py-0.5 rounded text-[10px] text-slate-200 pointer-events-none">
                          {copiedField === 'join-answer' ? 'コピー完了！' : 'クリックでコピー'}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400">
                        ホストがこの応答コードを貼り付けて接続完了すると、自動的に通信可能状態になります。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* BroadcastChannel Mode (Same device test) */
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                  同一端末・ブラウザタブ間 P2P テスト (BroadcastChannel)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  コピー＆ペースト不要。新しいブラウザタブでこのサイトを開き、同じチャンネル名で「タブ間接続を開始」を押すだけで即座にテストできます。
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="チャンネル名 (例: crypto-local-p2p)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />

                <button
                  onClick={handleConnectBroadcast}
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Wifi className="w-4 h-4" />
                  タブ間接続を開始
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connected Workspace */}
      {connectionStatus === 'connected' && (
        <div className="space-y-4">
          {/* Sub Navigation */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>P2P チャット &amp; 署名付き通信</span>
                {messages.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 text-slate-300">
                    {messages.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('file')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'file'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>P2P ファイル直接転送</span>
                {receivedFiles.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 text-slate-300">
                    {receivedFiles.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('keys')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'keys'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>公開鍵の直接交換 (Vault連携)</span>
                {receivedSharedKeys.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    +{receivedSharedKeys.length}
                  </span>
                )}
              </button>
            </div>

            <div className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              E2E Direct Link Active
            </div>
          </div>

          {/* SubTab 1: Chat & Signed Messaging */}
          {activeTab === 'chat' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
              {/* Message History */}
              <div className="h-80 overflow-y-auto bg-slate-950 rounded-lg p-4 border border-slate-800/80 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
                    <FileText className="w-8 h-8 mb-2 stroke-1" />
                    <span>メッセージはまだありません。下のフォームから送信できます。</span>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.sender === 'self' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 text-xs space-y-1.5 ${
                          m.sender === 'self'
                            ? 'bg-indigo-600/90 text-white'
                            : 'bg-slate-900 text-slate-200 border border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 pb-1 border-b border-white/10">
                          <span className="font-semibold">
                            {m.sender === 'self' ? '自分' : '相手 (Peer)'}
                          </span>
                          <span>{m.timestamp}</span>
                        </div>

                        {/* Click to copy message text */}
                        <div
                          onClick={() => handleCopy(m.text, `msg-${m.id}`)}
                          className="font-sans whitespace-pre-wrap break-words cursor-pointer select-all hover:opacity-90"
                          title="クリックでコピー"
                        >
                          {m.text}
                        </div>

                        {/* Signature Information if attached */}
                        {m.signature && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-[11px] font-mono space-y-1">
                            <div className="flex items-center gap-1.5">
                              {m.signature.verified ? (
                                <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  デジタル署名検証成功 ({m.signature.algorithm})
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-300 font-semibold">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  署名検証失敗 ({m.signature.verificationError || '不正'})
                                </span>
                              )}
                            </div>
                            <div
                              onClick={() =>
                                handleCopy(m.signature?.signatureHex || '', `sig-${m.id}`)
                              }
                              className="text-[10px] opacity-75 truncate cursor-pointer hover:underline"
                              title="クリックで署名値をコピー"
                            >
                              Sig: {m.signature.signatureHex.slice(0, 32)}...
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Composer & Signing Controls */}
              <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/60">
                {/* Optional Signature Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-slate-800/60 pb-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={signMessageWithVaultKey}
                      onChange={(e) => setSignMessageWithVaultKey(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>メッセージにデジタル署名を付与して改ざん防止</span>
                  </label>

                  {signMessageWithVaultKey && (
                    <div className="flex items-center gap-2">
                      <select
                        value={signingVaultKeyId}
                        onChange={(e) => setSigningVaultKeyId(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- 署名用秘密鍵を選択 --</option>
                        {signingKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.title} ({k.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="P2P 直接メッセージを入力して Enter..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim()}
                    className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    送信
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SubTab 2: P2P File Direct Transfer */}
          {activeTab === 'file' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Send File Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  P2P ファイル直接送信
                </h3>
                <p className="text-xs text-slate-400">
                  ファイルを相手のブラウザにダイレクト転送します。送信前に SHA-256
                  ハッシュを自動計算し、完全性を保証します。
                </p>

                <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-5 text-center cursor-pointer relative bg-slate-950/40 transition-colors">
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSendFileChange(f);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-300 font-medium">
                    {selectedSendFile
                      ? selectedSendFile.name
                      : 'ファイルを選択 または ドラッグ＆ドロップ'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {selectedSendFile
                      ? `${(selectedSendFile.size / 1024).toFixed(1)} KB`
                      : '全ファイル形式対応 (ブラウザ直接転送)'}
                  </p>
                </div>

                {selectedSendFile && sendFileHash && (
                  <div className="bg-slate-950 p-3 rounded border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>送信元 SHA-256 ハッシュ:</span>
                      <span className="text-[10px] text-indigo-400">クリックでコピー</span>
                    </div>
                    <div
                      onClick={() => handleCopy(sendFileHash, 'send-file-hash')}
                      className={`font-mono text-[11px] p-2 rounded bg-slate-900 border transition-all cursor-pointer break-all ${
                        copiedField === 'send-file-hash'
                          ? 'border-emerald-500 text-emerald-300'
                          : 'border-slate-800 text-slate-300'
                      }`}
                    >
                      {sendFileHash}
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                {sendFileProgress !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>送信進捗</span>
                      <span>{sendFileProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-150"
                        style={{ width: `${sendFileProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStartSendFile}
                  disabled={!selectedSendFile || isSendingFile}
                  className="w-full py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {isSendingFile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      P2P 送信中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      ファイルをダイレクト送信
                    </>
                  )}
                </button>
              </div>

              {/* Received Files Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  受信ファイル一覧 ({receivedFiles.length})
                </h3>
                <p className="text-xs text-slate-400">
                  受信したファイルは自動で SHA-256 ハッシュが再計算され、改ざん検証されます。
                </p>

                <div className="space-y-3 max-h-[360px] overflow-y-auto">
                  {receivedFiles.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-xs">
                      相手からファイルを受信するとここに表示されます
                    </div>
                  ) : (
                    receivedFiles.map((rf) => (
                      <div
                        key={rf.id}
                        className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="font-semibold text-slate-200 truncate">
                              {rf.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {(rf.size / 1024).toFixed(1)} KB
                          </span>
                        </div>

                        {/* Hash status */}
                        {rf.completed ? (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {rf.isVerified ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                SHA-256 ハッシュ一致 (改ざんなし・完全性検証済)
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1 font-medium">
                                <XCircle className="w-3.5 h-3.5" />
                                ハッシュ不一致 (破損または改ざんの可能性)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>受信中...</span>
                              <span>
                                {Math.round((rf.chunksReceived / rf.totalChunks) * 100)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full"
                                style={{
                                  width: `${(rf.chunksReceived / rf.totalChunks) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Download button */}
                        {rf.completed && rf.blobUrl && (
                          <div className="flex justify-end pt-1">
                            <a
                              href={rf.blobUrl}
                              download={rf.name}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" />
                              ダウンロード保存
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SubTab 3: Key Sharing & Vault Integration */}
          {activeTab === 'keys' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Share My Vault Public Key */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-400" />
                  公開鍵を相手に送信 (Key Share)
                </h3>
                <p className="text-xs text-slate-400">
                  あなたの単一鍵管理ファイル (Vault)
                  から公開鍵を選択し、P2Pで相手に直接送信します（秘密鍵は送信されません）。
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">
                      送信する鍵を選択
                    </label>
                    <select
                      value={selectedVaultKeyToShare}
                      onChange={(e) => setSelectedVaultKeyToShare(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Vaultから鍵を選択 --</option>
                      {vault.keys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title} ({k.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedVaultKeyToShare && (
                    <div className="bg-slate-950 p-3 rounded border border-slate-800/80 space-y-2 text-xs">
                      {(() => {
                        const k = vault.keys.find((x) => x.id === selectedVaultKeyToShare);
                        if (!k) return null;
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200">{k.title}</span>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {k.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              公開鍵プレビュー (クリックでコピー):
                            </div>
                            <div
                              onClick={() =>
                                handleCopy(k.publicKeyPem || '', `preview-pub-${k.id}`)
                              }
                              className="font-mono text-[10px] p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 max-h-20 overflow-y-auto cursor-pointer"
                            >
                              {k.publicKeyPem || '公開鍵なし'}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <button
                    onClick={handleShareKey}
                    disabled={!selectedVaultKeyToShare}
                    className="w-full py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    この公開鍵を相手に送信
                  </button>
                </div>
              </div>

              {/* Received Public Keys from Peer */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  相手から受信した公開鍵 ({receivedSharedKeys.length})
                </h3>
                <p className="text-xs text-slate-400">
                  相手から送られた公開鍵を、ワンクリックであなたの単一鍵管理ファイルに追加・保存できます。
                </p>

                <div className="space-y-3 max-h-[360px] overflow-y-auto">
                  {receivedSharedKeys.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-xs">
                      相手から公開鍵が送信されるとここに表示されます
                    </div>
                  ) : (
                    receivedSharedKeys.map((sk, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{sk.title}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            {sk.type}
                          </span>
                        </div>

                        {sk.memo && <p className="text-[11px] text-slate-400">{sk.memo}</p>}

                        <div
                          onClick={() => handleCopy(sk.publicKeyPem, `sk-pub-${idx}`)}
                          className="font-mono text-[10px] p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 max-h-16 overflow-y-auto cursor-pointer"
                          title="クリックでコピー"
                        >
                          {sk.publicKeyPem}
                        </div>

                        <div className="flex justify-end pt-1">
                          {addedKeyTitles.has(sk.title) ? (
                            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Vault に追加保存済み
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSaveReceivedKeyToVault(sk)}
                              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              鍵管理ファイルに保存 (追加)
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
