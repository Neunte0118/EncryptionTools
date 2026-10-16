import { ml_kem512, ml_kem768, ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa44, ml_dsa65, ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';

export type MlKemLevel = '512' | '768' | '1024';
export type MlDsaLevel = '44' | '65' | '87';

export interface PqcEncryptedPackage {
  algorithm: 'ML-KEM-AES256GCM';
  level: MlKemLevel;
  kemCiphertextHex: string;
  ivHex: string;
  ciphertextBase64: string;
  filename?: string;
  mimeType?: string;
  timestamp: number;
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().replace(/^0x/i, '').replace(/\s+/g, '');
  if (cleanHex.length % 2 !== 0) throw new Error('16進数文字列の長さが不正です');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function getMlKemInstance(level: MlKemLevel) {
  switch (level) {
    case '512':
      return ml_kem512;
    case '768':
      return ml_kem768;
    case '1024':
      return ml_kem1024;
    default:
      return ml_kem768;
  }
}

function getMlDsaInstance(level: MlDsaLevel) {
  switch (level) {
    case '44':
      return ml_dsa44;
    case '65':
      return ml_dsa65;
    case '87':
      return ml_dsa87;
    default:
      return ml_dsa65;
  }
}

// ---------------------------------------------------------------------
// ML-KEM (Kyber: FIPS 203)
// ---------------------------------------------------------------------

/**
 * Generate ML-KEM (Kyber) Lattice Key Pair
 */
export function generateMlKemKeyPair(level: MlKemLevel = '768'): {
  publicKeyHex: string;
  secretKeyHex: string;
  level: MlKemLevel;
  publicKeyBytes: number;
  secretKeyBytes: number;
} {
  const kem = getMlKemInstance(level);
  const seed = new Uint8Array(64);
  crypto.getRandomValues(seed);
  const { publicKey, secretKey } = kem.keygen(seed);

  return {
    publicKeyHex: bytesToHex(publicKey),
    secretKeyHex: bytesToHex(secretKey),
    level,
    publicKeyBytes: publicKey.length,
    secretKeyBytes: secretKey.length,
  };
}

/**
 * Encapsulate a shared secret using recipient's ML-KEM public key
 */
export function mlKemEncapsulate(
  publicKeyHex: string,
  level: MlKemLevel = '768'
): {
  sharedSecret: Uint8Array;
  sharedSecretHex: string;
  cipherTextHex: string;
} {
  const kem = getMlKemInstance(level);
  const pubBytes = hexToBytes(publicKeyHex);
  const { cipherText, sharedSecret } = kem.encapsulate(pubBytes);

  return {
    sharedSecret,
    sharedSecretHex: bytesToHex(sharedSecret),
    cipherTextHex: bytesToHex(cipherText),
  };
}

/**
 * Decapsulate a shared secret using secret key and ciphertext
 */
export function mlKemDecapsulate(
  cipherTextHex: string,
  secretKeyHex: string,
  level: MlKemLevel = '768'
): {
  sharedSecret: Uint8Array;
  sharedSecretHex: string;
} {
  const kem = getMlKemInstance(level);
  const cipherBytes = hexToBytes(cipherTextHex);
  const secBytes = hexToBytes(secretKeyHex);
  const sharedSecret = kem.decapsulate(cipherBytes, secBytes);

  return {
    sharedSecret,
    sharedSecretHex: bytesToHex(sharedSecret),
  };
}

/**
 * Quantum-resistant hybrid encryption: Encrypt text or file data with ML-KEM + AES-256-GCM
 */
export async function encryptHybridMlKem(
  data: Uint8Array,
  recipientPublicKeyHex: string,
  level: MlKemLevel = '768',
  meta?: { filename?: string; mimeType?: string }
): Promise<PqcEncryptedPackage> {
  const { sharedSecret, cipherTextHex } = mlKemEncapsulate(recipientPublicKeyHex, level);

  const aesKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data as any
  );

  let binary = '';
  const bytes = new Uint8Array(encryptedBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const ciphertextBase64 = btoa(binary);

  return {
    algorithm: 'ML-KEM-AES256GCM',
    level,
    kemCiphertextHex: cipherTextHex,
    ivHex: bytesToHex(iv),
    ciphertextBase64,
    filename: meta?.filename,
    mimeType: meta?.mimeType,
    timestamp: Date.now(),
  };
}

/**
 * Quantum-resistant hybrid decryption: Decapsulate ML-KEM secret and decrypt AES-256-GCM
 */
export async function decryptHybridMlKem(
  pkg: PqcEncryptedPackage,
  recipientSecretKeyHex: string
): Promise<Uint8Array> {
  const { sharedSecret } = mlKemDecapsulate(
    pkg.kemCiphertextHex,
    recipientSecretKeyHex,
    pkg.level
  );

  const aesKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv = hexToBytes(pkg.ivHex);

  const binaryStr = atob(pkg.ciphertextBase64);
  const cipherBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    cipherBytes[i] = binaryStr.charCodeAt(i);
  }

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    aesKey,
    cipherBytes as any
  );

  return new Uint8Array(decryptedBuffer);
}

// ---------------------------------------------------------------------
// ML-DSA (Dilithium: FIPS 204)
// ---------------------------------------------------------------------

/**
 * Generate ML-DSA (Dilithium) Lattice Signature Key Pair
 */
export function generateMlDsaKeyPair(level: MlDsaLevel = '65'): {
  publicKeyHex: string;
  secretKeyHex: string;
  level: MlDsaLevel;
  publicKeyBytes: number;
  secretKeyBytes: number;
} {
  const dsa = getMlDsaInstance(level);
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const { publicKey, secretKey } = dsa.keygen(seed);

  return {
    publicKeyHex: bytesToHex(publicKey),
    secretKeyHex: bytesToHex(secretKey),
    level,
    publicKeyBytes: publicKey.length,
    secretKeyBytes: secretKey.length,
  };
}

/**
 * Sign data with ML-DSA (Dilithium)
 */
export function mlDsaSign(
  data: Uint8Array,
  secretKeyHex: string,
  level: MlDsaLevel = '65'
): {
  signatureHex: string;
  signatureBytes: number;
} {
  const dsa = getMlDsaInstance(level);
  const secBytes = hexToBytes(secretKeyHex);
  const sig = dsa.sign(data, secBytes);

  return {
    signatureHex: bytesToHex(sig),
    signatureBytes: sig.length,
  };
}

/**
 * Verify ML-DSA (Dilithium) signature
 */
export function mlDsaVerify(
  signatureHex: string,
  data: Uint8Array,
  publicKeyHex: string,
  level: MlDsaLevel = '65'
): boolean {
  try {
    const dsa = getMlDsaInstance(level);
    const sigBytes = hexToBytes(signatureHex);
    const pubBytes = hexToBytes(publicKeyHex);
    return dsa.verify(sigBytes, data, pubBytes);
  } catch {
    return false;
  }
}
