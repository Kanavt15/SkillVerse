/**
 * Authenticated encryption (AES-256-GCM) for small secrets we must be able to
 * read back, like TOTP secrets. (Passwords are HASHED, never encrypted.)
 *
 * Format: "v1:<iv base64url>:<ciphertext+tag base64url>". The version prefix
 * lets us rotate keys or algorithms later without breaking stored values.
 * The key comes from the MFA_ENCRYPTION_KEY secret (64 hex chars = 32 bytes).
 */
import { fromBase64Url, toBase64Url } from './crypto';

const keyCache = new Map<string, Promise<CryptoKey>>();

function importKey(hexKey: string): Promise<CryptoKey> {
  let key = keyCache.get(hexKey);
  if (!key) {
    if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
      throw new Error(
        'MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Run `npm run setup`.',
      );
    }
    const raw = Uint8Array.from(hexKey.match(/../g)!.map((h) => parseInt(h, 16)));
    key = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    keyCache.set(hexKey, key);
  }
  return key;
}

export async function encrypt(plaintext: Uint8Array, hexKey: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await importKey(hexKey),
    plaintext,
  );
  return `v1:${toBase64Url(iv)}:${toBase64Url(new Uint8Array(ct))}`;
}

/** Decrypts; throws if the value was tampered with (GCM authentication fails) or the key is wrong. */
export async function decrypt(value: string, hexKey: string): Promise<Uint8Array> {
  const [version, iv, ct] = value.split(':');
  if (version !== 'v1' || !iv || !ct) throw new Error('Unsupported ciphertext format');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv) },
    await importKey(hexKey),
    fromBase64Url(ct),
  );
  return new Uint8Array(pt);
}
