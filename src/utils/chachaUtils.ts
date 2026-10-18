/**
 * ChaCha20-Poly1305 AEAD Utility
 * IETF RFC 8439
 */

import { ChaCha20Poly1305 } from '@stablelib/chacha20poly1305';
import { bufferToBase64, base64ToBuffer } from './cryptoUtils';

export interface ChaChaResult {
  nonceHex: string;
  ciphertextBase64: string;
}

const CHACHA_FILE_MAGIC = new Uint8Array([0x43, 0x48, 0x41, 0x32, 0x30, 0x46, 0x49, 0x4c]); // CHA20FIL

async function deriveChaChaKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder().encode(password);
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const keyBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );
  return new Uint8Array(keyBits);
}

/**
 * Encrypt text or bytes with password
 */
export async function chacha20EncryptWithPassword(
  plaintext: string | ArrayBuffer,
  password: string
): Promise<{ combinedBase64: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = await deriveChaChaKey(password, salt);
  const cipher = new ChaCha20Poly1305(keyBytes);

  const plainBytes = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : new Uint8Array(plaintext);

  const encrypted = cipher.seal(nonce, plainBytes);

  const combined = new Uint8Array(16 + 12 + encrypted.length);
  combined.set(salt, 0);
  combined.set(nonce, 16);
  combined.set(encrypted, 28);

  return {
    combinedBase64: bufferToBase64(combined.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt text or bytes with password
 */
export async function chacha20DecryptWithPassword(
  combinedBase64: string,
  password: string
): Promise<{ text?: string; buffer: ArrayBuffer }> {
  const combined = new Uint8Array(base64ToBuffer(combinedBase64));
  if (combined.length < 28 + 16) {
    throw new Error('暗号文の長さが不足しています');
  }

  const salt = combined.subarray(0, 16);
  const nonce = combined.subarray(16, 28);
  const encrypted = combined.subarray(28);

  const keyBytes = await deriveChaChaKey(password, salt);
  const cipher = new ChaCha20Poly1305(keyBytes);

  const decrypted = cipher.open(nonce, encrypted);
  if (!decrypted) {
    throw new Error('復号に失敗しました。パスワードが異なるか暗号データが改ざんされています');
  }

  const arrayBuffer = decrypted.buffer.slice(
    decrypted.byteOffset,
    decrypted.byteOffset + decrypted.byteLength
  ) as ArrayBuffer;

  let text: string | undefined = undefined;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
  } catch {}

  return { text, buffer: arrayBuffer };
}

/**
 * Encrypt file with ChaCha20-Poly1305
 */
export async function chacha20EncryptFile(
  fileBuffer: ArrayBuffer,
  fileName: string,
  password: string
): Promise<ArrayBuffer> {
  const nameBytes = new TextEncoder().encode(fileName);
  const nameLen = nameBytes.length;

  // Inner payload format: [2 bytes nameLen][nameBytes][fileBytes]
  const fileBytes = new Uint8Array(fileBuffer);
  const payload = new Uint8Array(2 + nameLen + fileBytes.length);
  payload[0] = (nameLen >> 8) & 0xff;
  payload[1] = nameLen & 0xff;
  payload.set(nameBytes, 2);
  payload.set(fileBytes, 2 + nameLen);

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = await deriveChaChaKey(password, salt);
  const cipher = new ChaCha20Poly1305(keyBytes);

  const encrypted = cipher.seal(nonce, payload);

  // Outer container: [8 bytes magic][16 bytes salt][12 bytes nonce][encrypted payload]
  const container = new Uint8Array(8 + 16 + 12 + encrypted.length);
  container.set(CHACHA_FILE_MAGIC, 0);
  container.set(salt, 8);
  container.set(nonce, 24);
  container.set(encrypted, 36);

  return container.buffer as ArrayBuffer;
}

/**
 * Decrypt file with ChaCha20-Poly1305
 */
export async function chacha20DecryptFile(
  containerBuffer: ArrayBuffer,
  password: string
): Promise<{ fileName: string; fileData: ArrayBuffer }> {
  const container = new Uint8Array(containerBuffer);
  if (container.length < 36 + 16) {
    throw new Error('無効なファイル形式です');
  }

  // Check magic
  let isMagicMatch = true;
  for (let i = 0; i < 8; i++) {
    if (container[i] !== CHACHA_FILE_MAGIC[i]) {
      isMagicMatch = false;
      break;
    }
  }

  let salt: Uint8Array;
  let nonce: Uint8Array;
  let encrypted: Uint8Array;

  if (isMagicMatch) {
    salt = container.subarray(8, 24);
    nonce = container.subarray(24, 36);
    encrypted = container.subarray(36);
  } else {
    // Fallback without 8-byte magic
    salt = container.subarray(0, 16);
    nonce = container.subarray(16, 28);
    encrypted = container.subarray(28);
  }

  const keyBytes = await deriveChaChaKey(password, salt);
  const cipher = new ChaCha20Poly1305(keyBytes);

  const decrypted = cipher.open(nonce, encrypted);
  if (!decrypted) {
    throw new Error('復号に失敗しました。パスワードが異なるか改ざんされています');
  }

  if (isMagicMatch && decrypted.length >= 2) {
    const nameLen = (decrypted[0] << 8) | decrypted[1];
    if (decrypted.length >= 2 + nameLen) {
      const nameBytes = decrypted.subarray(2, 2 + nameLen);
      const fileName = new TextDecoder('utf-8').decode(nameBytes);
      const fileData = decrypted.subarray(2 + nameLen);
      const outBuffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength
      ) as ArrayBuffer;
      return { fileName, fileData: outBuffer };
    }
  }

  const outBuffer = decrypted.buffer.slice(
    decrypted.byteOffset,
    decrypted.byteOffset + decrypted.byteLength
  ) as ArrayBuffer;
  return { fileName: 'decrypted.bin', fileData: outBuffer };
}
