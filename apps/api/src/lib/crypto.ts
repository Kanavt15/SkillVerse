/**
 * Small Web Crypto helpers (Workers have no Node `crypto` module by default).
 *
 * Exports: sha256Hex, hashIp, randomToken, base64url encode/decode, constantTimeEqual.
 */

/** SHA-256 of a string, as lower-case hex. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One-way, salted hash of an IP address.
 * Lets us rate-limit and spot abuse from "the same IP" without storing
 * the IP itself (personal data under India's DPDP Act and GDPR).
 */
export function hashIp(ip: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${ip}`);
}

/** Bytes → URL-safe base64 without padding (safe in URLs and cookies). */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** URL-safe base64 → bytes. Throws on malformed input. */
export function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

/**
 * A new unguessable token for sessions and emailed links.
 * 32 bytes = 256 bits of randomness → 43 base64url characters.
 */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toBase64Url(buf);
}

/**
 * Compares two byte arrays in time that depends only on their length, not on
 * where they first differ. A normal `===` returns early and leaks, through
 * timing, how many leading bytes an attacker guessed right.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
