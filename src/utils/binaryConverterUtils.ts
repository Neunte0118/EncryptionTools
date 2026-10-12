/**
 * Binary & Encoding Converter Utilities for Developers
 * Supports:
 * - Plain UTF-8 Text
 * - Hexadecimal (Hex dump format & contiguous / delimited)
 * - Base64 & Base64URL
 * - Binary bit string (01010101)
 * - Decimal byte arrays (0-255)
 * - Base32 (RFC 4648)
 * - Base58 (Bitcoin style)
 * - Big-Endian / Little-Endian Integer views (UInt8, UInt16, UInt32, BigUInt64)
 */

import { base32Decode, base32Encode } from './totpUtils';

// Base58 Bitcoin alphabet
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }

  // Convert to big integer representation
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let result = '1'.repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

export function base58Decode(str: string): Uint8Array {
  const trimmed = str.trim();
  if (trimmed.length === 0) return new Uint8Array(0);

  let leadingOnes = 0;
  while (leadingOnes < trimmed.length && trimmed[leadingOnes] === '1') {
    leadingOnes++;
  }

  const bytes = [0];
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const val = BASE58_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`無効なBase58文字が含まれています: "${char}"`);
    }
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const result = new Uint8Array(leadingOnes + bytes.length);
  for (let i = 0; i < leadingOnes; i++) {
    result[i] = 0;
  }
  for (let i = 0; i < bytes.length; i++) {
    result[leadingOnes + i] = bytes[bytes.length - 1 - i];
  }
  return result;
}

export function bytesToUtf8(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes);
}

export function utf8ToBytes(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

export function bytesToHex(bytes: Uint8Array, separator: string = ''): string {
  const hexArr: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hexArr.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return hexArr.join(separator);
}

export function hexToBytes(hex: string): Uint8Array {
  // Strip 0x prefix, spaces, colons, hyphens, commas
  const clean = hex.replace(/^0x/i, '').replace(/[\s:,\-_]/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 2 !== 0) {
    throw new Error('Hexの文字数が奇数です。各バイトは2桁である必要があります。');
  }
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error('Hexに不正な文字が含まれています（0-9, a-f 以外）。');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.trim().replace(/\s+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  // Support Base64URL
  const standard = clean.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' if needed
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function bytesToBinaryString(bytes: Uint8Array, separator: string = ' '): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    parts.push(bytes[i].toString(2).padStart(8, '0'));
  }
  return parts.join(separator);
}

export function binaryStringToBytes(binStr: string): Uint8Array {
  const clean = binStr.replace(/[\s,\-_]/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (!/^[01]*$/.test(clean)) {
    throw new Error('バイナリ列に 0 または 1 以外の文字が含まれています。');
  }
  if (clean.length % 8 !== 0) {
    throw new Error(`ビット数が8の倍数ではありません (現在: ${clean.length} bits)`);
  }
  const bytes = new Uint8Array(clean.length / 8);
  for (let i = 0; i < clean.length; i += 8) {
    bytes[i / 8] = parseInt(clean.substring(i, i + 8), 2);
  }
  return bytes;
}

export function bytesToDecimalArray(bytes: Uint8Array, separator: string = ', '): string {
  return Array.from(bytes).join(separator);
}

export function decimalArrayToBytes(decStr: string): Uint8Array {
  const clean = decStr.replace(/[\[\]]/g, '').trim();
  if (clean.length === 0) return new Uint8Array(0);
  const tokens = clean.split(/[\s,]+/).filter(Boolean);
  const bytes = new Uint8Array(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    const val = parseInt(tokens[i], 10);
    if (isNaN(val) || val < 0 || val > 255) {
      throw new Error(`無効なバイト数値です: "${tokens[i]}" (0〜255の範囲)`);
    }
    bytes[i] = val;
  }
  return bytes;
}

export { base32Encode, base32Decode };

/**
 * Generate a classic Hex dump format (like xxd / hexdump)
 * Offset: 00000000  68 65 6c 6c 6f 20 77 6f  72 6c 64 21 0a           |hello world!.|
 */
export function generateHexDump(bytes: Uint8Array, bytesPerLine: number = 16): string {
  if (bytes.length === 0) return '';
  const lines: string[] = [];

  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const chunk = bytes.subarray(i, Math.min(i + bytesPerLine, bytes.length));
    const offset = i.toString(16).padStart(8, '0');

    // Hex part with midpoint space
    const hexParts: string[] = [];
    for (let j = 0; j < bytesPerLine; j++) {
      if (j === 8) hexParts.push(' ');
      if (j < chunk.length) {
        hexParts.push(chunk[j].toString(16).padStart(2, '0') + ' ');
      } else {
        hexParts.push('   ');
      }
    }

    // ASCII printable part
    let ascii = '';
    for (let j = 0; j < chunk.length; j++) {
      const b = chunk[j];
      if (b >= 32 && b <= 126) {
        ascii += String.fromCharCode(b);
      } else {
        ascii += '.';
      }
    }

    lines.push(`${offset}  ${hexParts.join('')} |${ascii}|`);
  }

  return lines.join('\n');
}

/**
 * Endianness and numerical representations
 */
export interface EndianIntView {
  uint8: number[];
  int8: number[];
  uint16LE: number[];
  uint16BE: number[];
  uint32LE: number[];
  uint32BE: number[];
  float32LE: number[];
  float32BE: number[];
}

export function parseEndianViews(bytes: Uint8Array): EndianIntView {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const view = new DataView(buffer);

  const uint8: number[] = [];
  const int8: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    uint8.push(view.getUint8(i));
    int8.push(view.getInt8(i));
  }

  const uint16LE: number[] = [];
  const uint16BE: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    uint16LE.push(view.getUint16(i, true));
    uint16BE.push(view.getUint16(i, false));
  }

  const uint32LE: number[] = [];
  const uint32BE: number[] = [];
  for (let i = 0; i + 3 < bytes.length; i += 4) {
    uint32LE.push(view.getUint32(i, true));
    uint32BE.push(view.getUint32(i, false));
  }

  const float32LE: number[] = [];
  const float32BE: number[] = [];
  for (let i = 0; i + 3 < bytes.length; i += 4) {
    float32LE.push(Number(view.getFloat32(i, true).toFixed(4)));
    float32BE.push(Number(view.getFloat32(i, false).toFixed(4)));
  }

  return {
    uint8,
    int8,
    uint16LE,
    uint16BE,
    uint32LE,
    uint32BE,
    float32LE,
    float32BE,
  };
}
