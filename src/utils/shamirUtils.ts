/**
 * Shamir's Secret Sharing Scheme (シャミアの秘密分散法)
 * Implementation over Galois Field GF(256) with AES irreducible polynomial (0x11b).
 *
 * Information-theoretically secure threshold scheme:
 * - Any k shares out of n can perfectly reconstruct the secret.
 * - Any k-1 or fewer shares reveal zero mathematical information about the secret.
 * - Includes CRC32 checksum for tamper detection and verifiable reconstruction.
 */

// --- GF(256) Arithmetic ---
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function initGF256() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    EXP[i + 255] = x;
    LOG[x] = i;
    // Multiply by generator alpha = 3 in GF(2^8) with polynomial 0x11b (x^8 + x^4 + x^3 + x + 1)
    const xTimes2 = (x << 1) ^ (x & 0x80 ? 0x11b : 0);
    x = xTimes2 ^ x;
  }
})();

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

export function gfDiv(a: number, b: number): number {
  if (a === 0) return 0;
  if (b === 0) throw new Error('Division by zero in GF(256)');
  return EXP[(LOG[a] - LOG[b] + 255) % 255];
}

export function gfAdd(a: number, b: number): number {
  return a ^ b;
}

// CRC32 implementation for secret integrity checking
export function calculateCRC32(data: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    let c = (crc ^ data[i]) & 0xff;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ -1) >>> 0;
}

export interface ShamirShare {
  version: number;
  k: number; // Threshold
  n: number; // Total shares
  x: number; // Share index (1..255)
  checksum: number; // CRC32 of original payload
  isText: boolean;
  filename?: string;
  data: Uint8Array; // Evaluated polynomial bytes y
  formattedText: string; // Compact copyable string
  armoredText: string; // PGP-like block format
}

export interface ReconstructResult {
  success: boolean;
  secretBytes?: Uint8Array;
  text?: string;
  filename?: string;
  isText?: boolean;
  checksumMatched: boolean;
  threshold: number;
  total: number;
  sharesUsed: number[];
  validSharesProvided?: number[];
  totalSharesProvided?: number;
  faultyShareIndices?: number[];
  error?: string;
}

/**
 * Splits raw bytes into n shares with threshold k.
 */
export function splitSecret(
  secretBytes: Uint8Array,
  k: number,
  n: number,
  options?: { isText?: boolean; filename?: string }
): ShamirShare[] {
  if (k < 2) throw new Error('閾値 k は 2 以上である必要があります');
  if (n < k) throw new Error('総シェア数 n は閾値 k 以上である必要があります');
  if (n > 255) throw new Error('総シェア数 n は 255 以下である必要があります');
  if (secretBytes.length === 0) throw new Error('秘密データが空です');

  const checksum = calculateCRC32(secretBytes);
  const isText = options?.isText ?? true;
  const filename = options?.filename ? options.filename.trim() : undefined;

  // Header payload structure:
  // [1 byte: isText flag]
  // [1 byte: filename length (FN_LEN)]
  // [FN_LEN bytes: filename UTF-8]
  // [Remainder: secretBytes]
  const encoder = new TextEncoder();
  const filenameBytes = filename ? encoder.encode(filename) : new Uint8Array(0);
  if (filenameBytes.length > 255) {
    throw new Error('ファイル名が長すぎます (最大255バイト)');
  }

  const payload = new Uint8Array(2 + filenameBytes.length + secretBytes.length);
  payload[0] = isText ? 1 : 0;
  payload[1] = filenameBytes.length;
  if (filenameBytes.length > 0) {
    payload.set(filenameBytes, 2);
  }
  payload.set(secretBytes, 2 + filenameBytes.length);

  const payloadLength = payload.length;

  // Allocate share data arrays
  const shareBuffers: Uint8Array[] = Array.from({ length: n }, () => new Uint8Array(payloadLength));

  // Cryptographically secure random coefficients
  // For each byte in payload, pick k-1 random coefficients in GF(256)
  const randomCoeffs = new Uint8Array(payloadLength * (k - 1));
  crypto.getRandomValues(randomCoeffs);

  let randOffset = 0;
  for (let byteIdx = 0; byteIdx < payloadLength; byteIdx++) {
    const a0 = payload[byteIdx];
    const coeffs = new Uint8Array(k);
    coeffs[0] = a0;
    for (let c = 1; c < k; c++) {
      coeffs[c] = randomCoeffs[randOffset++];
    }

    // Evaluate polynomial at x = 1..n
    for (let x = 1; x <= n; x++) {
      let y = coeffs[k - 1];
      for (let c = k - 2; c >= 0; c--) {
        y = gfMul(y, x) ^ coeffs[c];
      }
      shareBuffers[x - 1][byteIdx] = y;
    }
  }

  // Construct ShamirShare objects
  return shareBuffers.map((data, idx) => {
    const x = idx + 1;
    const shareObj: Omit<ShamirShare, 'formattedText' | 'armoredText'> = {
      version: 1,
      k,
      n,
      x,
      checksum,
      isText,
      filename,
      data,
    };

    const formattedText = formatShareCompact(shareObj);
    const armoredText = formatShareArmored(shareObj);

    return {
      ...shareObj,
      formattedText,
      armoredText,
    };
  });
}

/**
 * Compact single-line string representation:
 * SSS1-{k}of{n}-{x}-{checksumHex}-{base64url(data)}
 */
export function formatShareCompact(share: Omit<ShamirShare, 'formattedText' | 'armoredText'>): string {
  const checksumHex = share.checksum.toString(16).padStart(8, '0');
  const base64Data = uint8ArrayToBase64(share.data);
  return `SSS1-${share.k}of${share.n}-${share.x}-${checksumHex}-${base64Data}`;
}

/**
 * Formatted armored text block (easy to print, copy, paste).
 */
export function formatShareArmored(share: Omit<ShamirShare, 'formattedText' | 'armoredText'>): string {
  const checksumHex = share.checksum.toString(16).padStart(8, '0').toUpperCase();
  const base64Data = uint8ArrayToBase64(share.data);
  const chunks: string[] = [];
  for (let i = 0; i < base64Data.length; i += 64) {
    chunks.push(base64Data.slice(i, i + 64));
  }

  const headerLines: string[] = [
    `-----BEGIN SHAMIR SECRET SHARE-----`,
    `Version: 1`,
    `Threshold: ${share.k} of ${share.n}`,
    `Share-Index: ${share.x}`,
    `Checksum: ${checksumHex}`,
  ];
  if (share.filename) {
    headerLines.push(`Filename: ${share.filename}`);
  }
  headerLines.push(`Type: ${share.isText ? 'Text' : 'Binary File'}`);
  headerLines.push('');
  headerLines.push(...chunks);
  headerLines.push(`-----END SHAMIR SECRET SHARE-----`);

  return headerLines.join('\n');
}

/**
 * Parses a share from either compact single-line or armored block text.
 */
export function parseShareString(text: string): {
  version: number;
  k: number;
  n: number;
  x: number;
  checksum: number;
  data: Uint8Array;
} | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Try Compact format: SSS1-{k}of{n}-{x}-{checksumHex}-{base64}
  const compactMatch = trimmed.match(/SSS1-(\d+)of(\d+)-(\d+)-([0-9a-fA-F]{8})-([A-Za-z0-9+/=_-]+)/);
  if (compactMatch) {
    const k = parseInt(compactMatch[1], 10);
    const n = parseInt(compactMatch[2], 10);
    const x = parseInt(compactMatch[3], 10);
    const checksum = parseInt(compactMatch[4], 16) >>> 0;
    try {
      const data = base64ToUint8Array(compactMatch[5]);
      return { version: 1, k, n, x, checksum, data };
    } catch {
      return null;
    }
  }

  // 2. Try Armored block format
  if (trimmed.includes('BEGIN SHAMIR SECRET SHARE')) {
    const lines = trimmed.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    let k = 0;
    let n = 0;
    let x = 0;
    let checksum = 0;
    let base64Accumulator = '';

    for (const line of lines) {
      if (line.startsWith('-----BEGIN') || line.startsWith('-----END')) continue;

      const threshMatch = line.match(/^Threshold:\s*(\d+)\s*of\s*(\d+)$/i);
      if (threshMatch) {
        k = parseInt(threshMatch[1], 10);
        n = parseInt(threshMatch[2], 10);
        continue;
      }
      const indexMatch = line.match(/^Share-Index:\s*(\d+)$/i);
      if (indexMatch) {
        x = parseInt(indexMatch[1], 10);
        continue;
      }
      const checkMatch = line.match(/^Checksum:\s*([0-9a-fA-F]{8})$/i);
      if (checkMatch) {
        checksum = parseInt(checkMatch[1], 16) >>> 0;
        continue;
      }
      if (line.startsWith('Version:') || line.startsWith('Filename:') || line.startsWith('Type:')) {
        continue;
      }

      // Any remaining base64 payload line
      if (/^[A-Za-z0-9+/=_-]+$/.test(line)) {
        base64Accumulator += line;
      }
    }

    if (k > 0 && n >= k && x > 0 && base64Accumulator.length > 0) {
      try {
        const data = base64ToUint8Array(base64Accumulator);
        return { version: 1, k, n, x, checksum, data };
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Reconstructs a secret given a list of parsed shares.
 * If more than k shares are provided and some are corrupted, attempts combinations
 * to isolate the authentic shares and report any faulty ones.
 */
export function reconstructSecret(
  shares: Array<{ k: number; n: number; x: number; checksum: number; data: Uint8Array }>
): ReconstructResult {
  if (!shares || shares.length === 0) {
    return {
      success: false,
      checksumMatched: false,
      threshold: 0,
      total: 0,
      sharesUsed: [],
      error: 'シェアが入力されていません',
    };
  }

  // Deduplicate by share index x
  const uniqueMap = new Map<number, (typeof shares)[0]>();
  for (const s of shares) {
    if (!uniqueMap.has(s.x)) {
      uniqueMap.set(s.x, s);
    }
  }
  const uniqueShares = Array.from(uniqueMap.values());

  const first = uniqueShares[0];
  const k = first.k;
  const n = first.n;
  const expectedChecksum = first.checksum;

  // Check consistency of k, n, checksum across provided shares
  for (const s of uniqueShares) {
    if (s.k !== k || s.n !== n) {
      return {
        success: false,
        checksumMatched: false,
        threshold: k,
        total: n,
        sharesUsed: [],
        error: `異なる設定のシェアが混在しています (シェア#${s.x}は ${s.k}of${s.n}、別シェアは ${k}of${n})`,
      };
    }
    if (s.checksum !== expectedChecksum) {
      return {
        success: false,
        checksumMatched: false,
        threshold: k,
        total: n,
        sharesUsed: [],
        error: `異なる秘密に属するシェアが混在しています (チェックサム不一致: シェア#${s.x})`,
      };
    }
    if (s.data.length !== first.data.length) {
      return {
        success: false,
        checksumMatched: false,
        threshold: k,
        total: n,
        sharesUsed: [],
        error: `シェアのデータ長が異なります (シェア#${s.x}が破損している可能性があります)`,
      };
    }
  }

  if (uniqueShares.length < k) {
    return {
      success: false,
      checksumMatched: false,
      threshold: k,
      total: n,
      sharesUsed: uniqueShares.map((s) => s.x),
      error: `シェア数が不足しています。必要閾値は ${k} 枚ですが、現在 ${uniqueShares.length} 枚しかありません (あと ${k - uniqueShares.length} 枚必要)`,
    };
  }

  // Helper to reconstruct payload from exact k shares
  const tryReconstruct = (subset: typeof uniqueShares): Uint8Array => {
    const payloadLen = subset[0].data.length;
    const reconstructed = new Uint8Array(payloadLen);

    for (let byteIdx = 0; byteIdx < payloadLen; byteIdx++) {
      let secretByte = 0;
      for (let i = 0; i < k; i++) {
        let li = 1;
        const xi = subset[i].x;
        for (let j = 0; j < k; j++) {
          if (i === j) continue;
          const xj = subset[j].x;
          // Lagrange basis polynomial at x = 0: xj / (xi ^ xj)
          const num = xj;
          const den = xi ^ xj;
          const term = gfDiv(num, den);
          li = gfMul(li, term);
        }
        secretByte ^= gfMul(subset[i].data[byteIdx], li);
      }
      reconstructed[byteIdx] = secretByte;
    }
    return reconstructed;
  };

  // Helper to unpack payload [1 byte isText][1 byte fnLen][fnBytes][secretBytes]
  const unpackPayload = (payload: Uint8Array) => {
    if (payload.length < 2) return null;
    const isText = payload[0] === 1;
    const fnLen = payload[1];
    if (payload.length < 2 + fnLen) return null;
    let filename: string | undefined = undefined;
    if (fnLen > 0) {
      const fnBytes = payload.subarray(2, 2 + fnLen);
      filename = new TextDecoder().decode(fnBytes);
    }
    const secretBytes = payload.subarray(2 + fnLen);
    const checksum = calculateCRC32(secretBytes);
    return { isText, filename, secretBytes, checksum };
  };

  // 1. If exact k shares, reconstruct directly
  if (uniqueShares.length === k) {
    const payload = tryReconstruct(uniqueShares);
    const unpacked = unpackPayload(payload);
    if (!unpacked) {
      return {
        success: false,
        checksumMatched: false,
        threshold: k,
        total: n,
        sharesUsed: uniqueShares.map((s) => s.x),
        totalSharesProvided: uniqueShares.length,
        error: 'ペイロード形式が不正です。シェアが改ざんされたか誤っています。',
      };
    }

    const matched = unpacked.checksum === expectedChecksum;
    if (!matched) {
      return {
        success: false,
        checksumMatched: false,
        threshold: k,
        total: n,
        sharesUsed: uniqueShares.map((s) => s.x),
        totalSharesProvided: uniqueShares.length,
        error: `整合性チェックサムが一致しませんでした (計算値: 0x${unpacked.checksum.toString(16)}, 期待値: 0x${expectedChecksum.toString(16)})。提供されたシェアのいずれかが改ざんまたは破損しています。`,
      };
    }

    let text: string | undefined = undefined;
    if (unpacked.isText) {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(unpacked.secretBytes);
      } catch {
        text = new TextDecoder('utf-8').decode(unpacked.secretBytes);
      }
    }

    return {
      success: true,
      secretBytes: unpacked.secretBytes,
      text,
      filename: unpacked.filename,
      isText: unpacked.isText,
      checksumMatched: true,
      threshold: k,
      total: n,
      sharesUsed: uniqueShares.map((s) => s.x),
      validSharesProvided: uniqueShares.map((s) => s.x),
      totalSharesProvided: uniqueShares.length,
    };
  }

  // 2. If > k shares provided, find all valid k-combinations that match expectedChecksum
  const combinations = getCombinations(uniqueShares, k);
  const validCombos: Array<{ combo: typeof uniqueShares; unpacked: NonNullable<ReturnType<typeof unpackPayload>> }> = [];

  for (const combo of combinations) {
    const payload = tryReconstruct(combo);
    const unpacked = unpackPayload(payload);
    if (unpacked && unpacked.checksum === expectedChecksum) {
      validCombos.push({ combo, unpacked });
    }
  }

  if (validCombos.length > 0) {
    // Collect all share indices that appeared in at least one valid combination
    const validShareIndicesSet = new Set<number>();
    for (const item of validCombos) {
      for (const s of item.combo) {
        validShareIndicesSet.add(s.x);
      }
    }

    // Truly faulty shares: shares that NEVER produced a valid secret in any combination
    const faultyShares = uniqueShares.filter((s) => !validShareIndicesSet.has(s.x)).map((s) => s.x);
    const validSharesList = uniqueShares.filter((s) => validShareIndicesSet.has(s.x)).map((s) => s.x);

    const firstSuccess = validCombos[0];
    let text: string | undefined = undefined;
    if (firstSuccess.unpacked.isText) {
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(firstSuccess.unpacked.secretBytes);
      } catch {
        text = new TextDecoder('utf-8').decode(firstSuccess.unpacked.secretBytes);
      }
    }

    return {
      success: true,
      secretBytes: firstSuccess.unpacked.secretBytes,
      text,
      filename: firstSuccess.unpacked.filename,
      isText: firstSuccess.unpacked.isText,
      checksumMatched: true,
      threshold: k,
      total: n,
      sharesUsed: firstSuccess.combo.map((s) => s.x),
      validSharesProvided: validSharesList,
      totalSharesProvided: uniqueShares.length,
      faultyShareIndices: faultyShares.length > 0 ? faultyShares : undefined,
    };
  }

  // No combination succeeded
  return {
    success: false,
    checksumMatched: false,
    threshold: k,
    total: n,
    sharesUsed: uniqueShares.map((s) => s.x),
    totalSharesProvided: uniqueShares.length,
    error: 'すべての組み合わせで整合性チェックサムが不一致でした。有効なシェアが閾値 k 枚に達していないか、シェアが破損しています。',
  };
}

// Generate k-combinations from array
function getCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    // limit search space to avoid explosion
    if (result.length > 150) return;
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

// Helper: Uint8Array <-> Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Support standard and url-safe base64
  let normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Educational Math Simulator:
 * Generates sample polynomial values and shares for visual curve demonstration in the UI.
 */
export function generateMathSimulation(k: number, n: number, secretVal = 42) {
  // Generate a small toy polynomial f(x) = secret + a1*x + a2*x^2 ... over standard integers/real numbers for 2D graphing visualization
  const coeffs = [secretVal];
  for (let i = 1; i < k; i++) {
    // friendly integer coefficients for graphing
    coeffs.push((i * 7 + 3) % 15 - 5);
  }

  const evaluateToy = (x: number) => {
    let y = 0;
    for (let p = 0; p < k; p++) {
      y += coeffs[p] * Math.pow(x, p);
    }
    return y;
  };

  const points = [];
  for (let x = 1; x <= n; x++) {
    points.push({ x, y: evaluateToy(x) });
  }

  return {
    k,
    n,
    secret: secretVal,
    coeffs,
    points,
  };
}
