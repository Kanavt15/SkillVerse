/**
 * Account lifecycle: register → verify → sign in/out → reset/change password.
 * Each security property promised in services/auth.service.ts is checked here.
 */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  call,
  lastEmailTo,
  newUser,
  postJson,
  sessionCookieFrom,
  signedInUser,
  tokenFrom,
} from './helpers';

type Body = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; fields?: Record<string, string[]> };
};

async function me(cookie?: string) {
  return call('/api/v1/me', { headers: cookie ? { cookie } : {} });
}

describe('register', () => {
  it('creates an unverified account and emails a verification link', async () => {
    const user = newUser();
    const res = await postJson('/api/v1/auth/register', user);
    expect(res.status).toBe(202);
    expect(sessionCookieFrom(res)).toBeUndefined(); // not signed in until verified

    const mail = await lastEmailTo(user.email);
    expect(mail?.subject).toContain('Confirm your email');
    const row = await env.DB.prepare(
      'SELECT email_verified_at, password_hash FROM users WHERE email = ?',
    )
      .bind(user.email)
      .first<{ email_verified_at: number | null; password_hash: string }>();
    expect(row?.email_verified_at).toBeNull();
    expect(row?.password_hash).toMatch(/^pbkdf2\$100000\$/);
    expect(row?.password_hash).not.toContain(user.password);
  });

  it('does not reveal that an email is already registered', async () => {
    const user = newUser();
    const first = await postJson('/api/v1/auth/register', user);
    const second = await postJson('/api/v1/auth/register', {
      ...user,
      username: `${user.username}x`,
    });
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    // …but the real owner is told about the attempt.
    expect((await lastEmailTo(user.email))?.subject).toContain('already have an account');
    const count = await env.DB.prepare('SELECT count(*) AS n FROM users WHERE email = ?')
      .bind(user.email)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('reports a taken username', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    const res = await postJson('/api/v1/auth/register', { ...newUser(), username: user.username });
    expect(res.status).toBe(409);
    expect((await res.json<Body>()).error?.fields?.username).toBeDefined();
  });

  it('validates input and rejects unknown fields', async () => {
    const short = await postJson('/api/v1/auth/register', newUser({ password: 'short' }));
    expect(short.status).toBe(400);
    expect((await short.json<Body>()).error?.fields?.password).toBeDefined();

    const extra = await postJson('/api/v1/auth/register', { ...newUser(), role: 'admin' });
    expect(extra.status).toBe(400);
  });
});

describe('verify email', () => {
  it('verifies, signs in, and the link works only once', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    const token = tokenFrom(await lastEmailTo(user.email));

    const res = await postJson('/api/v1/auth/verify-email', { token });
    expect(res.status).toBe(200);
    const cookie = sessionCookieFrom(res);
    expect(cookie).toBeDefined();
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');

    const meRes = await me(cookie);
    const body = await meRes.json<{ data: { emailVerified: boolean } }>();
    expect(body.data.emailVerified).toBe(true);

    const again = await postJson('/api/v1/auth/verify-email', { token });
    expect(again.status).toBe(400);
  });

  it('rejects a made-up token', async () => {
    const res = await postJson('/api/v1/auth/verify-email', { token: 'A'.repeat(43) });
    expect(res.status).toBe(400);
  });
});

describe('login and logout', () => {
  it('signs in with the right password, even before verification', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    const res = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ data: Record<string, unknown> }>();
    expect(body.data.emailVerified).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/password|hash/i);
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    const wrong = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: 'nope-nope-nope',
    });
    const unknown = await postJson('/api/v1/auth/login', {
      email: 'nobody@example.com',
      password: 'nope-nope-nope',
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const a = await wrong.json<Body>();
    const b = await unknown.json<Body>();
    expect(a.error?.code).toBe(b.error?.code);
    expect(a.error?.message).toBe(b.error?.message);
  });

  it('locks password sign-in after 10 failures', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    for (let i = 0; i < 10; i++) {
      await postJson('/api/v1/auth/login', { email: user.email, password: 'wrong-password-1' });
    }
    const res = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    expect(res.status).toBe(429);
  });

  it('logout ends the session on the server', async () => {
    const { cookie } = await signedInUser();
    expect((await me(cookie)).status).toBe(200);
    const out = await postJson('/api/v1/auth/logout', {}, cookie);
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toMatch(
      /sv_session=;|Max-Age=0|expires=Thu, 01 Jan 1970/i,
    );
    expect((await me(cookie)).status).toBe(401); // the old cookie is useless now
  });

  it('refuses suspended accounts', async () => {
    const user = await signedInUser();
    await env.DB.prepare("UPDATE users SET status = 'suspended' WHERE email = ?")
      .bind(user.email)
      .run();
    expect((await me(user.cookie)).status).toBe(401);
    const res = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    expect(res.status).toBe(403);
  });

  it('writes audit log entries', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    await postJson('/api/v1/auth/login', { email: user.email, password: 'wrong-password-1' });
    const rows = await env.DB.prepare(
      'SELECT action FROM audit_logs WHERE target_id = (SELECT id FROM users WHERE email = ?) ORDER BY created_at',
    )
      .bind(user.email)
      .all<{ action: string }>();
    expect(rows.results.map((r) => r.action)).toEqual(['auth.registered', 'auth.login_failed']);
  });
});

describe('password reset', () => {
  it('does not reveal whether an email exists', async () => {
    const res = await postJson('/api/v1/auth/forgot-password', { email: 'ghost@example.com' });
    expect(res.status).toBe(202);
  });

  it('resets the password, signs out other devices, and the link works once', async () => {
    const user = await signedInUser();
    await postJson('/api/v1/auth/forgot-password', { email: user.email });
    const token = tokenFrom(await lastEmailTo(user.email));

    const newPassword = 'a brand new passphrase';
    const res = await postJson('/api/v1/auth/reset-password', { token, password: newPassword });
    expect(res.status).toBe(200);
    expect(sessionCookieFrom(res)).toBeDefined();

    expect((await me(user.cookie)).status).toBe(401); // old device signed out
    const oldLogin = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    expect(oldLogin.status).toBe(401);
    const newLogin = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: newPassword,
    });
    expect(newLogin.status).toBe(200);

    const reuse = await postJson('/api/v1/auth/reset-password', {
      token,
      password: 'yet another passphrase',
    });
    expect(reuse.status).toBe(400);
  });

  it('only the newest reset link works', async () => {
    const user = await signedInUser();
    await postJson('/api/v1/auth/forgot-password', { email: user.email });
    const first = tokenFrom(await lastEmailTo(user.email));
    await postJson('/api/v1/auth/forgot-password', { email: user.email });
    const res = await postJson('/api/v1/auth/reset-password', {
      token: first,
      password: 'another good passphrase',
    });
    expect(res.status).toBe(400);
  });
});
