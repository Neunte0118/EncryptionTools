/**
 * Pure TypeScript Tar & Tar.gz Archiver & Extractor
 *
 * Implements standard POSIX UStar format generation and parsing with 512-byte blocks.
 * Seamlessly chains with CompressionStream('gzip') and DecompressionStream('gzip') for .tar.gz!
 */

export interface TarEntry {
  name: string;
  size: number;
  data: Uint8Array;
  lastModified?: number;
}

/**
 * Encode an array of files into a .tar archive buffer (POSIX ustar)
 */
export function createTarArchive(files: { name: string; data: Uint8Array; lastModified?: number }[]): Uint8Array {
  const blocks: Uint8Array[] = [];

  for (const file of files) {
    const header = new Uint8Array(512);
    const enc = new TextEncoder();

    // 0..99: File Name
    const nameBytes = enc.encode(file.name.slice(0, 99));
    header.set(nameBytes, 0);

    // 100..107: File Mode (0000644\0)
    header.set(enc.encode('0000644\0'), 100);

    // 108..115: UID (0000000\0)
    header.set(enc.encode('0000000\0'), 108);

    // 116..123: GID (0000000\0)
    header.set(enc.encode('0000000\0'), 116);

    // 124..135: Size in Octal (11 chars + space/null)
    const sizeOctal = file.data.byteLength.toString(8).padStart(11, '0') + ' ';
    header.set(enc.encode(sizeOctal), 124);

    // 136..147: MTime in Octal
    const mtime = Math.floor((file.lastModified || Date.now()) / 1000);
    const mtimeOctal = mtime.toString(8).padStart(11, '0') + ' ';
    header.set(enc.encode(mtimeOctal), 136);

    // 156: Type flag '0' = regular file
    header[156] = 48; // '0'

    // 257..262: Magic "ustar\0"
    header.set(enc.encode('ustar\0'), 257);
    // 263..264: Version "00"
    header.set(enc.encode('00'), 263);

    // 148..155: Checksum (filled with spaces first)
    header.fill(32, 148, 156);
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    const checksumOctal = checksum.toString(8).padStart(6, '0') + '\0 ';
    header.set(enc.encode(checksumOctal), 148);

    blocks.push(header);

    // Data blocks padded to 512 bytes
    blocks.push(file.data);
    const padding = (512 - (file.data.byteLength % 512)) % 512;
    if (padding > 0) {
      blocks.push(new Uint8Array(padding));
    }
  }

  // End of archive: two 512-byte zero blocks
  blocks.push(new Uint8Array(1024));

  // Combine into single Uint8Array
  const totalLength = blocks.reduce((acc, b) => acc + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.byteLength;
  }

  return result;
}

/**
 * Extract files from a .tar archive
 */
export function extractTarArchive(tarBuffer: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  const dec = new TextDecoder('utf-8');
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;

    // Check if end of archive (all zeros)
    let isAllZero = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        isAllZero = false;
        break;
      }
    }
    if (isAllZero) break;

    // Parse name (0..100)
    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    const name = dec.decode(header.subarray(0, nameEnd)).trim();
    if (!name) continue;

    // Parse size (124..135, octal string)
    let sizeEnd = 124;
    while (sizeEnd < 136 && header[sizeEnd] !== 0 && header[sizeEnd] !== 32) sizeEnd++;
    const sizeStr = dec.decode(header.subarray(124, sizeEnd)).trim();
    const size = parseInt(sizeStr, 8) || 0;

    // Parse data
    if (offset + size > tarBuffer.length) {
      throw new Error(`破損したTARアーカイブ: ファイル ${name} のデータが切断されています`);
    }

    const data = tarBuffer.slice(offset, offset + size);
    entries.push({ name, size, data });

    // Skip to next 512-byte boundary
    const padding = (512 - (size % 512)) % 512;
    offset += size + padding;
  }

  return entries;
}

/**
 * Compress tar buffer to .tar.gz using Web Streams API
 */
export async function compressTarToGz(tarBytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(tarBytes);
  writer.close();

  const response = new Response(cs.readable);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Decompress .tar.gz to raw tar buffer using Web Streams API
 */
export async function decompressGzToTar(gzBytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(gzBytes);
  writer.close();

  const response = new Response(ds.readable);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
