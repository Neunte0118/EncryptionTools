/**
 * Salsa20 / XSalsa20 / XSalsa20-Poly1305 Cryptographic Utilities
 *
 * Implements Daniel J. Bernstein's high-speed stream cipher and AEAD construction.
 * Uses `@noble/ciphers/salsa`.
 */

import { salsa20, xsalsa20, xsalsa20poly1305 } from '@noble/ciphers/salsa.js';
import {
  bufferToBase64,
  base64ToBuffer,
  stringToBuffer,
  bufferToString,
} from './cryptoUtils';

export type SalsaVariant = 'xsalsa20-poly1305' | 'xsalsa20' | 'salsa20';

export const SALSA_MAGIC = new Uint8Array([0x53, 0x4c, 0x53, 0x41]); // "SLSA"

/**
 * Derive a 32-byte (256-bit) key from password using PBKDF2-SHA256
 */
export async function deriveSalsaKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

/**
 * Encrypt bytes using Salsa20 / XSalsa20 / XSalsa20-Poly1305
 */
export async function encryptSalsa(
  data: Uint8Array,
  key: Uint8Array,
  variant: SalsaVariant = 'xsalsa20-poly1305',
  customNonce?: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  if (key.length !== 32) {
    throw new Error('Salsa20 鍵は 32 バイト (256 ビット) である必要があります');
  }

  const nonceLength = variant === 'salsa20' ? 8 : 24;
  let nonce: Uint8Array;
  if (customNonce) {
    if (customNonce.length !== nonceLength) {
      throw new Error(`Nonce 長は ${nonceLength} バイトである必要があります`);
    }
    nonce = customNonce;
  } else {
    nonce = crypto.getRandomValues(new Uint8Array(nonceLength));
  }

  let ciphertext: Uint8Array;

  if (variant === 'xsalsa20-poly1305') {
    const cipher = xsalsa20poly1305(key, nonce);
    ciphertext = cipher.encrypt(data);
  } else if (variant === 'xsalsa20') {
    ciphertext = xsalsa20(key, nonce, data);
  } else {
    ciphertext = salsa20(key, nonce, data);
  }

  return { ciphertext, nonce };
}

/**
 * Decrypt bytes using Salsa20 / XSalsa20 / XSalsa20-Poly1305
 */
export async function decryptSalsa(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  variant: SalsaVariant = 'xsalsa20-poly1305'
): Promise<Uint8Array> {
  if (key.length !== 32) {
    throw new Error('Salsa20 鍵は 32 バイト (256 ビット) である必要があります');
  }

  if (variant === 'xsalsa20-poly1305') {
    const cipher = xsalsa20poly1305(key, nonce);
    return cipher.decrypt(ciphertext);
  } else if (variant === 'xsalsa20') {
    return xsalsa20(key, nonce, ciphertext);
  } else {
    return salsa20(key, nonce, ciphertext);
  }
}

export interface SalsaPackage {
  format: 'salsa-package-v1';
  variant: SalsaVariant;
  saltB64?: string;
  nonceB64: string;
  ciphertextB64: string;
}

/**
 * Encrypt string to JSON or Base64 envelope
 */
export async function encryptSalsaText(
  text: string,
  options: {
    password?: string;
    rawKey?: Uint8Array;
    variant?: SalsaVariant;
  }
): Promise<{ resultText: string; rawKeyHex: string }> {
  const variant = options.variant || 'xsalsa20-poly1305';
  let keyBytes: Uint8Array;
  let saltBytes: Uint8Array | undefined;

  if (options.password) {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
    keyBytes = await deriveSalsaKeyFromPassword(options.password, saltBytes);
  } else if (options.rawKey) {
    keyBytes = options.rawKey;
  } else {
    keyBytes = crypto.getRandomValues(new Uint8Array(32));
  }

  const plaintextBytes = new TextEncoder().encode(text);
  const { ciphertext, nonce } = await encryptSalsa(plaintextBytes, keyBytes, variant);

  const pkg: SalsaPackage = {
    format: 'salsa-package-v1',
    variant,
    saltB64: saltBytes ? bufferToBase64(saltBytes.buffer as ArrayBuffer) : undefined,
    nonceB64: bufferToBase64(nonce.buffer as ArrayBuffer),
    ciphertextB64: bufferToBase64(ciphertext.buffer as ArrayBuffer),
  };

  const rawKeyHex = Array.from(keyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    resultText: JSON.stringify(pkg, null, 2),
    rawKeyHex,
  };
}

/**
 * Decrypt string from JSON envelope
 */
export async function decryptSalsaText(
  packageJson: string,
  options: {
    password?: string;
    rawKey?: Uint8Array;
  }
): Promise<string> {
  let pkg: SalsaPackage;
  try {
    pkg = JSON.parse(packageJson);
  } catch {
    throw new Error('Salsa20 暗号化パッケージ (JSON形式) ではありません');
  }

  if (pkg.format !== 'salsa-package-v1' || !pkg.ciphertextB64 || !pkg.nonceB64) {
    throw new Error('対応していない Salsa20 パッケージ形式です');
  }

  let keyBytes: Uint8Array;
  if (options.password) {
    if (!pkg.saltB64) {
      throw new Error('ソルト情報が含まれていないため、パスワード復号できません。生鍵を使用してください。');
    }
    const salt = new Uint8Array(base64ToBuffer(pkg.saltB64));
    keyBytes = await deriveSalsaKeyFromPassword(options.password, salt);
  } else if (options.rawKey) {
    keyBytes = options.rawKey;
  } else {
    throw new Error('復号パスワードまたは生鍵を入力してください');
  }

  const nonce = new Uint8Array(base64ToBuffer(pkg.nonceB64));
  const ciphertext = new Uint8Array(base64ToBuffer(pkg.ciphertextB64));

  const decrypted = await decryptSalsa(ciphertext, keyBytes, nonce, pkg.variant);
  return new TextDecoder().decode(decrypted);
}
