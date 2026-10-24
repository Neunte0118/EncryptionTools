import {
  isEncryptedFile,
  detectEncryptedFileMetadata,
  decryptFileAesPassword,
  decryptFileAesRaw,
  decryptFileHybrid,
  verifyData,
  base64ToBuffer,
  bufferToBase64,
  bufferToString,
} from './cryptoUtils';
import { chacha20DecryptFile, chacha20DecryptWithPassword } from './chachaUtils';
import { decryptPgpMessage, decryptPgpFile } from './pgpUtils';
import { parseShareString, reconstructSecret, ShamirShare } from './shamirUtils';
import { overlayShares } from './visualCryptoUtils';
import { decryptWithUserKey, AbeCipherPackage, UserSecretKey } from './abeUtils';
import { parsePaillierPrivateKey, paillierDecrypt, FheDatasetPackage, FheAggregatePackage } from './fheUtils';
import { inspectStegoHeader, decodeSteganography } from './steganographyUtils';
import { extractRoundFromCiphertext } from './timelockUtils';
import { timelockDecrypt } from 'tlock-js';
import { KeyVaultFile } from '../types/crypto';

export type DetectedCryptoType =
  | 'lcv-aes-password'
  | 'lcv-aes-raw'
  | 'lcv-hybrid-rsa'
  | 'chacha20-poly1305'
  | 'self-decrypt-html'
  | 'openpgp-message'
  | 'openpgp-private-key'
  | 'openpgp-public-key'
  | 'rsa-private-key'
  | 'rsa-public-key'
  | 'shamir-share'
  | 'visual-crypto-share'
  | 'steganography-image'
  | 'timelock-age'
  | 'abe-cipher-package'
  | 'abe-user-key'
  | 'fhe-package'
  | 'candidate-password'
  | 'candidate-raw-key'
  | 'generic-ciphertext'
  | 'unknown';

export interface AnalyzedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  buffer: ArrayBuffer;
  text?: string;
  detectedType: DetectedCryptoType;
  typeLabel: string;
  isKeyOrSecret: boolean;
  metadata?: Record<string, any>;
}

export interface DecryptionResult {
  id: string;
  sourceFileNames: string[];
  algorithm: string;
  status: 'success' | 'needs-key' | 'failed' | 'processing';
  errorMessage?: string;
  outputFileName?: string;
  outputSize?: number;
  outputBuffer?: ArrayBuffer;
  outputText?: string;
  outputDataUrl?: string;
  isText?: boolean;
  isImage?: boolean;
  details?: string;
}

const CHACHA_MAGIC = [0x43, 0x48, 0x41, 0x32, 0x30, 0x46, 0x49, 0x4c]; // CHA20FIL

/**
 * Classify a single file based on header, magic bytes, structure, or text format.
 */
export async function analyzeFile(file: File): Promise<AnalyzedFile> {
  const buffer = await file.arrayBuffer();
  const id = `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const bytes = new Uint8Array(buffer);

  let text: string | undefined = undefined;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // not valid utf-8 text
  }

  // 1. Check LCV_ENC1 (Local Crypto Vault native format)
  if (isEncryptedFile(buffer)) {
    const meta = detectEncryptedFileMetadata(buffer);
    if (meta) {
      if (meta.mode === 'aes-password') {
        return {
          id,
          file,
          name: file.name,
          size: file.size,
          buffer,
          detectedType: 'lcv-aes-password',
          typeLabel: 'AES-256 パスワード暗号化ファイル',
          isKeyOrSecret: false,
          metadata: { originalFilename: meta.filename, mode: meta.mode },
        };
      } else if (meta.mode === 'aes-raw') {
        return {
          id,
          file,
          name: file.name,
          size: file.size,
          buffer,
          detectedType: 'lcv-aes-raw',
          typeLabel: 'AES-256 共通鍵暗号化ファイル',
          isKeyOrSecret: false,
          metadata: { originalFilename: meta.filename, mode: meta.mode },
        };
      } else if (meta.mode === 'hybrid-rsa') {
        return {
          id,
          file,
          name: file.name,
          size: file.size,
          buffer,
          detectedType: 'lcv-hybrid-rsa',
          typeLabel: 'RSA-OAEP ハイブリッド暗号化ファイル',
          isKeyOrSecret: false,
          metadata: { originalFilename: meta.filename, mode: meta.mode },
        };
      }
    }
  }

  // 2. Check ChaCha20-Poly1305 file magic
  if (bytes.length >= 36) {
    let matchChaCha = true;
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== CHACHA_MAGIC[i]) {
        matchChaCha = false;
        break;
      }
    }
    if (matchChaCha) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        detectedType: 'chacha20-poly1305',
        typeLabel: 'ChaCha20-Poly1305 暗号化ファイル',
        isKeyOrSecret: false,
      };
    }
  }

  // 3. Text-based formats (HTML self-decrypting, OpenPGP, PEM, Shamir, Age, JSON packages)
  if (text) {
    const trimmed = text.trim();

    // 3.1 Self-Decrypting Package
    if (
      (file.name.endsWith('.html') || file.name.endsWith('.htm') || trimmed.includes('<!DOCTYPE html>')) &&
      (trimmed.includes('__ENCRYPTED_PAYLOAD__') || trimmed.includes('自己復号パッケージ'))
    ) {
      let payloadMeta: any = null;
      const match = trimmed.match(/window\.__ENCRYPTED_PAYLOAD__\s*=\s*(\{[\s\S]*?\});/);
      if (match) {
        try {
          payloadMeta = JSON.parse(match[1]);
        } catch {}
      }
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'self-decrypt-html',
        typeLabel: '自己復号HTMLパッケージ',
        isKeyOrSecret: false,
        metadata: payloadMeta || {},
      };
    }

    // 3.2 OpenPGP
    if (trimmed.includes('-----BEGIN PGP MESSAGE-----')) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'openpgp-message',
        typeLabel: 'OpenPGP 暗号化メッセージ',
        isKeyOrSecret: false,
      };
    }
    if (trimmed.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'openpgp-private-key',
        typeLabel: 'OpenPGP 秘密鍵ブロック',
        isKeyOrSecret: true,
      };
    }
    if (trimmed.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'openpgp-public-key',
        typeLabel: 'OpenPGP 公開鍵ブロック',
        isKeyOrSecret: true,
      };
    }

    // 3.3 PEM Keys
    if (trimmed.includes('-----BEGIN PRIVATE KEY-----') || trimmed.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'rsa-private-key',
        typeLabel: 'RSA/PKCS8 秘密鍵 PEM',
        isKeyOrSecret: true,
      };
    }
    if (trimmed.includes('-----BEGIN PUBLIC KEY-----') || trimmed.includes('-----BEGIN RSA PUBLIC KEY-----')) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'rsa-public-key',
        typeLabel: 'RSA/SPKI 公開鍵 PEM',
        isKeyOrSecret: true,
      };
    }

    // 3.4 Shamir Secret Share
    if (
      trimmed.includes('-----BEGIN SHAMIR SECRET SHARE-----') ||
      trimmed.startsWith('SSS1-') ||
      (trimmed.includes('"threshold"') && trimmed.includes('"shareIndex"'))
    ) {
      const shareInfo = parseShareString(trimmed);
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'shamir-share',
        typeLabel: 'シャミア秘密分散シェア',
        isKeyOrSecret: true,
        metadata: shareInfo || {},
      };
    }

    // 3.5 Timelock Age
    if (trimmed.includes('age-encryption.org/v1') || trimmed.includes('-----BEGIN AGE ENCRYPTED FILE-----')) {
      const roundMeta = extractRoundFromCiphertext(trimmed);
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text,
        detectedType: 'timelock-age',
        typeLabel: 'タイムロック暗号ファイル',
        isKeyOrSecret: false,
        metadata: roundMeta || {},
      };
    }

    // 3.6 JSON Packages (ABE / FHE)
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const json = JSON.parse(trimmed);
        if (json.format === 'ABE_CIPHER_PACKAGE' || json.leafCipherShares) {
          return {
            id,
            file,
            name: file.name,
            size: file.size,
            buffer,
            text,
            detectedType: 'abe-cipher-package',
            typeLabel: '属性ベース暗号パッケージ',
            isKeyOrSecret: false,
            metadata: { policy: json.policyExpression },
          };
        }
        if (json.format === 'ABE_USER_KEY' || json.attributeTokens) {
          return {
            id,
            file,
            name: file.name,
            size: file.size,
            buffer,
            text,
            detectedType: 'abe-user-key',
            typeLabel: '属性ベース暗号ユーザー鍵',
            isKeyOrSecret: true,
            metadata: { attributes: json.attributes },
          };
        }
        if (json.format === 'FHE_PAILLIER_DATASET' || json.format === 'FHE_PAILLIER_AGGREGATE') {
          return {
            id,
            file,
            name: file.name,
            size: file.size,
            buffer,
            text,
            detectedType: 'fhe-package',
            typeLabel: '準同型暗号データセット',
            isKeyOrSecret: false,
            metadata: { title: json.title },
          };
        }
      } catch {}
    }

    // 3.7 Candidate Password or Keyfile
    if (
      (file.name.toLowerCase().includes('pass') ||
        file.name.toLowerCase().includes('key') ||
        file.name.toLowerCase().includes('pwd') ||
        file.name.endsWith('.key') ||
        file.name.endsWith('.pwd')) &&
      trimmed.length < 512
    ) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text: trimmed,
        detectedType: 'candidate-password',
        typeLabel: 'パスワード・秘密文字列ファイル',
        isKeyOrSecret: true,
      };
    }

    // 3.8 Generic base64 ciphertext
    if (/^[A-Za-z0-9+/=_\-\r\n\s]{32,}$/.test(trimmed) && trimmed.length < 100000) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        text: trimmed,
        detectedType: 'generic-ciphertext',
        typeLabel: 'Base64 暗号文データ',
        isKeyOrSecret: false,
      };
    }
  }

  // 4. Binary Image Steganography Check
  if (file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|bmp)$/i.test(file.name)) {
    try {
      const img = await loadImageFromBlob(file);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const stegHeader = inspectStegoHeader(imgData);
        if (stegHeader) {
          return {
            id,
            file,
            name: file.name,
            size: file.size,
            buffer,
            detectedType: 'steganography-image',
            typeLabel: 'ステガノグラフィ埋込画像',
            isKeyOrSecret: false,
            metadata: stegHeader,
          };
        }
      }
    } catch {}

    // Check if it might be a visual crypto share (e.g., share1.png, share2.png, or transparent/black)
    if (file.name.toLowerCase().includes('share') || file.name.toLowerCase().includes('visual')) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        detectedType: 'visual-crypto-share',
        typeLabel: '視覚復号暗号シェア画像',
        isKeyOrSecret: true,
      };
    }
  }

  // 5. Binary Raw Key (16, 24, 32 bytes or named key)
  if (bytes.length === 16 || bytes.length === 24 || bytes.length === 32 || file.name.endsWith('.key') || file.name.endsWith('.bin')) {
    if (bytes.length === 32 || bytes.length === 16) {
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        buffer,
        detectedType: 'candidate-raw-key',
        typeLabel: `${bytes.length * 8}ビット共通鍵バイナリ`,
        isKeyOrSecret: true,
      };
    }
  }

  return {
    id,
    file,
    name: file.name,
    size: file.size,
    buffer,
    detectedType: 'unknown',
    typeLabel: 'ファイル',
    isKeyOrSecret: false,
  };
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

/**
 * Intelligent correlation and auto-decryption for a set of analyzed files.
 */
export async function autoDecryptFiles(
  analyzedFiles: AnalyzedFile[],
  passwords: Record<string, string>, // fileId or targetType -> password
  vault?: KeyVaultFile
): Promise<DecryptionResult[]> {
  const results: DecryptionResult[] = [];

  // Group files into targets vs keys
  const targets = analyzedFiles.filter((f) => !f.isKeyOrSecret);
  const keys = analyzedFiles.filter((f) => f.isKeyOrSecret);

  // Check special multi-file scenarios first:

  // Scenario 1: Multiple Shamir Shares
  const shamirShares = analyzedFiles.filter((f) => f.detectedType === 'shamir-share');
  if (shamirShares.length >= 2) {
    try {
      const parsedList = shamirShares
        .map((f) => parseShareString(f.text || ''))
        .filter(Boolean);

      if (parsedList.length >= 2) {
        const threshold = parsedList[0]!.k;
        if (parsedList.length >= threshold) {
          const rec = reconstructSecret(parsedList as any);
          if (rec.success) {
            results.push({
              id: `shamir-${Date.now()}`,
              sourceFileNames: shamirShares.map((s) => s.name),
              algorithm: `シャミア秘密分散法 (閾値 ${threshold}/${parsedList[0]!.n})`,
              status: 'success',
              outputFileName: rec.filename || (rec.isText ? 'reconstructed_secret.txt' : 'reconstructed_secret.bin'),
              outputSize: rec.secretBytes?.length,
              outputBuffer: rec.secretBytes ? rec.secretBytes.buffer.slice(rec.secretBytes.byteOffset, rec.secretBytes.byteOffset + rec.secretBytes.byteLength) as ArrayBuffer : undefined,
              outputText: rec.text,
              isText: rec.isText,
              details: `合計 ${parsedList.length} 個のシェアから CRC32 整合性を検証して復元成功`,
            });
          } else {
            results.push({
              id: `shamir-${Date.now()}`,
              sourceFileNames: shamirShares.map((s) => s.name),
              algorithm: 'シャミア秘密分散法',
              status: 'failed',
              errorMessage: rec.error || 'シェアの復元に失敗しました。',
            });
          }
        } else {
          results.push({
            id: `shamir-${Date.now()}`,
            sourceFileNames: shamirShares.map((s) => s.name),
            algorithm: `シャミア秘密分散法 (閾値 ${threshold})`,
            status: 'needs-key',
            errorMessage: `復元に必要なシェアが不足しています (投入数: ${parsedList.length} / 必要閾値: ${threshold})`,
          });
        }
      }
    } catch (err: any) {
      results.push({
        id: `shamir-${Date.now()}`,
        sourceFileNames: shamirShares.map((s) => s.name),
        algorithm: 'シャミア秘密分散法',
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  // Scenario 2: Two Visual Cryptography Shares
  const visualShares = analyzedFiles.filter((f) => f.detectedType === 'visual-crypto-share');
  if (visualShares.length >= 2) {
    try {
      const img1 = await loadImageFromBlob(visualShares[0].file);
      const img2 = await loadImageFromBlob(visualShares[1].file);
      const w = Math.max(img1.naturalWidth, img2.naturalWidth);
      const h = Math.max(img1.naturalHeight, img2.naturalHeight);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      overlayShares(img1, img2, canvas, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      const buf = await blob.arrayBuffer();

      results.push({
        id: `visual-${Date.now()}`,
        sourceFileNames: [visualShares[0].name, visualShares[1].name],
        algorithm: '視覚復号型暗号 (Naor-Shamir 2-out-of-2)',
        status: 'success',
        outputFileName: 'revealed_secret.png',
        outputSize: blob.size,
        outputBuffer: buf,
        outputDataUrl: dataUrl,
        isImage: true,
        details: '2つのシェア画像をデジタル重ね合わせ（光透過OR演算）し秘密画像を顕現',
      });
    } catch (err: any) {
      results.push({
        id: `visual-${Date.now()}`,
        sourceFileNames: visualShares.map((s) => s.name),
        algorithm: '視覚復号型暗号',
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  // Candidate keys found in dropped files
  const candidatePasswords = keys
    .filter((k) => k.detectedType === 'candidate-password')
    .map((k) => k.text?.trim())
    .filter(Boolean) as string[];

  const rsaPrivKeys = keys.filter((k) => k.detectedType === 'rsa-private-key');
  const pgpPrivKeys = keys.filter((k) => k.detectedType === 'openpgp-private-key');
  const rawKeyFiles = keys.filter((k) => k.detectedType === 'candidate-raw-key');
  const abeUserKeys = keys.filter((k) => k.detectedType === 'abe-user-key');

  // Vault keys if available
  const vaultAesKeys = vault?.keys.filter((k) => k.type === 'aes-gcm') || [];
  const vaultRsaKeys = vault?.keys.filter((k) => k.type === 'rsa-oaep') || [];

  // Decrypt individual targets
  for (const target of targets) {
    const userPass = passwords[target.id] || passwords['global'] || '';

    // 1. LCV AES Password
    if (target.detectedType === 'lcv-aes-password') {
      const candidatePassList = [
        userPass,
        ...candidatePasswords,
        ...vaultAesKeys.map((k) => k.title),
      ].filter(Boolean);

      let decrypted: { filename: string; fileData: ArrayBuffer } | null = null;
      let lastErr = '';

      for (const pass of candidatePassList) {
        try {
          decrypted = await decryptFileAesPassword(target.buffer, pass);
          if (decrypted) break;
        } catch (err: any) {
          lastErr = err.message;
        }
      }

      if (decrypted) {
        let textVal: string | undefined = undefined;
        let isTextVal = false;
        try {
          textVal = new TextDecoder('utf-8', { fatal: true }).decode(decrypted.fileData);
          isTextVal = true;
        } catch {}

        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'AES-256-GCM (パスワード暗号化)',
          status: 'success',
          outputFileName: decrypted.filename,
          outputSize: decrypted.fileData.byteLength,
          outputBuffer: decrypted.fileData,
          outputText: textVal,
          isText: isTextVal,
          details: 'PBKDF2 (100,000回) + AES-GCM 256bit 復号完了',
        });
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'AES-256-GCM (パスワード暗号化)',
          status: 'needs-key',
          errorMessage: lastErr || '復号パスワードが必要です',
          outputFileName: target.metadata?.originalFilename,
        });
      }
    }

    // 2. LCV AES Raw Key
    else if (target.detectedType === 'lcv-aes-raw') {
      const candidateRawBuffers: ArrayBuffer[] = [
        ...rawKeyFiles.map((k) => k.buffer),
        ...vaultAesKeys
          .filter((k) => k.rawKeyBase64)
          .map((k) => base64ToBuffer(k.rawKeyBase64!)),
      ];

      // If user typed a base64 key in passwords[target.id]
      if (userPass.trim()) {
        try {
          candidateRawBuffers.unshift(base64ToBuffer(userPass.trim()));
        } catch {}
      }

      let decrypted: { filename: string; fileData: ArrayBuffer } | null = null;
      let lastErr = '';

      for (const rawBuf of candidateRawBuffers) {
        try {
          decrypted = await decryptFileAesRaw(target.buffer, rawBuf);
          if (decrypted) break;
        } catch (err: any) {
          lastErr = err.message;
        }
      }

      if (decrypted) {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'AES-256-GCM (共通鍵暗号化)',
          status: 'success',
          outputFileName: decrypted.filename,
          outputSize: decrypted.fileData.byteLength,
          outputBuffer: decrypted.fileData,
          details: '256bit AES共通鍵により復号完了',
        });
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'AES-256-GCM (共通鍵暗号化)',
          status: 'needs-key',
          errorMessage: lastErr || 'AES 256bit 共通鍵ファイル（またはBase64）が必要です',
          outputFileName: target.metadata?.originalFilename,
        });
      }
    }

    // 3. LCV Hybrid RSA
    else if (target.detectedType === 'lcv-hybrid-rsa') {
      const candidateRsaPemList: string[] = [
        ...rsaPrivKeys.map((k) => k.text || '').filter(Boolean),
        ...vaultRsaKeys.map((k) => k.privateKeyPem || '').filter(Boolean),
      ];

      if (userPass.includes('-----BEGIN PRIVATE KEY-----') || userPass.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        candidateRsaPemList.unshift(userPass);
      }

      let decrypted: { filename: string; fileData: ArrayBuffer } | null = null;
      let lastErr = '';

      for (const pem of candidateRsaPemList) {
        for (const hash of ['SHA-256', 'SHA-512', 'SHA-384', 'SHA-1'] as const) {
          try {
            decrypted = await decryptFileHybrid(target.buffer, pem, hash);
            if (decrypted) break;
          } catch (err: any) {
            lastErr = err.message;
          }
        }
        if (decrypted) break;
      }

      if (decrypted) {
        // Check if payload is a signed envelope (Sign-then-Encrypt)
        let isSignedEnvelope = false;
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(decrypted.fileData);
          if (text.startsWith('{"type":"lcv-signed-envelope-v1"')) {
            const parsed = JSON.parse(text);
            if (parsed.type === 'lcv-signed-envelope-v1' && parsed.payloadBase64) {
              const payloadBuf = base64ToBuffer(parsed.payloadBase64);
              let isValid = false;
              let sigError = '';

              if (parsed.signature && parsed.signerPublicKeyPem) {
                try {
                  isValid = await verifyData({
                    type: parsed.signatureType || 'rsa-pss',
                    hash: parsed.hashAlgorithm || 'SHA-256',
                    namedCurve: 'P-256',
                    publicKeyPem: parsed.signerPublicKeyPem,
                    data: payloadBuf,
                    signature: base64ToBuffer(parsed.signature),
                  });
                } catch (e: any) {
                  sigError = e.message;
                }
              }

              results.push({
                id: target.id,
                sourceFileNames: [target.name],
                algorithm: `署名付きハイブリッド暗号 (${isValid ? '署名真正' : '署名未検証'})`,
                status: 'success',
                outputFileName: parsed.originalFileName || decrypted.filename,
                outputSize: payloadBuf.byteLength,
                outputBuffer: payloadBuf,
                details: isValid
                  ? `送信者の電子署名 (${(parsed.signatureType || 'RSA-PSS').toUpperCase()}) を検証完了。真正な作成者による暗号化ファイルです。`
                  : sigError
                  ? `署名検証エラー: ${sigError}`
                  : '署名付きエンベロープを展開しました。',
              });
              isSignedEnvelope = true;
            }
          }
        } catch {
          // not a JSON envelope, proceed as raw decrypted file
        }

        if (!isSignedEnvelope) {
          results.push({
            id: target.id,
            sourceFileNames: [target.name],
            algorithm: 'RSA-OAEP + AES-GCM ハイブリッド暗号',
            status: 'success',
            outputFileName: decrypted.filename,
            outputSize: decrypted.fileData.byteLength,
            outputBuffer: decrypted.fileData,
            details: 'RSA秘密鍵によりセッション鍵を復号し、本体データを抽出成功',
          });
        }
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'RSA-OAEP + AES-GCM ハイブリッド暗号',
          status: 'needs-key',
          errorMessage: lastErr || '受取人のRSA秘密鍵（.pem）が必要です',
          outputFileName: target.metadata?.originalFilename,
        });
      }
    }

    // 4. ChaCha20-Poly1305
    else if (target.detectedType === 'chacha20-poly1305') {
      const candidatePassList = [
        userPass,
        ...candidatePasswords,
        ...vaultAesKeys.map((k) => k.title),
      ].filter(Boolean);

      let decrypted: { fileName: string; fileData: ArrayBuffer } | null = null;
      let lastErr = '';

      for (const pass of candidatePassList) {
        try {
          decrypted = await chacha20DecryptFile(target.buffer, pass);
          if (decrypted) break;
        } catch (err: any) {
          lastErr = err.message;
        }
      }

      if (decrypted) {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'ChaCha20-Poly1305 AEAD',
          status: 'success',
          outputFileName: decrypted.fileName,
          outputSize: decrypted.fileData.byteLength,
          outputBuffer: decrypted.fileData,
          details: 'ChaCha20-Poly1305 (RFC 8439) 高速復号完了',
        });
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'ChaCha20-Poly1305 AEAD',
          status: 'needs-key',
          errorMessage: lastErr || 'ChaCha20 復号パスワードが必要です',
        });
      }
    }

    // 5. Self-Decrypting HTML
    else if (target.detectedType === 'self-decrypt-html') {
      const meta = target.metadata;
      if (meta && meta.ciphertext && meta.salt && meta.iv) {
        const candidatePassList = [
          userPass,
          ...candidatePasswords,
          ...vaultAesKeys.map((k) => k.title),
        ].filter(Boolean);

        let decryptedBuffer: ArrayBuffer | null = null;
        let lastErr = '';

        for (const pass of candidatePassList) {
          try {
            const salt = base64ToBuffer(meta.salt);
            const iv = base64ToBuffer(meta.iv);
            const cipher = base64ToBuffer(meta.ciphertext);

            // Derive key with PBKDF2
            const enc = new TextEncoder().encode(pass);
            const baseKey = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
            const derivedKey = await crypto.subtle.deriveKey(
              { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
              baseKey,
              { name: 'AES-GCM', length: 256 },
              false,
              ['decrypt']
            );

            decryptedBuffer = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv },
              derivedKey,
              cipher
            );
            if (decryptedBuffer) break;
          } catch (err: any) {
            lastErr = err.message;
          }
        }

        if (decryptedBuffer) {
          let textVal: string | undefined = undefined;
          let isText = meta.type === 'text';
          try {
            textVal = new TextDecoder('utf-8', { fatal: true }).decode(decryptedBuffer);
          } catch {}

          results.push({
            id: target.id,
            sourceFileNames: [target.name],
            algorithm: '自己復号HTMLパッケージ (AES-256-GCM)',
            status: 'success',
            outputFileName: meta.filename || 'decrypted_payload.dat',
            outputSize: decryptedBuffer.byteLength,
            outputBuffer: decryptedBuffer,
            outputText: textVal,
            isText,
            details: `自己復号パッケージ内の暗号化ペイロード (${meta.title || ''}) を復号`,
          });
        } else {
          results.push({
            id: target.id,
            sourceFileNames: [target.name],
            algorithm: '自己復号HTMLパッケージ',
            status: 'needs-key',
            errorMessage: lastErr || (meta.hint ? `ヒント: ${meta.hint}` : '復号パスワードが必要です'),
            outputFileName: meta.filename,
          });
        }
      }
    }

    // 6. OpenPGP Message
    else if (target.detectedType === 'openpgp-message') {
      const candidatePgpPrivKeys = pgpPrivKeys.map((k) => k.text || '');
      const candidatePassList = [userPass, ...candidatePasswords].filter(Boolean);

      let decryptedRes: { data: string | Uint8Array } | null = null;
      let lastErr = '';

      // Try private keys first
      for (const privKey of candidatePgpPrivKeys) {
        for (const pass of ['', ...candidatePassList]) {
          try {
            decryptedRes = (await decryptPgpMessage({
              armoredCiphertext: target.text!,
              privateKeyArmored: privKey,
              passphrase: pass || undefined,
            })) as any;
            if (decryptedRes) break;
          } catch (err: any) {
            lastErr = err.message;
          }
        }
        if (decryptedRes) break;
      }

      // Try symmetric passphrase
      if (!decryptedRes) {
        for (const pass of candidatePassList) {
          try {
            decryptedRes = (await decryptPgpMessage({
              armoredCiphertext: target.text!,
              passphrase: pass,
            })) as any;
            if (decryptedRes) break;
          } catch (err: any) {
            lastErr = err.message;
          }
        }
      }

      if (decryptedRes && decryptedRes.data) {
        const textStr = typeof decryptedRes.data === 'string'
          ? decryptedRes.data
          : new TextDecoder('utf-8').decode(decryptedRes.data);
        const buf = new TextEncoder().encode(textStr).buffer as ArrayBuffer;

        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'OpenPGP (RFC 4880)',
          status: 'success',
          outputFileName: 'decrypted_pgp_message.txt',
          outputSize: buf.byteLength,
          outputBuffer: buf,
          outputText: textStr,
          isText: true,
          details: 'OpenPGP 秘密鍵またはパスフレーズによりメッセージを復号',
        });
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'OpenPGP (RFC 4880)',
          status: 'needs-key',
          errorMessage: lastErr || 'OpenPGP 秘密鍵（.asc）またはパスフレーズが必要です',
        });
      }
    }

    // 7. Steganography Image
    else if (target.detectedType === 'steganography-image') {
      const header = target.metadata;
      const candidatePassList = [userPass, ...candidatePasswords, ''].filter((p, i, arr) => arr.indexOf(p) === i);

      let decoded: any = null;
      let lastErr = '';

      try {
        const img = await loadImageFromBlob(target.file);
        for (const pass of candidatePassList) {
          try {
            decoded = await decodeSteganography(img, pass);
            if (decoded) break;
          } catch (err: any) {
            lastErr = err.message;
          }
        }
      } catch (err: any) {
        lastErr = err.message;
      }

      if (decoded) {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'LSB ステガノグラフィ',
          status: 'success',
          outputFileName: decoded.fileName || (decoded.isFile ? 'hidden_file.bin' : 'hidden_message.txt'),
          outputSize: decoded.bytes?.length || (decoded.text ? new TextEncoder().encode(decoded.text).length : 0),
          outputBuffer: decoded.bytes ? decoded.bytes.buffer : undefined,
          outputText: decoded.text,
          isText: !decoded.isFile,
          details: `画像ピクセルの最下位ビット (LSB) から隠蔽データを抽出成功`,
        });
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'LSB ステガノグラフィ',
          status: 'needs-key',
          errorMessage: lastErr === 'PASSWORD_REQUIRED' ? '暗号化ステガノ画像の復号パスワードが必要です' : lastErr,
        });
      }
    }

    // 8. Attribute-Based Encryption (CP-ABE)
    else if (target.detectedType === 'abe-cipher-package') {
      let decrypted: any = null;
      let lastErr = '';

      for (const ukFile of abeUserKeys) {
        try {
          const userKeyJson = JSON.parse(ukFile.text || '{}');
          const cipherPkg = JSON.parse(target.text || '{}');
          decrypted = await decryptWithUserKey(cipherPkg, userKeyJson);
          if (decrypted) break;
        } catch (err: any) {
          lastErr = err.message;
        }
      }

      if (decrypted) {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: '属性ベース暗号 (CP-ABE)',
          status: 'success',
          outputFileName: decrypted.fileName || (decrypted.isBinary ? 'decrypted_abe.bin' : 'decrypted_abe.txt'),
          outputBuffer: decrypted.binaryData ? decrypted.binaryData.buffer : undefined,
          outputText: decrypted.text,
          isText: !decrypted.isBinary,
          details: `アクセスポリシーを満たすユーザー属性鍵により復号成功`,
        });
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: '属性ベース暗号 (CP-ABE)',
          status: 'needs-key',
          errorMessage: lastErr || 'アクセスポリシーを満たす ABE ユーザー秘密鍵 JSON が必要です',
        });
      }
    }

    // 9. Timelock Age
    else if (target.detectedType === 'timelock-age') {
      try {
        const roundMeta = target.metadata;
        const currentRound = Math.floor((Date.now() - 1692803367000) / 3000) + 1; // drand quicknet
        const targetRound = roundMeta?.round;

        if (targetRound && currentRound < targetRound) {
          const remainingSec = (targetRound - currentRound) * 3;
          results.push({
            id: target.id,
            sourceFileNames: [target.name],
            algorithm: `分散タイムロック暗号 (ラウンド ${targetRound})`,
            status: 'needs-key',
            errorMessage: `指定時刻に達していません。解除まで約 ${remainingSec} 秒お待ちください。`,
          });
        } else {
          // Attempt timelockDecrypt
          const dec = await timelockDecrypt(target.text!, undefined as any);
          const buf = dec.buffer.slice(dec.byteOffset, dec.byteOffset + dec.byteLength) as ArrayBuffer;
          let txt: string | undefined = undefined;
          let isTxt = false;
          try {
            txt = new TextDecoder('utf-8', { fatal: true }).decode(buf);
            isTxt = true;
          } catch {}

          results.push({
            id: target.id,
            sourceFileNames: [target.name],
            algorithm: '分散タイムロック暗号 (drand quicknet)',
            status: 'success',
            outputFileName: 'timelock_unlocked.txt',
            outputSize: buf.byteLength,
            outputBuffer: buf,
            outputText: txt,
            isText: isTxt,
            details: '時間経過によるBLS署名ビーコン取得・自動復号成功',
          });
        }
      } catch (err: any) {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: '分散タイムロック暗号',
          status: 'failed',
          errorMessage: err.message,
        });
      }
    }

    // 10. Generic Base64 ciphertext
    else if (target.detectedType === 'generic-ciphertext') {
      const candidatePassList = [userPass, ...candidatePasswords].filter(Boolean);
      let decryptedText: string | null = null;

      for (const pass of candidatePassList) {
        try {
          const chachaRes = await chacha20DecryptWithPassword(target.text!, pass);
          if (chachaRes && chachaRes.text) {
            decryptedText = chachaRes.text;
            break;
          }
        } catch {}
      }

      if (decryptedText) {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'Base64 暗号文復号',
          status: 'success',
          outputFileName: 'decrypted_text.txt',
          outputText: decryptedText,
          isText: true,
          details: 'ChaCha20-Poly1305 パスワード復号成功',
        });
      } else {
        results.push({
          id: target.id,
          sourceFileNames: [target.name],
          algorithm: 'Base64 暗号文',
          status: 'needs-key',
          errorMessage: '暗号化アルゴリズムに応じた復号鍵またはパスワードを入力してください',
        });
      }
    }
  }

  return results;
}
