/**
 * Time-based one-time passwords (TOTP, RFC 6238), the 6-digit codes shown by
 * authenticator apps (Google Authenticator, Microsoft Authenticator, 1Password…).
 *
 *   code = HOTP(secret, floor(unixTime / 30))   HMAC-SHA1, 6 digits (RFC 4226)
 *
 * We accept the current 30-second step and one step either side (clock drift),
 * and never accept a step at or before the last one used (a stolen code can't
 * be replayed, even within its 30 seconds).
 */
import { TOTP_DIGITS, TOTP_PERIOD_SECONDS } from '@skillverse/shared';
import { constantTimeEqual } from './crypto';

export { TOTP_DIGITS, TOTP_PERIOD_SECONDS };
const SECRET_BYTES = 20; // 160 bits, as recommended by RFC 4226

// ─── Base32 (RFC 4648), the format authenticator apps expect ─────────────────
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

// ─── TOTP ───────────────────────────────────────────────────────────────────

export function newTotpSecret(): Uint8Array {
  const secret = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(secret);
  return secret;
}

export function currentStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** The code for one time step, zero-padded (RFC 4226 dynamic truncation). */
export async function hotp(
  secret: Uint8Array,
  step: number,
  digits = TOTP_DIGITS,
): Promise<string> {
  const counter = new Uint8Array(8);
  let c = step;
  for (let i = 7; i >= 0; i--) {
    counter[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary =
    ((mac[offset]! & 0x7f) << 24) |
    (mac[offset + 1]! << 16) |
    (mac[offset + 2]! << 8) |
    mac[offset + 3]!;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Checks a code. Returns the matched time step (store it as `lastUsedStep`),
 * or null. Every candidate step is checked, so timing doesn't reveal which matched.
 */
export async function verifyTotp(
  secret: Uint8Array,
  code: string,
  opts: { nowMs?: number; lastUsedStep?: number; window?: number } = {},
): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const now = currentStep(opts.nowMs);
  const window = opts.window ?? 1;
  const given = new TextEncoder().encode(code);
  let matched: number | null = null;
  for (let step = now - window; step <= now + window; step++) {
    const expected = new TextEncoder().encode(await hotp(secret, step));
    if (constantTimeEqual(expected, given) && step > (opts.lastUsedStep ?? 0)) matched = step;
  }
  return matched;
}

/** Re-exported: the URI builder lives in @skillverse/shared so the website builds the same URI. */
export { otpauthUri } from '@skillverse/shared';
