/**
 * Platform operations tables: admin-editable settings, feature flags and the audit log.
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { id } from './_columns';
import { users } from './identity';

/**
 * Key/value settings that admins can change without a deploy
 * (commission rates, refund window, ad toggles …). `value` is JSON text.
 * Reads are cached in KV; see apps/api/src/services/settings.service.ts.
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
});

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
    index('audit_target_idx').on(t.targetType, t.targetId),
    index('audit_actor_idx').on(t.actorUserId, t.createdAt),
    index('audit_action_idx').on(t.action, t.createdAt),
  ],
);
