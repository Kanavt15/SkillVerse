/**
 * ID generation: UUIDv7 (RFC 9562).
 *
 * Why UUIDv7 instead of auto-increment integers:
 *   - IDs don't reveal how many users/orders exist (no enumeration of /orders/1, /orders/2 …).
 *   - IDs can be created anywhere (browser, Worker, script) without asking the database.
 *   - The first 48 bits are a millisecond timestamp, so IDs sort by creation time,
 *     which keeps SQLite B-tree inserts cheap (unlike random UUIDv4).
 *
 * Uses Web Crypto, which exists in Workers, browsers and Node ≥ 20.
 */

/** Returns a new UUIDv7 string, e.g. "0192f1c3-7a4e-7cde-8f12-3456789abcde". */
export function newId(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 48-bit big-endian Unix timestamp in milliseconds.
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 9562 variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** True when `value` is a well-formed UUIDv7. */
export function isId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7.test(value);
}
