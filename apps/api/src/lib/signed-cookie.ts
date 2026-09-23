/**
 * Tamper-proof cookie values: "<payload base64url>.<HMAC-SHA256 base64url>".
 *
 * Used for short-lived OAuth state (state, PKCE verifier, nonce). The browser
 * stores it, but can't change it without the COOKIE_SIGNING_KEY secret: any
 * modification makes `verify` return null.
 */
import { constantTimeEqual, fromBase64Url, toBase64Url } from './crypto';

async function hmac(key: string, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}

export async function signValue(payload: unknown, key: string): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${toBase64Url(await hmac(key, body))}`;
}

/** Returns the payload if the signature is valid, otherwise null. Never throws. */
export async function verifyValue<T>(value: string | undefined, key: string): Promise<T | null> {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  try {
    const expected = await hmac(key, body);
    if (!constantTimeEqual(expected, fromBase64Url(sig))) return null;
    return JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T;
  } catch {
    return null;
  }
}
