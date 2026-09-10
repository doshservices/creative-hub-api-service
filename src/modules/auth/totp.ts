import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// RFC 6238 TOTP over RFC 4226 HOTP — HMAC-SHA1, 30s step, 6 digits, the parameters every
// authenticator app (Google Authenticator, Authy, 1Password, etc.) assumes by default. No
// dependency added: this is the same amount of code as password.ts's hand-rolled scrypt
// hashing, and Node's `node:crypto` already has everything HOTP needs.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;
// Accept the previous and next 30s window too, so a slow phone clock or network hop between
// "user reads code" and "server checks code" doesn't spuriously fail — same tolerance every
// mainstream TOTP implementation uses.
const WINDOW_STEPS = 1;

export function generateBase32Secret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    // 10 digits, grouped for readability (e.g. "48213-97042") — not a TOTP code, a single-use
    // recovery code independent of the authenticator app.
    const code = randomInt(0, 1_000_000_000).toString().padStart(9, '0');
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
}

export function buildOtpAuthUrl(secret: string, email: string, issuer = 'Creative Hub'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function base32Encode(bytes: Buffer): string {
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(value: string): Buffer {
  const cleaned = value.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const truncated =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (truncated % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

export function generateTotp(base32Secret: string, at: Date = new Date()): string {
  const counter = Math.floor(at.getTime() / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

// Constant-time compare across a small window of adjacent steps — never a plain `===` on a
// secret-derived value, same principle as password.ts's timingSafeEqual use.
export function verifyTotp(base32Secret: string, code: string, at: Date = new Date()): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  const secretBytes = base32Decode(base32Secret);
  const counter = Math.floor(at.getTime() / 1000 / STEP_SECONDS);
  const codeBuffer = Buffer.from(code);
  for (let step = -WINDOW_STEPS; step <= WINDOW_STEPS; step += 1) {
    const candidate = Buffer.from(hotp(secretBytes, counter + step));
    if (timingSafeEqual(candidate, codeBuffer)) {
      return true;
    }
  }
  return false;
}
