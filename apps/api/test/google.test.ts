/**
 * "Continue with Google": ID token validation, the start/callback redirects
 * (state + signed cookie), and the account find/link/create rules.
 * Google itself is never called: the token exchange uses a stub fetcher.
 */
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@skillverse/db';
import { AppError } from '../src/lib/errors';
import type { RequestDeps } from '../src/lib/deps';
import { createLogger } from '../src/lib/logger';
import { clearFeatureCache } from '../src/services/feature-flags.service';
import {
  exchangeGoogleCode,
  signInWithGoogle,
  validateIdTokenClaims,
  type OAuthState,
} from '../src/services/google-auth.service';
import { call, newUser, postJson, signedInUser } from './helpers';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const now = Math.floor(Date.now() / 1000);

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: now + 300,
    nonce: 'n-1',
    email_verified: true,
    sub: 'google-sub-1',
    email: 'Someone@Example.com',
    name: 'Some One',
    ...overrides,
  };
}

function deps(): RequestDeps {
  return {
    db: createDb(env.DB),
    env,
    log: createLogger(),
    requestId: 'test',
    ip: '203.0.113.5',
    userAgent: 'vitest',
    waitUntil: () => {},
  };
}

async function enableGoogleFlag(enabled: boolean) {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO feature_flags (key, enabled, rollout_percent, updated_at) VALUES ('auth.google', ?, 100, 0)",
  )
    .bind(enabled ? 1 : 0)
    .run();
  clearFeatureCache();
}

describe('validateIdTokenClaims', () => {
  const expected = { clientId: CLIENT_ID, nonce: 'n-1' };

  it('accepts a valid token and normalises the email', () => {
    expect(validateIdTokenClaims(claims(), expected)).toEqual({
      sub: 'google-sub-1',
      email: 'someone@example.com',
      name: 'Some One',
    });
  });

  it.each([
    ['wrong issuer', { iss: 'https://evil.example' }],
    ['wrong audience', { aud: 'someone-else' }],
    ['expired', { exp: now - 10 }],
    ['wrong nonce (replayed token)', { nonce: 'other' }],
    ['unverified email', { email_verified: false }],
    ['missing sub', { sub: '' }],
  ])('rejects %s', (_, override) => {
    expect(() => validateIdTokenClaims(claims(override), expected)).toThrow();
  });
});

describe('code exchange', () => {
  const state: OAuthState = {
    state: 's',
    verifier: 'v',
    nonce: 'n-1',
    redirectTo: '/dashboard',
    exp: 0,
  };
  const jwt = (payload: object) =>
    `h.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`;

  it('sends the PKCE verifier and validates the returned ID token', async () => {
    let sentBody = '';
    const fetcher = (async (_url: string, init: RequestInit) => {
      sentBody = String(init.body);
      return Response.json({ id_token: jwt(claims()) });
    }) as unknown as typeof fetch;
    const result = await exchangeGoogleCode(env, 'the-code', state, fetcher);
    expect(result.sub).toBe('google-sub-1');
    expect(sentBody).toContain('code_verifier=v');
    expect(sentBody).toContain('grant_type=authorization_code');
  });

  it('rejects a token whose nonce does not match this sign-in', async () => {
    const fetcher = (async () =>
      Response.json({ id_token: jwt(claims({ nonce: 'x' })) })) as unknown as typeof fetch;
    await expect(exchangeGoogleCode(env, 'c', state, fetcher)).rejects.toThrow('bad nonce');
  });
});

describe('start and callback redirects', () => {
  beforeEach(() => enableGoogleFlag(true));

  it('is off unless the auth.google flag is on', async () => {
    await enableGoogleFlag(false);
    const res = await call('/api/v1/auth/google/start', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login?error=google_unavailable');
  });

  it('redirects to Google with state, nonce and a PKCE challenge, and sets a signed cookie', async () => {
    const res = await call('/api/v1/auth/google/start?redirectTo=/settings', {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get('location')!);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/api/v1/auth/google/callback',
    );
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/sv_oauth=[^;]+\.[^;]+/); // payload.signature
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth/google');
  });

  it('refuses a callback without the state cookie (CSRF)', async () => {
    const res = await call('/api/v1/auth/google/callback?code=x&state=y', { redirect: 'manual' });
    expect(res.headers.get('location')).toBe('/login?error=google_failed');
  });

  it('refuses a callback whose state does not match the cookie', async () => {
    const start = await call('/api/v1/auth/google/start', { redirect: 'manual' });
    const cookie = (start.headers.get('set-cookie') ?? '').split(';')[0]!;
    const res = await call('/api/v1/auth/google/callback?code=x&state=forged', {
      redirect: 'manual',
      headers: { cookie },
    });
    expect(res.headers.get('location')).toBe('/login?error=google_failed');
  });

  it('refuses a tampered state cookie', async () => {
    const start = await call('/api/v1/auth/google/start', { redirect: 'manual' });
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const cookie = (start.headers.get('set-cookie') ?? '').split(';')[0]!;
    const tampered = cookie.replace(/\.[^.]+$/, '.AAAA');
    const res = await call(`/api/v1/auth/google/callback?code=x&state=${state}`, {
      redirect: 'manual',
      headers: { cookie: tampered },
    });
    expect(res.headers.get('location')).toBe('/login?error=google_failed');
  });

  it('reports a cancelled consent screen', async () => {
    const res = await call('/api/v1/auth/google/callback?error=access_denied', {
      redirect: 'manual',
    });
    expect(res.headers.get('location')).toBe('/login?error=google_cancelled');
  });

  it('is reported in /meta', async () => {
    const body = await (
      await call('/api/v1/meta')
    ).json<{ data: { authProviders: { google: boolean } } }>();
    expect(body.data.authProviders.google).toBe(true);
  });
});

describe('account linking', () => {
  it('creates a verified, password-less account for a new Google user', async () => {
    const email = `new_${Date.now()}@gmail.com`;
    const { session, onboarded } = await signInWithGoogle(deps(), {
      sub: `sub-${email}`,
      email,
      name: 'New Person',
    });
    expect(session.mfaRequired).toBe(false);
    expect(onboarded).toBe(false);
    const row = await env.DB.prepare(
      'SELECT email_verified_at, password_hash, username FROM users WHERE email = ?',
    )
      .bind(email)
      .first<{
        email_verified_at: number | null;
        password_hash: string | null;
        username: string;
      }>();
    expect(row?.email_verified_at).not.toBeNull();
    expect(row?.password_hash).toBeNull();
    expect(row?.username).toMatch(/^[a-z0-9_]{3,30}$/);
  });

  it('links to an existing verified account and keeps its password', async () => {
    const user = await signedInUser();
    await signInWithGoogle(deps(), { sub: `sub-${user.email}`, email: user.email });
    const login = await postJson('/api/v1/auth/login', {
      email: user.email,
      password: user.password,
    });
    expect(login.status).toBe(200);
  });

  it('keeps finding the account by Google id even if the Google email changes', async () => {
    const email = `mover_${Date.now()}@gmail.com`;
    const sub = `sub-${email}`;
    await signInWithGoogle(deps(), { sub, email });
    await signInWithGoogle(deps(), { sub, email: `changed_${email}` });
    const count = await env.DB.prepare('SELECT count(*) AS n FROM users WHERE email LIKE ?')
      .bind(`%${email}`)
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('defends against pre-hijacking of an unverified account', async () => {
    // An "attacker" registers the victim's email with their own password but never verifies it…
    const attacker = newUser();
    await postJson('/api/v1/auth/register', attacker);
    const attackerLogin = await postJson('/api/v1/auth/login', {
      email: attacker.email,
      password: attacker.password,
    });
    const attackerCookie = (attackerLogin.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect((await call('/api/v1/me', { headers: { cookie: attackerCookie } })).status).toBe(200);

    // …then the real owner signs in with Google.
    await signInWithGoogle(deps(), { sub: `sub-${attacker.email}`, email: attacker.email });

    expect((await call('/api/v1/me', { headers: { cookie: attackerCookie } })).status).toBe(401);
    const retry = await postJson('/api/v1/auth/login', {
      email: attacker.email,
      password: attacker.password,
    });
    expect(retry.status).toBe(401); // the attacker's password was removed
  });

  it('refuses suspended accounts', async () => {
    const user = await signedInUser();
    await env.DB.prepare("UPDATE users SET status = 'suspended' WHERE email = ?")
      .bind(user.email)
      .run();
    await expect(
      signInWithGoogle(deps(), { sub: `sub-${user.email}`, email: user.email }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
