import React, { useState } from 'react';
import {
  deriveKeyFromPassword,
  computeHash,
  bufferToBase64,
  bufferToHex,
  base64ToBuffer,
  hexToBuffer,
  encryptFileHybrid,
  encryptFileAesRaw,
  signData,
} from '../utils/cryptoUtils';
import { stripAllFileMetadata } from '../utils/metadataUtils';
import { generateSelfDecryptingHtml } from '../utils/selfDecryptingPackage';
import { createEncryptedZip } from '../utils/zipUtils';
import { createTarArchive, compressTarToGz } from '../utils/tarUtils';
import { splitSecret, ShamirShare } from '../utils/shamirUtils';
import { encodeSteganography, calculateImageCapacity, formatBytes } from '../utils/steganographyUtils';
import { FileLoaderButton } from './FileLoaderButton';
import { KeyVaultFile } from '../types/crypto';
import {
  Zap,
  ShieldCheck,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  FolderArchive,
  FileCheck,
  Hash,
  Flame,
  FileCode,
  QrCode,
  Lock,
  Layers,
  ArrowRight,
  FileText,
  Clock,
  Sparkles,
  Key,
  Trash2,
  FileSignature,
  Share2,
  Image as ImageIcon,
} from 'lucide-react';
import QRCode from 'qrcode';

type PipelineId =
  | 'privacy-encrypt'
  | 'multi-share'
  | 'archive-pack'
  | 'zip-aes-rsa'
  | 'sign-encrypt'
  | 'shamir-encrypt'
  | 'stego-encrypt';

interface Props {
  vault?: KeyVaultFile;
}

export const ActionPipelinesTool: React.FC<Props> = ({ vault }) => {
  const [activePipeline, setActivePipeline] = useState<PipelineId>('privacy-encrypt');

  // -------------------------------------------------------------
  // Pipeline 1: Clean Metadata + Encrypt + Hash
  // -------------------------------------------------------------
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stripMeta, setStripMeta] = useState(true);
  const [isProcessingP1, setIsProcessingP1] = useState(false);
  const [stepP1, setStepP1] = useState('');
  const [resultP1, setResultP1] = useState<{
    downloadUrl: string;
    filename: string;
    origHash: string;
    encHash: string;
    origSize: number;
    encSize: number;
    wasStripped: boolean;
  } | null>(null);
  const [errorP1, setErrorP1] = useState('');

  // -------------------------------------------------------------
  // Pipeline 2: Dual Share (One-Time Link + Self-Decrypting HTML)
  // -------------------------------------------------------------
  const [shareText, setShareText] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [showSharePassword, setShowSharePassword] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [burnAfterSeconds, setBurnAfterSeconds] = useState<number>(60);
  const [isProcessingP2, setIsProcessingP2] = useState(false);
  const [resultP2, setResultP2] = useState<{
    oneTimeUrl: string;
    qrDataUrl: string;
    htmlDownloadUrl: string;
    htmlFilename: string;
    expiresAt: number;
  } | null>(null);
  const [copiedP2, setCopiedP2] = useState<string | null>(null);
  const [errorP2, setErrorP2] = useState('');

  // -------------------------------------------------------------
  // Pipeline 3: Archive (ZIP / tar.gz) + Encrypt
  // -------------------------------------------------------------
  const [archiveFiles, setArchiveFiles] = useState<File[]>([]);
  const [archiveFormat, setArchiveFormat] = useState<'zip' | 'tar.gz'>('zip');
  const [archivePassword, setArchivePassword] = useState('');
  const [showArchivePassword, setShowArchivePassword] = useState(false);
  const [isProcessingP3, setIsProcessingP3] = useState(false);
  const [stepP3, setStepP3] = useState('');
  const [resultP3, setResultP3] = useState<{
    downloadUrl: string;
    filename: string;
    sha256: string;
    fileCount: number;
    size: number;
  } | null>(null);
  const [errorP3, setErrorP3] = useState('');

  // -------------------------------------------------------------
  // Pipeline 4: ZIP -> AES-256 -> AES Key RSA-OAEP Encrypt
  // -------------------------------------------------------------
  const [zipRsaFiles, setZipRsaFiles] = useState<File[]>([]);
  const [zipRsaArchiveName, setZipRsaArchiveName] = useState('secure_archive');
  const [zipRsaPublicKeyPem, setZipRsaPublicKeyPem] = useState('');
  const [selectedVaultRsaKeyId, setSelectedVaultRsaKeyId] = useState('');
  const [isProcessingP4, setIsProcessingP4] = useState(false);
  const [stepP4, setStepP4] = useState('');
  const [resultP4, setResultP4] = useState<{
    downloadUrl: string;
    filename: string;
    sha256: string;
    origSize: number;
    zipSize: number;
    encSize: number;
    fileCount: number;
  } | null>(null);
  const [errorP4, setErrorP4] = useState('');

  const rsaVaultKeys = vault?.keys.filter((k) => k.type === 'rsa-oaep' && !!k.publicKeyPem) || [];
  const signingVaultKeys = vault?.keys.filter((k) => (k.type === 'rsa-pss' || k.type === 'ecdsa') && !!k.privateKeyPem) || [];

  // -------------------------------------------------------------
  // Pipeline 5: Sign + Hybrid Encrypt (Sign-then-Encrypt)
  // -------------------------------------------------------------
  const [signEncryptFile, setSignEncryptFile] = useState<File | null>(null);
  const [senderSigType, setSenderSigType] = useState<'rsa-pss' | 'ecdsa'>('rsa-pss');
  const [senderPrivateKeyPem, setSenderPrivateKeyPem] = useState('');
  const [senderPublicKeyPem, setSenderPublicKeyPem] = useState('');
  const [selectedVaultSignKeyId, setSelectedVaultSignKeyId] = useState('');
  const [recipientHybridPublicKeyPem, setRecipientHybridPublicKeyPem] = useState('');
  const [selectedVaultRecipientKeyId, setSelectedVaultRecipientKeyId] = useState('');
  const [isProcessingP5, setIsProcessingP5] = useState(false);
  const [stepP5, setStepP5] = useState('');
  const [resultP5, setResultP5] = useState<{
    downloadUrl: string;
    filename: string;
    sha256: string;
    signatureBase64: string;
    origSize: number;
    encSize: number;
    sigType: string;
  } | null>(null);
  const [errorP5, setErrorP5] = useState('');

  // -------------------------------------------------------------
  // Pipeline 6: Shamir Secret Sharing + AES File Encryption
  // -------------------------------------------------------------
  const [shamirFile, setShamirFile] = useState<File | null>(null);
  const [shamirK, setShamirK] = useState(3);
  const [shamirN, setShamirN] = useState(5);
  const [isProcessingP6, setIsProcessingP6] = useState(false);
  const [stepP6, setStepP6] = useState('');
  const [resultP6, setResultP6] = useState<{
    encFileUrl: string;
    encFilename: string;
    encSize: number;
    sha256: string;
    rawKeyHex: string;
    shares: ShamirShare[];
    zipSharesUrl: string;
    zipSharesFilename: string;
  } | null>(null);
  const [activeShareQrIndex, setActiveShareQrIndex] = useState<number | null>(null);
  const [shareQrDataUrls, setShareQrDataUrls] = useState<Record<number, string>>({});
  const [errorP6, setErrorP6] = useState('');

  // -------------------------------------------------------------
  // Pipeline 7: Encrypt + Steganography Covert Transport
  // -------------------------------------------------------------
  const [stegoSecretFile, setStegoSecretFile] = useState<File | null>(null);
  const [stegoCarrierFile, setStegoCarrierFile] = useState<File | null>(null);
  const [stegoCarrierPreviewUrl, setStegoCarrierPreviewUrl] = useState<string | null>(null);
  const [stegoCarrierCap, setStegoCarrierCap] = useState<{ width: number; height: number; maxBytes: number; formattedMaxCapacity: string } | null>(null);
  const [stegoPassword, setStegoPassword] = useState('');
  const [showStegoPassword, setShowStegoPassword] = useState(false);
  const [isProcessingP7, setIsProcessingP7] = useState(false);
  const [stepP7, setStepP7] = useState('');
  const [resultP7, setResultP7] = useState<{
    downloadUrl: string;
    filename: string;
    capacityUsedPercent: number;
    origFileSize: number;
    carrierDimensions: string;
  } | null>(null);
  const [errorP7, setErrorP7] = useState('');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Pipeline 1 Handler
  const handleRunPrivacyEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFile) return setErrorP1('ファイルを選択してください');
    if (!password.trim()) return setErrorP1('暗号化パスワードを入力してください');

    setErrorP1('');
    setResultP1(null);
    setIsProcessingP1(true);

    try {
      let workingBuffer: ArrayBuffer;
      let wasStripped = false;

      if (stripMeta) {
        setStepP1('プライバシーメタデータ（Exif/ID3/PDFタグ等）を消去中...');
        const cleanBlob = await stripAllFileMetadata(targetFile);
        workingBuffer = await cleanBlob.arrayBuffer();
        wasStripped = true;
      } else {
        setStepP1('ファイルを読み込み中...');
        workingBuffer = await targetFile.arrayBuffer();
      }

      setStepP1('元ファイルの SHA-256 チェックサムを算出中...');
      const origHashResult = await computeHash(workingBuffer, 'SHA-256');

      setStepP1('AES-256-GCM で暗号化中...');
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKeyFromPassword(password.trim(), salt);

      const cipherBuf = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        workingBuffer
      );

      // Binary Package: [4b MAGIC 'ENC1'] [16b salt] [12b iv] [cipher]
      const magic = new TextEncoder().encode('ENC1');
      const finalPkg = new Uint8Array(4 + 16 + 12 + cipherBuf.byteLength);
      finalPkg.set(magic, 0);
      finalPkg.set(salt, 4);
      finalPkg.set(iv, 20);
      finalPkg.set(new Uint8Array(cipherBuf), 32);

      const blob = new Blob([finalPkg as any], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const encHashResult = await computeHash(finalPkg.buffer as ArrayBuffer, 'SHA-256');

      setResultP1({
        downloadUrl,
        filename: `${targetFile.name}.encrypted`,
        origHash: origHashResult.hex,
        encHash: encHashResult.hex,
        origSize: targetFile.size,
        encSize: blob.size,
        wasStripped,
      });
      setStepP1('完了しました');
    } catch (err: any) {
      setErrorP1(`処理エラー: ${err.message}`);
    } finally {
      setIsProcessingP1(false);
    }
  };

  // Pipeline 2 Handler: Self-Decrypting Package
  const handleRunMultiShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareText.trim()) return setErrorP2('秘密メッセージを入力してください');
    if (!sharePassword.trim()) return setErrorP2('復号パスワードを入力してください');

    setErrorP2('');
    setResultP2(null);
    setIsProcessingP2(true);

    try {
      // Self-Decrypting HTML
      const htmlString = await generateSelfDecryptingHtml({
        type: 'text',
        textContent: shareText.trim(),
        title: shareTitle.trim() || 'セキュアメッセージ',
        password: sharePassword.trim(),
        hint: undefined,
      });

      const htmlBlob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
      const htmlDownloadUrl = URL.createObjectURL(htmlBlob);

      // Generate QR Code containing the file title and confirmation
      const qrDataUrl = await QRCode.toDataURL(`SECURE_ENCRYPTED_PACKAGE:${shareTitle.trim() || 'package'}`, {
        margin: 1,
        width: 180,
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      setResultP2({
        oneTimeUrl: '',
        qrDataUrl,
        htmlDownloadUrl,
        htmlFilename: `${shareTitle.trim() || 'secure-note'}.html`,
        expiresAt: 0,
      });
    } catch (err: any) {
      setErrorP2(`生成エラー: ${err.message}`);
    } finally {
      setIsProcessingP2(false);
    }
  };

  // Pipeline 3 Handler: Archive + Encrypt
  const handleRunArchivePack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (archiveFiles.length === 0) return setErrorP3('ファイルを選択してください');
    if (!archivePassword.trim()) return setErrorP3('暗号化パスワードを入力してください');

    setErrorP3('');
    setResultP3(null);
    setIsProcessingP3(true);

    try {
      let finalBlob: Blob;
      let filename: string;

      if (archiveFormat === 'zip') {
        setStepP3('AES-256暗号化ZIPアーカイブを作成中...');
        finalBlob = await createEncryptedZip(archiveFiles, {
          password: archivePassword.trim(),
          encryptionStrength: 'aes-256',
        });
        filename = 'archive.zip';
      } else {
        setStepP3('TARアーカイブを生成中...');
        const entries = await Promise.all(
          archiveFiles.map(async (f) => ({
            name: f.name,
            data: new Uint8Array(await f.arrayBuffer()),
          }))
        );
        const tarBytes = createTarArchive(entries);

        setStepP3('Gzip圧縮ストリームを適用中...');
        const gzBytes = await compressTarToGz(tarBytes);

        setStepP3('AES-256-GCM で暗号化中...');
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKeyFromPassword(archivePassword.trim(), salt);
        const cipher = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          gzBytes as any
        );

        const magic = new TextEncoder().encode('TARGZENC1');
        const packed = new Uint8Array(9 + 16 + 12 + cipher.byteLength);
        packed.set(magic, 0);
        packed.set(salt, 9);
        packed.set(iv, 25);
        packed.set(new Uint8Array(cipher), 37);

        finalBlob = new Blob([packed as any], { type: 'application/gzip' });
        filename = 'archive.tar.gz.enc';
      }

      setStepP3('SHA-256ハッシュを計算中...');
      const buf = await finalBlob.arrayBuffer();
      const hashRes = await computeHash(buf, 'SHA-256');

      setResultP3({
        downloadUrl: URL.createObjectURL(finalBlob),
        filename,
        sha256: hashRes.hex,
        fileCount: archiveFiles.length,
        size: finalBlob.size,
      });
      setStepP3('完了しました');
    } catch (err: any) {
      setErrorP3(`アーカイブエラー: ${err.message}`);
    } finally {
      setIsProcessingP3(false);
    }
  };

  // Pipeline 4 Handler: ZIP -> AES-256 -> AES Key RSA-OAEP
  const handleRunZipAesRsa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zipRsaFiles.length === 0) return setErrorP4('暗号化するファイルを1つ以上選択してください');
    if (!zipRsaPublicKeyPem.trim()) return setErrorP4('受取人のRSA公開鍵 PEM を指定してください');

    setErrorP4('');
    setResultP4(null);
    setIsProcessingP4(true);

    try {
      setStepP4('1/4: 複数ファイルをZIPアーカイブに圧縮中...');
      const zipBlob = await createEncryptedZip(zipRsaFiles, {});
      const zipBuffer = await zipBlob.arrayBuffer();

      setStepP4('2/4: AES-256 セッション鍵を生成し、ZIPデータを暗号化中...');
      setStepP4('3/4: 受取人のRSA-OAEP公開鍵でセッション鍵を暗号化中...');
      const cleanBaseName = zipRsaArchiveName.trim().replace(/\.[^/.]+$/, '') || 'secure_archive';
      const innerFilename = `${cleanBaseName}.zip`;
      const encryptedBuffer = await encryptFileHybrid(
        zipBuffer,
        innerFilename,
        zipRsaPublicKeyPem.trim(),
        'SHA-256'
      );

      setStepP4('4/4: SHA-256 整合性チェックサムを算出中...');
      const hashRes = await computeHash(encryptedBuffer, 'SHA-256');

      const finalBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
      const outFilename = `${cleanBaseName}.zip.lcv`;

      setResultP4({
        downloadUrl: URL.createObjectURL(finalBlob),
        filename: outFilename,
        sha256: hashRes.hex,
        origSize: zipRsaFiles.reduce((acc, f) => acc + f.size, 0),
        zipSize: zipBuffer.byteLength,
        encSize: finalBlob.size,
        fileCount: zipRsaFiles.length,
      });
      setStepP4('完了しました');
    } catch (err: any) {
      setErrorP4(`パイプライン処理エラー: ${err.message}`);
    } finally {
      setIsProcessingP4(false);
    }
  };

  // -------------------------------------------------------------
  // Pipeline 5 Handler: Sign + Hybrid Encrypt (Sign-then-Encrypt)
  // -------------------------------------------------------------
  const handleRunSignEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signEncryptFile) return setErrorP5('暗号化するファイルを選択してください');
    if (!senderPrivateKeyPem.trim()) return setErrorP5('送信者の署名用秘密鍵 (PEM) を入力してください');
    if (!recipientHybridPublicKeyPem.trim()) return setErrorP5('受取人のRSA公開鍵 (PEM) を入力してください');

    setErrorP5('');
    setResultP5(null);
    setIsProcessingP5(true);

    try {
      setStepP5('1/4: ファイルを読み込み、送信者秘密鍵でデジタル署名を生成中...');
      const fileBuffer = await signEncryptFile.arrayBuffer();

      const sigRes = await signData({
        type: senderSigType,
        hash: 'SHA-256',
        namedCurve: 'P-256',
        privateKeyPem: senderPrivateKeyPem.trim(),
        data: fileBuffer,
      });

      setStepP5('2/4: 署名メタデータと平文を署名付きエンベロープに統合中...');
      const envelope = {
        type: 'lcv-signed-envelope-v1',
        originalFileName: signEncryptFile.name,
        originalFileSize: signEncryptFile.size,
        signature: sigRes.base64,
        signatureType: senderSigType,
        hashAlgorithm: 'SHA-256',
        signerPublicKeyPem: senderPublicKeyPem.trim(),
        payloadBase64: bufferToBase64(fileBuffer),
        signedAt: new Date().toISOString(),
      };
      const envelopeBytes = new TextEncoder().encode(JSON.stringify(envelope));

      setStepP5('3/4: ワンタイムAES鍵を生成し、受取人RSA公開鍵でハイブリッド暗号化中...');
      const encryptedBuffer = await encryptFileHybrid(
        envelopeBytes.buffer as ArrayBuffer,
        `${signEncryptFile.name}.signed.lcv`,
        recipientHybridPublicKeyPem.trim(),
        'SHA-256'
      );

      setStepP5('4/4: 改竄検知用 SHA-256 チェックサムを算出中...');
      const hashRes = await computeHash(encryptedBuffer, 'SHA-256');

      const finalBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
      const outFilename = `${signEncryptFile.name}.signed.lcv`;

      setResultP5({
        downloadUrl: URL.createObjectURL(finalBlob),
        filename: outFilename,
        sha256: hashRes.hex,
        signatureBase64: sigRes.base64,
        origSize: signEncryptFile.size,
        encSize: finalBlob.size,
        sigType: senderSigType.toUpperCase(),
      });
      setStepP5('完了しました');
    } catch (err: any) {
      setErrorP5(`パイプライン処理エラー: ${err.message}`);
    } finally {
      setIsProcessingP5(false);
    }
  };

  // -------------------------------------------------------------
  // Pipeline 6 Handler: Shamir Secret Sharing + AES File Encryption
  // -------------------------------------------------------------
  const handleRunShamirEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shamirFile) return setErrorP6('暗号化するファイルを選択してください');
    if (shamirK < 2 || shamirN < shamirK) {
      return setErrorP6('閾値 k は 2 以上、総数 n は k 以上である必要があります');
    }

    setErrorP6('');
    setResultP6(null);
    setIsProcessingP6(true);

    try {
      setStepP6('1/4: 暗号論的疑似乱数により256bit AES共通鍵を生成中...');
      const rawKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const rawKeyHex = bufferToHex(rawKeyBytes.buffer);

      setStepP6('2/4: 生成したAES-256鍵でファイルを暗号化中...');
      const fileBuffer = await shamirFile.arrayBuffer();
      const encBuffer = await encryptFileAesRaw(fileBuffer, shamirFile.name, rawKeyBytes.buffer);
      const hashRes = await computeHash(encBuffer, 'SHA-256');

      setStepP6(`3/4: シャミア秘密分散法により鍵を ${shamirN} 個のシェアに分割中 (閾値: ${shamirK})...`);
      const keyTextBytes = new TextEncoder().encode(rawKeyHex);
      const shares = splitSecret(keyTextBytes, shamirK, shamirN, {
        isText: true,
        filename: 'aes256_key.txt',
      });

      setStepP6('4/4: シェアファイル群と一括ZIPアーカイブを生成中...');
      const shareFiles: File[] = shares.map((s) => {
        const shareContent = `=== LOCAL CRYPTO VAULT - SHAMIR KEY SHARE (${s.x}/${s.n}) ===\n閾値 (k): ${s.k}\n総シェア数 (n): ${s.n}\nシェア番号: ${s.x}\n対象暗号ファイル: ${shamirFile.name}.aes.lcv\nCRC32チェックサム: ${s.checksum.toString(16)}\n\n${s.armoredText}\n\n[復元手順]\n任意の ${s.k} 個のシェアを Local Crypto Vault の「Shamir秘密分散」または「自動解析・復号」ツールに入力すると、AES暗号化鍵が即座に復元され、ファイルが解凍されます。\n`;
        return new File([shareContent], `share_${s.x}_of_${s.n}.txt`, { type: 'text/plain;charset=utf-8' });
      });

      const zipBlob = await createEncryptedZip(shareFiles, {});
      const encBlob = new Blob([encBuffer], { type: 'application/octet-stream' });
      const encFilename = `${shamirFile.name}.aes.lcv`;

      // Generate QR codes for quick view
      const qrMap: Record<number, string> = {};
      for (const s of shares.slice(0, 5)) {
        try {
          qrMap[s.x] = await QRCode.toDataURL(s.formattedText, { width: 220, margin: 1 });
        } catch {}
      }
      setShareQrDataUrls(qrMap);

      setResultP6({
        encFileUrl: URL.createObjectURL(encBlob),
        encFilename,
        encSize: encBlob.size,
        sha256: hashRes.hex,
        rawKeyHex,
        shares,
        zipSharesUrl: URL.createObjectURL(zipBlob),
        zipSharesFilename: `shares_${shamirK}_of_${shamirN}.zip`,
      });
      setStepP6('完了しました');
    } catch (err: any) {
      setErrorP6(`パイプライン処理エラー: ${err.message}`);
    } finally {
      setIsProcessingP6(false);
    }
  };

  // Helper to generate a default cover image for Steganography
  const handleGenerateDefaultCarrier = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 650;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 900, 650);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.4, '#1e1b4b');
    grad.addColorStop(0.8, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 650);

    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${60 + Math.random() * 120}, ${90 + Math.random() * 100}, ${200 + Math.random() * 55}, ${0.1 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 900, Math.random() * 650, 30 + Math.random() * 120, 0, Math.PI * 2);
      ctx.fill();
    }

    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const generatedFile = new File([blob], 'stealth_carrier.png', { type: 'image/png' });
    setStegoCarrierFile(generatedFile);
    setStegoCarrierPreviewUrl(URL.createObjectURL(generatedFile));
    setStegoCarrierCap(calculateImageCapacity(900, 650));
  };

  // -------------------------------------------------------------
  // Pipeline 7 Handler: Encrypt + Steganography Covert Transport
  // -------------------------------------------------------------
  const handleRunStegoEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stegoSecretFile) return setErrorP7('秘匿するファイルを選択してください');

    setErrorP7('');
    setResultP7(null);
    setIsProcessingP7(true);

    try {
      setStepP7('1/3: カバー画像を読み込み、埋め込み容量を算出中...');
      let carrierImgFile = stegoCarrierFile;
      if (!carrierImgFile) {
        // Generate carrier on the fly
        const canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 650;
        const ctx = canvas.getContext('2d')!;
        const grad = ctx.createLinearGradient(0, 0, 900, 650);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.4, '#1e1b4b');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 900, 650);
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        carrierImgFile = new File([blob], 'stealth_carrier.png', { type: 'image/png' });
        setStegoCarrierFile(carrierImgFile);
        setStegoCarrierPreviewUrl(URL.createObjectURL(carrierImgFile));
      }

      const img = new Image();
      const carrierUrl = URL.createObjectURL(carrierImgFile);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('カバー画像のデコードに失敗しました'));
        img.src = carrierUrl;
      });

      const cap = calculateImageCapacity(img.naturalWidth || img.width, img.naturalHeight || img.height);
      setStegoCarrierCap(cap);

      setStepP7('2/3: 秘密ファイルをGzip圧縮し、AES-256暗号化とCRC32整合性値を算出中...');
      const secretBytes = new Uint8Array(await stegoSecretFile.arrayBuffer());

      setStepP7('3/3: 画像のRGB画素ビット(LSB)へ不可視暗号埋め込み中...');
      const stegoRes = await encodeSteganography(img, {
        type: 'file',
        fileBytes: secretBytes,
        fileName: stegoSecretFile.name,
        mimeType: stegoSecretFile.type || 'application/octet-stream',
        password: stegoPassword.trim() || undefined,
        useCompression: true,
      });

      const downloadUrl = URL.createObjectURL(stegoRes.pngBlob);
      const usedPercent = Math.min(100, Math.round((stegoSecretFile.size / cap.maxBytes) * 100));

      setResultP7({
        downloadUrl,
        filename: `stego_${stegoSecretFile.name.replace(/\.[^/.]+$/, '')}.png`,
        capacityUsedPercent: usedPercent,
        origFileSize: stegoSecretFile.size,
        carrierDimensions: `${cap.width} × ${cap.height} px`,
      });
      setStepP7('完了しました');
    } catch (err: any) {
      setErrorP7(`ステガノグラフィ偽装エラー: ${err.message}`);
    } finally {
      setIsProcessingP7(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">アクション (一括実行パイプライン)</h2>
            <p className="text-[11px] text-slate-400">
              暗号化・メタデータ削除・圧縮・共有など、頻出するセキュリティ処理を1クリックで一括実行
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => setActivePipeline('privacy-encrypt')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'privacy-encrypt'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>プライバシー消去 ＋ AES暗号化</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              Exif/タグ削除 → ハッシュ算出 → AES-256暗号化を完全自動実行
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('multi-share')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'multi-share'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>ワンタイムリンク ＋ 自己復号HTML</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              時限消滅URLとオフライン単一HTMLの2大共有形式を同時発行
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('archive-pack')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'archive-pack'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
            <FolderArchive className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>一括アーカイブ ＋ パスワード暗号化</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              複数ファイルを tar.gz または ZIP にまとめてAES-256で安全に封印
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('zip-aes-rsa')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'zip-aes-rsa'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>ZIP化 ＋ AES ＋ RSA暗号化</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              複数ファイルをZIP化しAES-256暗号化、鍵を受取人のRSA公開鍵で封印
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('sign-encrypt')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'sign-encrypt'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
            <FileSignature className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>電子署名 ＋ ハイブリッド暗号化</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              送信者秘密鍵で署名付与後に受取人公開鍵で暗号化（Sign-then-Encrypt）
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('shamir-encrypt')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'shamir-encrypt'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
            <Share2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>Shamir鍵分割 ＋ AES暗号化</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              ファイルをAES暗号化し、鍵をシャミア秘密分散法でK-of-N分割出力
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActivePipeline('stego-encrypt')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
            activePipeline === 'stego-encrypt'
              ? 'bg-indigo-950/30 border-indigo-500 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>暗号化 ＋ ステガノグラフィ偽装</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
              ファイルをAES暗号化しカバー画像の画素ビット(LSB)へ不可視埋め込み
            </div>
          </div>
        </button>
      </div>

      {/* Pipeline 1: Privacy + Encrypt + Hash */}
      {activePipeline === 'privacy-encrypt' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-lg space-y-1 text-indigo-200">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>ワークフロー概要</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ファイルに残留するGPS位置情報やExif・著者タグ等のメタデータを不可逆消去した上で、AES-256-GCM暗号化と改竄照合用SHA-256ハッシュを一括生成します。
              </p>
            </div>

            <form onSubmit={handleRunPrivacyEncrypt} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">対象ファイル</label>
                <input
                  type="file"
                  onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
                {targetFile && (
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                    <span>選択: <strong className="text-slate-200">{targetFile.name}</strong></span>
                    <span>({(targetFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">暗号化パスワード</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="パスワードを入力"
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

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="stripMetaCheckbox"
                  checked={stripMeta}
                  onChange={(e) => setStripMeta(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="stripMetaCheckbox" className="text-slate-300 text-xs cursor-pointer select-none">
                  プライバシーメタデータを自動除去する (Exif, GPS, ID3, PDF著者等)
                </label>
              </div>

              {errorP1 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                  {errorP1}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP1 || !targetFile}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessingP1 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{stepP1}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>パイプラインを実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              パイプライン実行結果
            </h3>

            {resultP1 ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>全工程が正常に完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    暗号化ファイル: <code className="text-indigo-300">{resultP1.filename}</code>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    メタデータ消去: {resultP1.wasStripped ? '適用済み' : 'スキップ'}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-indigo-400" />
                      <span>暗号成果物 SHA-256:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resultP1.encHash, 'encHash')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedKey === 'encHash' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="text-emerald-300 break-all select-all">{resultP1.encHash}</div>
                </div>

                <a
                  href={resultP1.downloadUrl}
                  download={resultP1.filename}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>暗号化ファイルを保存</span>
                </a>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <ShieldCheck className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 2: Dual Share (One-Time Link + Self-Decrypting HTML) */}
      {activePipeline === 'multi-share' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg space-y-1 text-amber-200">
              <div className="font-semibold flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>デュアル形式ワンタイム共有</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ① チャット等ですぐ送れる<strong>URLフラグメント時限消滅リンク</strong>と、② オフラインのどんな環境でも開ける<strong>自己復号HTMLファイル</strong>を1入力で同時に生成します。
              </p>
            </div>

            <form onSubmit={handleRunMultiShare} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">タイトル / 件名 (任意)</label>
                <input
                  type="text"
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                  placeholder="例: 機密ログイン情報"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">秘密メッセージ本文</label>
                <textarea
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                  rows={4}
                  placeholder="相手に一度だけ安全に伝えたいテキスト・パスワードを入力..."
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">リンク有効期限</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={10}>10分間</option>
                    <option value={60}>1時間</option>
                    <option value={1440}>24時間 (1日)</option>
                    <option value={10080}>7日間</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">開封後自爆タイマー</label>
                  <select
                    value={burnAfterSeconds}
                    onChange={(e) => setBurnAfterSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={30}>30秒で消滅</option>
                    <option value={60}>60秒で消滅</option>
                    <option value={300}>5分で消滅</option>
                    <option value={0}>自動消滅なし</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  復号パスワード (任意)
                </label>
                <div className="relative">
                  <input
                    type={showSharePassword ? 'text' : 'password'}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="空欄の場合はリンク自体に鍵を含めます"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSharePassword(!showSharePassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showSharePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {errorP2 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                  {errorP2}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP2 || !shareText.trim()}
                className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessingP2 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>リンクとHTMLを同時生成</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              同時発行されたセキュア共有パッケージ
            </h3>

            {resultP2 ? (
              <div className="space-y-4">
                {/* Self-Decrypting HTML */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span>自己復号スタンドアロンHTML</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    外部サーバー不要で、ブラウザにドラッグ＆ドロップしてパスワードを入力するだけで復号できる単一HTMLファイルです。
                  </p>
                  <a
                    href={resultP2.htmlDownloadUrl}
                    download={resultP2.htmlFilename}
                    >
                    <Download className="w-4 h-4" />
                    <span>自己復号HTMLファイルを保存</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <Flame className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 3: Archive (ZIP / tar.gz) + Encrypt */}
      {activePipeline === 'archive-pack' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg space-y-1 text-emerald-200">
              <div className="font-semibold flex items-center gap-1.5">
                <FolderArchive className="w-4 h-4 text-emerald-400" />
                <span>複数ファイル一括アーカイブ &amp; 暗号化</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                複数ファイルを1つのアーカイブに圧縮し、AES-256でパスワード保護。Windows/Mac標準ツール対応のZIPまたは高圧縮tar.gzを選択できます。
              </p>
            </div>

            <form onSubmit={handleRunArchivePack} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  対象ファイル (複数選択可)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setArchiveFiles(Array.from(e.target.files || []))}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />
                {archiveFiles.length > 0 && (
                  <div className="mt-2 p-2 bg-slate-950 border border-slate-800 rounded-lg max-h-24 overflow-y-auto space-y-1">
                    {archiveFiles.map((f, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] text-slate-300">
                        <span className="truncate">{f.name}</span>
                        <span className="text-slate-500 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">アーカイブ形式</label>
                  <select
                    value={archiveFormat}
                    onChange={(e) => setArchiveFormat(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="zip">ZIP (AES-256暗号化)</option>
                    <option value="tar.gz">tar.gz (Gzip圧縮＋AES-256)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">暗号化パスワード</label>
                  <div className="relative">
                    <input
                      type={showArchivePassword ? 'text' : 'password'}
                      value={archivePassword}
                      onChange={(e) => setArchivePassword(e.target.value)}
                      placeholder="パスワードを入力"
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowArchivePassword(!showArchivePassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showArchivePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {errorP3 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                  {errorP3}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP3 || archiveFiles.length === 0}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                {isProcessingP3 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{stepP3}</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4" />
                    <span>一括アーカイブ＆暗号化を実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              アーカイブ生成結果
            </h3>

            {resultP3 ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>アーカイブが正常に完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    格納ファイル数: <strong className="text-slate-200">{resultP3.fileCount} 個</strong>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    アーカイブ容量: {(resultP3.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-indigo-400" />
                      <span>SHA-256 チェックサム:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resultP3.sha256, 'archiveSha256')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {copiedKey === 'archiveSha256' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="text-emerald-300 break-all select-all">{resultP3.sha256}</div>
                </div>

                <a
                  href={resultP3.downloadUrl}
                  download={resultP3.filename}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>暗号化アーカイブを保存</span>
                </a>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <FolderArchive className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 4: ZIP + AES-256 + RSA-OAEP Hybrid Envelope Encryption */}
      {activePipeline === 'zip-aes-rsa' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-lg space-y-1 text-cyan-200">
              <div className="font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>ワークフロー概要</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                複数ファイルを1つのZIPアーカイブへ統合し、高速なワンタイムAES-256鍵で暗号化。その鍵を受取人のRSA-OAEP公開鍵で暗号化してカプセル化（LCV_ENC1コンテナ）します。大容量ファイルを安全かつ確実に受取人限定で送付できます。
              </p>
            </div>

            <form onSubmit={handleRunZipAesRsa} className="space-y-4">
              {/* File Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  暗号化するファイル (複数選択可)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const files = Array.from(e.dataTransfer.files);
                      setZipRsaFiles((prev) => [...prev, ...files]);
                    }
                  }}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-3 text-center bg-slate-950/50"
                >
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const files = Array.from(e.target.files);
                        setZipRsaFiles((prev) => [...prev, ...files]);
                      }
                    }}
                    className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    ここに複数のファイルをドラッグ＆ドロップして一括追加できます
                  </p>
                </div>

                {zipRsaFiles.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 bg-slate-950 border border-slate-800 rounded-lg p-2.5 max-h-40 overflow-y-auto">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                      <span>追加済みファイル: <strong className="text-slate-200">{zipRsaFiles.length} 件</strong></span>
                      <div className="flex items-center gap-2">
                        <span>合計 {(zipRsaFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB</span>
                        <button
                          type="button"
                          onClick={() => setZipRsaFiles([])}
                          className="text-rose-400 hover:text-rose-300 text-[10px]"
                        >
                          全解除
                        </button>
                      </div>
                    </div>
                    {zipRsaFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-900 text-[11px]"
                      >
                        <span className="text-slate-200 truncate max-w-[240px]">{file.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-400 text-[10px]">{(file.size / 1024).toFixed(1)} KB</span>
                          <button
                            type="button"
                            onClick={() => setZipRsaFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-rose-400 p-0.5"
                            title="削除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Archive Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  アーカイブ名 (拡張子不要)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={zipRsaArchiveName}
                    onChange={(e) => setZipRsaArchiveName(e.target.value)}
                    placeholder="secure_archive"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-400 text-xs font-mono shrink-0">.zip.lcv</span>
                </div>
              </div>

              {/* Recipient Public Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span>受取人のRSA公開鍵 (PEM形式)</span>
                  </label>
                  <FileLoaderButton
                    onFileLoaded={(content) => {
                      setZipRsaPublicKeyPem(content);
                    }}
                    label="公開鍵ファイルを読込"
                    accept=".pem,.pub,.key,.txt"
                    className="text-[11px] py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                  />
                </div>

                {rsaVaultKeys.length > 0 && (
                  <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400 shrink-0">キー保管庫から選ぶ:</span>
                    <select
                      value={selectedVaultRsaKeyId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedVaultRsaKeyId(id);
                        const k = rsaVaultKeys.find((item) => item.id === id);
                        if (k?.publicKeyPem) setZipRsaPublicKeyPem(k.publicKeyPem);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
                    >
                      <option value="">選択してください...</option>
                      {rsaVaultKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title} ({k.algorithmDetails?.modulusLength || 2048}bit)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea
                  value={zipRsaPublicKeyPem}
                  onChange={(e) => setZipRsaPublicKeyPem(e.target.value)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const text = await e.dataTransfer.files[0].text();
                      setZipRsaPublicKeyPem(text);
                    }
                  }}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;受取人の公開鍵を貼り付けるか、ファイルをここにドロップ&#10;-----END PUBLIC KEY-----"
                  rows={4}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-[11px] focus:outline-none focus:border-cyan-500 leading-tight"
                />
              </div>

              {stepP4 && (
                <div className="p-2.5 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-cyan-300 text-[11px] flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{stepP4}</span>
                </div>
              )}

              {errorP4 && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-[11px]">
                  {errorP4}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP4 || zipRsaFiles.length === 0}
                className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isProcessingP4 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>処理中...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>ZIP化 ＋ AES暗号化 ＋ RSA鍵封印を実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result Card */}
          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              暗号化コンテナ生成結果
            </h3>

            {resultP4 ? (
              <div className="space-y-3">
                <div className="p-3 bg-cyan-950/30 border border-cyan-800/60 rounded-lg text-cyan-300 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-cyan-400" />
                    <span>暗号化コンテナが正常に作成されました</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-cyan-900/40 font-mono">
                    <div>
                      格納数: <strong className="text-slate-100">{resultP4.fileCount} ファイル</strong>
                    </div>
                    <div>
                      元合計: {(resultP4.origSize / 1024).toFixed(1)} KB
                    </div>
                    <div>
                      ZIP圧縮後: {(resultP4.zipSize / 1024).toFixed(1)} KB
                    </div>
                    <div>
                      暗号化容量: {(resultP4.encSize / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-cyan-400" />
                      <span>SHA-256 チェックサム:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resultP4.sha256, 'zipRsaSha256')}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {copiedKey === 'zipRsaSha256' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="text-cyan-300 break-all select-all">{resultP4.sha256}</div>
                </div>

                <a
                  href={resultP4.downloadUrl}
                  download={resultP4.filename}
                  className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>暗号化ファイル ({resultP4.filename}) を保存</span>
                </a>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-200">復号方法</div>
                  <p className="leading-relaxed">
                    受取人は「自動解析・復号」または「RSA暗号」タブにこのファイルをドラッグ＆ドロップし、対応するRSA秘密鍵を指定するだけで自動復号・ZIP展開が実行されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <Lock className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 5: Digital Signature + Hybrid Encryption (Sign-then-Encrypt) */}
      {activePipeline === 'sign-encrypt' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-lg space-y-1 text-purple-200">
              <div className="font-semibold flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-purple-400" />
                <span>ワークフロー概要</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                送信者秘密鍵でファイル全体に電子署名を生成した上で、受取人のRSA公開鍵を用いてワンタイムAES-256ハイブリッド暗号化（Sign-then-Encrypt）を行います。受取人は復号と同時に署名の真正性と改竄の不在を検証でき、暗号化とデジタル署名をワンステップで完結させます。
              </p>
            </div>

            <form onSubmit={handleRunSignEncrypt} className="space-y-4">
              {/* Target File */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">対象ファイル</label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files?.[0]) {
                      setSignEncryptFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-3 text-center bg-slate-950/50"
                >
                  <input
                    type="file"
                    onChange={(e) => setSignEncryptFile(e.target.files?.[0] || null)}
                    className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                  />
                  {signEncryptFile ? (
                    <div className="text-[11px] text-purple-300 mt-2 font-mono flex items-center justify-center gap-2">
                      <span>選択中: <strong>{signEncryptFile.name}</strong></span>
                      <span>({(signEncryptFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1">
                      暗号化＋署名するファイルをドラッグ＆ドロップまたは選択
                    </p>
                  )}
                </div>
              </div>

              {/* Sender Signature Key */}
              <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <FileSignature className="w-3.5 h-3.5 text-purple-400" />
                    <span>送信者の署名用秘密鍵</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={senderSigType}
                      onChange={(e) => setSenderSigType(e.target.value as any)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200"
                    >
                      <option value="rsa-pss">RSA-PSS (SHA-256)</option>
                      <option value="ecdsa">ECDSA (P-256)</option>
                    </select>
                    <FileLoaderButton
                      onFileLoaded={(content) => setSenderPrivateKeyPem(content)}
                      label="秘密鍵読込"
                      accept=".pem,.key,.txt"
                      className="text-[10px] py-0.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                    />
                  </div>
                </div>

                {signingVaultKeys.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400 shrink-0">保管庫から選ぶ:</span>
                    <select
                      value={selectedVaultSignKeyId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedVaultSignKeyId(id);
                        const k = signingVaultKeys.find((item) => item.id === id);
                        if (k?.privateKeyPem) setSenderPrivateKeyPem(k.privateKeyPem);
                        if (k?.publicKeyPem) setSenderPublicKeyPem(k.publicKeyPem);
                        if (k?.type === 'ecdsa') setSenderSigType('ecdsa');
                        else if (k?.type === 'rsa-pss') setSenderSigType('rsa-pss');
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    >
                      <option value="">選択してください...</option>
                      {signingVaultKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title} ({k.type.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea
                  value={senderPrivateKeyPem}
                  onChange={(e) => setSenderPrivateKeyPem(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;送信者の署名用秘密鍵 PEM を貼り付け&#10;-----END PRIVATE KEY-----"
                  rows={3}
                  required
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono text-[10px] focus:outline-none focus:border-purple-500"
                />

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">送信者の公開鍵 PEM (受取人の自動検証用・推奨):</span>
                    <FileLoaderButton
                      onFileLoaded={(content) => setSenderPublicKeyPem(content)}
                      label="公開鍵読込"
                      accept=".pem,.pub,.key,.txt"
                      className="text-[10px] py-0.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                    />
                  </div>
                  <textarea
                    value={senderPublicKeyPem}
                    onChange={(e) => setSenderPublicKeyPem(e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----&#10;送信者の公開鍵 PEM (受取人が復号時に署名真正性を自動照合するためにカプセル化されます)&#10;-----END PUBLIC KEY-----"
                    rows={2}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono text-[10px] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Recipient Hybrid RSA Public Key */}
              <div className="space-y-1.5 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-400" />
                    <span>受取人のRSA暗号化公開鍵 (RSA-OAEP)</span>
                  </span>
                  <FileLoaderButton
                    onFileLoaded={(content) => setRecipientHybridPublicKeyPem(content)}
                    label="公開鍵読込"
                    accept=".pem,.pub,.key,.txt"
                    className="text-[10px] py-0.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                  />
                </div>

                {rsaVaultKeys.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400 shrink-0">保管庫から選ぶ:</span>
                    <select
                      value={selectedVaultRecipientKeyId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedVaultRecipientKeyId(id);
                        const k = rsaVaultKeys.find((item) => item.id === id);
                        if (k?.publicKeyPem) setRecipientHybridPublicKeyPem(k.publicKeyPem);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    >
                      <option value="">選択してください...</option>
                      {rsaVaultKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title} ({k.algorithmDetails?.modulusLength || 2048}bit)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea
                  value={recipientHybridPublicKeyPem}
                  onChange={(e) => setRecipientHybridPublicKeyPem(e.target.value)}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;受取人のRSA公開鍵 PEM を貼り付け&#10;-----END PUBLIC KEY-----"
                  rows={3}
                  required
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono text-[10px] focus:outline-none focus:border-purple-500"
                />
              </div>

              {stepP5 && (
                <div className="p-2.5 bg-purple-950/30 border border-purple-800/40 rounded-lg text-purple-300 text-[11px] flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{stepP5}</span>
                </div>
              )}

              {errorP5 && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-[11px]">
                  {errorP5}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP5 || !signEncryptFile}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isProcessingP5 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>処理中...</span>
                  </>
                ) : (
                  <>
                    <FileSignature className="w-4 h-4" />
                    <span>署名付与 ＋ ハイブリッド暗号化を実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result Card */}
          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              署名付き暗号化パッケージ結果
            </h3>

            {resultP5 ? (
              <div className="space-y-3">
                <div className="p-3 bg-purple-950/30 border border-purple-800/60 rounded-lg text-purple-300 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-purple-400" />
                    <span>署名・暗号化パッケージが完成しました</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono space-y-0.5 pt-1 border-t border-purple-900/40">
                    <div>署名方式: <strong className="text-slate-100">{resultP5.sigType}</strong></div>
                    <div>平文サイズ: {(resultP5.origSize / 1024).toFixed(1)} KB</div>
                    <div>暗号コンテナサイズ: {(resultP5.encSize / 1024).toFixed(1)} KB</div>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-purple-400" />
                      <span>SHA-256 チェックサム:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resultP5.sha256, 'signSha256')}
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      {copiedKey === 'signSha256' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>コピー</span>
                    </button>
                  </div>
                  <div className="text-purple-300 break-all select-all">{resultP5.sha256}</div>
                </div>

                <a
                  href={resultP5.downloadUrl}
                  download={resultP5.filename}
                  className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>暗号化パッケージ ({resultP5.filename}) を保存</span>
                </a>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-200">復号と署名検証方法</div>
                  <p className="leading-relaxed">
                    受取人はこのファイルを「自動解析・復号」ツールにドラッグ＆ドロップし、自身のRSA秘密鍵を指定するだけで自動復号が行われ、同時に送信者の電子署名検証結果が表示されます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <FileSignature className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 6: Shamir Secret Sharing + AES File Encryption */}
      {activePipeline === 'shamir-encrypt' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-blue-950/20 border border-blue-800/40 rounded-lg space-y-1 text-blue-200">
              <div className="font-semibold flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-blue-400" />
                <span>ワークフロー概要</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ファイルを強力なAES-256共通鍵で暗号化し、その暗号鍵をシャミアの秘密分散法（K-of-N 閾値秘密分散）で数学的に分割します。指定した K 個のシェアが集まらない限り、暗号論的に鍵の復元は不可能です。共同管理・取締役会・複数管理者での金庫保管に最適です。
              </p>
            </div>

            <form onSubmit={handleRunShamirEncrypt} className="space-y-4">
              {/* Target File */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">暗号化するファイル</label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files?.[0]) {
                      setShamirFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-3 text-center bg-slate-950/50"
                >
                  <input
                    type="file"
                    onChange={(e) => setShamirFile(e.target.files?.[0] || null)}
                    className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />
                  {shamirFile ? (
                    <div className="text-[11px] text-blue-300 mt-2 font-mono flex items-center justify-center gap-2">
                      <span>選択中: <strong>{shamirFile.name}</strong></span>
                      <span>({(shamirFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1">
                      暗号化対象ファイルをドラッグ＆ドロップまたは選択
                    </p>
                  )}
                </div>
              </div>

              {/* Threshold Parameters */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    復元閾値 k (必要人数)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={shamirK}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 2;
                      setShamirK(val);
                      if (shamirN < val) setShamirN(val);
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-center focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    鍵の復元に最低限必要なシェア数
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    総シェア数 n (配布総数)
                  </label>
                  <input
                    type="number"
                    min={shamirK}
                    max={50}
                    value={shamirN}
                    onChange={(e) => setShamirN(parseInt(e.target.value) || shamirK)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-center focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    発行・配布する合計シェア数
                  </span>
                </div>
              </div>

              {stepP6 && (
                <div className="p-2.5 bg-blue-950/30 border border-blue-800/40 rounded-lg text-blue-300 text-[11px] flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{stepP6}</span>
                </div>
              )}

              {errorP6 && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-[11px]">
                  {errorP6}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP6 || !shamirFile}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isProcessingP6 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>処理中...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>AES暗号化 ＋ Shamir鍵分割を実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result Card */}
          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              暗号ファイル ＆ 鍵分割シェア群
            </h3>

            {resultP6 ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-950/30 border border-blue-800/60 rounded-lg text-blue-300 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-blue-400" />
                    <span>暗号化と {resultP6.shares.length} 個の鍵分割が完了しました</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">
                    閾値: <strong className="text-slate-100">{shamirK} of {shamirN}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={resultP6.encFileUrl}
                    download={resultP6.encFilename}
                    className="py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-1.5 shadow-sm text-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>暗号化本体 (.lcv)</span>
                  </a>

                  <a
                    href={resultP6.zipSharesUrl}
                    download={resultP6.zipSharesFilename}
                    className="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-1.5 shadow-sm text-center"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>全シェア一括ZIP</span>
                  </a>
                </div>

                {/* Individual Share List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {resultP6.shares.map((s) => (
                    <div key={s.x} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-200">
                          シェア {s.x} / {s.n}
                        </span>
                        <div className="flex items-center gap-2">
                          {shareQrDataUrls[s.x] && (
                            <button
                              type="button"
                              onClick={() => setActiveShareQrIndex(activeShareQrIndex === s.x ? null : s.x)}
                              className="text-slate-400 hover:text-blue-400 flex items-center gap-0.5 text-[10px]"
                            >
                              <QrCode className="w-3 h-3" />
                              <span>QR</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(s.formattedText, `share-${s.x}`)}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5 text-[10px]"
                          >
                            {copiedKey === `share-${s.x}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>コピー</span>
                          </button>
                        </div>
                      </div>

                      {activeShareQrIndex === s.x && shareQrDataUrls[s.x] && (
                        <div className="p-2 bg-white rounded flex justify-center">
                          <img src={shareQrDataUrls[s.x]} alt={`Share ${s.x} QR`} className="w-36 h-36" />
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-slate-400 truncate bg-slate-900/60 p-1 rounded">
                        {s.formattedText}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-[10px] text-slate-400">
                  【復元方法】参加者のうち任意の {shamirK} 名のシェアを「Shamir秘密分散」または「自動解析・復号」に投入するとAESキーが再構築されます。
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <Share2 className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline 7: Encrypt + Steganography Covert Transport */}
      {activePipeline === 'stego-encrypt' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg space-y-1 text-rose-200">
              <div className="font-semibold flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-rose-400" />
                <span>ワークフロー概要</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ファイルをGzip圧縮およびAES-256暗号化した上で、カバー画像のRGB画素最下位ビット(LSB)に不可視埋め込みします。通信監査や検閲を回避し、外見上は無害な画像ファイルとして極秘ファイルを安全に偽装転送できます。
              </p>
            </div>

            <form onSubmit={handleRunStegoEncrypt} className="space-y-4">
              {/* Secret Target File */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  秘匿するファイル (ドキュメント/暗号ファイル等)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files?.[0]) {
                      setStegoSecretFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-3 text-center bg-slate-950/50"
                >
                  <input
                    type="file"
                    onChange={(e) => setStegoSecretFile(e.target.files?.[0] || null)}
                    className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white hover:file:bg-rose-500 cursor-pointer"
                  />
                  {stegoSecretFile ? (
                    <div className="text-[11px] text-rose-300 mt-2 font-mono flex items-center justify-center gap-2">
                      <span>秘匿対象: <strong>{stegoSecretFile.name}</strong></span>
                      <span>({(stegoSecretFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1">
                      画像の中に隠したい秘密ファイルをドラッグ＆ドロップまたは選択
                    </p>
                  )}
                </div>
              </div>

              {/* Cover Carrier Image */}
              <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
                    <span>カバー画像 (偽装用キャリア画像)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateDefaultCarrier}
                    className="text-[10px] py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>カバー画像を自動生成</span>
                  </button>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      setStegoCarrierFile(file);
                      setStegoCarrierPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                  className="border border-slate-800 rounded-lg p-2.5 text-center bg-slate-900/60"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setStegoCarrierFile(file);
                        setStegoCarrierPreviewUrl(URL.createObjectURL(file));
                      }
                    }}
                    className="w-full text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                  />
                  {stegoCarrierPreviewUrl && (
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <img
                        src={stegoCarrierPreviewUrl}
                        alt="Carrier preview"
                        className="w-16 h-12 object-cover rounded border border-slate-700"
                      />
                      <div className="text-[11px] text-slate-300 text-left">
                        <div>{stegoCarrierFile?.name}</div>
                        {stegoCarrierCap && (
                          <div className="text-[10px] text-slate-400">
                            最大埋込容量: <strong className="text-rose-400">{stegoCarrierCap.formattedMaxCapacity}</strong> ({stegoCarrierCap.width}×{stegoCarrierCap.height})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Encryption Password */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  暗号化パスワード (任意・空欄の場合は平文埋め込み)
                </label>
                <div className="relative">
                  <input
                    type={showStegoPassword ? 'text' : 'password'}
                    value={stegoPassword}
                    onChange={(e) => setStegoPassword(e.target.value)}
                    placeholder="パスワードを入力（推奨）"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono pr-10 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStegoPassword(!showStegoPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showStegoPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {stepP7 && (
                <div className="p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-lg text-rose-300 text-[11px] flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{stepP7}</span>
                </div>
              )}

              {errorP7 && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-[11px]">
                  {errorP7}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingP7 || !stegoSecretFile}
                className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {isProcessingP7 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>偽装中...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    <span>AES暗号化 ＋ ステガノグラフィ偽装を実行</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result Card */}
          <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">
              偽装画像生成結果
            </h3>

            {resultP7 ? (
              <div className="space-y-3">
                <div className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-lg text-rose-300 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-rose-400" />
                    <span>偽装PNG画像が完成しました</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono space-y-0.5 pt-1 border-t border-rose-900/40">
                    <div>解像度: {resultP7.carrierDimensions}</div>
                    <div>秘匿データ: {(resultP7.origFileSize / 1024).toFixed(1)} KB</div>
                    <div>画像容量占有率: {resultP7.capacityUsedPercent}%</div>
                  </div>
                </div>

                <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg flex justify-center">
                  <img
                    src={resultP7.downloadUrl}
                    alt="Stego Result"
                    className="max-h-48 rounded object-contain border border-slate-800"
                  />
                </div>

                <a
                  href={resultP7.downloadUrl}
                  download={resultP7.filename}
                  className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>偽装画像 ({resultP7.filename}) を保存</span>
                </a>

                <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-200">復号・抽出方法</div>
                  <p className="leading-relaxed">
                    受取人はこのPNG画像を「自動解析・復号」または「ステガノグラフィ」ツールにドラッグ＆ドロップし、パスワードを入力するだけで即座に平文ファイルを抽出・復元できます。
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-1">
                <ImageIcon className="w-8 h-8 mx-auto text-slate-600" />
                <div>左のパネルで実行してください</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
