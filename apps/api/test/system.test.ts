/**
 * Tests for the foundation: health, meta, error contract and security headers.
 */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { call } from './helpers';

describe('GET /api/health', () => {
  it('reports the database as up', async () => {
    const res = await call('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json<{ status: string; checks: { database: string } }>();
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('up');
  });
});

describe('GET /api/v1/meta', () => {
  it('returns only fully-rolled-out flags as on', async () => {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO feature_flags (key, enabled, rollout_percent, updated_at) VALUES ('a.on', 1, 100, 0)",
      ),
      env.DB.prepare(
        "INSERT INTO feature_flags (key, enabled, rollout_percent, updated_at) VALUES ('b.partial', 1, 50, 0)",
      ),
      env.DB.prepare(
        "INSERT INTO feature_flags (key, enabled, rollout_percent, updated_at) VALUES ('c.off', 0, 100, 0)",
      ),
    ]);

    const res = await call('/api/v1/meta');
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; data: { features: Record<string, boolean> } }>();
    expect(body.ok).toBe(true);
    expect(body.data.features).toEqual({ 'a.on': true, 'b.partial': false, 'c.off': false });
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
  });
});

describe('error contract', () => {
  it('returns a JSON 404 with a request id for unknown routes', async () => {
    const res = await call('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    const body = await res.json<{ ok: boolean; error: { code: string; requestId: string } }>();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers.get('x-request-id'));
  });

  it('ignores a malformed incoming request id (log-injection guard)', async () => {
    const res = await call('/api/health', { headers: { 'x-request-id': 'forged" level="admin' } });
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('security headers', () => {
  it('are present on success and error responses', async () => {
    for (const path of ['/api/health', '/api/v1/nope']) {
      const res = await call(path);
      expect(res.headers.get('content-security-policy')).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    }
  });

  it('marks API responses as not cacheable by default', async () => {
    const res = await call('/api/health');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('API docs', () => {
  it('serves the OpenAPI document outside production', async () => {
    const res = await call('/api/openapi.json');
    expect(res.status).toBe(200);
    const doc = await res.json<{ paths: Record<string, unknown> }>();
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/api/health', '/api/v1/meta']));
  });
});
