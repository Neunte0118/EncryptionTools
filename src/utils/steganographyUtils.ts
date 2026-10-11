/**
 * Steganography Utility (Least Significant Bit - LSB Image Steganography)
 * Supports:
 * - Text and arbitrary binary files hiding in images
 * - Optional AES-256-GCM encryption with PBKDF2 password derivation
 * - Optional Gzip compression (CompressionStream) for payload size optimization
 * - Magic header detection, payload integrity checking (CRC32), and zero-loss PNG export
 * - LSB difference / modification visualizer (amplified heat-map of modified pixels)
 */

import { compressBuffer, decompressBuffer } from './compressionUtils';

// Magic 4-byte signature: 'STEG' (0x53, 0x54, 0x45, 0x47)
export const STEG_MAGIC = new Uint8Array([0x53, 0x54, 0x45, 0x47]);
export const STEG_VERSION = 1;

// Flags:
// bit 0: isEncrypted (1 = AES-256-GCM)
// bit 1: isFile (1 = file with filename & mime, 0 = plain text)
// bit 2: isCompressed (1 = gzip compressed)
export const FLAG_ENCRYPTED = 1 << 0;
export const FLAG_IS_FILE = 1 << 1;
export const FLAG_COMPRESSED = 1 << 2;

// Standard CRC32 table & function
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

export function calculateCRC32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Format bytes into human-readable string (e.g. 1.25 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface ImageCapacity {
  width: number;
  height: number;
  totalPixels: number;
  totalChannels: number;
  maxBytes: number;
  formattedMaxCapacity: string;
}

export function calculateImageCapacity(width: number, height: number): ImageCapacity {
  const totalPixels = width * height;
  const totalChannels = totalPixels * 3; // R, G, B
  const maxBytes = Math.floor(totalChannels / 8);
  return {
    width,
    height,
    totalPixels,
    totalChannels,
    maxBytes,
    formattedMaxCapacity: formatBytes(maxBytes),
  };
}

/**
 * Helper to derive AES-256-GCM key from password and salt via PBKDF2
 */
async function deriveAESKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * LSB Stream Writer
 */
class LsbStreamWriter {
  private data: Uint8ClampedArray;
  private channelIdx: number = 0;
  private currentPixel: number = 0;
  private totalPixels: number;
  public bitsWritten: number = 0;

  constructor(imageData: ImageData) {
    this.data = imageData.data;
    this.totalPixels = imageData.width * imageData.height;
  }

  writeBit(bit: number): boolean {
    if (this.currentPixel >= this.totalPixels) return false;
    const offset = this.currentPixel * 4 + this.channelIdx;
    this.data[offset] = (this.data[offset] & 0xfe) | (bit & 1);
    this.bitsWritten++;
    this.channelIdx++;
    if (this.channelIdx === 3) {
      this.channelIdx = 0;
      this.currentPixel++;
    }
    return true;
  }

  writeByte(byte: number): boolean {
    for (let i = 7; i >= 0; i--) {
      const bit = (byte >> i) & 1;
      if (!this.writeBit(bit)) return false;
    }
    return true;
  }

  writeBytes(bytes: Uint8Array): boolean {
    for (let i = 0; i < bytes.length; i++) {
      if (!this.writeByte(bytes[i])) return false;
    }
    return true;
  }

  writeUint16(val: number): boolean {
    return this.writeByte((val >> 8) & 0xff) && this.writeByte(val & 0xff);
  }

  writeUint32(val: number): boolean {
    return (
      this.writeByte((val >>> 24) & 0xff) &&
      this.writeByte((val >>> 16) & 0xff) &&
      this.writeByte((val >>> 8) & 0xff) &&
      this.writeByte(val & 0xff)
    );
  }
}

/**
 * LSB Stream Reader
 */
class LsbStreamReader {
  private data: Uint8ClampedArray;
  private channelIdx: number = 0;
  private currentPixel: number = 0;
  private totalPixels: number;

  constructor(imageData: ImageData) {
    this.data = imageData.data;
    this.totalPixels = imageData.width * imageData.height;
  }

  readBit(): number | null {
    if (this.currentPixel >= this.totalPixels) return null;
    const offset = this.currentPixel * 4 + this.channelIdx;
    const bit = this.data[offset] & 1;
    this.channelIdx++;
    if (this.channelIdx === 3) {
      this.channelIdx = 0;
      this.currentPixel++;
    }
    return bit;
  }

  readByte(): number | null {
    let byte = 0;
    for (let i = 7; i >= 0; i--) {
      const bit = this.readBit();
      if (bit === null) return null;
      byte = (byte << 1) | bit;
    }
    return byte;
  }

  readBytes(count: number): Uint8Array | null {
    const res = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const b = this.readByte();
      if (b === null) return null;
      res[i] = b;
    }
    return res;
  }

  readUint16(): number | null {
    const b1 = this.readByte();
    const b2 = this.readByte();
    if (b1 === null || b2 === null) return null;
    return (b1 << 8) | b2;
  }

  readUint32(): number | null {
    const b1 = this.readByte();
    const b2 = this.readByte();
    const b3 = this.readByte();
    const b4 = this.readByte();
    if (b1 === null || b2 === null || b3 === null || b4 === null) return null;
    return ((b1 << 24) >>> 0) | (b2 << 16) | (b3 << 8) | b4;
  }
}

export interface EncodePayloadOptions {
  type: 'text' | 'file';
  text?: string;
  fileBytes?: Uint8Array;
  fileName?: string;
  mimeType?: string;
  password?: string;
  useCompression?: boolean;
}

export interface EncodeResult {
  encodedImageData: ImageData;
  pngBlob: Blob;
  totalCarrierCapacityBytes: number;
  usedBytes: number;
  usagePercentage: number;
  isEncrypted: boolean;
  isCompressed: boolean;
}

export interface StegoHeaderInfo {
  version: number;
  isEncrypted: boolean;
  isFile: boolean;
  isCompressed: boolean;
  payloadLength: number;
  crc32: number;
  salt?: Uint8Array;
  iv?: Uint8Array;
  fileName?: string;
  mimeType?: string;
}

export interface DecodeResult {
  type: 'text' | 'file';
  text?: string;
  fileBytes?: Uint8Array;
  fileName?: string;
  mimeType?: string;
  fileBlob?: Blob;
  fileSize?: number;
  isEncrypted: boolean;
  isCompressed: boolean;
  crcValid: boolean;
}

/**
 * Detect whether an image contains our Steganography signature
 */
export function inspectStegoHeader(imageData: ImageData): StegoHeaderInfo | null {
  const reader = new LsbStreamReader(imageData);
  const magic = reader.readBytes(4);
  if (!magic) return null;

  for (let i = 0; i < 4; i++) {
    if (magic[i] !== STEG_MAGIC[i]) return null;
  }

  const version = reader.readByte();
  if (version === null || version !== STEG_VERSION) return null;

  const flags = reader.readByte();
  if (flags === null) return null;

  const isEncrypted = (flags & FLAG_ENCRYPTED) !== 0;
  const isFile = (flags & FLAG_IS_FILE) !== 0;
  const isCompressed = (flags & FLAG_COMPRESSED) !== 0;

  let salt: Uint8Array | undefined;
  let iv: Uint8Array | undefined;

  if (isEncrypted) {
    const readSalt = reader.readBytes(16);
    const readIv = reader.readBytes(12);
    if (!readSalt || !readIv) return null;
    salt = readSalt;
    iv = readIv;
  }

  const payloadLength = reader.readUint32();
  if (payloadLength === null) return null;

  const crc32 = reader.readUint32();
  if (crc32 === null) return null;

  let fileName: string | undefined;
  let mimeType: string | undefined;

  if (isFile) {
    const fnLen = reader.readUint16();
    if (fnLen === null) return null;
    const fnBytes = reader.readBytes(fnLen);
    if (!fnBytes) return null;
    fileName = new TextDecoder().decode(fnBytes);

    const mimeLen = reader.readUint16();
    if (mimeLen === null) return null;
    const mimeBytes = reader.readBytes(mimeLen);
    if (!mimeBytes) return null;
    mimeType = new TextDecoder().decode(mimeBytes);
  }

  return {
    version,
    isEncrypted,
    isFile,
    isCompressed,
    payloadLength,
    crc32,
    salt,
    iv,
    fileName,
    mimeType,
  };
}

/**
 * Encode secret payload into carrier image
 */
export async function encodeSteganography(
  carrierImage: HTMLImageElement,
  options: EncodePayloadOptions
): Promise<EncodeResult> {
  const width = carrierImage.naturalWidth || carrierImage.width;
  const height = carrierImage.naturalHeight || carrierImage.height;

  // Prepare offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(carrierImage, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  const capacity = calculateImageCapacity(width, height);

  // 1. Prepare raw payload
  let rawBytes: Uint8Array;
  const isFile = options.type === 'file';

  if (isFile) {
    if (!options.fileBytes) throw new Error('File payload bytes missing');
    rawBytes = options.fileBytes;
  } else {
    const text = options.text || '';
    rawBytes = new TextEncoder().encode(text);
  }

  // Calculate CRC32 of original unencrypted payload
  const crc32 = calculateCRC32(rawBytes);

  // 2. Compress payload if requested (Gzip)
  let payloadBytes = rawBytes;
  let isCompressed = false;
  if (options.useCompression !== false) {
    try {
      const compressed = await compressBuffer(rawBytes, 'gzip');
      // Only keep compression if it actually reduced the size
      if (compressed.length < rawBytes.length) {
        payloadBytes = compressed;
        isCompressed = true;
      }
    } catch {
      // Fallback uncompressed
      payloadBytes = rawBytes;
    }
  }

  // 3. Encrypt payload if password provided (AES-256-GCM)
  const isEncrypted = Boolean(options.password && options.password.length > 0);
  let salt: Uint8Array | undefined;
  let iv: Uint8Array | undefined;

  if (isEncrypted && options.password) {
    salt = crypto.getRandomValues(new Uint8Array(16));
    iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAESKey(options.password, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      payloadBytes as any
    );
    payloadBytes = new Uint8Array(ciphertext);
  }

  // 4. Calculate total bytes needed
  let headerBytesNeeded = 4 + 1 + 1 + 4 + 4; // magic(4) + ver(1) + flags(1) + payloadLen(4) + crc(4)
  if (isEncrypted) headerBytesNeeded += 16 + 12; // salt(16) + iv(12)

  let fileNameBytes: Uint8Array | null = null;
  let mimeBytes: Uint8Array | null = null;
  if (isFile) {
    fileNameBytes = new TextEncoder().encode(options.fileName || 'hidden_file.bin');
    mimeBytes = new TextEncoder().encode(options.mimeType || 'application/octet-stream');
    headerBytesNeeded += 2 + fileNameBytes.length + 2 + mimeBytes.length;
  }

  const totalBytesNeeded = headerBytesNeeded + payloadBytes.length;

  if (totalBytesNeeded > capacity.maxBytes) {
    throw new Error(
      `容量オーバー: 埋め込みデータサイズ (${formatBytes(totalBytesNeeded)}) が画像の最大容量 (${capacity.formattedMaxCapacity}) を超えています。より大きな解像度の画像を使用してください。`
    );
  }

  // 5. Write to LSB stream
  const writer = new LsbStreamWriter(imageData);

  // Write magic
  writer.writeBytes(STEG_MAGIC);
  // Write version
  writer.writeByte(STEG_VERSION);

  // Write flags
  let flags = 0;
  if (isEncrypted) flags |= FLAG_ENCRYPTED;
  if (isFile) flags |= FLAG_IS_FILE;
  if (isCompressed) flags |= FLAG_COMPRESSED;
  writer.writeByte(flags);

  // Write salt & IV if encrypted
  if (isEncrypted && salt && iv) {
    writer.writeBytes(salt);
    writer.writeBytes(iv);
  }

  // Write payload length & CRC32
  writer.writeUint32(payloadBytes.length);
  writer.writeUint32(crc32);

  // Write file metadata
  if (isFile && fileNameBytes && mimeBytes) {
    writer.writeUint16(fileNameBytes.length);
    writer.writeBytes(fileNameBytes);
    writer.writeUint16(mimeBytes.length);
    writer.writeBytes(mimeBytes);
  }

  // Write payload
  writer.writeBytes(payloadBytes);

  // 6. Put modified image data back to canvas and convert to PNG Blob
  ctx.putImageData(imageData, 0, 0);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas to PNG blob conversion failed'));
    }, 'image/png');
  });

  return {
    encodedImageData: imageData,
    pngBlob,
    totalCarrierCapacityBytes: capacity.maxBytes,
    usedBytes: totalBytesNeeded,
    usagePercentage: parseFloat(((totalBytesNeeded / capacity.maxBytes) * 100).toFixed(2)),
    isEncrypted,
    isCompressed,
  };
}

/**
 * Decode secret payload from stego image
 */
export async function decodeSteganography(
  stegoImage: HTMLImageElement,
  password?: string
): Promise<DecodeResult> {
  const width = stegoImage.naturalWidth || stegoImage.width;
  const height = stegoImage.naturalHeight || stegoImage.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(stegoImage, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  const header = inspectStegoHeader(imageData);
  if (!header) {
    throw new Error('この画像にはステガノグラフィデータが検出されませんでした。');
  }

  if (header.isEncrypted && !password) {
    throw new Error('PASSWORD_REQUIRED');
  }

  // Read the full payload from the image
  const reader = new LsbStreamReader(imageData);

  // Skip header:
  reader.readBytes(4); // magic
  reader.readByte(); // version
  reader.readByte(); // flags

  if (header.isEncrypted) {
    reader.readBytes(16); // salt
    reader.readBytes(12); // iv
  }

  reader.readUint32(); // payload length
  reader.readUint32(); // crc

  if (header.isFile) {
    const fnLen = reader.readUint16()!;
    reader.readBytes(fnLen);
    const mimeLen = reader.readUint16()!;
    reader.readBytes(mimeLen);
  }

  const rawPayload = reader.readBytes(header.payloadLength);
  if (!rawPayload || rawPayload.length !== header.payloadLength) {
    throw new Error('画像データが破損しているか、不完全です。');
  }

  let decryptedBytes = rawPayload;

  // Decrypt if encrypted
  if (header.isEncrypted && header.salt && header.iv) {
    if (!password) {
      throw new Error('PASSWORD_REQUIRED');
    }
    try {
      const key = await deriveAESKey(password, header.salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: header.iv as any },
        key,
        rawPayload as any
      );
      decryptedBytes = new Uint8Array(decrypted);
    } catch {
      throw new Error('パスワードが正しくないか、データが破損しています。');
    }
  }

  // Decompress if compressed
  let finalBytes = decryptedBytes;
  if (header.isCompressed) {
    try {
      finalBytes = await decompressBuffer(decryptedBytes, 'gzip');
    } catch {
      throw new Error('データの解凍に失敗しました。');
    }
  }

  // Verify CRC32
  const computedCrc = calculateCRC32(finalBytes);
  const crcValid = computedCrc === header.crc32;
  if (!crcValid) {
    console.warn('[Steganography] CRC32 mismatch! Expected:', header.crc32, 'Got:', computedCrc);
  }

  if (header.isFile) {
    const mimeType = header.mimeType || 'application/octet-stream';
    const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: mimeType });
    return {
      type: 'file',
      fileBytes: finalBytes,
      fileName: header.fileName || 'extracted_file.bin',
      mimeType,
      fileBlob: blob,
      fileSize: finalBytes.byteLength,
      isEncrypted: header.isEncrypted,
      isCompressed: header.isCompressed,
      crcValid,
    };
  } else {
    const text = new TextDecoder('utf-8').decode(finalBytes);
    return {
      type: 'text',
      text,
      isEncrypted: header.isEncrypted,
      isCompressed: header.isCompressed,
      crcValid,
    };
  }
}

/**
 * Generate amplified LSB modification visualization (Heatmap of altered pixels)
 */
export function generateDiffVisualization(
  originalImageData: ImageData,
  encodedImageData: ImageData
): ImageData {
  const width = originalImageData.width;
  const height = originalImageData.height;
  const diffData = new ImageData(width, height);

  const orig = originalImageData.data;
  const enc = encodedImageData.data;
  const diff = diffData.data;

  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const o = i * 4;
    const diffR = (enc[o] & 1) !== (orig[o] & 1);
    const diffG = (enc[o + 1] & 1) !== (orig[o + 1] & 1);
    const diffB = (enc[o + 2] & 1) !== (orig[o + 2] & 1);

    if (diffR || diffG || diffB) {
      // Highlight modified pixels in high-contrast cyan/amber
      diff[o] = diffR ? 255 : 0; // Red
      diff[o + 1] = diffG ? 255 : 200; // Green
      diff[o + 2] = diffB ? 255 : 0; // Blue
      diff[o + 3] = 255; // Alpha
    } else {
      // Dark dimmed background for unchanged pixels
      diff[o] = 15;
      diff[o + 1] = 23;
      diff[o + 2] = 42;
      diff[o + 3] = 255;
    }
  }

  return diffData;
}
