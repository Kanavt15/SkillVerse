/**
 * Password hashing with PBKDF2-HMAC-SHA256 via Web Crypto (native code in Workers).
 *
 * Stored format (versioned, so the algorithm can change without forcing resets):
 *
 *     pbkdf2$<iterations>$<salt base64url>$<hash base64url>
 *
 * Why PBKDF2 and not bcrypt/argon2? Workers on the free plan get 10 ms of CPU per
 * request. PBKDF2 runs as native code inside the runtime; bcrypt/argon2 would run
 * as JavaScript or WASM and blow the budget. 100,000 iterations is the maximum the
 * Workers runtime allows, and OWASP's current guidance for PBKDF2-SHA256 is higher,
 * so `needsRehash` lets us raise it transparently on the paid plan (see ADR 0001).
 */
import { constantTimeEqual, fromBase64Url, toBase64Url } from './crypto';

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** Hashes a password with a fresh random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

/**
 * Checks a password against a stored hash. Returns false (never throws) for
 * malformed hashes, so a corrupted row can't crash sign-in.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS)
    return false;
  try {
    const salt = fromBase64Url(parts[2]!);
    const expected = fromBase64Url(parts[3]!);
    const actual = await derive(password, salt, iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** True when a stored hash uses weaker settings than today's and should be re-hashed after sign-in. */
export function needsRehash(stored: string): boolean {
  const [scheme, iterations] = stored.split('$');
  return scheme !== 'pbkdf2' || Number(iterations) < PBKDF2_ITERATIONS;
}

/**
 * A valid hash of a random password, used to spend the same time verifying when
 * the email doesn't exist. Without it, "unknown email" answers faster than
 * "wrong password", and attackers could discover which emails have accounts.
 */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash;
}
