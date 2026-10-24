import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bufferToHex, bufferToBase64, hexToBuffer, base64ToBuffer, unwrapPem } from './cryptoUtils';

/**
 * Flexible key parser: parses 32/33/64/65-byte keys from Hex, Base64, or PKCS#8/SPKI PEM.
 */
export function parseRawKey(input: string, expectedLengths: number[] = [32]): Uint8Array {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('鍵が入力されていません');
  }

  // 1. If PEM format
  if (trimmed.includes('-----BEGIN')) {
    const rawBuffer = unwrapPem(trimmed);
    const bytes = new Uint8Array(rawBuffer);

    // If it's Ed25519 PKCS8 (48 bytes, prefix 16 bytes: 302e020100300506032b657004220420)
    if (bytes.length === 48 && bytes[0] === 0x30 && bytes[1] === 0x2e) {
      return bytes.slice(16, 48);
    }
    // If it's Ed25519 SPKI (44 bytes, prefix 12 bytes: 302a300506032b6570032100)
    if (bytes.length === 44 && bytes[0] === 0x30 && bytes[1] === 0x2a) {
      return bytes.slice(12, 44);
    }

    // If bytes already matches one of expected lengths
    if (expectedLengths.includes(bytes.length)) {
      return bytes;
    }

    // Try last 32 bytes
    if (expectedLengths.includes(32) && bytes.length >= 32) {
      return bytes.slice(bytes.length - 32);
    }
  }

  // 2. Try Hex (clean all spaces, 0x prefix)
  const hexCandidate = trimmed.replace(/^0x/i, '').replace(/\s+/g, '');
  if (/^[0-9a-fA-F]+$/.test(hexCandidate) && hexCandidate.length % 2 === 0) {
    const byteLen = hexCandidate.length / 2;
    if (expectedLengths.includes(byteLen)) {
      return new Uint8Array(hexToBuffer(hexCandidate));
    }
  }

  // 3. Try Base64
  try {
    const buf = base64ToBuffer(trimmed.replace(/\s+/g, ''));
    const byteLen = buf.byteLength;
    if (expectedLengths.includes(byteLen)) {
      return new Uint8Array(buf);
    }
  } catch {
    // not valid base64
  }

  // Fallback: if hex candidate was hex even if len didn't match exactly
  if (/^[0-9a-fA-F]+$/.test(hexCandidate) && hexCandidate.length % 2 === 0) {
    return new Uint8Array(hexToBuffer(hexCandidate));
  }

  throw new Error(
    `鍵のフォーマットが認識できません。Hex (16進数) または Base64 形式で入力してください (期待長: ${expectedLengths.join(
      ' / '
    )} バイト)`
  );
}

// ---------------------------------------------------------------------------
// Ed25519 (RFC 8032) Signatures
// ---------------------------------------------------------------------------

export interface Ed25519KeyPair {
  privateKeyHex: string;
  publicKeyHex: string;
  privateKeyBase64: string;
  publicKeyBase64: string;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export function generateEd25519KeyPair(): Ed25519KeyPair {
  const kp = ed25519.keygen();

  return {
    privateKeyHex: bufferToHex(toArrayBuffer(kp.secretKey)),
    publicKeyHex: bufferToHex(toArrayBuffer(kp.publicKey)),
    privateKeyBase64: bufferToBase64(toArrayBuffer(kp.secretKey)),
    publicKeyBase64: bufferToBase64(toArrayBuffer(kp.publicKey)),
  };
}

export function signEd25519(
  data: Uint8Array,
  privateKeyInput: string
): { hex: string; base64: string } {
  const privBytes = parseRawKey(privateKeyInput, [32]);
  const signature = ed25519.sign(data, privBytes);
  return {
    hex: bufferToHex(toArrayBuffer(signature)),
    base64: bufferToBase64(toArrayBuffer(signature)),
  };
}

export function verifyEd25519(
  data: Uint8Array,
  signatureInput: string,
  publicKeyInput: string
): boolean {
  const pubBytes = parseRawKey(publicKeyInput, [32]);
  const sigBytes = parseRawKey(signatureInput, [64]);
  return ed25519.verify(sigBytes, data, pubBytes);
}

// ---------------------------------------------------------------------------
// secp256k1 (SECG / Bitcoin / Ethereum) ECDSA Signatures
// ---------------------------------------------------------------------------

export interface Secp256k1KeyPair {
  privateKeyHex: string;
  publicKeyHex: string; // 33-byte compressed hex
  publicKeyUncompressedHex: string; // 65-byte uncompressed hex
  privateKeyBase64: string;
  publicKeyBase64: string;
}

export function generateSecp256k1KeyPair(): Secp256k1KeyPair {
  const kp = secp256k1.keygen();
  const pubUncompressed = secp256k1.getPublicKey(kp.secretKey, false);

  return {
    privateKeyHex: bufferToHex(toArrayBuffer(kp.secretKey)),
    publicKeyHex: bufferToHex(toArrayBuffer(kp.publicKey)),
    publicKeyUncompressedHex: bufferToHex(toArrayBuffer(pubUncompressed)),
    privateKeyBase64: bufferToBase64(toArrayBuffer(kp.secretKey)),
    publicKeyBase64: bufferToBase64(toArrayBuffer(kp.publicKey)),
  };
}

export function signSecp256k1(
  data: Uint8Array,
  privateKeyInput: string,
  hashMode: 'SHA-256' | 'Keccak-256' = 'SHA-256'
): { hex: string; base64: string } {
  const privBytes = parseRawKey(privateKeyInput, [32]);
  let sig: Uint8Array;
  if (hashMode === 'Keccak-256') {
    const msgHash = keccak_256(data);
    sig = secp256k1.sign(msgHash, privBytes, { prehash: false });
  } else {
    sig = secp256k1.sign(data, privBytes);
  }

  return {
    hex: bufferToHex(toArrayBuffer(sig)),
    base64: bufferToBase64(toArrayBuffer(sig)),
  };
}

export function verifySecp256k1(
  data: Uint8Array,
  signatureInput: string,
  publicKeyInput: string,
  hashMode: 'SHA-256' | 'Keccak-256' = 'SHA-256'
): boolean {
  const pubBytes = parseRawKey(publicKeyInput, [33, 65]);
  const sigBytes = parseRawKey(signatureInput, [64]);
  if (hashMode === 'Keccak-256') {
    const msgHash = keccak_256(data);
    return secp256k1.verify(sigBytes, msgHash, pubBytes, { prehash: false });
  }
  return secp256k1.verify(sigBytes, data, pubBytes);
}

// ---------------------------------------------------------------------------
// X25519 (RFC 7748) Key Agreement
// ---------------------------------------------------------------------------

export interface X25519KeyPair {
  privateKeyHex: string;
  publicKeyHex: string;
  privateKeyBase64: string;
  publicKeyBase64: string;
}

export function generateX25519KeyPair(): X25519KeyPair {
  const kp = x25519.keygen();

  return {
    privateKeyHex: bufferToHex(toArrayBuffer(kp.secretKey)),
    publicKeyHex: bufferToHex(toArrayBuffer(kp.publicKey)),
    privateKeyBase64: bufferToBase64(toArrayBuffer(kp.secretKey)),
    publicKeyBase64: bufferToBase64(toArrayBuffer(kp.publicKey)),
  };
}

export function computeX25519SharedSecret(
  myPrivateKeyInput: string,
  peerPublicKeyInput: string
): { secretHex: string; secretBase64: string; derivedKeyBase64: string } {
  const myPriv = parseRawKey(myPrivateKeyInput, [32]);
  const peerPub = parseRawKey(peerPublicKeyInput, [32]);

  const rawSecret = x25519.getSharedSecret(myPriv, peerPub);
  // Derive 256-bit symmetric AES key via SHA-256
  const derivedKey = sha256(rawSecret);

  return {
    secretHex: bufferToHex(toArrayBuffer(rawSecret)),
    secretBase64: bufferToBase64(toArrayBuffer(rawSecret)),
    derivedKeyBase64: bufferToBase64(toArrayBuffer(derivedKey)),
  };
}

// ---------------------------------------------------------------------------
// secp256k1 ECDH Key Agreement
// ---------------------------------------------------------------------------

export function computeSecp256k1SharedSecret(
  myPrivateKeyInput: string,
  peerPublicKeyInput: string
): { secretHex: string; secretBase64: string; derivedKeyBase64: string } {
  const myPriv = parseRawKey(myPrivateKeyInput, [32]);
  const peerPub = parseRawKey(peerPublicKeyInput, [33, 65]);

  const rawSecret = secp256k1.getSharedSecret(myPriv, peerPub, true);
  // Derive 256-bit symmetric key via SHA-256
  const derivedKey = sha256(rawSecret);

  return {
    secretHex: bufferToHex(toArrayBuffer(rawSecret)),
    secretBase64: bufferToBase64(toArrayBuffer(rawSecret)),
    derivedKeyBase64: bufferToBase64(toArrayBuffer(derivedKey)),
  };
}
