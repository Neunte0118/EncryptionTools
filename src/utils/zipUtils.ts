/**
 * Password-Protected Encrypted ZIP Archiver Utility
 *
 * Implements AES-256 and ZipCrypto encrypted ZIP creation and extraction directly in the browser
 * using @zip.js/zip.js. Compatible with standard OS tools (Windows 11, Mac, 7-Zip, WinRAR).
 */

import {
  BlobReader,
  BlobWriter,
  ZipWriter,
  ZipReader,
} from '@zip.js/zip.js';

export type ZipEncryptionStrength = 'aes-256' | 'zipcrypto';

export interface ZipFileEntry {
  name: string;
  size: number;
  file: File;
}

export interface ExtractedZipItem {
  filename: string;
  size: number;
  data: Blob;
  isDirectory: boolean;
}

/**
 * Create a password-protected encrypted ZIP archive
 */
export async function createEncryptedZip(
  files: File[],
  options: {
    password?: string;
    encryptionStrength?: ZipEncryptionStrength;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<Blob> {
  const blobWriter = new BlobWriter('application/zip');
  const isZipCrypto = options.encryptionStrength === 'zipcrypto';
  const zipWriter = new ZipWriter(blobWriter, {
    password: options.password || undefined,
    encryptionStrength: options.password ? (isZipCrypto ? undefined : 3) : undefined,
    zipCrypto: options.password ? isZipCrypto : false,
  });

  const total = files.length;
  for (let i = 0; i < total; i++) {
    const file = files[i];
    await zipWriter.add(file.name, new BlobReader(file));
    if (options.onProgress) {
      options.onProgress(i + 1, total);
    }
  }

  await zipWriter.close();
  return await blobWriter.getData();
}

/**
 * Extract files from a password-protected or standard ZIP archive
 */
export async function extractEncryptedZip(
  zipBlob: Blob,
  password?: string
): Promise<ExtractedZipItem[]> {
  const zipReader = new ZipReader(new BlobReader(zipBlob), {
    password: password || undefined,
  });

  const entries = await zipReader.getEntries();
  const results: ExtractedZipItem[] = [];

  for (const entry of entries) {
    if (entry.directory) {
      results.push({
        filename: entry.filename,
        size: 0,
        data: new Blob([]),
        isDirectory: true,
      });
    } else if (entry.getData) {
      const data = await entry.getData(new BlobWriter());
      results.push({
        filename: entry.filename,
        size: entry.uncompressedSize || 0,
        data,
        isDirectory: false,
      });
    }
  }

  await zipReader.close();
  return results;
}
