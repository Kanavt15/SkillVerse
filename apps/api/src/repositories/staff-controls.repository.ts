/** Closed administrative operations; every write is tied to a fresh single-use proof. */
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { schema, type Db } from '@skillverse/db';
import {
  newId,
  OPERATION_SETTING_RULES,
  type StaffAuditQuery,
  type StaffRoleDecision,
  type StaffSettingDecision,
  type StaffFlagDecision,
} from '@skillverse/shared';
import type { AuthContext } from '../env';

const { users, userRoles, sessions, mfaTotp, auditLogs, platformSettings, featureFlags } = schema;
export const STEP_UP_LIFETIME_MS = 60000;

export function superAuthority(auth: AuthContext, nonce: string, now: number) {
  return sql`EXISTS (SELECT 1 FROM ${users} AS actor
    JOIN ${userRoles} AS authority ON authority.user_id = actor.id
    JOIN ${sessions} AS credential ON credential.user_id = actor.id
    JOIN ${mfaTotp} AS factor ON factor.user_id = actor.id
    WHERE actor.id = ${auth.user.id} AND actor.status = 'active' AND actor.email_verified_at IS NOT NULL
    AND authority.role = 'super_admin' AND factor.enabled_at IS NOT NULL
    AND credential.id = ${auth.session.tokenHash} AND credential.expires_at > ${now} AND credential.idle_expires_at > ${now}
    AND credential.mfa_verified = 1 AND credential.step_up_nonce = ${nonce} AND credential.step_up_at > ${now - STEP_UP_LIFETIME_MS})`;
}

function receipt(
  db: Db,
  auth: AuthContext,
  nonce: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: { notes: string; summary: string },
  requestId: string,
  from: SQL,
  eligible: SQL,
) {
  const id = newId(),
    now = Date.now();
  const insert = db
    .insert(auditLogs)
    .select(
      sql`SELECT ${id}, ${auth.user.id}, ${action}, ${targetType}, ${targetId}, ${JSON.stringify(metadata)}, NULL, ${requestId}, ${now} FROM ${from} WHERE ${eligible} AND ${superAuthority(auth, nonce, now)}`,
    )
    .returning({ id: auditLogs.id });
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${id})`;
  const consume = db
    .update(sessions)
    .set({ stepUpNonce: null, stepUpAt: null })
    .where(and(eq(sessions.id, auth.session.tokenHash), guard));
  return { insert, consume, guard, now };
}

export async function decideRole(
  db: Db,
  auth: AuthContext,
  targetId: string,
  input: StaffRoleDecision,
  nonce: string,
  requestId: string,
) {
  const eligible = and(
    eq(users.id, targetId),
    eq(users.adminVersion, input.version),
    sql`${users.id} <> ${auth.user.id}`,
    sql`${users.status} <> 'deleted'`,
    input.decision === 'grant'
      ? sql`${users.status} = 'active' AND ${users.emailVerifiedAt} IS NOT NULL AND EXISTS (SELECT 1 FROM ${mfaTotp} WHERE user_id = ${users.id} AND enabled_at IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM ${userRoles} WHERE user_id = ${users.id} AND role = ${input.role})`
      : sql`EXISTS (SELECT 1 FROM ${userRoles} WHERE user_id = ${users.id} AND role = ${input.role})
        AND (${input.role} <> 'super_admin' OR EXISTS (SELECT 1 FROM ${userRoles} AS remaining JOIN ${users} AS account ON account.id = remaining.user_id JOIN ${mfaTotp} AS factor ON factor.user_id = account.id WHERE account.id <> ${targetId} AND account.status = 'active' AND account.email_verified_at IS NOT NULL AND factor.enabled_at IS NOT NULL AND remaining.role = 'super_admin'))
        AND EXISTS (SELECT 1 FROM ${userRoles} AS remaining JOIN ${users} AS account ON account.id = remaining.user_id JOIN ${mfaTotp} AS factor ON factor.user_id = account.id WHERE account.status = 'active' AND account.email_verified_at IS NOT NULL AND factor.enabled_at IS NOT NULL AND remaining.role IN ('admin', 'super_admin') AND (account.id <> ${targetId} OR remaining.role <> ${input.role}))`,
  )!;
  const r = receipt(
    db,
    auth,
    nonce,
    `admin.role_${input.decision === 'grant' ? 'granted' : 'revoked'}`,
    'user',
    targetId,
    {
      notes: input.notes,
      summary: `${input.decision === 'grant' ? 'Granted' : 'Revoked'} ${input.role}; all target sessions revoked.`,
    },
    requestId,
    sql`${users}`,
    eligible,
  );
  const change =
    input.decision === 'grant'
      ? db
          .insert(userRoles)
          .select(
            sql`SELECT ${targetId}, ${input.role}, ${auth.user.id}, ${r.now} WHERE ${r.guard}`,
          )
      : db
          .delete(userRoles)
          .where(and(eq(userRoles.userId, targetId), eq(userRoles.role, input.role), r.guard));
  const result = await db.batch([
    r.insert,
    change,
    db
      .update(users)
      .set({ adminVersion: sql`${users.adminVersion} + 1`, updatedAt: new Date(r.now) })
      .where(and(eq(users.id, targetId), r.guard)),
    db.delete(sessions).where(and(eq(sessions.userId, targetId), r.guard)),
    r.consume,
  ]);
  return result[0].length === 1;
}

export async function decideSetting(
  db: Db,
  auth: AuthContext,
  input: StaffSettingDecision,
  nonce: string,
  requestId: string,
) {
  const r = receipt(
    db,
    auth,
    nonce,
    'admin.setting_changed',
    'setting',
    input.key,
    { notes: input.notes, summary: `Set ${input.key} to ${input.value}.` },
    requestId,
    sql`${platformSettings}`,
    and(eq(platformSettings.key, input.key), eq(platformSettings.version, input.version))!,
  );
  const result = await db.batch([
    r.insert,
    db
      .update(platformSettings)
      .set({
        value: JSON.stringify(input.value),
        updatedBy: auth.user.id,
        updatedAt: new Date(r.now),
        version: sql`${platformSettings.version} + 1`,
      })
      .where(and(eq(platformSettings.key, input.key), r.guard)),
    r.consume,
  ]);
  return result[0].length === 1;
}
export async function decideFlag(
  db: Db,
  auth: AuthContext,
  input: StaffFlagDecision,
  nonce: string,
  requestId: string,
) {
  const r = receipt(
    db,
    auth,
    nonce,
    'admin.flag_changed',
    'flag',
    input.key,
    {
      notes: input.notes,
      summary: `${input.enabled ? 'Enabled' : 'Disabled'} ${input.key}; rollout ${input.rolloutPercent}%.`,
    },
    requestId,
    sql`${featureFlags}`,
    and(eq(featureFlags.key, input.key), eq(featureFlags.version, input.version))!,
  );
  const result = await db.batch([
    r.insert,
    db
      .update(featureFlags)
      .set({
        enabled: input.enabled,
        rolloutPercent: input.rolloutPercent,
        version: sql`${featureFlags.version} + 1`,
        updatedAt: new Date(r.now),
      })
      .where(and(eq(featureFlags.key, input.key), r.guard)),
    r.consume,
  ]);
  return result[0].length === 1;
}

export async function configuration(db: Db) {
  return db.batch([
    db
      .select()
      .from(platformSettings)
      .where(inArray(platformSettings.key, Object.keys(OPERATION_SETTING_RULES)))
      .limit(6),
    db
      .select()
      .from(featureFlags)
      .where(
        inArray(featureFlags.key, ['auth.google', 'ads.house', 'ads.adsense', 'commerce.checkout']),
      )
      .limit(4),
  ]);
}
export function auditPage(db: Db, query: StaffAuditQuery) {
  const parts = query.before?.split(':'),
    beforeTime = parts ? Number(parts[0]) : null;
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorName: users.displayName,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      requestId: auditLogs.requestId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(
      and(
        query.action ? eq(auditLogs.action, query.action) : undefined,
        query.actorId ? eq(auditLogs.actorUserId, query.actorId) : undefined,
        query.targetId ? eq(auditLogs.targetId, query.targetId) : undefined,
        parts
          ? sql`(${auditLogs.createdAt} < ${beforeTime} OR (${auditLogs.createdAt} = ${beforeTime} AND ${auditLogs.id} < ${parts[1]}))`
          : undefined,
      ),
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(51);
}

/** Infrastructure-only, one-time provisioning. It is deliberately not an HTTP route. */
export async function bootstrap(
  db: Db,
  userId: string,
  notes: string,
  requestId: string,
  apply: boolean,
) {
  const eligible = and(
    eq(users.id, userId),
    eq(users.status, 'active'),
    sql`${users.emailVerifiedAt} IS NOT NULL`,
    sql`${users.passwordHash} IS NOT NULL`,
    sql`EXISTS (SELECT 1 FROM ${mfaTotp} WHERE user_id = ${users.id} AND enabled_at IS NOT NULL)`,
    sql`NOT EXISTS (SELECT 1 FROM ${userRoles} WHERE role IN ('admin', 'super_admin'))`,
    sql`NOT EXISTS (SELECT 1 FROM ${platformSettings} WHERE key = 'security.bootstrap_completed')`,
  )!;
  if (!apply) return Boolean(await db.select({ id: users.id }).from(users).where(eligible).get());
  const receiptId = newId(),
    now = Date.now();
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receiptId})`;
  const statements: BatchItem<'sqlite'>[] = [
    db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receiptId}, NULL, 'security.initial_admin_provisioned', 'user', ${userId}, ${JSON.stringify({ notes, summary: 'Provisioned the initial super administrator; revoked existing sessions.' })}, NULL, ${requestId}, ${now} FROM ${users} WHERE ${eligible}`,
      )
      .returning({ id: auditLogs.id }),
    db.insert(userRoles).select(sql`SELECT ${userId}, 'super_admin', NULL, ${now} WHERE ${guard}`),
    db
      .update(users)
      .set({ adminVersion: sql`${users.adminVersion} + 1`, updatedAt: new Date(now) })
      .where(and(eq(users.id, userId), guard)),
    db.delete(sessions).where(and(eq(sessions.userId, userId), guard)),
    db
      .insert(platformSettings)
      .select(
        sql`SELECT 'security.bootstrap_completed', ${JSON.stringify({ userId, completedAt: now })}, 'Protected initial administrative provisioning marker.', NULL, ${now}, 0 WHERE ${guard}`,
      ),
  ];
  const result = await db.batch([statements[0]!, ...statements.slice(1)]);
  return Array.isArray(result[0]) && result[0].length === 1;
}
