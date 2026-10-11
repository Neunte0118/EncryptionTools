import { PDFDocument } from 'pdf-lib';
import { ID3Writer } from 'browser-id3-writer';
import piexif from 'piexifjs';

export type SupportedMediaType = 'image' | 'audio' | 'video' | 'pdf' | 'unknown';

export interface FileMetadataInfo {
  mediaType: SupportedMediaType;
  mimeType: string;
  fileName: string;
  fileSize: number;

  // Common tags
  title: string;
  artist: string; // Author or Creator
  album: string;
  year: string;
  genre: string;
  comment: string;
  copyright: string;
  software: string; // Camera Software, Producer, Encoder

  // Audio specific
  track: string;
  albumArt: {
    mimeType: string;
    dataUrl: string;
    description?: string;
    sizeBytes: number;
    rawBuffer?: ArrayBuffer;
  } | null;

  // Image specific
  cameraMake: string;
  cameraModel: string;
  dateTimeOriginal: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  hasExif: boolean;

  // PDF specific
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;

  // Raw key-value pairs detected
  detectedTags: { key: string; label: string; value: string }[];
}

// Helper: Convert ArrayBuffer to binary string
export function bufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return binary;
}

// Helper: Convert binary string to Uint8Array
export function binaryStringToUint8Array(binary: string): Uint8Array {
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// Detect media type from MIME or file extension
export function detectMediaType(file: File): SupportedMediaType {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (
    mime.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif')
  ) {
    return 'image';
  }

  if (
    mime.startsWith('audio/') ||
    name.endsWith('.mp3') ||
    name.endsWith('.wav') ||
    name.endsWith('.flac') ||
    name.endsWith('.m4a') ||
    name.endsWith('.ogg') ||
    name.endsWith('.aac')
  ) {
    return 'audio';
  }

  if (
    mime.startsWith('video/') ||
    name.endsWith('.mp4') ||
    name.endsWith('.webm') ||
    name.endsWith('.mkv') ||
    name.endsWith('.mov') ||
    name.endsWith('.avi')
  ) {
    return 'video';
  }

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }

  return 'unknown';
}

// -------------------------------------------------------------
// ID3 Parser for Audio (MP3)
// -------------------------------------------------------------

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // ISO-8859-1
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) break;
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    } else if (encoding === 1) {
      // UTF-16 with BOM
      return new TextDecoder('utf-16').decode(bytes).replace(/\0/g, '');
    } else if (encoding === 2) {
      // UTF-16BE
      return new TextDecoder('utf-16be').decode(bytes).replace(/\0/g, '');
    } else if (encoding === 3) {
      // UTF-8
      return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '');
    }
  } catch {
    // Fallback
  }
  return '';
}

function parseID3v2(buffer: ArrayBuffer): {
  tags: Record<string, string>;
  albumArt: FileMetadataInfo['albumArt'];
} {
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  const tags: Record<string, string> = {};
  let albumArt: FileMetadataInfo['albumArt'] = null;

  if (u8.length < 10) return { tags, albumArt };
  // Check 'ID3' marker
  if (u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) {
    return { tags, albumArt };
  }

  const version = u8[3];
  const tagSize =
    ((u8[6] & 0x7f) << 21) |
    ((u8[7] & 0x7f) << 14) |
    ((u8[8] & 0x7f) << 7) |
    (u8[9] & 0x7f);

  let offset = 10;
  const end = Math.min(10 + tagSize, u8.length);

  while (offset + 10 <= end) {
    // Read 4-byte frame ID
    let frameId = '';
    for (let i = 0; i < 4; i++) {
      const c = u8[offset + i];
      if (c === 0) break;
      frameId += String.fromCharCode(c);
    }
    if (frameId.length < 4) break;

    // Frame size
    let frameSize = 0;
    if (version === 4) {
      frameSize =
        ((u8[offset + 4] & 0x7f) << 21) |
        ((u8[offset + 5] & 0x7f) << 14) |
        ((u8[offset + 6] & 0x7f) << 7) |
        (u8[offset + 7] & 0x7f);
    } else {
      frameSize = view.getUint32(offset + 4, false);
    }

    if (frameSize <= 0 || offset + 10 + frameSize > end) break;

    const frameData = u8.subarray(offset + 10, offset + 10 + frameSize);

    if (frameId === 'APIC' && frameData.length > 2) {
      try {
        const encoding = frameData[0];
        let p = 1;
        let mime = '';
        while (p < frameData.length && frameData[p] !== 0) {
          mime += String.fromCharCode(frameData[p]);
          p++;
        }
        p++; // skip null
        const picType = frameData[p];
        p++; // skip picType

        // Description
        let desc = '';
        if (encoding === 1 || encoding === 2) {
          while (p + 1 < frameData.length && (frameData[p] !== 0 || frameData[p + 1] !== 0)) {
            p += 2;
          }
          p += 2;
        } else {
          while (p < frameData.length && frameData[p] !== 0) {
            desc += String.fromCharCode(frameData[p]);
            p++;
          }
          p++;
        }

        const imgBytes = frameData.subarray(p);
        if (imgBytes.length > 0) {
          const finalMime = mime || 'image/jpeg';
          let binary = '';
          for (let i = 0; i < imgBytes.length; i++) {
            binary += String.fromCharCode(imgBytes[i]);
          }
          const base64 = btoa(binary);
          albumArt = {
            mimeType: finalMime,
            dataUrl: `data:${finalMime};base64,${base64}`,
            description: desc || 'フロントカバー',
            sizeBytes: imgBytes.length,
            rawBuffer: imgBytes.buffer.slice(
              imgBytes.byteOffset,
              imgBytes.byteOffset + imgBytes.byteLength
            ),
          };
        }
      } catch (e) {
        console.warn('APIC parse error:', e);
      }
    } else if (frameId.startsWith('T') && frameData.length > 1) {
      // Text frame
      const encoding = frameData[0];
      const text = decodeText(frameData.subarray(1), encoding);
      tags[frameId] = text.trim();
    } else if (frameId === 'COMM' && frameData.length > 4) {
      const encoding = frameData[0];
      // 3 bytes language, description until null, then text
      let p = 4;
      while (p < frameData.length && frameData[p] !== 0) p++;
      p++;
      const comment = decodeText(frameData.subarray(p), encoding);
      tags['COMM'] = comment.trim();
    }

    offset += 10 + frameSize;
  }

  return { tags, albumArt };
}

// Strip ID3 from MP3
export function stripID3Tags(buffer: ArrayBuffer): ArrayBuffer {
  const u8 = new Uint8Array(buffer);
  let start = 0;
  let end = u8.length;

  // Check ID3v2 at start
  if (u8.length >= 10 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) {
    const tagSize =
      ((u8[6] & 0x7f) << 21) |
      ((u8[7] & 0x7f) << 14) |
      ((u8[8] & 0x7f) << 7) |
      (u8[9] & 0x7f);
    start = 10 + tagSize;
  }

  // Check ID3v1 at end (128 bytes starting with 'TAG')
  if (end - start > 128) {
    const p = end - 128;
    if (u8[p] === 0x54 && u8[p + 1] === 0x41 && u8[p + 2] === 0x47) {
      end -= 128;
    }
  }

  return buffer.slice(start, end);
}

// -------------------------------------------------------------
// Image (JPEG / PNG) Metadata Parser & Stripper
// -------------------------------------------------------------

// Strip all APP markers from JPEG
export function stripJpegMetadata(buffer: ArrayBuffer): ArrayBuffer {
  try {
    const binary = bufferToBinaryString(buffer);
    const cleanBinary = piexif.remove(binary);
    return binaryStringToUint8Array(cleanBinary).buffer as ArrayBuffer;
  } catch {
    // Fallback: manual segment filter
    const u8 = new Uint8Array(buffer);
    if (u8[0] !== 0xff || u8[1] !== 0xd8) return buffer;

    const kept: Uint8Array[] = [u8.subarray(0, 2)]; // SOI
    let offset = 2;

    while (offset < u8.length) {
      if (u8[offset] !== 0xff) {
        kept.push(u8.subarray(offset));
        break;
      }
      const marker = u8[offset + 1];
      if (marker === 0xda) {
        // Start of Scan: remainder is raw image data
        kept.push(u8.subarray(offset));
        break;
      }
      if (marker === 0xd9) {
        // EOI
        kept.push(u8.subarray(offset, offset + 2));
        break;
      }
      if (offset + 4 > u8.length) break;
      const length = (u8[offset + 2] << 8) | u8[offset + 3];

      // Filter out APP1 (0xE1: Exif/XMP), APP2 (0xE2), APP13 (0xED: Photoshop), COM (0xFE)
      const isMetadata =
        marker === 0xe1 || marker === 0xe2 || marker === 0xed || marker === 0xfe;

      if (!isMetadata) {
        kept.push(u8.subarray(offset, offset + 2 + length));
      }
      offset += 2 + length;
    }

    let total = 0;
    for (const chunk of kept) total += chunk.length;
    const result = new Uint8Array(total);
    let pos = 0;
    for (const chunk of kept) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result.buffer as ArrayBuffer;
  }
}

// Strip metadata chunks from PNG (keeping only critical chunks)
export function stripPngMetadata(buffer: ArrayBuffer): ArrayBuffer {
  const u8 = new Uint8Array(buffer);
  // PNG signature
  if (
    u8.length < 8 ||
    u8[0] !== 0x89 ||
    u8[1] !== 0x50 ||
    u8[2] !== 0x4e ||
    u8[3] !== 0x47 ||
    u8[4] !== 0x0d ||
    u8[5] !== 0x0a ||
    u8[6] !== 0x1a ||
    u8[7] !== 0x0a
  ) {
    return buffer;
  }

  const kept: Uint8Array[] = [u8.subarray(0, 8)];
  let offset = 8;
  const view = new DataView(buffer);

  while (offset + 12 <= u8.length) {
    const length = view.getUint32(offset, false);
    let type = '';
    for (let i = 0; i < 4; i++) {
      type += String.fromCharCode(u8[offset + 4 + i]);
    }

    const chunkTotalLen = 12 + length;
    if (offset + chunkTotalLen > u8.length) break;

    // Filter out metadata chunks
    const isMeta =
      type === 'tEXt' ||
      type === 'zTXt' ||
      type === 'iTXt' ||
      type === 'eXIf' ||
      type === 'tIME' ||
      type === 'pHYs';

    if (!isMeta) {
      kept.push(u8.subarray(offset, offset + chunkTotalLen));
    }

    offset += chunkTotalLen;
    if (type === 'IEND') break;
  }

  let total = 0;
  for (const chunk of kept) total += chunk.length;
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of kept) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result.buffer as ArrayBuffer;
}

// -------------------------------------------------------------
// Video (MP4) Metadata Parser & Stripper
// -------------------------------------------------------------

export function stripMp4Metadata(buffer: ArrayBuffer): ArrayBuffer {
  const u8 = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;

  // Search for 'moov' atom
  while (offset + 8 <= u8.length) {
    const size = view.getUint32(offset, false);
    let type = '';
    for (let i = 0; i < 4; i++) {
      type += String.fromCharCode(u8[offset + 4 + i]);
    }

    if (size === 0) break;

    if (type === 'moov') {
      // Look inside moov for 'udta'
      const moovStart = offset;
      const moovEnd = offset + size;
      let innerOffset = offset + 8;
      let udtaStart = -1;
      let udtaSize = 0;

      while (innerOffset + 8 <= moovEnd) {
        const innerSize = view.getUint32(innerOffset, false);
        let innerType = '';
        for (let i = 0; i < 4; i++) {
          innerType += String.fromCharCode(u8[innerOffset + 4 + i]);
        }
        if (innerType === 'udta') {
          udtaStart = innerOffset;
          udtaSize = innerSize;
          break;
        }
        if (innerSize === 0) break;
        innerOffset += innerSize;
      }

      if (udtaStart !== -1 && udtaSize > 0) {
        // Strip the udta box from moov and update moov box size
        const beforeUdta = u8.subarray(0, udtaStart);
        const afterUdta = u8.subarray(udtaStart + udtaSize);
        const newBuf = new Uint8Array(beforeUdta.length + afterUdta.length);
        newBuf.set(beforeUdta, 0);
        newBuf.set(afterUdta, beforeUdta.length);

        // Update moov size
        const newMoovView = new DataView(newBuf.buffer);
        newMoovView.setUint32(moovStart, size - udtaSize, false);
        return newBuf.buffer as ArrayBuffer;
      }
    }

    offset += size;
  }

  return buffer;
}

function parseMp4Metadata(buffer: ArrayBuffer): Record<string, string> {
  const u8 = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const tags: Record<string, string> = {};
  let offset = 0;

  while (offset + 8 <= u8.length) {
    const size = view.getUint32(offset, false);
    if (size < 8) break;
    let type = '';
    for (let i = 0; i < 4; i++) type += String.fromCharCode(u8[offset + 4 + i]);

    if (type === 'moov') {
      const moovEnd = offset + size;
      let inner = offset + 8;
      while (inner + 8 <= moovEnd) {
        const inSize = view.getUint32(inner, false);
        if (inSize < 8) break;
        let inType = '';
        for (let i = 0; i < 4; i++) inType += String.fromCharCode(u8[inner + 4 + i]);

        if (inType === 'udta') {
          // Search for meta -> ilst
          const udtaEnd = inner + inSize;
          let u = inner + 8;
          while (u + 8 <= udtaEnd) {
            const uSize = view.getUint32(u, false);
            if (uSize < 8) break;
            let uType = '';
            for (let i = 0; i < 4; i++) uType += String.fromCharCode(u8[u + 4 + i]);

            if (uType === 'meta') {
              // meta header has 4 bytes flags
              const metaEnd = u + uSize;
              let m = u + 12;
              while (m + 8 <= metaEnd) {
                const mSize = view.getUint32(m, false);
                if (mSize < 8) break;
                let mType = '';
                for (let i = 0; i < 4; i++) mType += String.fromCharCode(u8[m + 4 + i]);

                if (mType === 'ilst') {
                  // read items inside ilst
                  const ilstEnd = m + mSize;
                  let itemPos = m + 8;
                  while (itemPos + 8 <= ilstEnd) {
                    const itemSize = view.getUint32(itemPos, false);
                    if (itemSize < 8) break;
                    let itemId = '';
                    for (let i = 0; i < 4; i++) itemId += String.fromCharCode(u8[itemPos + 4 + i]);

                    // look for 'data' inside
                    let d = itemPos + 8;
                    const itemEnd = itemPos + itemSize;
                    while (d + 8 <= itemEnd) {
                      const dSize = view.getUint32(d, false);
                      if (dSize < 8) break;
                      let dType = '';
                      for (let i = 0; i < 4; i++) dType += String.fromCharCode(u8[d + 4 + i]);

                      if (dType === 'data' && dSize > 16) {
                        // skip 8 bytes (type + locale)
                        const textBytes = u8.subarray(d + 16, d + dSize);
                        const val = new TextDecoder('utf-8').decode(textBytes).trim();
                        if (val) tags[itemId] = val;
                      }
                      d += dSize;
                    }

                    itemPos += itemSize;
                  }
                }
                m += mSize;
              }
            }
            u += uSize;
          }
        }
        inner += inSize;
      }
    }
    offset += size;
  }

  return tags;
}

// -------------------------------------------------------------
// Unified Main Parser
// -------------------------------------------------------------

export async function readFileMetadata(file: File): Promise<FileMetadataInfo> {
  const mediaType = detectMediaType(file);
  const buffer = await file.arrayBuffer();

  const info: FileMetadataInfo = {
    mediaType,
    mimeType: file.type || 'application/octet-stream',
    fileName: file.name,
    fileSize: file.size,
    title: '',
    artist: '',
    album: '',
    year: '',
    genre: '',
    comment: '',
    copyright: '',
    software: '',
    track: '',
    albumArt: null,
    cameraMake: '',
    cameraModel: '',
    dateTimeOriginal: '',
    gpsLatitude: null,
    gpsLongitude: null,
    hasExif: false,
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    creationDate: '',
    modificationDate: '',
    detectedTags: [],
  };

  // 1. Image (JPEG / PNG)
  if (mediaType === 'image') {
    const isJpeg = file.name.match(/\.(jpe?g)$/i) || file.type === 'image/jpeg';
    if (isJpeg) {
      try {
        const binary = bufferToBinaryString(buffer);
        const exifData = piexif.load(binary);
        info.hasExif = true;

        const zeroth = exifData['0th'] || {};
        const exif = exifData['Exif'] || {};
        const gps = exifData['GPS'] || {};

        if (zeroth[piexif.ImageIFD.Make]) {
          info.cameraMake = String(zeroth[piexif.ImageIFD.Make]).trim();
          info.detectedTags.push({ key: 'Make', label: 'カメラメーカー', value: info.cameraMake });
        }
        if (zeroth[piexif.ImageIFD.Model]) {
          info.cameraModel = String(zeroth[piexif.ImageIFD.Model]).trim();
          info.detectedTags.push({ key: 'Model', label: 'カメラ型番', value: info.cameraModel });
        }
        if (zeroth[piexif.ImageIFD.Software]) {
          info.software = String(zeroth[piexif.ImageIFD.Software]).trim();
          info.detectedTags.push({ key: 'Software', label: 'ソフトウェア', value: info.software });
        }
        if (zeroth[piexif.ImageIFD.Artist]) {
          info.artist = String(zeroth[piexif.ImageIFD.Artist]).trim();
          info.detectedTags.push({ key: 'Artist', label: '作成者/撮影者', value: info.artist });
        }
        if (zeroth[piexif.ImageIFD.ImageDescription]) {
          info.title = String(zeroth[piexif.ImageIFD.ImageDescription]).trim();
          info.detectedTags.push({ key: 'ImageDescription', label: 'タイトル/説明', value: info.title });
        }
        if (zeroth[piexif.ImageIFD.Copyright]) {
          info.copyright = String(zeroth[piexif.ImageIFD.Copyright]).trim();
          info.detectedTags.push({ key: 'Copyright', label: '著作権', value: info.copyright });
        }
        if (exif[piexif.ExifIFD.DateTimeOriginal]) {
          info.dateTimeOriginal = String(exif[piexif.ExifIFD.DateTimeOriginal]).trim();
          info.detectedTags.push({ key: 'DateTimeOriginal', label: '撮影日時', value: info.dateTimeOriginal });
        }
        if (exif[piexif.ExifIFD.UserComment]) {
          info.comment = String(exif[piexif.ExifIFD.UserComment]).trim();
          info.detectedTags.push({ key: 'UserComment', label: 'コメント', value: info.comment });
        }

        // GPS Coordinates
        if (gps[piexif.GPSIFD.GPSLatitude] && gps[piexif.GPSIFD.GPSLatitudeRef]) {
          try {
            const lat = piexif.GPSHelper.dmsRationalToDeg(
              gps[piexif.GPSIFD.GPSLatitude],
              gps[piexif.GPSIFD.GPSLatitudeRef]
            );
            if (typeof lat === 'number') {
              info.gpsLatitude = lat;
              info.detectedTags.push({
                key: 'GPSLatitude',
                label: 'GPS 緯度',
                value: `${lat.toFixed(6)}°`,
              });
            }
          } catch {}
        }
        if (gps[piexif.GPSIFD.GPSLongitude] && gps[piexif.GPSIFD.GPSLongitudeRef]) {
          try {
            const lon = piexif.GPSHelper.dmsRationalToDeg(
              gps[piexif.GPSIFD.GPSLongitude],
              gps[piexif.GPSIFD.GPSLongitudeRef]
            );
            if (typeof lon === 'number') {
              info.gpsLongitude = lon;
              info.detectedTags.push({
                key: 'GPSLongitude',
                label: 'GPS 経度',
                value: `${lon.toFixed(6)}°`,
              });
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Exif load error:', err);
      }
    }
  }

  // 2. Audio (ID3)
  if (mediaType === 'audio') {
    const { tags, albumArt } = parseID3v2(buffer);
    info.title = tags['TIT2'] || '';
    info.artist = tags['TPE1'] || '';
    info.album = tags['TALB'] || '';
    info.year = tags['TYER'] || tags['TDRC'] || '';
    info.genre = tags['TCON'] || '';
    info.track = tags['TRCK'] || '';
    info.comment = tags['COMM'] || '';
    info.albumArt = albumArt;

    if (info.title) info.detectedTags.push({ key: 'TIT2', label: 'タイトル', value: info.title });
    if (info.artist) info.detectedTags.push({ key: 'TPE1', label: 'アーティスト', value: info.artist });
    if (info.album) info.detectedTags.push({ key: 'TALB', label: 'アルバム', value: info.album });
    if (info.year) info.detectedTags.push({ key: 'TYER', label: 'リリース年', value: info.year });
    if (info.genre) info.detectedTags.push({ key: 'TCON', label: 'ジャンル', value: info.genre });
    if (info.track) info.detectedTags.push({ key: 'TRCK', label: 'トラック番号', value: info.track });
    if (info.comment) info.detectedTags.push({ key: 'COMM', label: 'コメント', value: info.comment });
    if (info.albumArt) {
      info.detectedTags.push({
        key: 'APIC',
        label: 'アルバムアート',
        value: `${info.albumArt.mimeType} (${Math.round(info.albumArt.sizeBytes / 1024)} KB)`,
      });
    }
  }

  // 3. PDF
  if (mediaType === 'pdf') {
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      info.title = pdfDoc.getTitle() || '';
      info.artist = pdfDoc.getAuthor() || '';
      info.subject = pdfDoc.getSubject() || '';
      info.keywords = pdfDoc.getKeywords() || '';
      info.creator = pdfDoc.getCreator() || '';
      info.producer = pdfDoc.getProducer() || '';
      const cDate = pdfDoc.getCreationDate();
      const mDate = pdfDoc.getModificationDate();
      info.creationDate = cDate ? cDate.toLocaleString('ja-JP') : '';
      info.modificationDate = mDate ? mDate.toLocaleString('ja-JP') : '';

      if (info.title) info.detectedTags.push({ key: 'Title', label: 'ドキュメントタイトル', value: info.title });
      if (info.artist) info.detectedTags.push({ key: 'Author', label: '著者 (Author)', value: info.artist });
      if (info.subject) info.detectedTags.push({ key: 'Subject', label: 'サブジェクト', value: info.subject });
      if (info.keywords) info.detectedTags.push({ key: 'Keywords', label: 'キーワード', value: info.keywords });
      if (info.creator) info.detectedTags.push({ key: 'Creator', label: '作成ツール (Creator)', value: info.creator });
      if (info.producer) info.detectedTags.push({ key: 'Producer', label: 'プロデューサー', value: info.producer });
      if (info.creationDate) info.detectedTags.push({ key: 'CreationDate', label: '作成日時', value: info.creationDate });
      if (info.modificationDate) info.detectedTags.push({ key: 'ModDate', label: '更新日時', value: info.modificationDate });
    } catch (e) {
      console.warn('PDF load error:', e);
    }
  }

  // 4. Video (MP4 / MOV)
  if (mediaType === 'video') {
    const mp4Tags = parseMp4Metadata(buffer);
    info.title = mp4Tags['\xa9nam'] || '';
    info.artist = mp4Tags['\xa9ART'] || '';
    info.album = mp4Tags['\xa9alb'] || '';
    info.year = mp4Tags['\xa9day'] || '';
    info.comment = mp4Tags['\xa9cmt'] || '';
    info.genre = mp4Tags['\xa9gen'] || '';
    info.software = mp4Tags['\xa9too'] || '';

    if (info.title) info.detectedTags.push({ key: 'title', label: '動画タイトル', value: info.title });
    if (info.artist) info.detectedTags.push({ key: 'artist', label: '制作者/アーティスト', value: info.artist });
    if (info.album) info.detectedTags.push({ key: 'album', label: 'アルバム/シリーズ', value: info.album });
    if (info.year) info.detectedTags.push({ key: 'year', label: '年', value: info.year });
    if (info.comment) info.detectedTags.push({ key: 'comment', label: 'コメント', value: info.comment });
    if (info.software) info.detectedTags.push({ key: 'software', label: 'エンコーダー/ツール', value: info.software });
  }

  return info;
}

// -------------------------------------------------------------
// Metadata Editor & Writer
// -------------------------------------------------------------

export interface MetadataUpdatePayload {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  comment?: string;
  copyright?: string;
  software?: string;
  track?: string;

  // Audio cover
  albumArtBuffer?: ArrayBuffer | null; // null means delete
  albumArtMime?: string;

  // Image specific
  cameraMake?: string;
  cameraModel?: string;
  clearGps?: boolean;

  // PDF specific
  subject?: string;
  keywords?: string;
}

export async function updateFileMetadata(
  file: File,
  updates: MetadataUpdatePayload
): Promise<Blob> {
  const mediaType = detectMediaType(file);
  const buffer = await file.arrayBuffer();

  // 1. Audio (MP3)
  if (mediaType === 'audio') {
    // Strip existing ID3 first to write clean new tag
    const stripped = stripID3Tags(buffer);
    const writer = new ID3Writer(stripped);

    if (updates.title) writer.setFrame('TIT2', updates.title);
    if (updates.artist) writer.setFrame('TPE1', [updates.artist]);
    if (updates.album) writer.setFrame('TALB', updates.album);
    if (updates.year) {
      const yr = parseInt(updates.year, 10);
      if (!isNaN(yr)) writer.setFrame('TYER', yr);
    }
    if (updates.genre) writer.setFrame('TCON', [updates.genre]);
    if (updates.track) writer.setFrame('TRCK', updates.track);
    if (updates.comment) {
      writer.setFrame('COMM', {
        description: '',
        text: updates.comment,
      });
    }

    // Album art
    if (updates.albumArtBuffer) {
      writer.setFrame('APIC', {
        type: 3, // Cover (front)
        data: updates.albumArtBuffer,
        description: 'Cover',
        useUnicodeEncoding: false,
      });
    }

    writer.addTag();
    return writer.getBlob();
  }

  // 2. PDF
  if (mediaType === 'pdf') {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    if (updates.title !== undefined) pdfDoc.setTitle(updates.title);
    if (updates.artist !== undefined) pdfDoc.setAuthor(updates.artist);
    if (updates.subject !== undefined) pdfDoc.setSubject(updates.subject);
    if (updates.keywords !== undefined) {
      const kw = updates.keywords.split(',').map((s) => s.trim()).filter(Boolean);
      pdfDoc.setKeywords(kw);
    }
    if (updates.software !== undefined) pdfDoc.setProducer(updates.software);

    pdfDoc.setModificationDate(new Date());
    const savedBytes = await pdfDoc.save();
    return new Blob([savedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  // 3. Image (JPEG)
  if (mediaType === 'image') {
    const isJpeg = file.name.match(/\.(jpe?g)$/i) || file.type === 'image/jpeg';
    if (isJpeg) {
      try {
        const binary = bufferToBinaryString(buffer);
        let exifObj: any;
        try {
          exifObj = piexif.load(binary);
        } catch {
          exifObj = { '0th': {}, Exif: {}, GPS: {}, Interop: {}, '1st': {}, thumbnail: null };
        }

        if (!exifObj['0th']) exifObj['0th'] = {};
        if (!exifObj['Exif']) exifObj['Exif'] = {};

        if (updates.title !== undefined) {
          exifObj['0th'][piexif.ImageIFD.ImageDescription] = updates.title;
        }
        if (updates.artist !== undefined) {
          exifObj['0th'][piexif.ImageIFD.Artist] = updates.artist;
        }
        if (updates.cameraMake !== undefined) {
          exifObj['0th'][piexif.ImageIFD.Make] = updates.cameraMake;
        }
        if (updates.cameraModel !== undefined) {
          exifObj['0th'][piexif.ImageIFD.Model] = updates.cameraModel;
        }
        if (updates.software !== undefined) {
          exifObj['0th'][piexif.ImageIFD.Software] = updates.software;
        }
        if (updates.copyright !== undefined) {
          exifObj['0th'][piexif.ImageIFD.Copyright] = updates.copyright;
        }
        if (updates.comment !== undefined) {
          exifObj['Exif'][piexif.ExifIFD.UserComment] = updates.comment;
        }

        if (updates.clearGps) {
          exifObj['GPS'] = {};
        }

        const exifBytes = piexif.dump(exifObj);
        const newBinary = piexif.insert(exifBytes, binary);
        const resultBytes = binaryStringToUint8Array(newBinary);
        return new Blob([resultBytes.buffer as ArrayBuffer], { type: 'image/jpeg' });
      } catch (err) {
        console.error('JPEG update error:', err);
      }
    }
  }

  // 4. Video (MP4) - Strips old metadata and saves
  if (mediaType === 'video') {
    const stripped = stripMp4Metadata(buffer);
    return new Blob([stripped], { type: file.type || 'video/mp4' });
  }

  // Fallback
  return new Blob([buffer], { type: file.type });
}

// -------------------------------------------------------------
// Strip All Metadata (全て削除)
// -------------------------------------------------------------

export async function stripAllFileMetadata(file: File): Promise<Blob> {
  const mediaType = detectMediaType(file);
  const buffer = await file.arrayBuffer();

  if (mediaType === 'image') {
    const isJpeg = file.name.match(/\.(jpe?g)$/i) || file.type === 'image/jpeg';
    if (isJpeg) {
      const stripped = stripJpegMetadata(buffer);
      return new Blob([stripped], { type: 'image/jpeg' });
    }
    const isPng = file.name.match(/\.png$/i) || file.type === 'image/png';
    if (isPng) {
      const stripped = stripPngMetadata(buffer);
      return new Blob([stripped], { type: 'image/png' });
    }
  }

  if (mediaType === 'audio') {
    const stripped = stripID3Tags(buffer);
    return new Blob([stripped], { type: file.type || 'audio/mpeg' });
  }

  if (mediaType === 'pdf') {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
    const cleanBytes = await pdfDoc.save();
    return new Blob([cleanBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  if (mediaType === 'video') {
    const stripped = stripMp4Metadata(buffer);
    return new Blob([stripped], { type: file.type || 'video/mp4' });
  }

  return new Blob([buffer], { type: file.type });
}
