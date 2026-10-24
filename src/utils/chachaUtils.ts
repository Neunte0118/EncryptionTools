/**
 * ChaCha20 / Salsa20 Family Cryptographic Utility
 * - ChaCha20-Poly1305 (IETF RFC 8439 / 96-bit Nonce AEAD)
 * - XChaCha20-Poly1305 (Extended 192-bit / 24-byte Nonce AEAD)
 * - ChaCha20 Raw (RFC 8439 Stream Cipher without MAC)
 * - XSalsa20-Poly1305 (NaCl / libsodium crypto_secretbox standard)
 */

import { chacha20poly1305, xchacha20poly1305, chacha20 } from '@noble/ciphers/chacha.js';
import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js';
import { bufferToBase64, base64ToBuffer, bufferToHex } from './cryptoUtils';

export type ChaChaVariant =
  | 'chacha20-poly1305'
  | 'xchacha20-poly1305'
  | 'chacha20-raw'
  | 'xsalsa20-poly1305';

export interface ChaChaResult {
  nonceHex: string;
  ciphertextBase64: string;
  variant: ChaChaVariant;
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
 * Encrypt text or bytes with password using selected variant
 */
export async function chacha20EncryptWithPassword(
  plaintext: string | ArrayBuffer,
  password: string,
  variant: ChaChaVariant = 'chacha20-poly1305'
): Promise<{ combinedBase64: string; nonceHex: string; variant: ChaChaVariant }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;
  const nonce = window.crypto.getRandomValues(new Uint8Array(nonceLen));
  const keyBytes = await deriveChaChaKey(password, salt);

  const plainBytes = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : new Uint8Array(plaintext);

  let encrypted: Uint8Array;
  if (variant === 'xchacha20-poly1305') {
    const cipher = xchacha20poly1305(keyBytes, nonce);
    encrypted = cipher.encrypt(plainBytes);
  } else if (variant === 'chacha20-raw') {
    encrypted = chacha20(keyBytes, nonce, plainBytes);
  } else if (variant === 'xsalsa20-poly1305') {
    const cipher = xsalsa20poly1305(keyBytes, nonce);
    encrypted = cipher.encrypt(plainBytes);
  } else {
    // Default RFC 8439 ChaCha20-Poly1305
    const cipher = chacha20poly1305(keyBytes, nonce);
    encrypted = cipher.encrypt(plainBytes);
  }

  // Variant indicator: 0 = chacha20-poly1305, 1 = xchacha20-poly1305, 2 = chacha20-raw, 3 = xsalsa20-poly1305
  let variantByte = 0;
  if (variant === 'xchacha20-poly1305') variantByte = 1;
  else if (variant === 'chacha20-raw') variantByte = 2;
  else if (variant === 'xsalsa20-poly1305') variantByte = 3;

  const combined = new Uint8Array(1 + 16 + nonce.length + encrypted.length);
  combined[0] = variantByte;
  combined.set(salt, 1);
  combined.set(nonce, 17);
  combined.set(encrypted, 17 + nonce.length);

  return {
    combinedBase64: bufferToBase64(combined.buffer as ArrayBuffer),
    nonceHex: bufferToHex(nonce.buffer as ArrayBuffer),
    variant,
  };
}

/**
 * Decrypt text or bytes with password
 */
export async function chacha20DecryptWithPassword(
  combinedBase64: string,
  password: string,
  forceVariant?: ChaChaVariant
): Promise<{ text?: string; buffer: ArrayBuffer; detectedVariant?: ChaChaVariant }> {
  const combined = new Uint8Array(base64ToBuffer(combinedBase64));
  if (combined.length < 28) {
    throw new Error('暗号文の長さが不足しています');
  }

  let variant: ChaChaVariant = 'chacha20-poly1305';
  let salt: Uint8Array;
  let nonce: Uint8Array;
  let encrypted: Uint8Array;

  // Check if first byte is our variant tag
  if (combined[0] <= 3 && combined.length >= 1 + 16 + 12) {
    const variantTag = combined[0];
    if (variantTag === 1) variant = 'xchacha20-poly1305';
    else if (variantTag === 2) variant = 'chacha20-raw';
    else if (variantTag === 3) variant = 'xsalsa20-poly1305';
    else variant = 'chacha20-poly1305';

    if (forceVariant) variant = forceVariant;
    const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;

    salt = combined.subarray(1, 17);
    nonce = combined.subarray(17, 17 + nonceLen);
    encrypted = combined.subarray(17 + nonceLen);
  } else {
    // Legacy format without variant tag: [16 bytes salt][12 bytes nonce][encrypted]
    if (forceVariant) variant = forceVariant;
    const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;
    salt = combined.subarray(0, 16);
    nonce = combined.subarray(16, 16 + nonceLen);
    encrypted = combined.subarray(16 + nonceLen);
  }

  const keyBytes = await deriveChaChaKey(password, salt);
  let decrypted: Uint8Array;

  try {
    if (variant === 'xchacha20-poly1305') {
      const cipher = xchacha20poly1305(keyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    } else if (variant === 'chacha20-raw') {
      decrypted = chacha20(keyBytes, nonce, encrypted);
    } else if (variant === 'xsalsa20-poly1305') {
      const cipher = xsalsa20poly1305(keyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    } else {
      const cipher = chacha20poly1305(keyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    }
  } catch (err: any) {
    throw new Error('復号に失敗しました。パスワードが異なるか、選択した暗号規格が一致しません');
  }

  const arrayBuffer = decrypted.buffer.slice(
    decrypted.byteOffset,
    decrypted.byteOffset + decrypted.byteLength
  ) as ArrayBuffer;

  let text: string | undefined = undefined;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
  } catch {}

  return { text, buffer: arrayBuffer, detectedVariant: variant };
}

/**
 * Encrypt file with selected ChaCha/Salsa variant
 */
export async function chacha20EncryptFile(
  fileBuffer: ArrayBuffer,
  fileName: string,
  password: string,
  variant: ChaChaVariant = 'chacha20-poly1305'
): Promise<ArrayBuffer> {
  const nameBytes = new TextEncoder().encode(fileName);
  const nameLen = nameBytes.length;

  const fileBytes = new Uint8Array(fileBuffer);
  const payload = new Uint8Array(2 + nameLen + fileBytes.length);
  payload[0] = (nameLen >> 8) & 0xff;
  payload[1] = nameLen & 0xff;
  payload.set(nameBytes, 2);
  payload.set(fileBytes, 2 + nameLen);

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;
  const nonce = window.crypto.getRandomValues(new Uint8Array(nonceLen));
  const keyBytes = await deriveChaChaKey(password, salt);

  let encrypted: Uint8Array;
  if (variant === 'xchacha20-poly1305') {
    const cipher = xchacha20poly1305(keyBytes, nonce);
    encrypted = cipher.encrypt(payload);
  } else if (variant === 'chacha20-raw') {
    encrypted = chacha20(keyBytes, nonce, payload);
  } else if (variant === 'xsalsa20-poly1305') {
    const cipher = xsalsa20poly1305(keyBytes, nonce);
    encrypted = cipher.encrypt(payload);
  } else {
    const cipher = chacha20poly1305(keyBytes, nonce);
    encrypted = cipher.encrypt(payload);
  }

  let variantByte = 0;
  if (variant === 'xchacha20-poly1305') variantByte = 1;
  else if (variant === 'chacha20-raw') variantByte = 2;
  else if (variant === 'xsalsa20-poly1305') variantByte = 3;

  // Outer container: [8 bytes magic][1 byte variant][16 bytes salt][nonce bytes][encrypted payload]
  const container = new Uint8Array(8 + 1 + 16 + nonce.length + encrypted.length);
  container.set(CHACHA_FILE_MAGIC, 0);
  container[8] = variantByte;
  container.set(salt, 9);
  container.set(nonce, 25);
  container.set(encrypted, 25 + nonce.length);

  return container.buffer as ArrayBuffer;
}

/**
 * Decrypt file with ChaCha20 / XChaCha20 / Salsa
 */
export async function chacha20DecryptFile(
  containerBuffer: ArrayBuffer,
  password: string
): Promise<{ fileName: string; fileData: ArrayBuffer; variant: ChaChaVariant }> {
  const container = new Uint8Array(containerBuffer);
  if (container.length < 36) {
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

  let variant: ChaChaVariant = 'chacha20-poly1305';
  let salt: Uint8Array;
  let nonce: Uint8Array;
  let encrypted: Uint8Array;

  if (isMagicMatch) {
    const variantByte = container[8];
    if (variantByte === 1) variant = 'xchacha20-poly1305';
    else if (variantByte === 2) variant = 'chacha20-raw';
    else if (variantByte === 3) variant = 'xsalsa20-poly1305';
    else variant = 'chacha20-poly1305';

    const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;
    salt = container.subarray(9, 25);
    nonce = container.subarray(25, 25 + nonceLen);
    encrypted = container.subarray(25 + nonceLen);
  } else {
    // Legacy fallback without variant byte: [16 bytes salt][12 bytes nonce][encrypted]
    salt = container.subarray(0, 16);
    nonce = container.subarray(16, 28);
    encrypted = container.subarray(28);
  }

  const keyBytes = await deriveChaChaKey(password, salt);
  let decrypted: Uint8Array;

  try {
    if (variant === 'xchacha20-poly1305') {
      const cipher = xchacha20poly1305(keyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    } else if (variant === 'chacha20-raw') {
      decrypted = chacha20(keyBytes, nonce, encrypted);
    } else if (variant === 'xsalsa20-poly1305') {
      const cipher = xsalsa20poly1305(keyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    } else {
      const cipher = chacha20poly1305(keyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    }
  } catch {
    throw new Error('復号に失敗しました。パスワードが異なるか改ざんされています');
  }

  if (decrypted.length >= 2) {
    const nameLen = (decrypted[0] << 8) | decrypted[1];
    if (decrypted.length >= 2 + nameLen) {
      const nameBytes = decrypted.subarray(2, 2 + nameLen);
      const fileName = new TextDecoder('utf-8').decode(nameBytes);
      const fileData = decrypted.subarray(2 + nameLen);
      const outBuffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength
      ) as ArrayBuffer;
      return { fileName, fileData: outBuffer, variant };
    }
  }

  const outBuffer = decrypted.buffer.slice(
    decrypted.byteOffset,
    decrypted.byteOffset + decrypted.byteLength
  ) as ArrayBuffer;
  return { fileName: 'decrypted.bin', fileData: outBuffer, variant };
}

/**
 * Encrypt directly using a 32-byte (256-bit) raw key generated in KeyGeneratorTool
 */
export async function chacha20EncryptWithRawKey(
  plaintext: string | ArrayBuffer,
  rawKeyBytes: Uint8Array,
  variant: ChaChaVariant = 'chacha20-poly1305'
): Promise<{ combinedBase64: string; nonceHex: string; variant: ChaChaVariant }> {
  if (rawKeyBytes.length !== 32) {
    throw new Error(`ChaCha20 の共通鍵は 32 バイト (256 bit) である必要があります (指定長: ${rawKeyBytes.length} バイト)`);
  }
  const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;
  const nonce = window.crypto.getRandomValues(new Uint8Array(nonceLen));

  const plainBytes = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : new Uint8Array(plaintext);

  let encrypted: Uint8Array;
  if (variant === 'xchacha20-poly1305') {
    const cipher = xchacha20poly1305(rawKeyBytes, nonce);
    encrypted = cipher.encrypt(plainBytes);
  } else if (variant === 'chacha20-raw') {
    encrypted = chacha20(rawKeyBytes, nonce, plainBytes);
  } else if (variant === 'xsalsa20-poly1305') {
    const cipher = xsalsa20poly1305(rawKeyBytes, nonce);
    encrypted = cipher.encrypt(plainBytes);
  } else {
    const cipher = chacha20poly1305(rawKeyBytes, nonce);
    encrypted = cipher.encrypt(plainBytes);
  }

  let variantByte = 0;
  if (variant === 'xchacha20-poly1305') variantByte = 1;
  else if (variant === 'chacha20-raw') variantByte = 2;
  else if (variant === 'xsalsa20-poly1305') variantByte = 3;

  // Prefix with 0xFF marker to indicate raw-key mode, then variantByte, then nonce, then ciphertext
  const combined = new Uint8Array(2 + nonce.length + encrypted.length);
  combined[0] = 0xff; // marker for raw key
  combined[1] = variantByte;
  combined.set(nonce, 2);
  combined.set(encrypted, 2 + nonce.length);

  return {
    combinedBase64: bufferToBase64(combined.buffer as ArrayBuffer),
    nonceHex: bufferToHex(nonce.buffer as ArrayBuffer),
    variant,
  };
}

/**
 * Decrypt directly using a 32-byte (256-bit) raw key
 */
export async function chacha20DecryptWithRawKey(
  combinedBase64: string,
  rawKeyBytes: Uint8Array,
  forceVariant?: ChaChaVariant
): Promise<{ text?: string; buffer: ArrayBuffer; detectedVariant?: ChaChaVariant }> {
  if (rawKeyBytes.length !== 32) {
    throw new Error(`ChaCha20 の共通鍵は 32 バイト (256 bit) である必要があります (指定長: ${rawKeyBytes.length} バイト)`);
  }
  const combined = new Uint8Array(base64ToBuffer(combinedBase64));
  if (combined.length < 14) {
    throw new Error('暗号文の長さが不足しています');
  }

  let variant: ChaChaVariant = 'chacha20-poly1305';
  let nonce: Uint8Array;
  let encrypted: Uint8Array;

  if (combined[0] === 0xff) {
    const variantTag = combined[1];
    if (variantTag === 1) variant = 'xchacha20-poly1305';
    else if (variantTag === 2) variant = 'chacha20-raw';
    else if (variantTag === 3) variant = 'xsalsa20-poly1305';
    else variant = 'chacha20-poly1305';

    if (forceVariant) variant = forceVariant;
    const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;
    nonce = combined.subarray(2, 2 + nonceLen);
    encrypted = combined.subarray(2 + nonceLen);
  } else {
    // If not prefixed with 0xff, treat as raw nonce + cipher
    if (forceVariant) variant = forceVariant;
    const nonceLen = (variant === 'xchacha20-poly1305' || variant === 'xsalsa20-poly1305') ? 24 : 12;
    nonce = combined.subarray(0, nonceLen);
    encrypted = combined.subarray(nonceLen);
  }

  let decrypted: Uint8Array;
  try {
    if (variant === 'xchacha20-poly1305') {
      const cipher = xchacha20poly1305(rawKeyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    } else if (variant === 'chacha20-raw') {
      decrypted = chacha20(rawKeyBytes, nonce, encrypted);
    } else if (variant === 'xsalsa20-poly1305') {
      const cipher = xsalsa20poly1305(rawKeyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    } else {
      const cipher = chacha20poly1305(rawKeyBytes, nonce);
      decrypted = cipher.decrypt(encrypted);
    }
  } catch {
    throw new Error('復号に失敗しました。共通鍵が異なるか、選択した暗号規格が一致しません');
  }

  const arrayBuffer = decrypted.buffer.slice(
    decrypted.byteOffset,
    decrypted.byteOffset + decrypted.byteLength
  ) as ArrayBuffer;

  let text: string | undefined = undefined;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
  } catch {}

  return { text, buffer: arrayBuffer, detectedVariant: variant };
}

