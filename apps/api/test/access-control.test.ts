/**
 * Deny by default: every endpoint in the OpenAPI document that is not on the
 * explicit PUBLIC list must refuse anonymous callers with 401.
 *
 * Adding a new route automatically adds it to this test. If a new route is
 * genuinely public, add it to PUBLIC below and justify it in review.
 */
import { describe, expect, it } from 'vitest';
import { newId } from '@skillverse/shared';
import { call, callAsWebApp } from './helpers';

const PUBLIC = new Set([
  'GET /api/health',
  'GET /api/v1/meta',
  'GET /api/v1/categories',
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/verify-email',
  'POST /api/v1/auth/resend-verification',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  'POST /api/v1/auth/mfa/verify', // needs the pending-2FA session, not a full one
  'GET /api/v1/auth/google/start', // browser navigation into Google sign-in
  'GET /api/v1/auth/google/callback', // Google redirects here; protected by state + signed cookie
  'GET /api/v1/dev/mailbox', // development only; 404 elsewhere
]);

describe('access control', () => {
  it('every non-public endpoint requires sign-in', async () => {
    const doc = await (
      await call('/api/openapi.json')
    ).json<{
      paths: Record<string, Record<string, unknown>>;
    }>();

    const checked: string[] = [];
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const method of Object.keys(methods)) {
        const key = `${method.toUpperCase()} ${path}`;
        if (PUBLIC.has(key)) continue;
        const url = path.replace(/\{[^}]+\}/g, newId());
        const res = await callAsWebApp(url, {
          method: method.toUpperCase(),
          body: method === 'get' ? undefined : '{}',
        });
        expect(res.status, key).toBe(401);
        checked.push(key);
      }
    }
    expect(checked.length).toBeGreaterThan(0);
  });

  it('a forged session cookie is treated as anonymous and cleared', async () => {
    const res = await call('/api/v1/me', { headers: { cookie: `sv_session=${'x'.repeat(43)}` } });
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toContain('sv_session=');
  });
});
