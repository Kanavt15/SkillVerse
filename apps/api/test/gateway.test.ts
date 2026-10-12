/** Actual D1 operations through the Render adapter and protected Worker gateway. */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { newId } from '@skillverse/shared';
import gateway from '../gateway/worker';
// The Node adapter contains portable Web API code; the HTTP server itself stays in Node.
// @ts-expect-error JavaScript adapter is verified at its real HTTP boundary below.
import { gatewayClient } from '../node/bindings.mjs';

const key = 'gateway-test-key-0123456789abcdef0123456789';
const bindings = { DB: env.DB, RL_API: env.RL_API, RL_AUTH: env.RL_AUTH, GATEWAY_KEY: key };
const request = (path: string, body: unknown, token = key) =>
  gateway.fetch(
    new Request(`https://gateway.test${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    bindings,
  );
const adapter = () =>
  gatewayClient({
    url: 'https://gateway.test',
    key,
    fetcher: (url: URL, init: RequestInit) => gateway.fetch(new Request(url, init), bindings),
  });

describe('protected data gateway', () => {
  it('requires the shared secret and rejects unsupported statements and routes', async () => {
    expect((await request('/query', {}, '')).status).toBe(401);
    expect((await request('/query', {}, 'wrong-key')).status).toBe(401);
    expect((await request('/query', { mode: 'batch', statements: [] })).status).toBe(400);
    expect(
      (
        await request('/query', {
          mode: 'batch',
          statements: [{ sql: 'select 1', params: [], extra: true }],
        })
      ).status,
    ).toBe(400);
    expect((await request('/limit', { binding: 'SECRET_BINDING', key: 'test' })).status).toBe(400);
    expect((await request('/missing', {})).status).toBe(404);
  });
  it('preserves column order and duplicate names through raw results and null through first()', async () => {
    const { DB } = adapter();
    expect(await DB.prepare('SELECT ? AS name, ? AS name').bind('first', 'second').raw()).toEqual([
      ['first', 'second'],
    ]);
    expect(await DB.prepare('SELECT ? AS name').bind('value').raw({ columnNames: true })).toEqual([
      ['name'],
      ['value'],
    ]);
    expect(await DB.prepare('SELECT ? AS name').bind('value').first('name')).toBe('value');
    expect(await DB.prepare('SELECT 1 WHERE 0').first()).toBeNull();
  });
  it('commits a full batch and rolls back every statement on failure without automatic retries', async () => {
    const { DB } = adapter(),
      id = newId();
    await DB.batch([
      DB.prepare('INSERT INTO tags (id, slug, name, created_at) VALUES (?, ?, ?, ?)').bind(
        id,
        `gateway-${id}`,
        'Gateway test',
        Date.now(),
      ),
      DB.prepare('SELECT id FROM tags WHERE id = ?').bind(id),
    ]);
    expect(await DB.prepare('SELECT id FROM tags WHERE id = ?').bind(id).first('id')).toBe(id);
    const rolledBack = newId();
    await expect(
      DB.batch([
        DB.prepare('INSERT INTO tags (id, slug, name, created_at) VALUES (?, ?, ?, ?)').bind(
          rolledBack,
          `gateway-${rolledBack}`,
          'Rollback test',
          Date.now(),
        ),
        DB.prepare('INSERT INTO missing_table VALUES (1)').bind(),
      ]),
    ).rejects.toThrow('D1 gateway failed');
    expect(
      await DB.prepare('SELECT id FROM tags WHERE id = ?').bind(rolledBack).first(),
    ).toBeNull();
    expect(
      (
        await request('/query', {
          mode: 'all',
          statements: [{ sql: 'SELECT private_key FROM missing_table', params: [] }],
        })
      ).status,
    ).toBe(500);
  });
  it('uses the bound Cloudflare auth limiter and provides persistent-notification fallback', async () => {
    const client = adapter(),
      uniqueKey = newId();
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await client.RL_AUTH.limit({ key: uniqueKey }));
    expect(results.some((r) => !r.success)).toBe(true);
    expect(
      (await client.NOTIFICATIONS.getByName('user').fetch('https://notifications.internal/connect'))
        .status,
    ).toBe(426);
    expect(
      (await client.NOTIFICATIONS.getByName('user').fetch('https://notifications.internal/publish'))
        .status,
    ).toBe(204);
  });
});
