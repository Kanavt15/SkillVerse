/** Durable aggregates, bounded retries and lease contention without real outbound providers. */
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, expect, it, vi } from 'vitest';
import { createDb, schema } from '@skillverse/db';
import { newId, operationalSummarySchema } from '@skillverse/shared';
import { createApp } from '../src/app';
import { createLogger } from '../src/lib/logger';
import {
  recordOperation,
  flushOperationalAlerts,
  clearOperationalSettingsCache,
  operationalSettings,
  runOperationalMaintenance,
  operationScope,
  operationalSummary,
} from '../src/services/operational.service';
import type { AuthContext } from '../src/env';

const db = createDb(env.DB),
  log = createLogger({ test: 'operations' });
const enabled = { ...env, OPERATIONS_TELEMETRY: 'on', OPS_ALERT_WEBHOOK_URL: '' };
const now = Date.now();
const admin = { roles: ['admin'] } as AuthContext;
const observation = { scope: 'auth', status: 503, durationMs: 3000 };
beforeEach(async () => {
  clearOperationalSettingsCache();
  await db.batch([db.delete(schema.operationalMetrics), db.delete(schema.operationalAlerts)]);
});
it('leaves telemetry off without writes and maps sensitive paths to six coarse groups', async () => {
  await recordOperation(db, { ...enabled, OPERATIONS_TELEMETRY: 'off' }, log, observation);
  expect(await db.select().from(schema.operationalMetrics)).toHaveLength(0);
  expect(operationScope('/api/v1/auth/reset-password?token=private')).toBe('auth');
  expect(operationScope('/api/v1/admin/users/private-account/roles')).toBe('staff');
  expect(operationScope('/api/v1/learning/courses/private/lessons/private')).toBe('learning');
});
it('atomically aggregates concurrency, raises each threshold once and returns bounded safe summaries', async () => {
  await db.batch([
    db
      .update(schema.platformSettings)
      .set({ value: '2' })
      .where(eq(schema.platformSettings.key, 'operations.request_threshold')),
    db
      .update(schema.platformSettings)
      .set({ value: '2' })
      .where(eq(schema.platformSettings.key, 'operations.error_threshold')),
    db
      .update(schema.platformSettings)
      .set({ value: '2' })
      .where(eq(schema.platformSettings.key, 'operations.slow_threshold')),
    db
      .update(schema.platformSettings)
      .set({ value: '2' })
      .where(eq(schema.platformSettings.key, 'operations.rate_limit_threshold')),
  ]);
  await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      recordOperation(db, enabled, log, { ...observation, status: i < 3 ? 503 : 429 }, now),
    ),
  );
  const rows = await db.select().from(schema.operationalMetrics);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    scope: 'auth',
    requests: 6,
    errors: 3,
    rateLimited: 3,
    slowRequests: 6,
    durationMs: 18000,
  });
  const alerts = await db.select().from(schema.operationalAlerts);
  expect(alerts).toHaveLength(4);
  expect(alerts.every((row) => row.state === 'not_configured' && row.attempts === 0)).toBe(true);
  const result = operationalSummarySchema.parse(await operationalSummary(db, enabled, admin, 1));
  expect(result).toMatchObject({ requests: 6, errors: 3, rateLimited: 3, averageDurationMs: 3000 });
  expect(result.scopes).toEqual([{ scope: 'auth', requests: 6, errors: 3 }]);
  const raw = JSON.stringify(result);
  for (const key of ['email', 'userId', 'token', 'ipHash', 'password', 'webhook'])
    expect(raw).not.toContain(key);
  await expect(
    operationalSummary(db, enabled, { roles: ['moderator'] } as AuthContext, 1),
  ).rejects.toThrow('Administrator');
});
async function alert(id = newId()) {
  await db.insert(schema.operationalAlerts).values({
    id,
    bucket: Math.floor(now / 300000) * 300000,
    kind: 'server_errors',
    count: 5,
    nextAttemptAt: now,
    updatedAt: new Date(now),
  });
  return id;
}
const withHook = { ...enabled, OPS_ALERT_WEBHOOK_URL: 'https://alerts.example.com/private-hook' };
it('leases each delivery once, sends safe payload/idempotency and never follows redirects', async () => {
  const id = await alert();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  await Promise.all([
    flushOperationalAlerts(db, withHook, log, now, fetcher),
    flushOperationalAlerts(db, withHook, log, now, fetcher),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const options = fetcher.mock.calls[0]![1]!;
  expect(options.redirect).toBe('manual');
  expect(new Headers(options.headers).get('idempotency-key')).toBe(id);
  expect(JSON.parse(String(options.body)).alert).toEqual({
    id,
    environment: 'development',
    kind: 'server_errors',
    count: 5,
    bucket: Math.floor(now / 300000) * 300000,
  });
  expect((await db.select().from(schema.operationalAlerts))[0]).toMatchObject({
    state: 'delivered',
    attempts: 1,
  });
  await flushOperationalAlerts(db, withHook, log, now + 600000, fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('durably retries failed/crashed deliveries up to three attempts, and skips unsafe webhook destinations', async () => {
  await alert();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('secret provider response', { status: 302 }));
  await flushOperationalAlerts(db, withHook, log, now, fetcher);
  await flushOperationalAlerts(db, withHook, log, now + 30000, fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await flushOperationalAlerts(db, withHook, log, now + 60000, fetcher);
  await flushOperationalAlerts(db, withHook, log, now + 180000, fetcher);
  await flushOperationalAlerts(db, withHook, log, now + 900000, fetcher);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect((await db.select().from(schema.operationalAlerts))[0]).toMatchObject({
    state: 'delivery_failed',
    attempts: 3,
  });
  await expect(
    flushOperationalAlerts(
      db,
      { ...withHook, OPS_ALERT_WEBHOOK_URL: 'http://localhost/private' },
      log,
      now,
      fetcher,
    ),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(3);
  await db.delete(schema.operationalAlerts);
  const crashed = await alert();
  await db
    .update(schema.operationalAlerts)
    .set({ state: 'delivering', attempts: 1, nextAttemptAt: now + 60000 })
    .where(eq(schema.operationalAlerts.id, crashed));
  await flushOperationalAlerts(
    db,
    withHook,
    log,
    now + 60000,
    vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
  );
  expect(
    await db
      .select()
      .from(schema.operationalAlerts)
      .where(eq(schema.operationalAlerts.id, crashed))
      .get(),
  ).toMatchObject({ state: 'delivered', attempts: 2 });
});
it('uses validated defaults for malformed settings and removes old observations in bounded maintenance batches', async () => {
  await db
    .update(schema.platformSettings)
    .set({ value: 'bad-json' })
    .where(eq(schema.platformSettings.key, 'operations.error_threshold'));
  expect((await operationalSettings(db))['operations.error_threshold']).toBe(5);
  const old = now - 31 * 86400000;
  await db.batch([
    db.insert(schema.operationalMetrics).values({ bucket: old, scope: 'auth', requests: 1 }),
    db.insert(schema.operationalMetrics).values({ bucket: now, scope: 'other', requests: 1 }),
    db.insert(schema.operationalAlerts).values({
      bucket: old,
      kind: 'server_errors',
      count: 5,
      nextAttemptAt: old,
      updatedAt: new Date(old),
    }),
  ]);
  await runOperationalMaintenance(enabled);
  expect(await db.select().from(schema.operationalMetrics)).toHaveLength(1);
  expect(await db.select().from(schema.operationalAlerts)).toHaveLength(0);
});
it('observes handled HTTP failures in background and excludes health checks', async () => {
  const app = createApp();
  app.get('/api/v1/fixture-error', () => {
    throw new Error('private failure body');
  });
  const tasks: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      tasks.push(promise);
    },
    passThroughOnException() {},
  } as unknown as ExecutionContext;
  expect(
    (await app.fetch(new Request('http://localhost:8787/api/v1/fixture-error'), enabled, ctx))
      .status,
  ).toBe(500);
  await Promise.all(tasks.splice(0));
  expect((await db.select().from(schema.operationalMetrics))[0]).toMatchObject({
    scope: 'other',
    errors: 1,
    requests: 1,
  });
  await app.fetch(new Request('http://localhost:8787/api/health'), enabled, ctx);
  await Promise.all(tasks);
  expect((await db.select().from(schema.operationalMetrics))[0]!.requests).toBe(1);
});
