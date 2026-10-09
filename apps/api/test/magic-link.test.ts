/** Email first-factor expiry, replay, purpose isolation, account privacy and mailbox cooldown. */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/crypto';
import {
  call,
  lastEmailTo,
  newUser,
  postJson,
  sessionCookieFrom,
  signedInUser,
  tokenFrom,
} from './helpers';

const requestLink = (email: string, redirectTo?: string) =>
  postJson('/api/v1/auth/magic-link', { email, ...(redirectTo ? { redirectTo } : {}) });
const redeem = (token: string) => postJson('/api/v1/auth/magic-link/redeem', { token });

describe('email-link sign-in', () => {
  it('returns the same response for active, unknown and inactive accounts', async () => {
    const user = await signedInUser();
    const active = await requestLink(user.email);
    const unknown = await requestLink('missing-magic@example.com');
    await env.DB.prepare("UPDATE users SET status = 'suspended' WHERE email = ?")
      .bind(user.email)
      .run();
    const inactive = await requestLink(user.email);
    expect([active.status, unknown.status, inactive.status]).toEqual([202, 202, 202]);
    const body = await active.json();
    expect(await unknown.json()).toEqual(body);
    expect(await inactive.json()).toEqual(body);
    expect(sessionCookieFrom(active)).toBeUndefined();
    expect(await lastEmailTo('missing-magic@example.com')).toBeUndefined();
  });

  it('stores only a hash, verifies mailbox ownership and preserves the password', async () => {
    const user = await signedInUser();
    await requestLink(user.email, '/courses/build-your-first-web-page');
    const mail = await lastEmailTo(user.email),
      token = tokenFrom(mail);
    expect(mail?.text).toContain('expires in 15 minutes');
    expect(mail?.text).toContain('redirectTo=%2Fcourses%2Fbuild-your-first-web-page');
    const row = await env.DB.prepare(
      "SELECT id, expires_at, created_at FROM email_tokens WHERE purpose = 'magic_link' AND user_id = (SELECT id FROM users WHERE email = ?)",
    )
      .bind(user.email)
      .first<{ id: string; expires_at: number; created_at: number }>();
    expect(row?.id).toBe(await sha256Hex(token));
    expect(row?.id).not.toBe(token);
    expect(row!.expires_at - row!.created_at).toBe(15 * 60_000);
    const res = await redeem(token);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { email: user.email, emailVerified: true } });
    expect(
      (await call('/api/v1/me', { headers: { cookie: sessionCookieFrom(res)! } })).status,
    ).toBe(200);
    expect(
      (await postJson('/api/v1/auth/login', { email: user.email, password: user.password })).status,
    ).toBe(200);
    expect((await redeem(token)).status).toBe(400);
    const audit = await env.DB.prepare(
      "SELECT metadata FROM audit_logs WHERE action = 'auth.magic_link_login' AND target_id = (SELECT id FROM users WHERE email = ?)",
    )
      .bind(user.email)
      .first<{ metadata: string }>();
    expect(audit).toBeTruthy();
    expect(audit?.metadata).not.toContain(token);
  });

  it('has only one winner when a sign-in link is redeemed concurrently', async () => {
    const user = await signedInUser();
    await requestLink(user.email);
    const token = tokenFrom(await lastEmailTo(user.email));
    const results = await Promise.all([redeem(token), redeem(token)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it('reclaims an unverified account by removing the prior password and sessions', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    const old = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    await requestLink(user.email);
    const result = await redeem(tokenFrom(await lastEmailTo(user.email)));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ data: { emailVerified: true } });
    expect(
      (await call('/api/v1/me', { headers: { cookie: sessionCookieFrom(old)! } })).status,
    ).toBe(401);
    expect(
      (await postJson('/api/v1/auth/login', { email: user.email, password: user.password })).status,
    ).toBe(401);
    const row = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?')
      .bind(user.email)
      .first<{ password_hash: string | null }>();
    expect(row?.password_hash).toBeNull();
  });

  it('serializes the sending cooldown and leaves the winning link usable', async () => {
    const user = await signedInUser();
    const results = await Promise.all([
      requestLink(user.email),
      requestLink(user.email),
      requestLink(user.email),
    ]);
    expect(results.map((r) => r.status)).toEqual([202, 202, 202]);
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM email_tokens WHERE purpose = 'magic_link' AND user_id = (SELECT id FROM users WHERE email = ?)",
    )
      .bind(user.email)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
    const token = tokenFrom(await lastEmailTo(user.email));
    expect((await redeem(token)).status).toBe(200);
    await requestLink(user.email);
    expect(tokenFrom(await lastEmailTo(user.email))).toBe(token);
  });

  it('invalidates an older unused link after the sending cooldown', async () => {
    const user = await signedInUser();
    await requestLink(user.email);
    const old = tokenFrom(await lastEmailTo(user.email));
    await env.DB.prepare('UPDATE email_tokens SET created_at = created_at - 61000 WHERE id = ?')
      .bind(await sha256Hex(old))
      .run();
    await requestLink(user.email);
    const newest = tokenFrom(await lastEmailTo(user.email));
    expect(newest).not.toBe(old);
    expect((await redeem(old)).status).toBe(400);
    expect((await redeem(newest)).status).toBe(200);
  });

  it('rejects expired links and accounts suspended after issuance', async () => {
    const user = await signedInUser();
    await requestLink(user.email);
    const token = tokenFrom(await lastEmailTo(user.email));
    await env.DB.prepare('UPDATE email_tokens SET expires_at = 1 WHERE id = ?')
      .bind(await sha256Hex(token))
      .run();
    expect((await redeem(token)).status).toBe(400);
    await env.DB.prepare('UPDATE email_tokens SET created_at = 1 WHERE id = ?')
      .bind(await sha256Hex(token))
      .run();
    await requestLink(user.email);
    const current = tokenFrom(await lastEmailTo(user.email));
    await env.DB.prepare("UPDATE users SET status = 'suspended' WHERE email = ?")
      .bind(user.email)
      .run();
    const res = await redeem(current);
    expect(res.status).toBe(403);
    expect(sessionCookieFrom(res)).toBeUndefined();
  });

  it('never accepts verification/reset tokens and cannot reset a password with a sign-in token', async () => {
    const user = newUser();
    await postJson('/api/v1/auth/register', user);
    const verify = tokenFrom(await lastEmailTo(user.email));
    expect((await redeem(verify)).status).toBe(400);
    expect((await postJson('/api/v1/auth/verify-email', { token: verify })).status).toBe(200);
    await postJson('/api/v1/auth/forgot-password', { email: user.email });
    const reset = tokenFrom(await lastEmailTo(user.email));
    expect((await redeem(reset)).status).toBe(400);
    await requestLink(user.email);
    const magic = tokenFrom(await lastEmailTo(user.email));
    expect(
      (
        await postJson('/api/v1/auth/reset-password', {
          token: magic,
          password: 'another safe passphrase',
        })
      ).status,
    ).toBe(400);
    expect((await redeem(magic)).status).toBe(200);
  });

  it('sanitizes redirects, rejects unknown fields and requires CSRF on redemption', async () => {
    const user = await signedInUser();
    await requestLink(user.email, 'https://evil.example/phish');
    expect((await lastEmailTo(user.email))?.text).toContain('redirectTo=%2Fdashboard');
    expect(
      (await postJson('/api/v1/auth/magic-link', { email: user.email, role: 'admin' })).status,
    ).toBe(400);
    const token = tokenFrom(await lastEmailTo(user.email));
    expect(
      (
        await call('/api/v1/auth/magic-link/redeem', {
          method: 'POST',
          body: JSON.stringify({ token }),
          headers: { 'content-type': 'application/json' },
        })
      ).status,
    ).toBe(403);
    expect((await redeem(token)).status).toBe(200);
  });
});
