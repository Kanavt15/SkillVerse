/**
 * Small Web Crypto helpers (Workers have no Node `crypto` module by default).
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
