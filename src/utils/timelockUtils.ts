/**
 * Drand Timelock Encryption & Decryption Utilities
 *
 * Uses League of Entropy (drand) quicknet beacon network to enable cryptographic timelock encryption.
 * Encrypted data CANNOT be decrypted by anyone (including the sender) until the decentralized threshold network
 * produces the BLS signature for the specified future round (3-second intervals).
 */

import {
  timelockEncrypt as tlockEncryptRaw,
  timelockDecrypt as tlockDecryptRaw,
  roundAt as tlockRoundAt,
  roundTime as tlockRoundTime,
  defaultChainInfo,
  Buffer as TBuffer,
  mainnetClient,
} from 'tlock-js';

export type DrandChainInfo = typeof defaultChainInfo;

export const DRAND_QUICKNET_INFO: DrandChainInfo = defaultChainInfo;

/**
 * Get round number for a given timestamp in ms
 */
export function calculateRoundForTime(timeMs: number): number {
  return tlockRoundAt(timeMs, DRAND_QUICKNET_INFO);
}

/**
 * Get timestamp in ms for a given round number
 */
export function calculateTimeForRound(roundNumber: number): number {
  return tlockRoundTime(DRAND_QUICKNET_INFO, roundNumber);
}

/**
 * Parse an age armored ciphertext to extract the drand round number and chain hash if present
 */
export function extractRoundFromCiphertext(armor: string): { round?: number; chainHash?: string } | null {
  try {
    // 1. Direct regex for unarmored or commented lines: -> tlock <round> <chain_hash>
    const directMatch = armor.match(/->\s+tlock\s+(\d+)\s+([a-fA-F0-9]+)/);
    if (directMatch) {
      return {
        round: parseInt(directMatch[1], 10),
        chainHash: directMatch[2],
      };
    }

    // 2. Base64 payload in age armor: "YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IHRsb2Nr..."
    const lines = armor
      .replace(/-----BEGIN AGE ENCRYPTED FILE-----/, '')
      .replace(/-----END AGE ENCRYPTED FILE-----/, '')
      .trim()
      .split(/\r?\n/);

    for (const line of lines.slice(0, 5)) {
      try {
        const decoded = window.atob(line.trim());
        const innerMatch = decoded.match(/->\s+tlock\s+(\d+)\s+([a-fA-F0-9]+)/);
        if (innerMatch) {
          return {
            round: parseInt(innerMatch[1], 10),
            chainHash: innerMatch[2],
          };
        }
      } catch {
        // Not a valid base64 line, continue
      }
    }
  } catch (err) {
    console.error('Failed to parse round from ciphertext', err);
  }
  return null;
}

/**
 * Encrypt data using drand timelock
 */
export async function encryptTimelock(
  data: string | ArrayBuffer,
  targetRound: number
): Promise<string> {
  const client = mainnetClient();
  let buffer: any;

  if (typeof data === 'string') {
    buffer = TBuffer.from(data, 'utf-8');
  } else {
    buffer = TBuffer.from(data);
  }

  const ciphertext = await tlockEncryptRaw(targetRound, buffer, client);
  return ciphertext;
}

/**
 * Decrypt data using drand timelock
 */
export async function decryptTimelock(
  ciphertext: string
): Promise<{ text?: string; buffer: ArrayBuffer }> {
  const client = mainnetClient();
  const decryptedBuf = await tlockDecryptRaw(ciphertext, client);
  const arrayBuffer = decryptedBuf.buffer.slice(
    decryptedBuf.byteOffset,
    decryptedBuf.byteOffset + decryptedBuf.byteLength
  ) as ArrayBuffer;

  let text: string | undefined = undefined;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
  } catch {
    // Binary file or not valid UTF-8
  }

  return {
    text,
    buffer: arrayBuffer,
  };
}

/**
 * Fetch latest beacon from drand network
 */
export async function fetchCurrentDrandBeacon(): Promise<{
  round: number;
  timeMs: number;
  randomness: string;
}> {
  const url = `https://api.drand.sh/${DRAND_QUICKNET_INFO.hash}/public/latest`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`drand API 応答エラー: HTTP ${res.status}`);
  }
  const data = await res.json();
  const timeMs = calculateTimeForRound(data.round);
  return {
    round: data.round,
    timeMs,
    randomness: data.randomness,
  };
}
