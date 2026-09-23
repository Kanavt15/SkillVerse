/**
 * Rate-limit middleware, tested with a stub limiter so the test is deterministic.
 */
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/env';
import { createLogger } from '../src/lib/logger';
import { errorHandler } from '../src/middleware/error-handler';
import { rateLimit } from '../src/middleware/rate-limit';

function appWithLimiter(allow: boolean) {
  const seenKeys: string[] = [];
  const stub = {
    limit: async ({ key }: { key: string }) => {
      seenKeys.push(key);
      return { success: allow };
    },
  };
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('log', createLogger());
    c.set('requestId', 'test');
    await next();
  });
  app.use('*', rateLimit('RL_AUTH', 'auth'));
  app.get('/', (c) => c.text('ok'));
  app.onError(errorHandler);
  const env = { RL_AUTH: stub } as unknown as Env;
  return { app, env, seenKeys };
}

describe('rateLimit', () => {
  it('lets requests through while under the limit, keyed by scope and IP', async () => {
    const { app, env, seenKeys } = appWithLimiter(true);
    const res = await app.request('/', { headers: { 'cf-connecting-ip': '203.0.113.9' } }, env);
    expect(res.status).toBe(200);
    expect(seenKeys).toEqual(['auth:203.0.113.9']);
  });

  it('returns 429 with Retry-After when the limit is hit', async () => {
    const { app, env } = appWithLimiter(false);
    const res = await app.request('/', {}, env);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});
