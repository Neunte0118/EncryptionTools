/**
 * Pure TypeScript implementation of MD5 (RFC 1321)
 * Optimized for ArrayBuffer and typed arrays without any external dependencies.
 */

// Per-round shift amounts
const S: number[] = [
  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,
];

// Precomputed table of floor(2^32 * abs(sin(i + 1)))
const K: number[] = new Array(64);
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
}

function leftRotate(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

/**
 * Computes MD5 digest of an ArrayBuffer or Uint8Array.
 * Returns raw 16-byte Uint8Array.
 */
export function md5(data: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bitLength = bytes.length * 8;

  // Pre-processing: padding
  // Pad with 1 bit (0x80), then zeros until length % 64 === 56
  const paddingLength = (bytes.length % 64 < 56)
    ? 56 - (bytes.length % 64)
    : 120 - (bytes.length % 64);

  const totalLength = bytes.length + paddingLength + 8;
  const padded = new Uint8Array(totalLength);
  padded.set(bytes, 0);
  padded[bytes.length] = 0x80;

  // Append 64-bit length in little-endian
  const view = new DataView(padded.buffer);
  // Low 32 bits
  view.setUint32(totalLength - 8, bitLength >>> 0, true);
  // High 32 bits (support up to 2^53 safely)
  view.setUint32(totalLength - 4, Math.floor(bitLength / 4294967296) >>> 0, true);

  // Initialize variables (RFC 1321)
  let a0 = 0x67452301 >>> 0;
  let b0 = 0xefcdab89 >>> 0;
  let c0 = 0x98badcfe >>> 0;
  let d0 = 0x10325476 >>> 0;

  // Process 512-bit (64-byte) chunks
  const M = new Uint32Array(16);
  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(offset + i * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;

      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const temp = D;
      D = C;
      C = B;
      const sum = (A + F + K[i] + M[g]) >>> 0;
      B = (B + leftRotate(sum, S[i])) >>> 0;
      A = temp;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const result = new Uint8Array(16);
  const outView = new DataView(result.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);

  return result;
}

export function md5Hex(data: ArrayBuffer | Uint8Array | string): string {
  let buf: Uint8Array;
  if (typeof data === 'string') {
    buf = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    buf = data;
  } else {
    buf = new Uint8Array(data);
  }
  const digest = md5(buf);
  let hex = '';
  for (let i = 0; i < digest.length; i++) {
    hex += digest[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function md5Base64(data: ArrayBuffer | Uint8Array | string): string {
  let buf: Uint8Array;
  if (typeof data === 'string') {
    buf = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    buf = data;
  } else {
    buf = new Uint8Array(data);
  }
  const digest = md5(buf);
  let binary = '';
  for (let i = 0; i < digest.length; i++) {
    binary += String.fromCharCode(digest[i]);
  }
  return window.btoa(binary);
}
