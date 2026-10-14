/**
 * ChaCha20-Poly1305 Modern Symmetric Stream Cipher Utility
 *
 * Implements IETF RFC 8439 ChaCha20-Poly1305 AEAD (Authenticated Encryption with Associated Data).
 * Recognized alongside AES as the global standard cipher (used by WireGuard, TLS 1.3, SSH).
 */

import { ChaCha20Poly1305 } from '@stablelib/chacha20poly1305';
import { deriveKeyFromPassword, bufferToBase64, base64ToBuffer } from './cryptoUtils';

export interface ChaChaResult {
  nonceHex: string;
  ciphertextBase64: string;
}

/**
 * Encrypt bytes using ChaCha20-Poly1305 AEAD with password
 */
export async function chacha20EncryptWithPassword(
  plaintext: string | ArrayBuffer,
  password: string
): Promise<{ combinedBase64: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));

  // Derive 256-bit key
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

  const keyBytes = new Uint8Array(keyBits);
  const cipher = new ChaCha20Poly1305(keyBytes);

  const plainBytes = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : new Uint8Array(plaintext);

  const encrypted = cipher.seal(nonce, plainBytes);

  // Pack: [16b salt] [12b nonce] [ciphertext + 16b poly1305 tag]
  const combined = new Uint8Array(16 + 12 + encrypted.length);
  combined.set(salt, 0);
  combined.set(nonce, 16);
  combined.set(encrypted, 28);

  return {
    combinedBase64: bufferToBase64(combined.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt combined ChaCha20-Poly1305 payload with password
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

  const keyBytes = new Uint8Array(keyBits);
  const cipher = new ChaCha20Poly1305(keyBytes);

  const decrypted = cipher.open(nonce, encrypted);
  if (!decrypted) {
    throw new Error('認証失敗: パスワードが一致しないか、暗号データが改ざんされています');
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
