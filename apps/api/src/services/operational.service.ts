import { runPrivacyMaintenance } from './privacy-maintenance.service';
/** Aggregate operational observations and bounded, durable alert delivery. Never store request data. */
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { schema, createDb, type Db } from '@skillverse/db';
import { newId, OPERATION_SETTING_RULES, type OperationSettingKey } from '@skillverse/shared';
import { createLogger, type Logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import type { AuthContext } from '../env';

const {
  operationalMetrics: metrics,
  operationalAlerts: alerts,
  platformSettings,
  sessions,
} = schema;
export const OPERATION_BUCKET_MS = 300000;
type Settings = Record<OperationSettingKey, number>;
let cached: { settings: Settings; until: number } | null = null;
export function clearOperationalSettingsCache() {
  cached = null;
}
export async function operationalSettings(db: Db, now = Date.now()): Promise<Settings> {
  if (cached && cached.until > now) return cached.settings;
  const rows = await db
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings)
    .where(inArray(platformSettings.key, Object.keys(OPERATION_SETTING_RULES)));
  const settings = Object.fromEntries(
    Object.entries(OPERATION_SETTING_RULES).map(([key, rule]) => {
      let value: unknown = rule.default;
      try {
        value = JSON.parse(rows.find((row) => row.key === key)?.value ?? String(rule.default));
      } catch {
        /* Use validated defaults when offline admin data is malformed. */
      }
      return [
        key,
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= rule.min &&
        value <= rule.max
          ? value
          : rule.default,
      ];
    }),
  ) as Settings;
  cached = { settings, until: now + 60000 };
  return settings;
}
export function operationScope(path: string): string {
  if (path.startsWith('/api/v1/auth/')) return 'auth';
  if (path.startsWith('/api/v1/admin/')) return 'staff';
  if (path.startsWith('/api/v1/studio/') || path.includes('instructor-application'))
    return 'teaching';
  if (path.startsWith('/api/v1/learning/') || path.includes('/lessons/')) return 'learning';
  if (
    path.startsWith('/api/v1/courses') ||
    path === '/api/v1/meta' ||
    path === '/api/v1/categories'
  )
    return 'public';
  return 'other';
}

export async function recordOperation(
  db: Db,
  env: Env,
  log: Logger,
  observation: { scope: string; status: number; durationMs: number },
  now = Date.now(),
) {
  if (env.OPERATIONS_TELEMETRY !== 'on') return;
  const settings = await operationalSettings(db, now),
    bucket = Math.floor(now / OPERATION_BUCKET_MS) * OPERATION_BUCKET_MS;
  const duration = Math.max(0, Math.min(60000, Math.round(observation.durationMs)));
  const values = {
    bucket,
    scope: observation.scope,
    requests: 1,
    errors: observation.status >= 500 ? 1 : 0,
    rateLimited: observation.status === 429 ? 1 : 0,
    slowRequests: duration >= settings['operations.slow_ms'] ? 1 : 0,
    durationMs: duration,
  };
  await db
    .insert(metrics)
    .values(values)
    .onConflictDoUpdate({
      target: [metrics.bucket, metrics.scope],
      set: {
        requests: sql`${metrics.requests} + 1`,
        errors: sql`${metrics.errors} + ${values.errors}`,
        rateLimited: sql`${metrics.rateLimited} + ${values.rateLimited}`,
        slowRequests: sql`${metrics.slowRequests} + ${values.slowRequests}`,
        durationMs: sql`${metrics.durationMs} + ${duration}`,
      },
    });
  const kinds = [
    ['request_volume', metrics.requests, settings['operations.request_threshold']],
    ['server_errors', metrics.errors, settings['operations.error_threshold']],
    ['slow_requests', metrics.slowRequests, settings['operations.slow_threshold']],
    ['rate_limit_spike', metrics.rateLimited, settings['operations.rate_limit_threshold']],
  ] as const;
  const inserts = kinds.map(([kind, count, threshold]) =>
    db
      .insert(alerts)
      .select(
        sql`SELECT ${newId()}, ${bucket}, ${kind}, sum(${count}), ${env.OPS_ALERT_WEBHOOK_URL ? 'pending' : 'not_configured'}, 0, ${now}, ${now} FROM ${metrics} WHERE bucket = ${bucket} HAVING sum(${count}) >= ${threshold}`,
      )
      .onConflictDoNothing({ target: [alerts.bucket, alerts.kind] }),
  );
  await db.batch([inserts[0]!, ...inserts.slice(1)]);
  await flushOperationalAlerts(db, env, log, now);
}

function webhookUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.hostname === 'localhost' ||
    /(?:\.local|\.internal|\.localhost)$/.test(url.hostname) ||
    /^[\d.]+$/.test(url.hostname) ||
    url.hostname.includes(':')
  )
    throw new Error('Invalid operational webhook configuration.');
  return url;
}

/** One lease per alert, three delivery attempts, with retries after a failed/crashed sender. */
export async function flushOperationalAlerts(
  db: Db,
  env: Env,
  log: Logger,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
) {
  if (env.OPERATIONS_TELEMETRY !== 'on' || !env.OPS_ALERT_WEBHOOK_URL) return;
  const url = webhookUrl(env.OPS_ALERT_WEBHOOK_URL);
  const due = await db
    .select()
    .from(alerts)
    .where(
      and(
        sql`${alerts.state} <> 'delivered'`,
        lte(alerts.nextAttemptAt, now),
        sql`${alerts.attempts} < 3`,
      ),
    )
    .orderBy(alerts.nextAttemptAt, alerts.id)
    .limit(3);
  for (const alert of due) {
    const lease = new Date(now);
    const claimed = await db
      .update(alerts)
      .set({
        state: 'delivering',
        attempts: sql`${alerts.attempts} + 1`,
        nextAttemptAt: now + 60000,
        updatedAt: lease,
      })
      .where(
        and(
          eq(alerts.id, alert.id),
          eq(alerts.attempts, alert.attempts),
          sql`${alerts.state} <> 'delivered'`,
          lte(alerts.nextAttemptAt, now),
        ),
      )
      .returning({ id: alerts.id });
    if (!claimed.length) continue;
    const text = `SkillVerse ${env.ENVIRONMENT}: ${alert.kind} reached ${alert.count} in the 5-minute window starting ${new Date(alert.bucket).toISOString()}. Alert ${alert.id}.`;
    let delivered = false;
    try {
      const response = await fetcher(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': alert.id },
        body: JSON.stringify({
          text,
          alert: {
            id: alert.id,
            environment: env.ENVIRONMENT,
            kind: alert.kind,
            count: alert.count,
            bucket: alert.bucket,
          },
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      delivered = response.ok;
      await response.body?.cancel();
    } catch {
      /* Do not log the secret webhook URL or provider body. */
    }
    await db
      .update(alerts)
      .set({
        state: delivered ? 'delivered' : 'delivery_failed',
        nextAttemptAt: now + (alert.attempts + 1) * 60000,
        updatedAt: new Date(now),
      })
      .where(
        and(
          eq(alerts.id, alert.id),
          eq(alerts.attempts, alert.attempts + 1),
          eq(alerts.state, 'delivering'),
        ),
      );
    if (!delivered)
      log.warn('operations.alert_delivery_failed', { alertId: alert.id, kind: alert.kind });
  }
}

export async function runOperationalMaintenance(env: Env) {
  await runPrivacyMaintenance(env);
  if (env.OPERATIONS_TELEMETRY !== 'on') return;
  const db = createDb(env.DB),
    log = createLogger({ source: 'operations-maintenance' }),
    now = Date.now();
  try {
    const settings = await operationalSettings(db, now),
      cutoff = now - settings['operations.retention_days'] * 86400000;
    await db.batch([
      db
        .delete(metrics)
        .where(
          sql`(${metrics.bucket}, ${metrics.scope}) IN (SELECT bucket, scope FROM ${metrics} WHERE bucket < ${cutoff} LIMIT 500)`,
        ),
      db
        .delete(alerts)
        .where(sql`${alerts.id} IN (SELECT id FROM ${alerts} WHERE bucket < ${cutoff} LIMIT 500)`),
      db
        .update(sessions)
        .set({ stepUpNonce: null, stepUpAt: null })
        .where(
          sql`${sessions.id} IN (SELECT id FROM ${sessions} WHERE step_up_at < ${now - 60000} LIMIT 500)`,
        ),
    ]);
    await flushOperationalAlerts(db, env, log, now);
  } catch {
    log.error('operations.maintenance_failed');
  }
}

export async function operationalSummary(db: Db, env: Env, auth: AuthContext, hours: number) {
  if (!auth.roles.some((role) => role === 'admin' || role === 'super_admin'))
    throw new AppError('FORBIDDEN', 'Administrator access required.');
  const now = Date.now(),
    cutoff = Math.floor((now - hours * 3600000) / OPERATION_BUCKET_MS) * OPERATION_BUCKET_MS;
  const [rows, recent] = await db.batch([
    db
      .select({
        scope: metrics.scope,
        requests: sql<number>`sum(${metrics.requests})`,
        errors: sql<number>`sum(${metrics.errors})`,
        rateLimited: sql<number>`sum(${metrics.rateLimited})`,
        slowRequests: sql<number>`sum(${metrics.slowRequests})`,
        durationMs: sql<number>`sum(${metrics.durationMs})`,
      })
      .from(metrics)
      .where(sql`${metrics.bucket} >= ${cutoff}`)
      .groupBy(metrics.scope)
      .limit(6),
    db
      .select()
      .from(alerts)
      .where(sql`${alerts.bucket} >= ${cutoff}`)
      .orderBy(desc(alerts.bucket), desc(alerts.id))
      .limit(30),
  ]);
  const sum = (key: 'requests' | 'errors' | 'rateLimited' | 'slowRequests' | 'durationMs') =>
      rows.reduce((total, row) => total + row[key], 0),
    requests = sum('requests');
  return {
    measuredAt: new Date(now).toISOString(),
    telemetryEnabled: env.OPERATIONS_TELEMETRY === 'on',
    hours,
    requests,
    errors: sum('errors'),
    rateLimited: sum('rateLimited'),
    slowRequests: sum('slowRequests'),
    averageDurationMs: requests ? Math.round(sum('durationMs') / requests) : 0,
    scopes: rows.map(({ scope, requests, errors }) => ({ scope, requests, errors })),
    alerts: recent.map(({ id, bucket, kind, count, state, attempts }) => ({
      id,
      bucket: new Date(bucket).toISOString(),
      kind,
      count,
      state,
      attempts,
    })),
  };
}
