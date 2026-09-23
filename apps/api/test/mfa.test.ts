/**
 * Two-factor authentication: TOTP maths, secret encryption, and the full
 * setup → sign-in challenge → recovery → disable flow.
 */
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/env';
import { decrypt, encrypt } from '../src/lib/encryption';
import { createLogger } from '../src/lib/logger';
import { base32Decode, base32Encode, currentStep, hotp, verifyTotp } from '../src/lib/totp';
import { errorHandler } from '../src/middleware/error-handler';
import { requireMfa } from '../src/middleware/auth';
import { call, postJson, sessionCookieFrom, signedInUser } from './helpers';

const KEY = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';

describe('TOTP (RFC 6238)', () => {
  const rfcSecret = new TextEncoder().encode('12345678901234567890');

  it('matches the RFC test vector', async () => {
    // RFC 6238 Appendix B: T = 59 s → 94287082 (8 digits); 6 digits → 287082
    expect(await hotp(rfcSecret, 1, 8)).toBe('94287082');
    expect(await hotp(rfcSecret, 1)).toBe('287082');
  });

  it('accepts ±1 step for clock drift, rejects further and replays', async () => {
    const now = 1_700_000_000_000;
    const step = currentStep(now);
    expect(await verifyTotp(rfcSecret, await hotp(rfcSecret, step), { nowMs: now })).toBe(step);
    expect(await verifyTotp(rfcSecret, await hotp(rfcSecret, step - 1), { nowMs: now })).toBe(
      step - 1,
    );
    expect(await verifyTotp(rfcSecret, await hotp(rfcSecret, step + 2), { nowMs: now })).toBeNull();
    expect(
      await verifyTotp(rfcSecret, await hotp(rfcSecret, step), { nowMs: now, lastUsedStep: step }),
    ).toBeNull();
    expect(await verifyTotp(rfcSecret, 'abcdef', { nowMs: now })).toBeNull();
  });

  it('round-trips base32', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Encode(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI'); // RFC 4648 vector
  });
});

describe('secret encryption', () => {
  it('round-trips, uses a fresh IV, and detects tampering', async () => {
    const secret = new Uint8Array([1, 2, 3, 4]);
    const a = await encrypt(secret, KEY);
    const b = await encrypt(secret, KEY);
    expect(a).not.toBe(b);
    expect(await decrypt(a, KEY)).toEqual(secret);
    const tampered = a.slice(0, -2) + (a.endsWith('A') ? 'B' : 'A') + a.slice(-1);
    await expect(decrypt(tampered, KEY)).rejects.toThrow();
  });
});

async function codeFor(secretBase32: string, offset = 0) {
  return hotp(base32Decode(secretBase32), currentStep() + offset);
}

/** Signed-in user with 2FA fully enabled. Returns the secret and recovery codes too. */
async function userWithMfa() {
  const user = await signedInUser();
  const setupRes = await postJson('/api/v1/me/mfa/totp/setup', {}, user.cookie);
  const { data: setup } = await setupRes.json<{ data: { secret: string; otpauthUrl: string } }>();
  const enableRes = await postJson(
    '/api/v1/me/mfa/totp/enable',
    { code: await codeFor(setup.secret) },
    user.cookie,
  );
  const { data } = await enableRes.json<{ data: { recoveryCodes: string[] } }>();
  return {
    ...user,
    secret: setup.secret,
    otpauthUrl: setup.otpauthUrl,
    recoveryCodes: data.recoveryCodes,
  };
}

async function passwordStep(user: { email: string; password: string }) {
  const res = await postJson('/api/v1/auth/login', { email: user.email, password: user.password });
  return {
    res,
    body: await res.json<{ data: Record<string, unknown> }>(),
    cookie: sessionCookieFrom(res)!,
  };
}

describe('2FA setup', () => {
  it('enables with a valid code and returns 10 single-use recovery codes', async () => {
    const user = await userWithMfa();
    // The label's colon may be URL-encoded; authenticator apps accept both forms.
    expect(user.otpauthUrl).toMatch(/^otpauth:\/\/totp\/SkillVerse(%3A|:)/);
    expect(user.otpauthUrl).toContain('issuer=SkillVerse');
    expect(user.recoveryCodes).toHaveLength(10);
    expect(new Set(user.recoveryCodes).size).toBe(10);

    const status = await call('/api/v1/me/mfa', { headers: { cookie: user.cookie } });
    expect(await status.json()).toMatchObject({
      data: { enabled: true, recoveryCodesRemaining: 10 },
    });
    // The session that enabled 2FA stays signed in.
    const me = await call('/api/v1/me', { headers: { cookie: user.cookie } });
    expect((await me.json<{ data: { mfaEnabled: boolean } }>()).data.mfaEnabled).toBe(true);
  });

  it('rejects a wrong code during setup', async () => {
    const user = await signedInUser();
    await postJson('/api/v1/me/mfa/totp/setup', {}, user.cookie);
    const res = await postJson('/api/v1/me/mfa/totp/enable', { code: '000000' }, user.cookie);
    expect(res.status).toBe(400);
  });

  it('refuses to start setup again while enabled', async () => {
    const user = await userWithMfa();
    expect((await postJson('/api/v1/me/mfa/totp/setup', {}, user.cookie)).status).toBe(409);
  });
});

describe('2FA sign-in', () => {
  it('password alone gives only a pending session that can do nothing else', async () => {
    const user = await userWithMfa();
    const { res, body, cookie } = await passwordStep(user);
    expect(res.status).toBe(200);
    expect(body.data).toEqual({ mfaRequired: true });
    expect((await call('/api/v1/me', { headers: { cookie } })).status).toBe(401);
    expect((await postJson('/api/v1/me/profile', { headline: 'x' }, cookie, 'PATCH')).status).toBe(
      401,
    );
  });

  it('a correct code completes sign-in and rotates the session token', async () => {
    const user = await userWithMfa();
    const { cookie: pending } = await passwordStep(user);
    const res = await postJson(
      '/api/v1/auth/mfa/verify',
      { code: await codeFor(user.secret, 1) },
      pending,
    );
    expect(res.status).toBe(200);
    const full = sessionCookieFrom(res)!;
    expect(full).not.toBe(pending);
    expect((await call('/api/v1/me', { headers: { cookie: full } })).status).toBe(200);
    // The pending token no longer works for anything.
    const again = await postJson(
      '/api/v1/auth/mfa/verify',
      { code: await codeFor(user.secret, 1) },
      pending,
    );
    expect(again.status).toBe(401);
  });

  it('rejects a code that was already used (replay)', async () => {
    const user = await userWithMfa(); // setup consumed the current step
    const { cookie } = await passwordStep(user);
    const res = await postJson(
      '/api/v1/auth/mfa/verify',
      { code: await codeFor(user.secret, 0) },
      cookie,
    );
    expect(res.status).toBe(400);
  });

  it('accepts each recovery code once', async () => {
    const user = await userWithMfa();
    const code = user.recoveryCodes[0]!;
    const first = await passwordStep(user);
    expect(
      (await postJson('/api/v1/auth/mfa/verify', { code: code.toLowerCase() }, first.cookie))
        .status,
    ).toBe(200);
    const second = await passwordStep(user);
    expect((await postJson('/api/v1/auth/mfa/verify', { code }, second.cookie)).status).toBe(400);
  });

  it('kills the pending session after 5 wrong codes', async () => {
    const user = await userWithMfa();
    const { cookie } = await passwordStep(user);
    for (let i = 0; i < 4; i++) {
      expect((await postJson('/api/v1/auth/mfa/verify', { code: '111111' }, cookie)).status).toBe(
        400,
      );
    }
    expect((await postJson('/api/v1/auth/mfa/verify', { code: '111111' }, cookie)).status).toBe(
      401,
    );
    const late = await postJson(
      '/api/v1/auth/mfa/verify',
      { code: await codeFor(user.secret, 1) },
      cookie,
    );
    expect(late.status).toBe(401);
  });

  it('password reset does not bypass 2FA', async () => {
    const user = await userWithMfa();
    await postJson('/api/v1/auth/forgot-password', { email: user.email });
    const mail = await (
      await call('/api/v1/dev/mailbox')
    ).json<{ data: { to: string; text: string }[] }>();
    const token = mail.data
      .find((m) => m.to === user.email)!
      .text.match(/token=([A-Za-z0-9_-]+)/)![1];
    const res = await postJson('/api/v1/auth/reset-password', {
      token,
      password: 'a completely new passphrase',
    });
    expect((await res.json<{ data: unknown }>()).data).toEqual({ mfaRequired: true });
  });
});

describe('2FA management', () => {
  it('disabling needs the password and a code', async () => {
    const user = await userWithMfa();
    const noPassword = await postJson(
      '/api/v1/me/mfa/disable',
      { code: await codeFor(user.secret, 1) },
      user.cookie,
    );
    expect(noPassword.status).toBe(400);
    const ok = await postJson(
      '/api/v1/me/mfa/disable',
      { password: user.password, code: user.recoveryCodes[1] },
      user.cookie,
    );
    expect(ok.status).toBe(200);
    const { body } = await passwordStep(user);
    expect(body.data).not.toHaveProperty('mfaRequired');
  });

  it('regenerating recovery codes invalidates the old ones', async () => {
    const user = await userWithMfa();
    const res = await postJson(
      '/api/v1/me/mfa/recovery-codes',
      { code: user.recoveryCodes[2] },
      user.cookie,
    );
    expect(res.status).toBe(200);
    const { cookie } = await passwordStep(user);
    expect(
      (await postJson('/api/v1/auth/mfa/verify', { code: user.recoveryCodes[3] }, cookie)).status,
    ).toBe(400);
  });
});

describe('requireMfa', () => {
  function app(mfaEnabled: boolean) {
    const a = new Hono<AppEnv>();
    a.use('*', async (c, next) => {
      c.set('log', createLogger());
      c.set('requestId', 't');
      c.set('auth', {
        user: {
          id: 'u',
          email: 'e',
          username: 'u',
          displayName: 'U',
          emailVerified: true,
          avatarKey: null,
          mfaEnabled,
        },
        roles: ['admin'],
        session: { tokenHash: 'h', handle: 'x', mfaVerified: mfaEnabled },
      });
      await next();
    });
    a.use('*', requireMfa);
    a.get('/', (c) => c.text('ok'));
    a.onError(errorHandler);
    return a;
  }

  it('blocks accounts without 2FA and lets 2FA accounts through', async () => {
    const enforce = { ENFORCE_ADMIN_MFA: 'on' } as unknown as Env;
    const blocked = await app(false).request('/', {}, enforce);
    expect(blocked.status).toBe(403);
    expect((await blocked.json<{ error: { code: string } }>()).error.code).toBe(
      'MFA_SETUP_REQUIRED',
    );
    expect((await app(true).request('/', {}, enforce)).status).toBe(200);
  });

  it('can be relaxed only by an explicit ENFORCE_ADMIN_MFA=off (local development)', async () => {
    const off = { ENFORCE_ADMIN_MFA: 'off' } as unknown as Env;
    expect((await app(false).request('/', {}, off)).status).toBe(200);
    // Missing or unexpected values enforce it.
    expect((await app(false).request('/', {}, {} as Env)).status).toBe(403);
  });
});
