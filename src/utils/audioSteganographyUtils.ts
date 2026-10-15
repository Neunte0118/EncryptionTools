/**
 * Audio Steganography Utility (LSB Steganography for WAV audio files)
 *
 * WAV files (Linear PCM 16-bit / 8-bit uncompressed audio) allow hiding data
 * inside the Least Significant Bits (LSB) of the audio sample values without
 * producing any perceptible noise or degradation to the human ear.
 * Optional AES-256-GCM encryption ensures hidden payloads cannot be extracted without the password.
 */

import { deriveKeyFromPassword } from './cryptoUtils';

const MAGIC_HEADER = new TextEncoder().encode('STEG_WAV_v1'); // 11 bytes

/**
 * Embed arbitrary text/data into a 16-bit PCM WAV audio file using LSB
 */
export async function hideDataInWav(
  wavBuffer: ArrayBuffer,
  payloadText: string,
  password?: string
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  let payloadBytes = enc.encode(payloadText);

  // Optional AES-256-GCM encryption of payload
  let isEncrypted = false;
  let salt = new Uint8Array(16);
  let iv = new Uint8Array(12);

  if (password && password.trim()) {
    isEncrypted = true;
    salt = window.crypto.getRandomValues(new Uint8Array(16));
    iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKeyFromPassword(password.trim(), salt);
    const cipherBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      payloadBytes
    );
    payloadBytes = new Uint8Array(cipherBuf);
  }

  // Construct binary packet:
  // [11b: MAGIC] [1b: isEncrypted] [4b: length BE] [16b: salt if enc] [12b: iv if enc] [payload]
  const headerLen = MAGIC_HEADER.length + 1 + 4 + (isEncrypted ? 16 + 12 : 0);
  const packet = new Uint8Array(headerLen + payloadBytes.byteLength);

  let pOffset = 0;
  packet.set(MAGIC_HEADER, pOffset);
  pOffset += MAGIC_HEADER.length;

  packet[pOffset++] = isEncrypted ? 1 : 0;

  // Length 4 bytes BE
  const dv = new DataView(packet.buffer);
  dv.setUint32(pOffset, payloadBytes.byteLength, false);
  pOffset += 4;

  if (isEncrypted) {
    packet.set(salt, pOffset);
    pOffset += 16;
    packet.set(iv, pOffset);
    pOffset += 12;
  }

  packet.set(payloadBytes, pOffset);

  // Parse WAV header to find the 'data' chunk
  const wavView = new Uint8Array(wavBuffer.slice(0));
  const wavDv = new DataView(wavView.buffer);

  // Verify RIFF & WAVE
  const riff = String.fromCharCode(...wavView.subarray(0, 4));
  const wave = String.fromCharCode(...wavView.subarray(8, 12));
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('無効なWAV音声ファイルです (RIFF WAVE ヘッダーが見つかりません)');
  }

  // Find 'data' chunk offset
  let dataChunkOffset = 12;
  let dataChunkSize = 0;
  while (dataChunkOffset < wavView.length - 8) {
    const chunkId = String.fromCharCode(...wavView.subarray(dataChunkOffset, dataChunkOffset + 4));
    const chunkSize = wavDv.getUint32(dataChunkOffset + 4, true); // LE
    if (chunkId === 'data') {
      dataChunkOffset += 8;
      dataChunkSize = chunkSize;
      break;
    }
    dataChunkOffset += 8 + chunkSize;
  }

  if (dataChunkSize === 0) {
    throw new Error('WAVファイル内の音声データ (data チャンク) が見つかりません');
  }

  const availableBits = (wavView.length - dataChunkOffset) * 1; // 1 bit per audio sample byte
  const requiredBits = packet.length * 8;

  if (requiredBits > availableBits) {
    const maxChars = Math.floor(availableBits / 8) - headerLen;
    throw new Error(
      `音声の長さが足りません。必要ビット数: ${requiredBits}、収容可能ビット数: ${availableBits} (最大埋め込み目安: 約${Math.max(0, maxChars)}文字)`
    );
  }

  // Embed packet bits into LSB of WAV audio samples
  let sampleIndex = dataChunkOffset;
  for (let i = 0; i < packet.length; i++) {
    const byte = packet[i];
    for (let bit = 7; bit >= 0; bit--) {
      const bitVal = (byte >> bit) & 1;
      // Clear LSB and write bit
      wavView[sampleIndex] = (wavView[sampleIndex] & 0xfe) | bitVal;
      sampleIndex++;
    }
  }

  return wavView.buffer;
}

/**
 * Extract hidden payload from a WAV audio file
 */
export async function extractDataFromWav(
  wavBuffer: ArrayBuffer,
  password?: string
): Promise<{ text: string; isEncrypted: boolean }> {
  const wavView = new Uint8Array(wavBuffer);
  const wavDv = new DataView(wavView.buffer);

  // Verify WAV
  const riff = String.fromCharCode(...wavView.subarray(0, 4));
  const wave = String.fromCharCode(...wavView.subarray(8, 12));
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('無効なWAVファイルです');
  }

  // Find 'data' chunk
  let dataChunkOffset = 12;
  while (dataChunkOffset < wavView.length - 8) {
    const chunkId = String.fromCharCode(...wavView.subarray(dataChunkOffset, dataChunkOffset + 4));
    const chunkSize = wavDv.getUint32(dataChunkOffset + 4, true);
    if (chunkId === 'data') {
      dataChunkOffset += 8;
      break;
    }
    dataChunkOffset += 8 + chunkSize;
  }

  // Helper to extract N bytes from current sample index
  let sampleIndex = dataChunkOffset;
  const readBytes = (count: number): Uint8Array => {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      let b = 0;
      for (let bit = 7; bit >= 0; bit--) {
        if (sampleIndex >= wavView.length) {
          throw new Error('埋め込みデータが途中で切断されています');
        }
        const bitVal = wavView[sampleIndex] & 1;
        b |= bitVal << bit;
        sampleIndex++;
      }
      out[i] = b;
    }
    return out;
  };

  // 1. Read and verify Magic Header
  const magic = readBytes(MAGIC_HEADER.length);
  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (magic[i] !== MAGIC_HEADER[i]) {
      throw new Error('このWAVファイルにはステガノグラフィデータが見つかりません');
    }
  }

  // 2. Read isEncrypted flag
  const isEncrypted = readBytes(1)[0] === 1;

  // 3. Read payload length
  const lenBytes = readBytes(4);
  const lenDv = new DataView(lenBytes.buffer);
  const payloadLen = lenDv.getUint32(0, false);

  if (payloadLen <= 0 || payloadLen > 50 * 1024 * 1024) {
    throw new Error('不正なペイロードサイズです');
  }

  let salt: Uint8Array | undefined;
  let iv: Uint8Array | undefined;

  if (isEncrypted) {
    salt = readBytes(16);
    iv = readBytes(12);
  }

  // 4. Read payload
  const rawPayload = readBytes(payloadLen);

  if (isEncrypted) {
    if (!password || !password.trim()) {
      throw new Error('この音声データはパスワードで暗号化されています。パスワードを入力してください');
    }
    const key = await deriveKeyFromPassword(password.trim(), salt!);
    try {
      const decBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        rawPayload as any
      );
      const text = new TextDecoder('utf-8').decode(decBuf);
      return { text, isEncrypted: true };
    } catch {
      throw new Error('パスワードが一致しないか、データが破損しています');
    }
  }

  const text = new TextDecoder('utf-8').decode(rawPayload);
  return { text, isEncrypted: false };
}
