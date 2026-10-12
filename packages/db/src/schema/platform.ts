/**
 * Platform operations tables: admin-editable settings, feature flags and the audit log.
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id } from './_columns';
import { users } from './identity';

/**
 * Key/value settings that admins can change without a deploy
 * (commission rates, refund window, ad toggles …). `value` is JSON text.
 * Supported operational reads use a 60-second process cache; arbitrary/financial values stay protected.
 */
export const platformSettings = sqliteTable('platform_settings', {
  /** Dotted key, e.g. "commerce.platform_fee_bps". */
  key: text('key').primaryKey(),
  /** JSON-encoded value. Validated by a Zod schema per key before use. */
  value: text('value').notNull(),
  /** Human explanation shown in the admin UI. */
  description: text('description').notNull().default(''),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  version: integer('version').notNull().default(0),
});

/** On/off switches for features, so unfinished work can ship dark and be enabled gradually. */
export const featureFlags = sqliteTable('feature_flags', {
  /** e.g. "ads.adsense", "mentoring.booking". */
  key: text('key').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  /** 0–100: percentage of users who see the feature when enabled (stable per user). */
  rolloutPercent: integer('rollout_percent').notNull().default(100),
  description: text('description').notNull().default(''),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  version: integer('version').notNull().default(0),
});

/** Coarse counters only: no URLs, identities, addresses, queries or request bodies. */
export const operationalMetrics = sqliteTable(
  'operational_metrics',
  {
    bucket: integer('bucket').notNull(),
    scope: text('scope').notNull(),
    requests: integer('requests').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    rateLimited: integer('rate_limited').notNull().default(0),
    slowRequests: integer('slow_requests').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.scope] })],
);

export const operationalAlerts = sqliteTable(
  'operational_alerts',
  {
    id: id(),
    bucket: integer('bucket').notNull(),
    kind: text('kind', {
      enum: ['server_errors', 'slow_requests', 'rate_limit_spike', 'request_volume'],
    }).notNull(),
    count: integer('count').notNull(),
    state: text('state', {
      enum: ['pending', 'delivering', 'delivered', 'delivery_failed', 'not_configured'],
    })
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: integer('next_attempt_at').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('operational_alert_bucket_kind_idx').on(t.bucket, t.kind),
    index('operational_alert_delivery_idx').on(t.state, t.nextAttemptAt),
  ],
);

/**
 * Append-only record of security- and money-relevant actions: who did what, to what, when.
 * Application code only ever INSERTs here. It never UPDATEs or DELETEs.
 */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: id(),
    /** User who acted, or NULL for the system (cron, webhook). */
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Verb in "area.action" form, e.g. "auth.login_failed", "admin.role_granted". */
    action: text('action').notNull(),
    /** Kind of thing acted on, e.g. "user", "course", "order". */
    targetType: text('target_type'),
    targetId: text('target_id'),
    /** Extra JSON details. Must never contain secrets, passwords or full card/bank data. */
    metadata: text('metadata').notNull().default('{}'),
    ipHash: text('ip_hash'),
    /** Correlates with the API log line and the `requestId` returned to the client. */
    requestId: text('request_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    // Resource history is bounded and newest first, with id breaking timestamp ties.
    index('audit_created_idx').on(t.createdAt, t.id),
    index('audit_target_id_idx').on(t.targetId, t.createdAt, t.id),
    index('audit_target_idx').on(t.targetType, t.targetId, t.createdAt, t.id),
    index('audit_actor_idx').on(t.actorUserId, t.createdAt),
    index('audit_action_idx').on(t.action, t.createdAt),
  ],
);
