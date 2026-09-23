/**
 * /api/v1/me: profile, sessions and password change.
 */
import { describe, expect, it } from 'vitest';
import { call, postJson, sessionCookieFrom, signedInUser } from './helpers';

async function getJson<T>(path: string, cookie: string): Promise<{ status: number; body: T }> {
  const res = await call(path, { headers: { cookie } });
  return { status: res.status, body: await res.json<T>() };
}

describe('profile', () => {
  it('returns the user without secrets', async () => {
    const user = await signedInUser();
    const { status, body } = await getJson<{ data: Record<string, unknown> }>(
      '/api/v1/me',
      user.cookie,
    );
    expect(status).toBe(200);
    expect(body.data.email).toBe(user.email);
    expect(body.data.roles).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/hash|token/i);
  });

  it('updates profile fields and completes onboarding', async () => {
    const user = await signedInUser();
    const res = await postJson(
      '/api/v1/me/profile',
      {
        displayName: 'Asha Rao',
        headline: 'Aspiring data analyst',
        interests: ['data-science', 'data-science', 'excel'],
        goal: 'career_switch',
        timezone: 'Asia/Kolkata',
        completeOnboarding: true,
      },
      user.cookie,
      'PATCH',
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      data: { displayName: string; profile: { interests: string[]; onboarded: boolean } };
    }>();
    expect(body.data.displayName).toBe('Asha Rao');
    expect(body.data.profile.interests).toEqual(['data-science', 'excel']); // de-duplicated
    expect(body.data.profile.onboarded).toBe(true);
  });

  it('rejects unsafe or invalid values', async () => {
    const user = await signedInUser();
    for (const bad of [
      { websiteUrl: 'javascript:alert(1)' },
      { websiteUrl: 'http://insecure.example' },
      { timezone: 'Mars/Olympus' },
      { displayName: '<script>' },
    ]) {
      const res = await postJson('/api/v1/me/profile', bad, user.cookie, 'PATCH');
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });
});

describe('sessions', () => {
  it('lists devices and revokes the others', async () => {
    const user = await signedInUser();
    const second = sessionCookieFrom(
      await postJson('/api/v1/auth/login', { email: user.email, password: user.password }),
    )!;

    const list = await getJson<{ data: { handle: string; current: boolean }[] }>(
      '/api/v1/me/sessions',
      user.cookie,
    );
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.filter((s) => s.current)).toHaveLength(1);

    await postJson('/api/v1/me/sessions/revoke-others', {}, user.cookie);
    expect((await call('/api/v1/me', { headers: { cookie: second } })).status).toBe(401);
    expect((await call('/api/v1/me', { headers: { cookie: user.cookie } })).status).toBe(200);
  });

  it("cannot revoke another user's session (404, no confirmation it exists)", async () => {
    const alice = await signedInUser();
    const bob = await signedInUser();
    const bobs = await getJson<{ data: { handle: string }[] }>('/api/v1/me/sessions', bob.cookie);
    const handle = bobs.body.data[0]!.handle;

    const res = await postJson(`/api/v1/me/sessions/${handle}`, {}, alice.cookie, 'DELETE');
    expect(res.status).toBe(404);
    expect((await call('/api/v1/me', { headers: { cookie: bob.cookie } })).status).toBe(200);
  });
});

describe('change password', () => {
  it('requires the current password', async () => {
    const user = await signedInUser();
    const res = await postJson(
      '/api/v1/me/password',
      { currentPassword: 'not it at all', newPassword: 'a whole new passphrase' },
      user.cookie,
    );
    expect(res.status).toBe(400);
  });

  it('changes the password and signs out other devices only', async () => {
    const user = await signedInUser();
    const other = sessionCookieFrom(
      await postJson('/api/v1/auth/login', { email: user.email, password: user.password }),
    )!;
    const res = await postJson(
      '/api/v1/me/password',
      { currentPassword: user.password, newPassword: 'a whole new passphrase' },
      user.cookie,
    );
    expect(res.status).toBe(200);
    expect((await call('/api/v1/me', { headers: { cookie: user.cookie } })).status).toBe(200);
    expect((await call('/api/v1/me', { headers: { cookie: other } })).status).toBe(401);
  });
});
