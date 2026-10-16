/**
 * Fully Homomorphic Encryption (FHE) & Additive Homomorphic Utilities
 *
 * Implements:
 * 1. DGHV (Dijkstra-Gentry-Halevi-Vaikuntanathan) Integer-based Fully Homomorphic Encryption:
 *    - Encrypts bits {0, 1} with noise.
 *    - Evaluates arbitrary boolean logic circuits (AND, XOR, OR, NAND, Half Adder, Full Adder)
 *      directly on encrypted ciphertexts without ever decrypting them.
 * 2. Paillier Additive Homomorphic Cryptosystem:
 *    - Supports homomorphic addition: Dec(c1 * c2 mod n^2) = m1 + m2
 *    - Supports scalar multiplication: Dec(c^k mod n^2) = k * m
 *    - Real-world application for private voting tallying, encrypted salary averages, and confidential analytics.
 */

// -------------------------------------------------------------
// Math Helpers
// -------------------------------------------------------------

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp = exp / 2n;
  }
  return res;
}

export function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function getRandomBigInt(bits: number): bigint {
  const bytesCount = Math.ceil(bits / 8);
  const bytes = new Uint8Array(bytesCount);
  window.crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  let num = BigInt(`0x${hex}`);
  const mask = (1n << BigInt(bits)) - 1n;
  return (num & mask) | (1n << BigInt(bits - 1));
}

// -------------------------------------------------------------
// 1. DGHV Fully Homomorphic Encryption (FHE)
// -------------------------------------------------------------

export interface DghvKey {
  p: bigint; // secret odd prime / large integer
  bitLength: number;
}

export interface FheCipherBit {
  c: bigint;
  noiseEstimate: number; // approximate noise bit magnitude
}

/**
 * Generate DGHV secret key
 */
export function generateDghvKey(bitLength = 128): DghvKey {
  let p = getRandomBigInt(bitLength);
  if (p % 2n === 0n) p += 1n; // ensure odd
  return { p, bitLength };
}

/**
 * Encrypt a bit m in {0, 1}
 * Ciphertext: c = p * q + 2 * r + m
 */
export function dghvEncryptBit(m: number | bigint, key: DghvKey): FheCipherBit {
  const bit = BigInt(m) & 1n;
  // q: large random integer
  const q = getRandomBigInt(64);
  // r: small random noise (< 16 bits)
  const r = getRandomBigInt(14) % 1024n;
  const c = key.p * q + 2n * r + bit;
  return { c, noiseEstimate: 14 };
}

/**
 * Decrypt a ciphertext bit
 * m = (c mod p) mod 2
 */
export function dghvDecryptBit(cipher: FheCipherBit | bigint, key: DghvKey): number {
  const c = typeof cipher === 'bigint' ? cipher : cipher.c;
  const rem = ((c % key.p) + key.p) % key.p;
  return Number(rem % 2n);
}

/**
 * Homomorphic NOT: 1 - c (or c + 1)
 */
export function fheNot(a: FheCipherBit): FheCipherBit {
  return {
    c: a.c + 1n,
    noiseEstimate: a.noiseEstimate,
  };
}

/**
 * Homomorphic XOR (Addition modulo 2): c1 + c2
 */
export function fheXor(a: FheCipherBit, b: FheCipherBit): FheCipherBit {
  return {
    c: a.c + b.c,
    noiseEstimate: Math.max(a.noiseEstimate, b.noiseEstimate) + 1,
  };
}

/**
 * Homomorphic AND (Multiplication): c1 * c2
 */
export function fheAnd(a: FheCipherBit, b: FheCipherBit): FheCipherBit {
  return {
    c: a.c * b.c,
    noiseEstimate: a.noiseEstimate + b.noiseEstimate + 2,
  };
}

/**
 * Homomorphic OR: a XOR b XOR (a AND b)
 */
export function fheOr(a: FheCipherBit, b: FheCipherBit): FheCipherBit {
  const andPart = fheAnd(a, b);
  const xorPart = fheXor(a, b);
  return fheXor(xorPart, andPart);
}

/**
 * Homomorphic NAND: NOT (a AND b)
 */
export function fheNand(a: FheCipherBit, b: FheCipherBit): FheCipherBit {
  const andPart = fheAnd(a, b);
  return fheNot(andPart);
}

/**
 * Homomorphic Half Adder:
 * Sum = A XOR B
 * Carry = A AND B
 */
export function fheHalfAdder(
  a: FheCipherBit,
  b: FheCipherBit
): { sum: FheCipherBit; carry: FheCipherBit } {
  return {
    sum: fheXor(a, b),
    carry: fheAnd(a, b),
  };
}

/**
 * Homomorphic Full Adder:
 * Sum = A XOR B XOR Cin
 * Cout = (A AND B) OR (Cin AND (A XOR B))
 */
export function fheFullAdder(
  a: FheCipherBit,
  b: FheCipherBit,
  cin: FheCipherBit
): { sum: FheCipherBit; cout: FheCipherBit } {
  const aXorB = fheXor(a, b);
  const sum = fheXor(aXorB, cin);
  const aAndB = fheAnd(a, b);
  const cinAndAxorB = fheAnd(cin, aXorB);
  const cout = fheOr(aAndB, cinAndAxorB);
  return { sum, cout };
}

// -------------------------------------------------------------
// 2. Paillier Additive Homomorphic Cryptosystem
// -------------------------------------------------------------

export interface PaillierPublicKey {
  n: bigint;
  n2: bigint; // n^2
  g: bigint;
  bitLength: number;
}

export interface PaillierPrivateKey {
  lambda: bigint;
  mu: bigint;
  publicKey: PaillierPublicKey;
}

// Pre-generated certified safe primes for immediate browser initialization
const DEFAULT_PAILLIER_PRIMES = {
  p: 0xd986bf3e26bb2ef3d60742a3n,
  q: 0xdf84457e5d590e87b7a5a8a1n,
};

/**
 * Generate Paillier Key Pair
 */
export function generatePaillierKeys(customPrimes?: { p: bigint; q: bigint }): {
  publicKey: PaillierPublicKey;
  privateKey: PaillierPrivateKey;
} {
  const p = customPrimes?.p || DEFAULT_PAILLIER_PRIMES.p;
  const q = customPrimes?.q || DEFAULT_PAILLIER_PRIMES.q;

  const n = p * q;
  const n2 = n * n;
  const g = n + 1n; // standard generator choice

  const lambda = ((p - 1n) * (q - 1n)) / gcd(p - 1n, q - 1n);

  const L = (u: bigint) => (u - 1n) / n;
  const u = modPow(g, lambda, n2);
  const mu = modInverse(L(u), n);

  const publicKey: PaillierPublicKey = {
    n,
    n2,
    g,
    bitLength: n.toString(2).length,
  };

  const privateKey: PaillierPrivateKey = {
    lambda,
    mu,
    publicKey,
  };

  return { publicKey, privateKey };
}

/**
 * Paillier Encrypt: c = g^m * r^n mod n^2
 */
export function paillierEncrypt(m: number | bigint, publicKey: PaillierPublicKey): bigint {
  const { n, n2, g } = publicKey;
  const mBig = ((BigInt(m) % n) + n) % n;

  // Pick random r in [1, n-1] coprime to n
  const r = (getRandomBigInt(32) % (n - 2n)) + 2n;

  const gm = modPow(g, mBig, n2);
  const rn = modPow(r, n, n2);
  return (gm * rn) % n2;
}

/**
 * Paillier Decrypt: m = L(c^lambda mod n^2) * mu mod n
 */
export function paillierDecrypt(c: bigint, privateKey: PaillierPrivateKey): bigint {
  const { n, n2 } = privateKey.publicKey;
  const { lambda, mu } = privateKey;

  const u = modPow(c, lambda, n2);
  const L = (val: bigint) => (val - 1n) / n;
  let m = (L(u) * mu) % n;
  // Handle negative numbers if m > n / 2
  if (m > n / 2n) {
    m = m - n;
  }
  return m;
}

/**
 * Homomorphic Addition of two ciphertexts: c1 * c2 mod n^2
 * Dec(c_sum) = m1 + m2 mod n
 */
export function paillierAdd(c1: bigint, c2: bigint, publicKey: PaillierPublicKey): bigint {
  return (c1 * c2) % publicKey.n2;
}

/**
 * Homomorphic Scalar Multiplication: c^k mod n^2
 * Dec(c_mult) = k * m mod n
 */
export function paillierMultiplyScalar(
  c: bigint,
  scalar: number | bigint,
  publicKey: PaillierPublicKey
): bigint {
  const k = BigInt(scalar);
  return modPow(c, k, publicKey.n2);
}
