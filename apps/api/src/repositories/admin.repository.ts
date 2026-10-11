/** Bounded account inspection and atomic, guarded admin decisions over existing identity tables. */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import { newId, type AdminUserDecision, type AdminUserQuery } from '@skillverse/shared';

const {
  users,
  userRoles,
  sessions,
  mfaTotp,
  auditLogs,
  courses,
  enrollments,
  instructorApplications,
  contentReports,
} = schema;
export const ADMIN_USER_PAGE_SIZE = 20;
// Drizzle removes column qualification in single-table SELECT projections. Keep the
// correlated outer id explicit, so an inner table's own id cannot shadow it.
const outerUserId = sql`"users"."id"`;
const accountColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  status: users.status,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  adminVersion: users.adminVersion,
  rolesJson: sql<string>`(SELECT coalesce(json_group_array(${userRoles.role}), '[]') FROM ${userRoles} WHERE ${userRoles.userId} = ${outerUserId})`,
};
function userFilter(query: AdminUserQuery) {
  // Literal substring search has no wildcard language; values remain bound parameters.
  return and(
    query.status === 'all' ? undefined : eq(users.status, query.status),
    query.q
      ? sql`(instr(lower(${users.email}), lower(${query.q})) > 0 OR instr(lower(${users.username}), lower(${query.q})) > 0 OR instr(lower(${users.displayName}), lower(${query.q})) > 0)`
      : undefined,
  );
}
/** List and count share one D1 batch snapshot; secrets and private learning content are never selected. */
export function listUsers(db: Db, query: AdminUserQuery) {
  return db.batch([
    db
      .select(accountColumns)
      .from(users)
      .where(userFilter(query))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(ADMIN_USER_PAGE_SIZE)
      .offset((query.page - 1) * ADMIN_USER_PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)` })
      .from(users)
      .where(userFilter(query)),
  ]);
}
/** Identity/security indicators and relation counts only; never selects private learning bodies. */
export function findUser(db: Db, userId: string, now: number) {
  return db
    .select({
      ...accountColumns,
      mfaEnabled: sql<number>`EXISTS (SELECT 1 FROM ${mfaTotp} WHERE ${mfaTotp.userId} = ${outerUserId} AND ${mfaTotp.enabledAt} IS NOT NULL)`,
      activeSessions: sql<number>`(SELECT count(*) FROM ${sessions} WHERE ${sessions.userId} = ${outerUserId} AND ${sessions.expiresAt} > ${now} AND ${sessions.idleExpiresAt} > ${now})`,
      enrollments: sql<number>`(SELECT count(*) FROM ${enrollments} WHERE ${enrollments.userId} = ${outerUserId})`,
      authoredCourses: sql<number>`(SELECT count(*) FROM ${courses} WHERE ${courses.instructorId} = ${outerUserId})`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
/** Most recent account decisions only; excludes sign-in logs, IPs and session identifiers. */
export function userHistory(db: Db, userId: string) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorName: users.displayName,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(
      and(
        eq(auditLogs.targetType, 'user'),
        eq(auditLogs.targetId, userId),
        inArray(auditLogs.action, [
          'admin.user_suspend',
          'admin.user_reactivate',
          'admin.user_revoke_sessions',
        ]),
      ),
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(20);
}
/**
 * Insert a unique audit receipt only if version, target protection and actor authority still match.
 * The following writes depend on that receipt, in the same D1 transaction. A losing/stale request
 * therefore neither revokes sessions nor records a decision. Every success advances the version.
 */
export async function decideUser(
  db: Db,
  actorId: string,
  userId: string,
  requestId: string,
  input: AdminUserDecision,
  actorSession: { tokenHash: string; requireMfa: boolean },
) {
  const receiptId = newId(),
    now = Date.now();
  const requiredStatus =
    input.decision === 'reactivate' ? 'suspended' : input.decision === 'suspend' ? 'active' : null;
  const permission = sql`EXISTS (SELECT 1 FROM ${users} AS actor
    INNER JOIN ${userRoles} AS authority ON authority.user_id = actor.id
    INNER JOIN ${sessions} AS credential ON credential.user_id = actor.id
    WHERE actor.id = ${actorId} AND actor.status = 'active' AND authority.role IN ('admin', 'super_admin')
    AND credential.id = ${actorSession.tokenHash} AND credential.expires_at > ${now} AND credential.idle_expires_at > ${now}
    AND (NOT EXISTS (SELECT 1 FROM ${mfaTotp} WHERE ${mfaTotp.userId} = actor.id AND ${mfaTotp.enabledAt} IS NOT NULL) OR credential.mfa_verified = 1)
    AND (${actorSession.requireMfa ? 1 : 0} = 0 OR (credential.mfa_verified = 1 AND EXISTS (SELECT 1 FROM ${mfaTotp} WHERE ${mfaTotp.userId} = actor.id AND ${mfaTotp.enabledAt} IS NOT NULL))))`;
  const eligible = and(
    eq(users.id, userId),
    eq(users.adminVersion, input.version),
    sql`${users.id} <> ${actorId}`,
    sql`${users.status} <> 'deleted'`,
    requiredStatus ? eq(users.status, requiredStatus) : undefined,
    sql`NOT EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${users.id} AND ${userRoles.role} IN ('moderator', 'admin', 'super_admin'))`,
    permission,
  );
  const receipt = db
    .insert(auditLogs)
    .select(
      sql`SELECT ${receiptId}, ${actorId}, ${`admin.user_${input.decision}`}, 'user', ${userId}, ${JSON.stringify({ notes: input.notes })}, NULL, ${requestId}, ${now} FROM ${users} WHERE ${eligible}`,
    )
    .returning({ id: auditLogs.id });
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE ${auditLogs.id} = ${receiptId})`;
  const update = db
    .update(users)
    .set({
      ...(input.decision === 'suspend'
        ? { status: 'suspended' as const }
        : input.decision === 'reactivate'
          ? { status: 'active' as const }
          : {}),
      adminVersion: sql`${users.adminVersion} + 1`,
      updatedAt: new Date(now),
    })
    .where(and(eq(users.id, userId), guard));
  // Reactivation also clears any older sessions; it always requires a fresh sign-in.
  const revoke = db.delete(sessions).where(and(eq(sessions.userId, userId), guard));
  const results = await db.batch([receipt, update, revoke]);
  return results[0].length === 1;
}
/** Current totals, not truncated queue lengths or analytics estimates. */
export function overview(db: Db) {
  const queueColumns = {
    count: sql<number>`count(*)`,
    oldestAt: sql<number | null>`min(created_at)`,
  };
  return db.batch([
    db
      .select({ status: users.status, count: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.status)
      .limit(3),
    db
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(userRoles.role, 'instructor'), eq(users.status, 'active'))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(courses)
      .where(eq(courses.status, 'published')),
    db
      .select({
        count: sql<number>`count(*)`,
        completed: sql<number>`coalesce(sum(CASE WHEN ${enrollments.completedAt} IS NOT NULL THEN 1 ELSE 0 END), 0)`,
      })
      .from(enrollments),
    db
      .select(queueColumns)
      .from(instructorApplications)
      .where(eq(instructorApplications.status, 'pending')),
    db
      .select({
        count: sql<number>`count(*)`,
        oldestAt: sql<number | null>`min(${courses.submittedAt})`,
      })
      .from(courses)
      .where(eq(courses.status, 'in_review')),
    db.select(queueColumns).from(contentReports).where(eq(contentReports.status, 'open')),
  ]);
}
