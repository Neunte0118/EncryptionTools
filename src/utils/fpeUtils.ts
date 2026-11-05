/**
 * Format-Preserving Encryption (FPE) Utilities
 *
 * Implements NIST SP 800-38G standard FF1 (Format-Preserving Feistel-based Encryption)
 * using `@noble/ciphers/ff1`.
 *
 * Allows encrypting credit card numbers, phone numbers, My Number, or alphanumeric IDs
 * while maintaining the EXACT same character set, length, and format masks.
 */

import { FF1 } from '@noble/ciphers/ff1.js';
import { bufferToHex, hexToBuffer } from './cryptoUtils';

export type FpeAlphabetType = 'digits' | 'alphanumeric-lower' | 'alphanumeric' | 'hex' | 'custom';

export const ALPHABETS: Record<string, string> = {
  digits: '0123456789', // Radix 10
  'alphanumeric-lower': '0123456789abcdefghijklmnopqrstuvwxyz', // Radix 36
  alphanumeric: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', // Radix 62
  hex: '0123456789abcdef', // Radix 16
};

export interface FpeMaskResult {
  formattedCiphertext: string;
  alphabetSize: number;
  extractedLength: number;
}

/**
 * Encrypt a formatted text string using FF1, preserving non-alphabet delimiters (e.g. -, space, /)
 */
export function encryptFpeText(
  input: string,
  key: Uint8Array,
  alphabetType: FpeAlphabetType = 'digits',
  customAlphabet?: string,
  tweakString?: string
): FpeMaskResult {
  if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
    throw new Error('FPE (AES-FF1) 鍵は 128/192/256 ビット (16/24/32 バイト) である必要があります');
  }

  const alphabet = alphabetType === 'custom' && customAlphabet ? customAlphabet : ALPHABETS[alphabetType] || ALPHABETS.digits;
  const radix = alphabet.length;

  if (radix < 2 || radix > 65536) {
    throw new Error('基数 (Radix) は 2 以上 65536 以下である必要があります');
  }

  // Extract valid characters and record mask positions
  const extractedIndices: number[] = [];
  const maskPositions: { char: string; index: number }[] = [];

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const charIndex = alphabet.indexOf(char);
    if (charIndex !== -1) {
      extractedIndices.push(charIndex);
    } else {
      maskPositions.push({ char, index: i });
    }
  }

  // NIST SP 800-38G requires radix^len >= 100 for FF1
  if (Math.pow(radix, extractedIndices.length) < 100) {
    throw new Error(`対象文字数が少なすぎます (${extractedIndices.length} 文字)。FF1 暗号化には radix^len >= 100 (例: 10進数なら最低2桁以上) が必要です。`);
  }

  const tweakBytes = tweakString ? new TextEncoder().encode(tweakString) : undefined;
  const ff1 = FF1(radix, key, tweakBytes);

  const encryptedIndices = ff1.encrypt(extractedIndices);

  // Re-assemble with mask characters preserved
  const resultChars: string[] = [];
  let encPtr = 0;

  for (let i = 0; i < input.length; i++) {
    const maskMatch = maskPositions.find((m) => m.index === i);
    if (maskMatch) {
      resultChars.push(maskMatch.char);
    } else {
      resultChars.push(alphabet[encryptedIndices[encPtr]]);
      encPtr++;
    }
  }

  return {
    formattedCiphertext: resultChars.join(''),
    alphabetSize: radix,
    extractedLength: extractedIndices.length,
  };
}

/**
 * Decrypt a formatted text string using FF1
 */
export function decryptFpeText(
  ciphertext: string,
  key: Uint8Array,
  alphabetType: FpeAlphabetType = 'digits',
  customAlphabet?: string,
  tweakString?: string
): string {
  if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
    throw new Error('FPE (AES-FF1) 鍵は 128/192/256 ビット (16/24/32 バイト) である必要があります');
  }

  const alphabet = alphabetType === 'custom' && customAlphabet ? customAlphabet : ALPHABETS[alphabetType] || ALPHABETS.digits;
  const radix = alphabet.length;

  const extractedIndices: number[] = [];
  const maskPositions: { char: string; index: number }[] = [];

  for (let i = 0; i < ciphertext.length; i++) {
    const char = ciphertext[i];
    const charIndex = alphabet.indexOf(char);
    if (charIndex !== -1) {
      extractedIndices.push(charIndex);
    } else {
      maskPositions.push({ char, index: i });
    }
  }

  if (Math.pow(radix, extractedIndices.length) < 100) {
    throw new Error(`対象文字数が少なすぎます (${extractedIndices.length} 文字)。`);
  }

  const tweakBytes = tweakString ? new TextEncoder().encode(tweakString) : undefined;
  const ff1 = FF1(radix, key, tweakBytes);

  const decryptedIndices = ff1.decrypt(extractedIndices);

  const resultChars: string[] = [];
  let decPtr = 0;

  for (let i = 0; i < ciphertext.length; i++) {
    const maskMatch = maskPositions.find((m) => m.index === i);
    if (maskMatch) {
      resultChars.push(maskMatch.char);
    } else {
      resultChars.push(alphabet[decryptedIndices[decPtr]]);
      decPtr++;
    }
  }

  return resultChars.join('');
}
