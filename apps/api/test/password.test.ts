/**
 * Unit tests for password hashing and the breached-password check.
 */
import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from '../src/lib/password';
import { createLogger } from '../src/lib/logger';
import { isPasswordBreached, suffixIsBreached } from '../src/services/breached-password.service';

describe('hashPassword / verifyPassword', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('treats Unicode look-alikes consistently (NFKC)', async () => {
    const hash = await hashPassword('ﬁle'); // "ﬁ" ligature
    expect(await verifyPassword('file', hash)).toBe(true);
  });

  it('never throws on malformed hashes', async () => {
    for (const bad of [
      '',
      'plain',
      'pbkdf2$abc$def$ghi',
      'bcrypt$10$x$y',
      'pbkdf2$999999999$a$b',
    ]) {
      expect(await verifyPassword('x', bad)).toBe(false);
    }
  });

  it('flags weaker hashes for upgrade', () => {
    expect(needsRehash('pbkdf2$10000$a$b')).toBe(true);
    expect(needsRehash('pbkdf2$100000$a$b')).toBe(false);
  });
});

describe('breached password check', () => {
  const log = createLogger();

  it('parses the range response and ignores padding rows', () => {
    const body = 'AAAA:3\r\nBBBB:0\r\nCCCC:12';
    expect(suffixIsBreached(body, 'AAAA')).toBe(true);
    expect(suffixIsBreached(body, 'BBBB')).toBe(false);
    expect(suffixIsBreached(body, 'DDDD')).toBe(false);
  });

  it('sends only a 5-character hash prefix and detects a breached password', async () => {
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    let requested = '';
    const fetcher = (async (url: string) => {
      requested = url;
      return new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\n');
    }) as unknown as typeof fetch;
    expect(await isPasswordBreached('password', { enabled: true, log, fetcher })).toBe(true);
    expect(requested).toBe('https://api.pwnedpasswords.com/range/5BAA6');
  });

  it('fails open when the service is down, and does nothing when disabled', async () => {
    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    expect(await isPasswordBreached('password', { enabled: true, log, fetcher: down })).toBe(false);
    const never = (async () => {
      throw new Error('should not be called');
    }) as unknown as typeof fetch;
    expect(await isPasswordBreached('password', { enabled: false, log, fetcher: never })).toBe(
      false,
    );
  });
});
