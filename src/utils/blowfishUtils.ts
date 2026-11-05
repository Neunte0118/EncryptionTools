/**
 * Blowfish Block Cipher Utilities
 *
 * Implements Bruce Schneier's 64-bit block cipher with variable key length (32 to 448 bits).
 * Uses `egoroof-blowfish`.
 */

import { Blowfish } from 'egoroof-blowfish';
import { bufferToBase64, base64ToBuffer } from './cryptoUtils';

export type BlowfishMode = 'cbc' | 'ecb';

export interface BlowfishPackage {
  format: 'blowfish-package-v1';
  mode: BlowfishMode;
  saltB64?: string;
  ivB64?: string;
  ciphertextB64: string;
}

/**
 * Derive variable-length key from password using PBKDF2-SHA256
 */
export async function deriveBlowfishKey(
  password: string,
  salt: Uint8Array,
  keyBits = 256,
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
    keyBits
  );

  return new Uint8Array(derivedBits);
}

/**
 * Encrypt bytes using Blowfish (CBC or ECB, PKCS#5)
 */
export function encryptBlowfishBytes(
  data: Uint8Array,
  key: Uint8Array,
  mode: BlowfishMode = 'cbc',
  customIv?: Uint8Array
): { ciphertext: Uint8Array; iv?: Uint8Array } {
  if (key.length < 4 || key.length > 56) {
    throw new Error('Blowfish 鍵長は 4〜56 バイト (32〜448 ビット) である必要があります');
  }

  const bfMode = mode === 'ecb' ? Blowfish.MODE.ECB : Blowfish.MODE.CBC;
  const bf = new Blowfish(key, bfMode, Blowfish.PADDING.PKCS5);

  let iv: Uint8Array | undefined;
  if (mode === 'cbc') {
    iv = customIv || crypto.getRandomValues(new Uint8Array(8));
    if (iv.length !== 8) {
      throw new Error('Blowfish IV 長は 8 バイトである必要があります');
    }
    bf.setIv(iv);
  }

  const ciphertext = bf.encode(data);
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

/**
 * Decrypt bytes using Blowfish
 */
export function decryptBlowfishBytes(
  ciphertext: Uint8Array,
  key: Uint8Array,
  mode: BlowfishMode = 'cbc',
  iv?: Uint8Array
): Uint8Array {
  if (key.length < 4 || key.length > 56) {
    throw new Error('Blowfish 鍵長は 4〜56 バイト (32〜448 ビット) である必要があります');
  }

  const bfMode = mode === 'ecb' ? Blowfish.MODE.ECB : Blowfish.MODE.CBC;
  const bf = new Blowfish(key, bfMode, Blowfish.PADDING.PKCS5);

  if (mode === 'cbc') {
    if (!iv || iv.length !== 8) {
      throw new Error('Blowfish CBC 復号には 8 バイトの IV が必要です');
    }
    bf.setIv(iv);
  }

  const decrypted = bf.decode(ciphertext, Blowfish.TYPE.UINT8_ARRAY);
  return new Uint8Array(decrypted);
}

/**
 * Encrypt text using Blowfish and output JSON envelope
 */
export async function encryptBlowfishText(
  text: string,
  options: {
    password?: string;
    rawKey?: Uint8Array;
    keyBits?: number;
    mode?: BlowfishMode;
  }
): Promise<{ resultText: string; rawKeyHex: string }> {
  const mode = options.mode || 'cbc';
  const keyBits = options.keyBits || 256;
  let keyBytes: Uint8Array;
  let saltBytes: Uint8Array | undefined;

  if (options.password) {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
    keyBytes = await deriveBlowfishKey(options.password, saltBytes, keyBits);
  } else if (options.rawKey) {
    keyBytes = options.rawKey;
  } else {
    keyBytes = crypto.getRandomValues(new Uint8Array(keyBits / 8));
  }

  const plaintextBytes = new TextEncoder().encode(text);
  const { ciphertext, iv } = encryptBlowfishBytes(plaintextBytes, keyBytes, mode);

  const pkg: BlowfishPackage = {
    format: 'blowfish-package-v1',
    mode,
    saltB64: saltBytes ? bufferToBase64(saltBytes.buffer as ArrayBuffer) : undefined,
    ivB64: iv ? bufferToBase64(iv.buffer as ArrayBuffer) : undefined,
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
 * Decrypt text from Blowfish JSON envelope
 */
export async function decryptBlowfishText(
  packageJson: string,
  options: {
    password?: string;
    rawKey?: Uint8Array;
  }
): Promise<string> {
  let pkg: BlowfishPackage;
  try {
    pkg = JSON.parse(packageJson);
  } catch {
    throw new Error('Blowfish 暗号化パッケージ (JSON形式) ではありません');
  }

  if (pkg.format !== 'blowfish-package-v1' || !pkg.ciphertextB64) {
    throw new Error('対応していない Blowfish パッケージ形式です');
  }

  let keyBytes: Uint8Array;
  if (options.password) {
    if (!pkg.saltB64) {
      throw new Error('ソルト情報が含まれていないため、パスワード復号できません。生鍵を使用してください。');
    }
    const salt = new Uint8Array(base64ToBuffer(pkg.saltB64));
    keyBytes = await deriveBlowfishKey(options.password, salt, 256);
  } else if (options.rawKey) {
    keyBytes = options.rawKey;
  } else {
    throw new Error('復号パスワードまたは生鍵を入力してください');
  }

  const iv = pkg.ivB64 ? new Uint8Array(base64ToBuffer(pkg.ivB64)) : undefined;
  const ciphertext = new Uint8Array(base64ToBuffer(pkg.ciphertextB64));

  const decrypted = decryptBlowfishBytes(ciphertext, keyBytes, pkg.mode, iv);
  return new TextDecoder().decode(decrypted);
}
