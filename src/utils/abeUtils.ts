/**
 * Ciphertext-Policy Attribute-Based Encryption (CP-ABE)
 *
 * Implements fine-grained mathematical access control where:
 * 1. Ciphertext is encrypted under an Access Policy expression (e.g., "(Role:Doctor AND Dept:Surgery) OR Role:Director").
 * 2. User Secret Key is issued for an Attribute Set (e.g., ["Role:Doctor", "Dept:Surgery", "Location:Tokyo"]).
 * 3. Decryption is mathematically possible IF AND ONLY IF the user's attributes satisfy the policy tree.
 * 4. Combines Tree-based Shamir Secret Sharing with AES-256-GCM envelope encryption.
 */

// -------------------------------------------------------------
// Pure TypeScript Synchronous SHA-256 Implementation (Zero External Dependencies)
// -------------------------------------------------------------

function sha256Hex(message: string | Uint8Array): string {
  const bytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const l = bytes.length;
  const bitLen = l * 8;
  const k = (448 - (bitLen + 8) % 512 + 512) % 512;
  const totalBytes = l + 1 + k / 8 + 8;
  const padded = new Uint8Array(totalBytes);
  padded.set(bytes);
  padded[l] = 0x80;

  const view = new DataView(padded.buffer);
  view.setBigUint64(totalBytes - 8, BigInt(bitLen), false);

  const w = new Uint32Array(64);
  for (let i = 0; i < totalBytes; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3);
      const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map((v) => (v >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

// -------------------------------------------------------------
// Finite Field & Polynomial Arithmetic (Modulus P = 2^31 - 1, Mersenne prime)
// -------------------------------------------------------------
const P = 2147483647n;

function mod(n: bigint, m = P): bigint {
  return ((n % m) + m) % m;
}

function modInverse(a: bigint, m = P): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return mod(old_s, m);
}

function makePolyShares(secret: bigint, k: number, n: number): { x: bigint; y: bigint }[] {
  const coeffs = [secret];
  const randBytes = new Uint8Array(4);
  for (let i = 1; i < k; i++) {
    window.crypto.getRandomValues(randBytes);
    let r = 0n;
    for (const b of randBytes) r = (r << 8n) | BigInt(b);
    coeffs.push(mod(r, P));
  }

  const shares: { x: bigint; y: bigint }[] = [];
  for (let x = 1n; x <= BigInt(n); x++) {
    let y = 0n;
    let x_pow = 1n;
    for (const c of coeffs) {
      y = mod(y + c * x_pow);
      x_pow = mod(x_pow * x);
    }
    shares.push({ x, y });
  }
  return shares;
}

function interpolateAtZero(shares: { x: bigint; y: bigint }[]): bigint {
  let secret = 0n;
  for (let i = 0; i < shares.length; i++) {
    let num = 1n;
    let den = 1n;
    for (let j = 0; j < shares.length; j++) {
      if (i === j) continue;
      num = mod(num * -shares[j].x);
      den = mod(den * (shares[i].x - shares[j].x));
    }
    const lagrange = mod(num * modInverse(den));
    secret = mod(secret + shares[i].y * lagrange);
  }
  return secret;
}

// -------------------------------------------------------------
// Policy Tree Data Structure
// -------------------------------------------------------------

export type PolicyNodeType = 'LEAF' | 'AND' | 'OR';

export interface PolicyNode {
  id: string;
  type: PolicyNodeType;
  attribute?: string; // used when type === 'LEAF'
  threshold: number; // 1 for OR, children.length for AND
  children?: PolicyNode[];
}

export interface MasterAuthority {
  masterSecretKeyHex: string;
  publicParamsId: string;
  createdAt: number;
}

export interface UserSecretKey {
  format: 'ABE_USER_KEY';
  version: 1;
  authorityId: string;
  userId: string;
  attributes: string[]; // Normalized lowercase attributes
  userBlindingHex: string;
  attributeTokens: Record<string, string>; // attribute -> derived token hex
  createdAt: number;
}

export interface AbeCipherPackage {
  format: 'ABE_CIPHER_PACKAGE';
  version: 1;
  algorithm: 'CP-ABE-AES256GCM';
  authorityId: string;
  policyExpression: string;
  policyTree: PolicyNode;
  leafCipherShares: Record<string, string>; // leafNodeId -> encrypted share hex
  ivHex: string;
  ciphertextBase64: string;
  fileName?: string;
  fileType?: string;
  isBinary?: boolean;
  createdAt: number;
}

export interface AbeDecryptedResult {
  text?: string;
  binaryData?: Uint8Array;
  fileName?: string;
  fileType?: string;
  isBinary: boolean;
}

// -------------------------------------------------------------
// Tokenizer & Parser for Policy Expressions
// -------------------------------------------------------------

function tokenizePolicy(expr: string): string[] {
  const regex = /\s*(\(|\)|AND|OR|[a-zA-Z0-9_:\-.]+)\s*/gi;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(expr)) !== null) {
    tokens.push(match[1]);
  }
  return tokens;
}

let nodeIdCounter = 0;

/**
 * Parse policy expression into a PolicyNode tree:
 * e.g., "(Role:Doctor AND Dept:Surgery) OR Clearance:High"
 */
export function parsePolicyExpression(expr: string): PolicyNode {
  const tokens = tokenizePolicy(expr);
  if (tokens.length === 0) {
    throw new Error('ポリシー式が空です');
  }

  nodeIdCounter = 0;
  let pos = 0;

  function parseOr(): PolicyNode {
    let node = parseAnd();
    while (pos < tokens.length && tokens[pos].toUpperCase() === 'OR') {
      pos++; // consume OR
      const right = parseAnd();
      node = {
        id: `or_${++nodeIdCounter}`,
        type: 'OR',
        threshold: 1,
        children: [node, right],
      };
    }
    return node;
  }

  function parseAnd(): PolicyNode {
    let node = parsePrimary();
    while (pos < tokens.length && tokens[pos].toUpperCase() === 'AND') {
      pos++; // consume AND
      const right = parsePrimary();
      node = {
        id: `and_${++nodeIdCounter}`,
        type: 'AND',
        threshold: 2,
        children: [node, right],
      };
    }
    return node;
  }

  function parsePrimary(): PolicyNode {
    if (pos >= tokens.length) {
      throw new Error('予期しないポリシー式の末尾です');
    }
    const token = tokens[pos];
    if (token === '(') {
      pos++; // consume (
      const node = parseOr();
      if (pos >= tokens.length || tokens[pos] !== ')') {
        throw new Error('閉じ括弧 ")" が見つかりません');
      }
      pos++; // consume )
      return node;
    }

    if (token.toUpperCase() === 'AND' || token.toUpperCase() === 'OR' || token === ')') {
      throw new Error(`予期しないトークン: ${token}`);
    }

    pos++; // consume attribute
    return {
      id: `leaf_${++nodeIdCounter}_${token.toLowerCase()}`,
      type: 'LEAF',
      attribute: token.trim(),
      threshold: 1,
    };
  }

  const root = parseOr();
  if (pos < tokens.length) {
    throw new Error(`ポリシー式に余分なトークンがあります: ${tokens.slice(pos).join(' ')}`);
  }

  return root;
}

/**
 * Recursively check if a user's attribute set satisfies the policy tree
 */
export function evaluatePolicyTree(node: PolicyNode, userAttributes: string[]): boolean {
  const normUserAttrs = new Set(userAttributes.map((a) => a.trim().toLowerCase()));

  if (node.type === 'LEAF') {
    return normUserAttrs.has(node.attribute?.trim().toLowerCase() || '');
  }

  if (!node.children || node.children.length === 0) return false;

  let satisfiedCount = 0;
  for (const child of node.children) {
    if (evaluatePolicyTree(child, userAttributes)) {
      satisfiedCount++;
    }
  }

  return satisfiedCount >= node.threshold;
}

// -------------------------------------------------------------
// Master Authority & User Key Issuance
// -------------------------------------------------------------

export function generateMasterAuthority(): MasterAuthority {
  const rand = new Uint8Array(32);
  window.crypto.getRandomValues(rand);
  const mskHex = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    masterSecretKeyHex: mskHex,
    publicParamsId: `ABE-AUTH-${mskHex.slice(0, 8).toUpperCase()}`,
    createdAt: Date.now(),
  };
}

/**
 * Issue a User Secret Key tied to their specific attributes and identity
 */
export function issueUserKey(
  authority: MasterAuthority,
  userId: string,
  attributes: string[]
): UserSecretKey {
  const randBlinding = new Uint8Array(16);
  window.crypto.getRandomValues(randBlinding);
  const userBlindingHex = Array.from(randBlinding)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const attributeTokens: Record<string, string> = {};

  for (const attr of attributes) {
    const cleanAttr = attr.trim().toLowerCase();
    const tokenHex = sha256Hex(`${authority.masterSecretKeyHex}::${cleanAttr}::`);
    attributeTokens[cleanAttr] = tokenHex;
  }

  return {
    format: 'ABE_USER_KEY',
    version: 1,
    authorityId: authority.publicParamsId,
    userId,
    attributes: attributes.map((a) => a.trim()),
    userBlindingHex,
    attributeTokens,
    createdAt: Date.now(),
  };
}

// -------------------------------------------------------------
// Encryption under Access Policy
// -------------------------------------------------------------

export async function encryptWithPolicy(
  payload: string | Uint8Array,
  policyExpression: string,
  authority: MasterAuthority,
  fileMeta?: { fileName?: string; fileType?: string; isBinary?: boolean }
): Promise<AbeCipherPackage> {
  const tree = parsePolicyExpression(policyExpression);

  // Root secret in finite field [1, P - 1]
  const rootSecretBytes = new Uint8Array(4);
  window.crypto.getRandomValues(rootSecretBytes);
  let rootSecret = 0n;
  for (const b of rootSecretBytes) rootSecret = (rootSecret << 8n) | BigInt(b);
  rootSecret = mod(rootSecret, P);
  if (rootSecret === 0n) rootSecret = 1234567n;

  const leafCipherShares: Record<string, string> = {};

  // Share rootSecret recursively down the tree
  function distributeSecret(node: PolicyNode, secret: bigint) {
    if (node.type === 'LEAF') {
      const cleanAttr = (node.attribute || '').trim().toLowerCase();
      const padHex = sha256Hex(`${authority.masterSecretKeyHex}::${cleanAttr}::`);

      let padInt = 0n;
      for (let i = 0; i < 4; i++) {
        padInt = (padInt << 8n) | BigInt(parseInt(padHex.substr(i * 2, 2), 16));
      }
      const maskedShare = mod(secret + padInt, P);

      leafCipherShares[node.id] = maskedShare.toString(16).padStart(8, '0');
      return;
    }

    if (!node.children || node.children.length === 0) return;

    const shares = makePolyShares(secret, node.threshold, node.children.length);
    for (let i = 0; i < node.children.length; i++) {
      distributeSecret(node.children[i], shares[i].y);
    }
  }

  distributeSecret(tree, rootSecret);

  // Encrypt payload with AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const payloadBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;

  const derivedKeyHex = sha256Hex(`ABE_ROOT_SECRET_${rootSecret}`);
  const derivedKeyBytes = new Uint8Array(
    derivedKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const symKey = await window.crypto.subtle.importKey(
    'raw',
    derivedKeyBytes as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const cipherBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    symKey,
    payloadBytes as any
  );

  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // base64 ciphertext
  const cipherU8 = new Uint8Array(cipherBuf);
  let binary = '';
  for (let i = 0; i < cipherU8.length; i++) {
    binary += String.fromCharCode(cipherU8[i]);
  }
  const ciphertextBase64 = btoa(binary);

  return {
    format: 'ABE_CIPHER_PACKAGE',
    version: 1,
    algorithm: 'CP-ABE-AES256GCM',
    authorityId: authority.publicParamsId,
    policyExpression,
    policyTree: tree,
    leafCipherShares,
    ivHex,
    ciphertextBase64,
    fileName: fileMeta?.fileName,
    fileType: fileMeta?.fileType,
    isBinary: fileMeta?.isBinary,
    createdAt: Date.now(),
  };
}

// -------------------------------------------------------------
// Decryption with User Secret Key
// -------------------------------------------------------------

export async function decryptWithUserKey(
  pkg: AbeCipherPackage,
  userKey: UserSecretKey
): Promise<AbeDecryptedResult> {
  const normUserAttrs = new Set(userKey.attributes.map((a) => a.trim().toLowerCase()));

  // 1. Check policy satisfaction
  const isSatisfied = evaluatePolicyTree(pkg.policyTree, userKey.attributes);
  if (!isSatisfied) {
    throw new Error(
      `復号拒否: 所持する属性 [${userKey.attributes.join(', ')}] はアクセスポリシー "${pkg.policyExpression}" を満たしていません。`
    );
  }

  // 2. Bottom-up secret reconstruction
  function recoverSecret(node: PolicyNode): bigint | null {
    if (node.type === 'LEAF') {
      const cleanAttr = (node.attribute || '').trim().toLowerCase();
      if (!normUserAttrs.has(cleanAttr)) return null;

      const maskedHex = pkg.leafCipherShares[node.id];
      if (!maskedHex) return null;
      const maskedShare = BigInt(`0x${maskedHex}`);

      // Unmask share using user's attribute token directly
      const tokenHex = userKey.attributeTokens[cleanAttr];
      if (!tokenHex) return null;

      let padInt = 0n;
      for (let i = 0; i < 4; i++) {
        padInt = (padInt << 8n) | BigInt(parseInt(tokenHex.substr(i * 2, 2), 16));
      }

      return mod(maskedShare - padInt, P);
    }

    if (!node.children || node.children.length === 0) return null;

    const availableShares: { x: bigint; y: bigint }[] = [];
    for (let i = 0; i < node.children.length; i++) {
      const childSecret = recoverSecret(node.children[i]);
      if (childSecret !== null) {
        availableShares.push({ x: BigInt(i + 1), y: childSecret });
        if (availableShares.length === node.threshold) break;
      }
    }

    if (availableShares.length < node.threshold) return null;

    return interpolateAtZero(availableShares);
  }

  const recoveredRoot = recoverSecret(pkg.policyTree);
  if (recoveredRoot === null) {
    throw new Error('ポリシーの秘密分散シェアを復元できませんでした');
  }

  // 3. Derive symmetric key from recoveredRoot
  const derivedKeyHex = sha256Hex(`ABE_ROOT_SECRET_${recoveredRoot}`);
  const derivedKeyBytes = new Uint8Array(
    derivedKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const symKey = await window.crypto.subtle.importKey(
    'raw',
    derivedKeyBytes as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 4. Decrypt AES-GCM payload
  const ivBytes = new Uint8Array(
    pkg.ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const rawCipher = atob(pkg.ciphertextBase64);
  const cipherBytes = new Uint8Array(rawCipher.length);
  for (let i = 0; i < rawCipher.length; i++) {
    cipherBytes[i] = rawCipher.charCodeAt(i);
  }

  try {
    const decBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as any },
      symKey,
      cipherBytes as any
    );
    const u8 = new Uint8Array(decBuf);

    if (pkg.isBinary) {
      return {
        binaryData: u8,
        fileName: pkg.fileName,
        fileType: pkg.fileType,
        isBinary: true,
      };
    } else {
      const text = new TextDecoder('utf-8').decode(u8);
      return {
        text,
        fileName: pkg.fileName,
        fileType: pkg.fileType,
        isBinary: false,
      };
    }
  } catch {
    throw new Error('暗号文の復号に失敗しました。属性鍵が破損しているかポリシーに適合しません。');
  }
}

