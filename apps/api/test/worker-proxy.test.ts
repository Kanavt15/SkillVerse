/** The real Worker app accepts visitor IPs only behind the authenticated Vercel proxy. */
import { env } from 'cloudflare:workers';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
describe('Cloudflare Vercel transport', () => {
  it('keeps health public, rejects forged transport, uses the trusted visitor IP and closes unconfigured launch', async () => {
    const observed: string[] = [],
      key = 'private-fixture-proxy-key-0123456789abcdef';
    const bindings = {
      ...env,
      ENVIRONMENT: 'production',
      PUBLIC_LAUNCH_READY: 'off',
      WEB_PROXY_MODE: 'vercel',
      WEB_PROXY_KEY: key,
      OPERATIONS_TELEMETRY: 'off',
      RL_API: {
        limit: async ({ key }: { key: string }) => {
          observed.push(key);
          return { success: true };
        },
      },
    };
    const app = createApp(),
      context = createExecutionContext();
    const call = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
      app.fetch(
        new Request(`https://worker.test${path}`, {
          method,
          headers: { 'cf-connecting-ip': '203.0.113.9', ...headers },
          body: method === 'GET' ? undefined : '{}',
        }),
        bindings,
        context,
      );
    expect((await call('/api/health')).status).toBe(200);
    expect((await call('/api/v1/meta', { 'x-sv-client-ip': '198.51.100.5' })).status).toBe(403);
    const trusted = { 'x-sv-proxy-key': key, 'x-sv-client-ip': '198.51.100.5' };
    const response = await call('/api/v1/meta', trusted);
    expect(response.status).toBe(200);
    expect((await response.json<{ data: { launchReady: boolean } }>()).data.launchReady).toBe(
      false,
    );
    expect(observed).toContain('api:198.51.100.5');
    expect(observed).not.toContain('api:203.0.113.9');
    expect((await call('/api/v1/meta', { ...trusted, 'x-sv-client-ip': 'forged' })).status).toBe(
      400,
    );
    expect((await call('/api/v1/auth/register', trusted, 'POST')).status).toBe(503);
    await waitOnExecutionContext(context);
  });
});
