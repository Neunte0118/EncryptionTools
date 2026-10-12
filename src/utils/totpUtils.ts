/**
 * Base32 RFC 4648 encoding and decoding (for TOTP / HOTP secrets)
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(encoded: string): Uint8Array {
  // Clean string: uppercase, remove spaces and hyphens, strip padding '='
  const clean = encoded.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`無効なBase32文字が含まれています: "${char}"`);
    }
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Generate a random Base32 secret for 2FA (default 20 bytes = 160 bits)
 */
export function generate2FASecret(byteLength: number = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface TotpOptions {
  period?: number; // default 30
  digits?: number; // default 6
  algorithm?: TotpAlgorithm; // default SHA-1
  timestampMs?: number; // default Date.now()
}

export interface HotpOptions {
  counter: number;
  digits?: number; // default 6
  algorithm?: TotpAlgorithm; // default SHA-1
}

/**
 * Generate HMAC digest using Web Crypto API
 */
async function computeHmac(
  algorithm: TotpAlgorithm,
  keyBytes: Uint8Array,
  messageBytes: Uint8Array
): Promise<Uint8Array> {
  // Extract pure ArrayBuffer to satisfy strict BufferSource TS typings
  const keyBuffer = keyBytes.buffer.slice(
    keyBytes.byteOffset,
    keyBytes.byteOffset + keyBytes.byteLength
  ) as ArrayBuffer;

  const msgBuffer = messageBytes.buffer.slice(
    messageBytes.byteOffset,
    messageBytes.byteOffset + messageBytes.byteLength
  ) as ArrayBuffer;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: 'HMAC',
      hash: { name: algorithm },
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
  return new Uint8Array(signature);
}

/**
 * Convert 64-bit integer counter to 8-byte big-endian buffer
 */
function counterToBuffer(counter: number | bigint): Uint8Array {
  const buffer = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buffer[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  return buffer;
}

/**
 * RFC 4226 HOTP Generator
 */
export async function generateHOTP(
  secretBase32: string,
  counter: number,
  options: { digits?: number; algorithm?: TotpAlgorithm } = {}
): Promise<string> {
  const digits = options.digits ?? 6;
  const algorithm = options.algorithm ?? 'SHA-1';
  const keyBytes = base32Decode(secretBase32);
  const msgBytes = counterToBuffer(counter);

  const hmac = await computeHmac(algorithm, keyBytes, msgBytes);

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

/**
 * RFC 6238 TOTP Generator
 */
export async function generateTOTP(
  secretBase32: string,
  options: TotpOptions = {}
): Promise<{
  code: string;
  counter: number;
  remainingSeconds: number;
  period: number;
}> {
  const period = options.period ?? 30;
  const timestamp = options.timestampMs ?? Date.now();
  const counter = Math.floor(timestamp / 1000 / period);
  const elapsedInPeriod = Math.floor((timestamp / 1000) % period);
  const remainingSeconds = period - elapsedInPeriod;

  const code = await generateHOTP(secretBase32, counter, {
    digits: options.digits ?? 6,
    algorithm: options.algorithm ?? 'SHA-1',
  });

  return {
    code,
    counter,
    remainingSeconds,
    period,
  };
}

/**
 * Verify a TOTP code with time-step drift tolerance
 */
export async function verifyTOTP(
  token: string,
  secretBase32: string,
  options: TotpOptions & { window?: number } = {}
): Promise<{
  valid: boolean;
  delta?: number;
}> {
  const window = options.window ?? 1; // allow -1, 0, +1 time steps
  const period = options.period ?? 30;
  const timestamp = options.timestampMs ?? Date.now();
  const currentCounter = Math.floor(timestamp / 1000 / period);

  const cleanedToken = token.trim().replace(/\s+/g, '');

  for (let delta = -window; delta <= window; delta++) {
    const checkCounter = currentCounter + delta;
    try {
      const generated = await generateHOTP(secretBase32, checkCounter, {
        digits: options.digits ?? cleanedToken.length,
        algorithm: options.algorithm ?? 'SHA-1',
      });
      if (generated === cleanedToken) {
        return { valid: true, delta };
      }
    } catch {
      // Invalid secret, etc.
      return { valid: false };
    }
  }

  return { valid: false };
}

/**
 * Parse an otpauth:// URI
 */
export interface OtpAuthData {
  type: 'totp' | 'hotp';
  label: string;
  issuer?: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  counter?: number;
}

export function parseOtpAuthUri(uri: string): OtpAuthData {
  const trimmed = uri.trim();
  if (!trimmed.startsWith('otpauth://')) {
    throw new Error('無効なURIスキームです。otpauth:// で始まる必要があります。');
  }

  const parsed = new URL(trimmed);
  const type = parsed.hostname.toLowerCase();
  if (type !== 'totp' && type !== 'hotp') {
    throw new Error(`未対応の認証タイプです: ${type}`);
  }

  // Label is pathname without leading '/'
  const rawLabel = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const params = parsed.searchParams;

  const secret = params.get('secret');
  if (!secret) {
    throw new Error('URIに secret パラメータが含まれていません。');
  }

  const rawIssuer = params.get('issuer') || undefined;
  let issuer = rawIssuer;
  let label = rawLabel;

  // Sometimes label is "Issuer:account"
  if (rawLabel.includes(':')) {
    const [iss, ...rest] = rawLabel.split(':');
    if (!issuer) {
      issuer = iss.trim();
    }
    label = rest.join(':').trim();
  }

  let algorithm: TotpAlgorithm = 'SHA-1';
  const algoParam = params.get('algorithm')?.toUpperCase();
  if (algoParam === 'SHA256' || algoParam === 'SHA-256') algorithm = 'SHA-256';
  else if (algoParam === 'SHA512' || algoParam === 'SHA-512') algorithm = 'SHA-512';

  const digits = params.has('digits') ? parseInt(params.get('digits')!, 10) : 6;
  const period = params.has('period') ? parseInt(params.get('period')!, 10) : 30;
  const counter = params.has('counter') ? parseInt(params.get('counter')!, 10) : 0;

  return {
    type,
    label: label || 'アカウント',
    issuer,
    secret: secret.replace(/\s+/g, '').toUpperCase(),
    algorithm,
    digits,
    period,
    counter,
  };
}

/**
 * Generate an otpauth:// URI
 */
export function generateOtpAuthUri(data: OtpAuthData): string {
  const type = data.type;
  const labelPart = data.issuer ? `${encodeURIComponent(data.issuer)}:${encodeURIComponent(data.label)}` : encodeURIComponent(data.label);
  const params = new URLSearchParams();
  params.set('secret', data.secret.toUpperCase().replace(/\s+/g, ''));
  if (data.issuer) params.set('issuer', data.issuer);
  if (data.algorithm && data.algorithm !== 'SHA-1') params.set('algorithm', data.algorithm.replace('-', ''));
  if (data.digits && data.digits !== 6) params.set('digits', data.digits.toString());
  if (type === 'totp' && data.period && data.period !== 30) params.set('period', data.period.toString());
  if (type === 'hotp') params.set('counter', (data.counter ?? 0).toString());

  return `otpauth://${type}/${labelPart}?${params.toString()}`;
}
