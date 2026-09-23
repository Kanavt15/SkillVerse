/**
 * Rejects passwords that appear in known data breaches, using the free
 * "Have I Been Pwned" Pwned Passwords API with k-anonymity:
 *
 *   1. SHA-1 the password locally.
 *   2. Send ONLY the first 5 hex characters to the API.
 *   3. It returns every breached hash suffix with that prefix; we check locally.
 *
 * The password (and even its full hash) never leaves our server. NIST SP 800-63B
 * recommends this check instead of composition rules like "must contain a symbol".
 *
 * Fails OPEN: if the API is down we allow the password (and log it), because
 * blocking sign-ups on a third-party outage is worse than skipping one check.
 * Controlled by the PASSWORD_BREACH_CHECK var ("on"/"off"; off in local dev and tests).
 */
import type { Logger } from '../lib/logger';

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Parses the API's "SUFFIX:COUNT" lines and reports whether `suffix` has a non-zero count. */
export function suffixIsBreached(body: string, suffix: string): boolean {
  for (const line of body.split('\n')) {
    const [s, count] = line.trim().split(':');
    // Padding entries (Add-Padding header) have count 0 and must be ignored.
    if (s === suffix && Number(count) > 0) return true;
  }
  return false;
}

export async function isPasswordBreached(
  password: string,
  opts: { enabled: boolean; log: Logger; fetcher?: typeof fetch },
): Promise<boolean> {
  if (!opts.enabled) return false;
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  try {
    const res = await (opts.fetcher ?? fetch)(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'SkillVerse-password-check' },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`HIBP responded ${res.status}`);
    return suffixIsBreached(await res.text(), hash.slice(5));
  } catch (err) {
    opts.log.warn('hibp.unavailable', { message: (err as Error).message });
    return false;
  }
}
