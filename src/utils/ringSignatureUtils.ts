/**
 * Ring Signature Utilities (SAG / LSAG on Ed25519)
 *
 * Implements Spontaneous Anonymous Group (SAG) signatures based on the
 * Rivest-Shamir-Tauman / Schnorr-Ed25519 framework (similar to Monero's ring signatures).
 *
 * Key Property:
 * - A signer signs on behalf of an ad-hoc group (the "Ring") of N public keys.
 * - Any verifier can mathematically prove that ONE of the ring members signed the message.
 * - NO ONE (not even other ring members) can determine WHICH member produced the signature.
 * - Signer anonymity is unconditionally uniform: P(signer = i) = 1/N.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';

const G = ed25519.Point.BASE;
const CURVE_ORDER = ed25519.Point.Fn.ORDER;

export interface RingKeyPair {
  secretKeyHex: string;
  publicKeyHex: string;
  label?: string;
  createdAt: number;
}

export interface RingMember {
  publicKeyHex: string;
  label: string;
  isSelf?: boolean;
}

export interface RingSignaturePackage {
  version: number; // 1
  algorithm: 'Ed25519-SAG';
  message: string;
  ring: string[]; // List of public keys (Hex) in order
  c0: string; // Initial challenge scalar (Hex)
  s: string[]; // Response scalars (Hex) for each ring member
  createdAt: number;
}

export interface RingVerificationResult {
  isValid: boolean;
  ringSize: number;
  anonymityScore: string;
  verifiedAt: number;
  error?: string;
}

/**
 * Hash multiple inputs to a scalar modulo ed25519.CURVE.n
 */
function hashToScalar(...inputs: (string | Uint8Array)[]): bigint {
  const hasher = sha512.create();
  for (const input of inputs) {
    if (typeof input === 'string') {
      hasher.update(new TextEncoder().encode(input));
    } else {
      hasher.update(input);
    }
  }
  const digest = hasher.digest();

  // Convert 64-byte digest to BigInt (big-endian)
  let num = 0n;
  for (let i = 0; i < digest.length; i++) {
    num = (num << 8n) | BigInt(digest[i]);
  }

  const res = num % CURVE_ORDER;
  return res === 0n ? 1n : res;
}

/**
 * Generate a cryptographically secure random scalar in [1, CURVE_ORDER - 1]
 */
function randomScalar(): bigint {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  let val = 0n;
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8n) | BigInt(bytes[i]);
  }
  const scalar = (val % (CURVE_ORDER - 1n)) + 1n;
  return scalar;
}

/**
 * Convert BigInt scalar to 64-char zero-padded hex string
 */
function scalarToHex(val: bigint): string {
  return val.toString(16).padStart(64, '0');
}

/**
 * Convert hex string to BigInt scalar
 */
function hexToScalar(hex: string): bigint {
  const cleaned = hex.trim().replace(/^0x/i, '');
  return BigInt(`0x${cleaned}`);
}

/**
 * Generate a new ring signature keypair
 */
export function generateRingKeyPair(label?: string): RingKeyPair {
  const privScalar = randomScalar();
  const pubPoint = G.multiply(privScalar);
  const pubBytes = pubPoint.toRawBytes();

  const secretKeyHex = scalarToHex(privScalar);
  const publicKeyHex = Array.from(pubBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    secretKeyHex,
    publicKeyHex,
    label: label || '署名者キー',
    createdAt: Date.now(),
  };
}

/**
 * Derive public key hex from secret key hex
 */
export function getPublicKeyFromSecret(secretKeyHex: string): string {
  const privScalar = hexToScalar(secretKeyHex);
  if (privScalar <= 0n || privScalar >= CURVE_ORDER) {
    throw new Error('無効な秘密鍵スカラーです (1 <= scalar < curve.n である必要があります)');
  }
  const pubPoint = G.multiply(privScalar);
  const pubBytes = pubPoint.toRawBytes();
  return Array.from(pubBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate dummy decoy members for the ring
 */
export function generateDummyRingMembers(count: number): RingMember[] {
  const members: RingMember[] = [];
  for (let i = 0; i < count; i++) {
    const pair = generateRingKeyPair();
    members.push({
      publicKeyHex: pair.publicKeyHex,
      label: `おとり鍵 #${i + 1} (${pair.publicKeyHex.slice(0, 8)}...)`,
      isSelf: false,
    });
  }
  return members;
}

/**
 * Create a Spontaneous Anonymous Group (SAG) Ring Signature
 */
export function createRingSignature(
  message: string,
  ringPublicKeys: string[],
  signerSecretKeyHex: string
): RingSignaturePackage {
  if (ringPublicKeys.length < 2) {
    throw new Error('リング署名には最低2つ以上の公開鍵（自分＋1人以上のおとり）が必要です');
  }

  // Deduplicate and normalize
  const normalizedRing = ringPublicKeys.map((k) => k.trim().toLowerCase());
  const myPubKey = getPublicKeyFromSecret(signerSecretKeyHex).toLowerCase();

  const signerIndex = normalizedRing.indexOf(myPubKey);
  if (signerIndex === -1) {
    throw new Error(
      '指定された秘密鍵に対応する公開鍵がリングリストに含まれていません。リングメンバーに自身の公開鍵を追加してください。'
    );
  }

  const ringSize = normalizedRing.length;
  const signerPriv = hexToScalar(signerSecretKeyHex);

  // Validate all ring points
  const ringPoints: any[] = [];
  for (let i = 0; i < ringSize; i++) {
    try {
      const pt = ed25519.ExtendedPoint.fromHex(normalizedRing[i]);
      ringPoints.push(pt);
    } catch {
      throw new Error(`リング内の公開鍵 #${i + 1} が不正なEd25519ポイントです`);
    }
  }

  const L = normalizedRing.join(',');
  const s: bigint[] = new Array(ringSize);
  const c: bigint[] = new Array(ringSize);

  // 1. Pick random alpha in [1, CURVE_ORDER - 1] for signer index
  const alpha = randomScalar();
  const R_pi = G.multiply(alpha);

  // Challenge for next member (pi + 1)
  const nextIdx = (signerIndex + 1) % ringSize;
  c[nextIdx] = hashToScalar(L, message, R_pi.toRawBytes());

  // 2. Compute the rest of the ring sequentially
  for (let step = 1; step < ringSize; step++) {
    const i = (signerIndex + step) % ringSize;
    const nextI = (i + 1) % ringSize;

    // Pick random fake response s_i for decoys
    s[i] = randomScalar();

    // R_i = s_i * G + c_i * P_i
    const Pi = ringPoints[i];
    const sG = G.multiply(s[i]);
    const cP = Pi.multiply(c[i]);
    const Ri = sG.add(cP);

    // c_{i+1} = H(L, message, R_i)
    c[nextI] = hashToScalar(L, message, Ri.toRawBytes());
  }

  // 3. Close the ring at signer index pi:
  // s_pi = (alpha - c_pi * signerPriv) mod CURVE_ORDER
  let s_pi = (alpha - ((c[signerIndex] * signerPriv) % CURVE_ORDER)) % CURVE_ORDER;
  if (s_pi < 0n) s_pi += CURVE_ORDER;
  if (s_pi === 0n) s_pi = CURVE_ORDER;
  s[signerIndex] = s_pi;

  return {
    version: 1,
    algorithm: 'Ed25519-SAG',
    message,
    ring: normalizedRing,
    c0: scalarToHex(c[0]),
    s: s.map((val) => scalarToHex(val)),
    createdAt: Date.now(),
  };
}

/**
 * Verify a Spontaneous Anonymous Group (SAG) Ring Signature
 */
export function verifyRingSignature(pkg: RingSignaturePackage): RingVerificationResult {
  try {
    if (!pkg || !pkg.ring || !pkg.s || !pkg.c0) {
      return {
        isValid: false,
        ringSize: 0,
        anonymityScore: '0%',
        verifiedAt: Date.now(),
        error: '署名パッケージの形式が不正です',
      };
    }

    const ringSize = pkg.ring.length;
    if (ringSize < 2) {
      return {
        isValid: false,
        ringSize,
        anonymityScore: '0%',
        verifiedAt: Date.now(),
        error: 'リングサイズは2以上である必要があります',
      };
    }

    if (pkg.s.length !== ringSize) {
      return {
        isValid: false,
        ringSize,
        anonymityScore: '0%',
        verifiedAt: Date.now(),
        error: 'レスポンス値 s の数とリングサイズが一致しません',
      };
    }

    const L = pkg.ring.map((k) => k.trim().toLowerCase()).join(',');
    const c0 = hexToScalar(pkg.c0);

    let c_curr = c0;

    for (let i = 0; i < ringSize; i++) {
      const pubHex = pkg.ring[i].trim().toLowerCase();
      let Pi: any;
      try {
        Pi = ed25519.ExtendedPoint.fromHex(pubHex);
      } catch {
        return {
          isValid: false,
          ringSize,
          anonymityScore: '0%',
          verifiedAt: Date.now(),
          error: `公開鍵 #${i + 1} が有効なEd25519楕円曲線ポイントではありません`,
        };
      }

      const s_i = hexToScalar(pkg.s[i]);
      if (s_i <= 0n || s_i >= CURVE_ORDER) {
        return {
          isValid: false,
          ringSize,
          anonymityScore: '0%',
          verifiedAt: Date.now(),
          error: `レスポンススカラー #${i + 1} の範囲が不正です`,
        };
      }

      // R_i = s_i * G + c_curr * P_i
      const sG = G.multiply(s_i);
      const cP = Pi.multiply(c_curr);
      const Ri = sG.add(cP);

      // c_{i+1} = H(L, message, R_i)
      c_curr = hashToScalar(L, pkg.message, Ri.toRawBytes());
    }

    // Verify ring closure: c_n == c_0
    const isValid = c_curr === c0;

    const anonymityPercent = ((1 - 1 / ringSize) * 100).toFixed(1);

    return {
      isValid,
      ringSize,
      anonymityScore: isValid ? `特定不能性 ${anonymityPercent}% (候補数: ${ringSize})` : '0%',
      verifiedAt: Date.now(),
      error: isValid ? undefined : 'リングが閉じていません（署名が無効または改ざんされています）',
    };
  } catch (err: any) {
    return {
      isValid: false,
      ringSize: pkg?.ring?.length || 0,
      anonymityScore: '0%',
      verifiedAt: Date.now(),
      error: `検証処理中に例外が発生しました: ${err.message}`,
    };
  }
}
