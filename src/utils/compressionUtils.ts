/**
 * Native standard Web API Compression and Decompression utilities
 * Uses CompressionStream and DecompressionStream (Standard W3C / WHATWG Web APIs)
 */

export type CompressionFormat = 'gzip' | 'deflate' | 'deflate-raw';

/**
 * Compress an ArrayBuffer or Uint8Array using standard CompressionStream
 */
export async function compressBuffer(
  input: ArrayBuffer | Uint8Array,
  format: CompressionFormat = 'gzip'
): Promise<Uint8Array> {
  const stream = new Response(input as any).body;
  if (!stream) {
    throw new Error('Failed to create readable stream from input buffer');
  }

  const compressionStream = new CompressionStream(format);
  const compressedStream = stream.pipeThrough(compressionStream);
  const response = new Response(compressedStream);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Decompress an ArrayBuffer or Uint8Array using standard DecompressionStream
 */
export async function decompressBuffer(
  compressedInput: ArrayBuffer | Uint8Array,
  format: CompressionFormat = 'gzip'
): Promise<Uint8Array> {
  const stream = new Response(compressedInput as any).body;
  if (!stream) {
    throw new Error('Failed to create readable stream from compressed buffer');
  }

  const decompressionStream = new DecompressionStream(format);
  const decompressedStream = stream.pipeThrough(decompressionStream);
  const response = new Response(decompressedStream);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Compress a UTF-8 string to Base64 encoded gzip
 */
export async function compressStringToBase64(
  text: string,
  format: CompressionFormat = 'gzip'
): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const compressed = await compressBuffer(bytes, format);

  let binary = '';
  const len = compressed.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = compressed.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Decompress Base64 encoded gzip to UTF-8 string
 */
export async function decompressBase64ToString(
  base64: string,
  format: CompressionFormat = 'gzip'
): Promise<string> {
  const cleaned = base64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const decompressed = await decompressBuffer(bytes, format);
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(decompressed);
}

/**
 * Check if a buffer appears to be a gzip stream (magic numbers 0x1f, 0x8b)
 */
export function isGzipBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b;
}
