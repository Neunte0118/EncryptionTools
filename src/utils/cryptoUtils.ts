/**
 * Pure Web Crypto API Utilities (100% native browser implementation)
 * No external libraries used.
 */

// --- Encodings & Conversions ---

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/[\r\n\s]+/g, '');
  const binary = window.atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBuffer(hex: string): ArrayBuffer {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export function stringToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

export function bufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8').decode(buffer);
}

// --- PEM Formatting ---

export function wrapPem(base64: string, label: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
  const chunks = base64.match(/.{1,64}/g) || [base64];
  return `-----BEGIN ${label}-----\n${chunks.join('\n')}\n-----END ${label}-----`;
}

export function unwrapPem(pem: string): ArrayBuffer {
  const lines = pem.split('\n');
  const cleanLines = lines.filter(line => !line.startsWith('-----') && line.trim().length > 0);
  const base64 = cleanLines.join('');
  return base64ToBuffer(base64);
}

// --- Hash Functions ---

export type HashAlgorithm = 'SHA-256' | 'SHA-512' | 'SHA-384' | 'SHA-1';

export async function computeHash(data: ArrayBuffer, algorithm: HashAlgorithm): Promise<{
  hex: string;
  base64: string;
}> {
  const digest = await window.crypto.subtle.digest(algorithm, data);
  return {
    hex: bufferToHex(digest),
    base64: bufferToBase64(digest),
  };
}

// --- Key Generation ---

export interface KeyGenOptions {
  type: 'rsa-pss' | 'rsa-oaep' | 'rsa-pkcs1' | 'ecdsa' | 'ecdh' | 'aes-gcm';
  modulusLength?: number; // 2048, 3072, 4096
  hash?: HashAlgorithm;
  namedCurve?: 'P-256' | 'P-384' | 'P-521';
  aesLength?: 128 | 256;
}

export interface GeneratedKeyResult {
  publicKeyPem?: string;
  privateKeyPem?: string;
  rawKeyBase64?: string;
  rawKeyHex?: string;
}

export async function generateKeyPairOrKey(options: KeyGenOptions): Promise<GeneratedKeyResult> {
  const subtle = window.crypto.subtle;

  if (options.type === 'rsa-pss' || options.type === 'rsa-oaep' || options.type === 'rsa-pkcs1') {
    const algName =
      options.type === 'rsa-pss'
        ? 'RSA-PSS'
        : options.type === 'rsa-oaep'
        ? 'RSA-OAEP'
        : 'RSASSA-PKCS1-v1_5';

    const usages: KeyUsage[] =
      options.type === 'rsa-oaep' ? ['encrypt', 'decrypt'] : ['sign', 'verify'];

    const keyPair = (await subtle.generateKey(
      {
        name: algName,
        modulusLength: options.modulusLength || 2048,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: options.hash || 'SHA-256',
      },
      true,
      usages
    )) as CryptoKeyPair;

    const spki = await subtle.exportKey('spki', keyPair.publicKey);
    const pkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKeyPem: wrapPem(bufferToBase64(spki), 'PUBLIC KEY'),
      privateKeyPem: wrapPem(bufferToBase64(pkcs8), 'PRIVATE KEY'),
    };
  }

  if (options.type === 'ecdsa' || options.type === 'ecdh') {
    const algName = options.type === 'ecdsa' ? 'ECDSA' : 'ECDH';
    const usages: KeyUsage[] =
      options.type === 'ecdsa' ? ['sign', 'verify'] : ['deriveKey', 'deriveBits'];

    const keyPair = (await subtle.generateKey(
      {
        name: algName,
        namedCurve: options.namedCurve || 'P-256',
      },
      true,
      usages
    )) as CryptoKeyPair;

    const spki = await subtle.exportKey('spki', keyPair.publicKey);
    const pkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKeyPem: wrapPem(bufferToBase64(spki), 'PUBLIC KEY'),
      privateKeyPem: wrapPem(bufferToBase64(pkcs8), 'PRIVATE KEY'),
    };
  }

  if (options.type === 'aes-gcm') {
    const key = (await subtle.generateKey(
      {
        name: 'AES-GCM',
        length: options.aesLength || 256,
      },
      true,
      ['encrypt', 'decrypt']
    )) as CryptoKey;

    const raw = await subtle.exportKey('raw', key);
    return {
      rawKeyBase64: bufferToBase64(raw),
      rawKeyHex: bufferToHex(raw),
    };
  }

  throw new Error(`Unsupported key type: ${options.type}`);
}

// --- Import Keys ---

export async function importPublicKey(
  pem: string,
  algorithm: RsaHashedImportParams | EcKeyImportParams,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const der = unwrapPem(pem);
  return await window.crypto.subtle.importKey('spki', der, algorithm, true, usages);
}

export async function importPrivateKey(
  pem: string,
  algorithm: RsaHashedImportParams | EcKeyImportParams,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const der = unwrapPem(pem);
  return await window.crypto.subtle.importKey('pkcs8', der, algorithm, true, usages);
}

export async function importAesKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- Digital Signature Generation & Verification ---

export interface SignParams {
  type: 'rsa-pss' | 'rsa-pkcs1' | 'ecdsa';
  hash: HashAlgorithm;
  namedCurve?: 'P-256' | 'P-384' | 'P-521';
  saltLength?: number;
  privateKeyPem: string;
  data: ArrayBuffer;
}

export async function signData(params: SignParams): Promise<{ base64: string; hex: string }> {
  let subtle = window.crypto.subtle;
  let key: CryptoKey;
  let signAlg: AlgorithmIdentifier | RsaPssParams | EcdsaParams;

  if (params.type === 'rsa-pss') {
    key = await importPrivateKey(
      params.privateKeyPem,
      { name: 'RSA-PSS', hash: params.hash },
      ['sign']
    );
    const saltLen =
      params.saltLength !== undefined
        ? params.saltLength
        : params.hash === 'SHA-256'
        ? 32
        : params.hash === 'SHA-512'
        ? 64
        : params.hash === 'SHA-384'
        ? 48
        : 20;
    signAlg = { name: 'RSA-PSS', saltLength: saltLen };
  } else if (params.type === 'rsa-pkcs1') {
    key = await importPrivateKey(
      params.privateKeyPem,
      { name: 'RSASSA-PKCS1-v1_5', hash: params.hash },
      ['sign']
    );
    signAlg = { name: 'RSASSA-PKCS1-v1_5' };
  } else if (params.type === 'ecdsa') {
    key = await importPrivateKey(
      params.privateKeyPem,
      { name: 'ECDSA', namedCurve: params.namedCurve || 'P-256' },
      ['sign']
    );
    signAlg = { name: 'ECDSA', hash: params.hash };
  } else {
    throw new Error('Unsupported signature type');
  }

  const sigBuffer = await subtle.sign(signAlg, key, params.data);
  return {
    base64: bufferToBase64(sigBuffer),
    hex: bufferToHex(sigBuffer),
  };
}

export interface VerifyParams {
  type: 'rsa-pss' | 'rsa-pkcs1' | 'ecdsa';
  hash: HashAlgorithm;
  namedCurve?: 'P-256' | 'P-384' | 'P-521';
  saltLength?: number;
  publicKeyPem: string;
  data: ArrayBuffer;
  signature: ArrayBuffer;
}

export async function verifyData(params: VerifyParams): Promise<boolean> {
  const subtle = window.crypto.subtle;
  let key: CryptoKey;
  let verifyAlg: AlgorithmIdentifier | RsaPssParams | EcdsaParams;

  if (params.type === 'rsa-pss') {
    key = await importPublicKey(
      params.publicKeyPem,
      { name: 'RSA-PSS', hash: params.hash },
      ['verify']
    );
    const saltLen =
      params.saltLength !== undefined
        ? params.saltLength
        : params.hash === 'SHA-256'
        ? 32
        : params.hash === 'SHA-512'
        ? 64
        : params.hash === 'SHA-384'
        ? 48
        : 20;
    verifyAlg = { name: 'RSA-PSS', saltLength: saltLen };
  } else if (params.type === 'rsa-pkcs1') {
    key = await importPublicKey(
      params.publicKeyPem,
      { name: 'RSASSA-PKCS1-v1_5', hash: params.hash },
      ['verify']
    );
    verifyAlg = { name: 'RSASSA-PKCS1-v1_5' };
  } else if (params.type === 'ecdsa') {
    key = await importPublicKey(
      params.publicKeyPem,
      { name: 'ECDSA', namedCurve: params.namedCurve || 'P-256' },
      ['verify']
    );
    verifyAlg = { name: 'ECDSA', hash: params.hash };
  } else {
    throw new Error('Unsupported verification type');
  }

  return await subtle.verify(verifyAlg, key, params.signature, params.data);
}

// --- RSA-OAEP Encryption & Decryption ---

export async function rsaEncrypt(
  publicKeyPem: string,
  hash: HashAlgorithm,
  plaintext: ArrayBuffer
): Promise<{ base64: string; hex: string }> {
  const key = await importPublicKey(
    publicKeyPem,
    { name: 'RSA-OAEP', hash },
    ['encrypt']
  );
  const cipher = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, plaintext);
  return {
    base64: bufferToBase64(cipher),
    hex: bufferToHex(cipher),
  };
}

export async function rsaDecrypt(
  privateKeyPem: string,
  hash: HashAlgorithm,
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer> {
  const key = await importPrivateKey(
    privateKeyPem,
    { name: 'RSA-OAEP', hash },
    ['decrypt']
  );
  return await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, ciphertext);
}

// --- AES-GCM Symmetric Encryption & Decryption ---

export async function aesEncrypt(
  rawKey: ArrayBuffer,
  plaintext: ArrayBuffer
): Promise<{ ivHex: string; ciphertextBase64: string; combinedBase64: string }> {
  const key = await importAesKey(rawKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for GCM
  const cipher = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // Combine IV (12 bytes) + Ciphertext into a single payload
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);

  return {
    ivHex: bufferToHex(iv.buffer),
    ciphertextBase64: bufferToBase64(cipher),
    combinedBase64: bufferToBase64(combined.buffer),
  };
}

export async function aesDecrypt(
  rawKey: ArrayBuffer,
  ciphertextWithOrWithoutIv: ArrayBuffer,
  explicitIv?: ArrayBuffer
): Promise<ArrayBuffer> {
  const key = await importAesKey(rawKey);
  let iv: ArrayBuffer;
  let cipherOnly: ArrayBuffer;

  if (explicitIv) {
    iv = explicitIv;
    cipherOnly = ciphertextWithOrWithoutIv;
  } else {
    // Treat first 12 bytes as IV
    const bytes = new Uint8Array(ciphertextWithOrWithoutIv);
    if (bytes.length <= 12) {
      throw new Error('Ciphertext too short to contain IV and data');
    }
    iv = bytes.slice(0, 12).buffer;
    cipherOnly = bytes.slice(12).buffer;
  }

  return await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherOnly
  );
}

// --- ECDH Shared Secret Derivation ---

export async function computeEcdhSharedSecret(
  privateKeyPem: string,
  otherPublicKeyPem: string,
  namedCurve: 'P-256' | 'P-384' | 'P-521'
): Promise<{ secretHex: string; secretBase64: string }> {
  const privKey = await importPrivateKey(
    privateKeyPem,
    { name: 'ECDH', namedCurve },
    ['deriveBits']
  );
  const pubKey = await importPublicKey(
    otherPublicKeyPem,
    { name: 'ECDH', namedCurve },
    []
  );

  const bitsLength = namedCurve === 'P-256' ? 256 : namedCurve === 'P-384' ? 384 : 521;
  const derivedBits = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: pubKey },
    privKey,
    bitsLength
  );

  return {
    secretHex: bufferToHex(derivedBits),
    secretBase64: bufferToBase64(derivedBits),
  };
}
