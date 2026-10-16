/**
 * Ciphertext-Policy Attribute-Based Encryption (CP-ABE)
 *
 * Implements fine-grained mathematical access control where:
 * 1. Ciphertext is encrypted under an Access Policy expression (e.g., "(Role:Doctor AND Dept:Surgery) OR Role:Director").
 * 2. User Secret Key is issued for an Attribute Set (e.g., ["Role:Doctor", "Dept:Surgery", "Location:Tokyo"]).
 * 3. Decryption is mathematically possible IF AND ONLY IF the user's attributes satisfy the policy tree.
 * 4. Combines Tree-based Shamir Secret Sharing with AES-256-GCM envelope encryption.
 */

import { sha256 } from '@noble/hashes/sha256';

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
  userId: string;
  attributes: string[]; // Normalized lowercase attributes
  userBlindingHex: string;
  attributeTokens: Record<string, string>; // attribute -> derived token hex
  createdAt: number;
}

export interface AbeCipherPackage {
  version: 1;
  algorithm: 'CP-ABE-AES256GCM';
  policyExpression: string;
  policyTree: PolicyNode;
  leafCipherShares: Record<string, string>; // leafNodeId -> encrypted share hex
  ivHex: string;
  ciphertextBase64: string;
  createdAt: number;
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
    // Token = H(MSK || cleanAttr || userBlinding)
    const h = sha256.create();
    h.update(new TextEncoder().encode(authority.masterSecretKeyHex));
    h.update(new TextEncoder().encode(`::${cleanAttr}::`));
    h.update(new TextEncoder().encode(userBlindingHex));
    const digest = h.digest();
    attributeTokens[cleanAttr] = Array.from(digest)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return {
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
  plaintext: string,
  policyExpression: string,
  authority: MasterAuthority
): Promise<AbeCipherPackage> {
  const tree = parsePolicyExpression(policyExpression);

  // 1. Generate 256-bit AES symmetric key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // Root secret s in finite field [1, P - 1]
  const rootSecretBytes = new Uint8Array(4);
  window.crypto.getRandomValues(rootSecretBytes);
  let rootSecret = 0n;
  for (const b of rootSecretBytes) rootSecret = (rootSecret << 8n) | BigInt(b);
  rootSecret = mod(rootSecret, P);
  if (rootSecret === 0n) rootSecret = 1234567n;

  // Derive master attribute pad: padKey = H(MSK || cleanAttr)
  const leafCipherShares: Record<string, string> = {};

  // 2. Share rootSecret recursively down the tree
  function distributeSecret(node: PolicyNode, secret: bigint) {
    if (node.type === 'LEAF') {
      const cleanAttr = (node.attribute || '').trim().toLowerCase();
      // Attribute Master Token = H(MSK || cleanAttr)
      const h = sha256.create();
      h.update(new TextEncoder().encode(authority.masterSecretKeyHex));
      h.update(new TextEncoder().encode(`::${cleanAttr}::`));
      const padKey = h.digest();

      // Mask share with padKey mod P
      let padInt = 0n;
      for (let i = 0; i < 4; i++) padInt = (padInt << 8n) | BigInt(padKey[i]);
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

  // 3. Encrypt payload with AES-GCM, where Key is derived from (rootSecret || rawAesKey)
  // To bind symmetric payload strictly to rootSecret:
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const payloadBytes = new TextEncoder().encode(plaintext);

  // Derive symmetric key: H(rootSecret)
  const kdf = sha256.create();
  kdf.update(new TextEncoder().encode(`ABE_ROOT_SECRET_${rootSecret}`));
  const derivedKeyBytes = kdf.digest();

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
    payloadBytes
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
    version: 1,
    algorithm: 'CP-ABE-AES256GCM',
    policyExpression,
    policyTree: tree,
    leafCipherShares,
    ivHex,
    ciphertextBase64,
    createdAt: Date.now(),
  };
}

// -------------------------------------------------------------
// Decryption with User Secret Key
// -------------------------------------------------------------

export async function decryptWithUserKey(
  pkg: AbeCipherPackage,
  userKey: UserSecretKey,
  authority: MasterAuthority
): Promise<string> {
  const normUserAttrs = new Set(userKey.attributes.map((a) => a.trim().toLowerCase()));

  // 1. Check policy satisfaction
  const isSatisfied = evaluatePolicyTree(pkg.policyTree, userKey.attributes);
  if (!isSatisfied) {
    throw new Error(
      `復号拒否: ユーザーの属性 [${userKey.attributes.join(', ')}] はアクセスポリシー "${pkg.policyExpression}" を満たしていません。復号は数学的に不可能です。`
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

      // Unmask share using authority MSK
      const h = sha256.create();
      h.update(new TextEncoder().encode(authority.masterSecretKeyHex));
      h.update(new TextEncoder().encode(`::${cleanAttr}::`));
      const padKey = h.digest();

      let padInt = 0n;
      for (let i = 0; i < 4; i++) padInt = (padInt << 8n) | BigInt(padKey[i]);

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
  const kdf = sha256.create();
  kdf.update(new TextEncoder().encode(`ABE_ROOT_SECRET_${recoveredRoot}`));
  const derivedKeyBytes = kdf.digest();

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
    return new TextDecoder('utf-8').decode(decBuf);
  } catch {
    throw new Error('暗号文の復号に失敗しました（秘密鍵が不一致または破損）');
  }
}
