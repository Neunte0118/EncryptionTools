/**
 * Cryptographically Secure Pseudo-Random Number Generator (CSPRNG) Utilities
 * 100% native Web Crypto API (crypto.getRandomValues / crypto.randomUUID).
 * No external libraries used.
 */

// Unbiased CSPRNG random integer in [0, max)
export function getRandomInt(max: number): number {
  if (max <= 1) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  while (true) {
    window.crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      return buffer[0] % max;
    }
  }
}

// Generate random integer in [min, max]
export function getRandomIntRange(min: number, max: number): number {
  if (min >= max) return min;
  return min + getRandomInt(max - min + 1);
}

// Generate raw random bytes
export function getRandomBytes(byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

// Generate RFC 4122 v4 UUID
export function generateUuidV4(options?: { uppercase?: boolean; noHyphens?: boolean }): string {
  let uuid: string;
  if (typeof window.crypto.randomUUID === 'function') {
    uuid = window.crypto.randomUUID();
  } else {
    const bytes = getRandomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  if (options?.noHyphens) {
    uuid = uuid.replace(/-/g, '');
  }
  if (options?.uppercase) {
    uuid = uuid.toUpperCase();
  }
  return uuid;
}

// --- Regex Pattern Generator ---

/**
 * Expand a character class like "a-z0-9A-Z_-" into a string of allowed characters.
 */
function expandCharClass(content: string): string {
  let chars = '';
  let i = 0;
  while (i < content.length) {
    if (content[i] === '\\' && i + 1 < content.length) {
      const escaped = content[i + 1];
      if (escaped === 'd') chars += '0123456789';
      else if (escaped === 'w') chars += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
      else if (escaped === 's') chars += ' ';
      else chars += escaped;
      i += 2;
      continue;
    }

    if (i + 2 < content.length && content[i + 1] === '-') {
      const start = content.charCodeAt(i);
      const end = content.charCodeAt(i + 2);
      if (start <= end) {
        for (let c = start; c <= end; c++) {
          chars += String.fromCharCode(c);
        }
      } else {
        chars += content[i] + '-' + content[i + 2];
      }
      i += 3;
      continue;
    }

    chars += content[i];
    i++;
  }
  return chars.length > 0 ? chars : ' ';
}

/**
 * Generate a random string matching a regular expression / pattern syntax.
 * Supports:
 * - Character classes: [a-z], [0-9], [A-Z], [a-zA-Z0-9], \d, \w, \s, [^...]
 * - Quantifiers: {n}, {min,max}, ?, +, *
 * - Alternations: (abc|def|123)
 * - Escaped literals: \-, \_, \., etc.
 */
export function generateFromRegex(pattern: string): string {
  // Trim outer ^ and $
  let p = pattern.trim();
  if (p.startsWith('^')) p = p.slice(1);
  if (p.endsWith('$')) p = p.slice(0, -1);

  let result = '';
  let i = 0;

  while (i < p.length) {
    let tokenChars: string[] | null = null;
    let singleLiteral: string | null = null;

    // 1. Group / Alternation: (foo|bar|baz)
    if (p[i] === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < p.length && depth > 0) {
        if (p[j] === '\\') j += 2;
        else if (p[j] === '(') { depth++; j++; }
        else if (p[j] === ')') { depth--; j++; }
        else j++;
      }
      const groupContent = p.slice(i + 1, j - 1);
      const options = splitGroupOptions(groupContent);
      const chosenOption = options[getRandomInt(options.length)] || '';
      // Recursively generate for chosen subpattern
      singleLiteral = generateFromRegex(chosenOption);
      i = j;
    }
    // 2. Character class: [...]
    else if (p[i] === '[') {
      let j = i + 1;
      let isNegated = false;
      if (j < p.length && p[j] === '^') {
        isNegated = true;
        j++;
      }
      while (j < p.length && (p[j] !== ']' || p[j - 1] === '\\')) {
        j++;
      }
      const classContent = p.slice(i + (isNegated ? 2 : 1), j);
      const expanded = expandCharClass(classContent);
      if (isNegated) {
        // Safe printable ASCII pool excluding expanded
        const allPrintable = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        const filtered = allPrintable.split('').filter((c) => !expanded.includes(c)).join('');
        tokenChars = (filtered.length > 0 ? filtered : allPrintable).split('');
      } else {
        tokenChars = expanded.split('');
      }
      i = j + 1;
    }
    // 3. Escape sequence: \d, \w, \s, etc.
    else if (p[i] === '\\' && i + 1 < p.length) {
      const nextChar = p[i + 1];
      if (nextChar === 'd') tokenChars = '0123456789'.split('');
      else if (nextChar === 'w') tokenChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('');
      else if (nextChar === 's') tokenChars = [' '];
      else singleLiteral = nextChar;
      i += 2;
    }
    // 4. Dot (any alphanumeric / safe symbol)
    else if (p[i] === '.') {
      tokenChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
      i++;
    }
    // 5. Normal Literal Character
    else {
      singleLiteral = p[i];
      i++;
    }

    // Check for quantifier right after this token
    let minRep = 1;
    let maxRep = 1;

    if (i < p.length) {
      if (p[i] === '{') {
        const endBrace = p.indexOf('}', i);
        if (endBrace !== -1) {
          const quant = p.slice(i + 1, endBrace);
          if (quant.includes(',')) {
            const [minStr, maxStr] = quant.split(',');
            minRep = parseInt(minStr, 10) || 0;
            maxRep = parseInt(maxStr, 10) || minRep + 5;
          } else {
            minRep = maxRep = parseInt(quant, 10) || 1;
          }
          i = endBrace + 1;
        }
      } else if (p[i] === '?') {
        minRep = 0;
        maxRep = 1;
        i++;
      } else if (p[i] === '+') {
        minRep = 1;
        maxRep = 4;
        i++;
      } else if (p[i] === '*') {
        minRep = 0;
        maxRep = 4;
        i++;
      }
    }

    // Determine repetition count cryptographically
    const repCount = getRandomIntRange(minRep, maxRep);

    for (let r = 0; r < repCount; r++) {
      if (tokenChars && tokenChars.length > 0) {
        result += tokenChars[getRandomInt(tokenChars.length)];
      } else if (singleLiteral !== null) {
        result += singleLiteral;
      }
    }
  }

  return result;
}

function splitGroupOptions(groupContent: string): string[] {
  const options: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < groupContent.length; i++) {
    const c = groupContent[i];
    if (c === '\\') {
      current += c + (groupContent[i + 1] || '');
      i++;
    } else if (c === '(' || c === '[') {
      depth++;
      current += c;
    } else if (c === ')' || c === ']') {
      depth--;
      current += c;
    } else if (c === '|' && depth === 0) {
      options.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  options.push(current);
  return options;
}

// Preset Regex / Templates
export interface RandomPreset {
  id: string;
  name: string;
  description: string;
  pattern: string;
}

export const RANDOM_PRESETS: RandomPreset[] = [
  {
    id: 'uuid-v4',
    name: 'UUID v4 (RFC 4122)',
    description: '標準形式の暗号学的に安全なランダム一意識別子',
    pattern: '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',
  },
  {
    id: 'api-key-stripe',
    name: 'APIシークレットキー',
    description: '外部サービス連携用トークン (sk_live_...)',
    pattern: 'sk_live_[0-9a-zA-Z]{32}',
  },
  {
    id: 'hex-256',
    name: '256-bit Hexトークン (64桁)',
    description: 'SHA-256シークレット、ハッシュソルト用',
    pattern: '[0-9a-f]{64}',
  },
  {
    id: 'hex-128',
    name: '128-bit Hexトークン (32桁)',
    description: 'セッショントークン、暗号IV用',
    pattern: '[0-9a-f]{32}',
  },
  {
    id: 'strong-password',
    name: '高強度パスワード (16桁記号混在)',
    description: '英大文字、小文字、数字、セーフ記号を含むパスワード',
    pattern: '[A-Za-z0-9!@#$%^&*()_+\\-=]{16}',
  },
  {
    id: 'alphanumeric-24',
    name: '英数字トークン (24桁)',
    description: 'Cookie ID、ランダムワンタイム認証コード',
    pattern: '[A-Za-z0-9]{24}',
  },
  {
    id: 'pin-6',
    name: '6桁 PINコード',
    description: '2要素認証（TOTP/SMS）などの数字コード',
    pattern: '[0-9]{6}',
  },
  {
    id: 'license-key',
    name: 'プロダクトライセンスキー (XXXXX-...)',
    description: 'ソフトウェア配布用シリアルコード',
    pattern: '[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}',
  },
  {
    id: 'base58-token',
    name: 'Base58 (誤認文字 0OIl 除外)',
    description: 'BitcoinやIPFS等で使われる読みやすい文字列',
    pattern: '[1-9A-HJ-NP-Za-km-z]{32}',
  },
];
