/**
 * One-Time Secure Note & Ephemeral Link Utilities
 *
 * All operations run 100% locally in the browser via Web Crypto API.
 * The payload is encrypted with AES-256-GCM.
 * When transmitted via URL fragment (#...), the secret key and ciphertext
 * are NEVER sent to the web server, DNS, or proxy logs.
 */

import {
  deriveKeyFromPassword,
  base64ToBuffer,
  bufferToBase64,
} from './cryptoUtils';

export interface OneTimeNotePayload {
  v: number; // version (1)
  content: string; // decrypted secret message
  createdAt: number; // timestamp ms
  expiresAt: number; // timestamp ms (expiration deadline)
  burnAfterSeconds?: number; // local viewing countdown timer once opened
  title?: string;
  hasPassword?: boolean;
}

export interface EncryptedNotePackage {
  v: number;
  salt?: string; // base64 if password protected
  iv: string; // base64 (12 bytes)
  ciphertext: string; // base64
  expiresAt: number; // unencrypted deadline check so recipient can verify expiry immediately
  burnAfterSeconds: number; // countdown seconds
  title?: string;
  hasPassword: boolean;
}

// Convert base64 to base64url for safe URL inclusion
export function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBase64(b64url: string): string {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  return b64;
}

/**
 * Create an encrypted one-time note URL package.
 * Returns the shareable full link and key details.
 */
export async function createOneTimeNoteLink(
  content: string,
  options: {
    durationMinutes?: number; // how long until the link expires
    expiresAt?: number; // explicit timestamp for expiration
    burnAfterSeconds?: number; // how long recipient has once opened (e.g., 30s)
    title?: string;
    password?: string; // optional extra password protection
    baseUrl?: string;
  }
): Promise<{
  shareableUrl: string;
  expiresAt: number;
  burnAfterSeconds: number;
  keyBase64Url?: string;
}> {
  const now = Date.now();
  const expiresAt = options.expiresAt || (now + (options.durationMinutes || 60) * 60 * 1000);
  const burnAfterSeconds = options.burnAfterSeconds || 60;

  const innerPayload: OneTimeNotePayload = {
    v: 1,
    content,
    createdAt: now,
    expiresAt,
    burnAfterSeconds,
    title: options.title || '',
    hasPassword: !!options.password?.trim(),
  };

  const plainBytes = new TextEncoder().encode(JSON.stringify(innerPayload));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  let aesKey: CryptoKey;
  let rawRandomKeyBytes: Uint8Array | null = null;
  let saltB64: string | undefined = undefined;

  if (options.password && options.password.trim()) {
    // Password-based encryption
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    saltB64 = bufferToBase64(salt.buffer as ArrayBuffer);
    aesKey = await deriveKeyFromPassword(options.password.trim(), salt);
  } else {
    // Random 256-bit AES key embedded in URL fragment
    rawRandomKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
    aesKey = await window.crypto.subtle.importKey(
      'raw',
      rawRandomKeyBytes as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
  }

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    plainBytes as BufferSource
  );

  const encryptedPkg: EncryptedNotePackage = {
    v: 1,
    salt: saltB64,
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
    ciphertext: bufferToBase64(cipherBuffer),
    expiresAt,
    burnAfterSeconds,
    title: options.title || '',
    hasPassword: !!options.password?.trim(),
  };

  const pkgJson = JSON.stringify(encryptedPkg);
  const pkgB64Url = base64ToBase64Url(window.btoa(unescape(encodeURIComponent(pkgJson))));

  let fragment = `note=${pkgB64Url}`;
  let keyBase64Url: string | undefined = undefined;
  if (rawRandomKeyBytes) {
    keyBase64Url = base64ToBase64Url(bufferToBase64(rawRandomKeyBytes.buffer as ArrayBuffer));
    fragment += `&k=${keyBase64Url}`;
  }

  const currentBase =
    options.baseUrl ||
    window.location.origin + window.location.pathname;

  const shareableUrl = `${currentBase}#${fragment}`;

  return {
    shareableUrl,
    expiresAt,
    burnAfterSeconds,
    keyBase64Url,
  };
}

/**
 * Parse note parameters from a URL fragment or raw string
 */
export function parseNoteFragment(fragmentString: string): {
  pkg?: EncryptedNotePackage;
  keyB64?: string;
  error?: string;
} {
  try {
    const clean = fragmentString.replace(/^[#?]/, '');
    const params = new URLSearchParams(clean);
    const noteParam = params.get('note');
    const keyParam = params.get('k');

    if (!noteParam) {
      return { error: 'ノートの暗号化データが含まれていません' };
    }

    const b64 = base64UrlToBase64(noteParam);
    const jsonStr = decodeURIComponent(escape(window.atob(b64)));
    const pkg: EncryptedNotePackage = JSON.parse(jsonStr);

    let keyB64: string | undefined = undefined;
    if (keyParam) {
      keyB64 = base64UrlToBase64(keyParam);
    }

    return { pkg, keyB64 };
  } catch (err: any) {
    return { error: `URLパラメータの解析に失敗しました: ${err.message}` };
  }
}

/**
 * Decrypt a note package using the embedded key or user-supplied password
 */
export async function decryptOneTimeNote(
  pkg: EncryptedNotePackage,
  keyB64OrPassword?: string
): Promise<OneTimeNotePayload> {
  const now = Date.now();
  if (pkg.expiresAt && now > pkg.expiresAt) {
    throw new Error('このワンタイム・ノートは設定された有効期限を過ぎたため、破棄されました。');
  }

  if (!keyB64OrPassword) {
    throw new Error('復号用の鍵またはパスワードが指定されていません');
  }

  const iv = new Uint8Array(base64ToBuffer(pkg.iv));
  const cipherBytes = base64ToBuffer(pkg.ciphertext);

  let aesKey: CryptoKey;
  if (pkg.hasPassword) {
    if (!pkg.salt) {
      throw new Error('破損した暗号化パッケージです (ソルト欠落)');
    }
    const salt = new Uint8Array(base64ToBuffer(pkg.salt));
    aesKey = await deriveKeyFromPassword(keyB64OrPassword, salt);
  } else {
    // 256-bit raw key
    const rawKeyBuffer = base64ToBuffer(keyB64OrPassword);
    aesKey = await window.crypto.subtle.importKey(
      'raw',
      rawKeyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
  }

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    cipherBytes
  );

  const jsonStr = new TextDecoder('utf-8').decode(decryptedBuffer);
  const payload: OneTimeNotePayload = JSON.parse(jsonStr);

  // Re-verify inner payload deadline
  if (payload.expiresAt && Date.now() > payload.expiresAt) {
    throw new Error('このワンタイム・ノートは設定された有効期限を過ぎたため、破棄されました。');
  }

  return payload;
}
