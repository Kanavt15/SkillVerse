/**
 * Turnstile bot-check middleware, tested with a stub for Cloudflare's verify endpoint.
 */
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/env';
import { createLogger } from '../src/lib/logger';
import { errorHandler } from '../src/middleware/error-handler';
import { requireHuman, TURNSTILE_HEADER } from '../src/middleware/turnstile';

function app(fetcher: typeof fetch) {
  const a = new Hono<AppEnv>();
  a.use('*', async (c, next) => {
    c.set('log', createLogger());
    c.set('requestId', 't');
    await next();
  });
  a.post('/', requireHuman({ fetcher }), (c) => c.text('ok'));
  a.onError(errorHandler);
  return a;
}

const configured = { TURNSTILE_SECRET_KEY: 'secret' } as unknown as Env;
const reply = (body: object) => (async () => Response.json(body)) as unknown as typeof fetch;

describe('requireHuman', () => {
  it('does nothing when Turnstile is not configured', async () => {
    const res = await app(reply({ success: false })).request('/', { method: 'POST' }, {} as Env);
    expect(res.status).toBe(200);
  });

  it('rejects a missing token', async () => {
    const res = await app(reply({ success: true })).request('/', { method: 'POST' }, configured);
    expect(res.status).toBe(400);
    const body = await res.json<{ error: { fields: Record<string, string[]> } }>();
    expect(body.error.fields.turnstile).toBeDefined();
  });

  it('rejects a token Cloudflare says is invalid', async () => {
    const res = await app(
      reply({ success: false, 'error-codes': ['invalid-input-response'] }),
    ).request('/', { method: 'POST', headers: { [TURNSTILE_HEADER]: 'bad' } }, configured);
    expect(res.status).toBe(400);
  });

  it('passes a valid token and sends secret, token and client IP to Cloudflare', async () => {
    let sent = '';
    const fetcher = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      return Response.json({ success: true });
    }) as unknown as typeof fetch;
    const res = await app(fetcher).request(
      '/',
      {
        method: 'POST',
        headers: { [TURNSTILE_HEADER]: 'good', 'cf-connecting-ip': '198.51.100.7' },
      },
      configured,
    );
    expect(res.status).toBe(200);
    expect(sent).toContain('secret=secret');
    expect(sent).toContain('response=good');
    expect(sent).toContain('remoteip=198.51.100.7');
  });

  it('fails open when Cloudflare cannot be reached', async () => {
    const down = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const res = await app(down).request(
      '/',
      { method: 'POST', headers: { [TURNSTILE_HEADER]: 'x' } },
      configured,
    );
    expect(res.status).toBe(200);
  });
});
