/**
 * Data access for `instructor_applications`.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import { newId, type ApplicationStatus, type InstructorApplicationInput } from '@skillverse/shared';

const { instructorApplications, users, userRoles, sessions, mfaTotp, auditLogs } = schema;

export type { ApplicationStatus } from '@skillverse/shared';

export function latestApplication(db: Db, userId: string) {
  return db
    .select()
    .from(instructorApplications)
    .where(eq(instructorApplications.userId, userId))
    .orderBy(desc(instructorApplications.createdAt), desc(instructorApplications.id))
    .limit(1)
    .get();
}

export function findApplication(db: Db, id: string) {
  return db.select().from(instructorApplications).where(eq(instructorApplications.id, id)).get();
}

/** Private, bounded submission history, newest first with deterministic ties. */
export function myApplications(db: Db, userId: string) {
  return db
    .select()
    .from(instructorApplications)
    .where(eq(instructorApplications.userId, userId))
    .orderBy(desc(instructorApplications.createdAt), desc(instructorApplications.id))
    .limit(20);
}

/** Applications with a given status, oldest first (fair queue). */
export function listApplications(db: Db, status: ApplicationStatus) {
  return db
    .select({
      id: instructorApplications.id,
      status: instructorApplications.status,
      headline: instructorApplications.headline,
      topics: instructorApplications.topics,
      experience: instructorApplications.experience,
      sampleUrl: instructorApplications.sampleUrl,
      reviewNotes: instructorApplications.reviewNotes,
      createdAt: instructorApplications.createdAt,
      withdrawnAt: instructorApplications.withdrawnAt,
      // Applicant fields; users.id is not selected (duplicate "id" column in a join).
      applicant: {
        id: instructorApplications.userId,
        displayName: users.displayName,
        username: users.username,
        email: users.email,
      },
    })
    .from(instructorApplications)
    .innerJoin(users, eq(users.id, instructorApplications.userId))
    .where(eq(instructorApplications.status, status))
    .orderBy(asc(instructorApplications.createdAt), asc(instructorApplications.id))
    .limit(200);
}

type ActorSession = { tokenHash: string; requireMfa: boolean };

/** Recheck current account, email, session and MFA inside the transaction, including the local MFA exception. */
function currentActor(actorId: string, session: ActorSession, staff: boolean) {
  return sql`EXISTS (SELECT 1 FROM ${users} AS actor
    INNER JOIN ${sessions} AS credential ON credential.user_id = actor.id
    WHERE actor.id = ${actorId} AND actor.status = 'active' AND actor.email_verified_at IS NOT NULL
    AND credential.id = ${session.tokenHash} AND credential.expires_at > ${Date.now()} AND credential.idle_expires_at > ${Date.now()}
    AND (NOT EXISTS (SELECT 1 FROM ${mfaTotp} WHERE ${mfaTotp.userId} = actor.id AND ${mfaTotp.enabledAt} IS NOT NULL) OR credential.mfa_verified = 1)
    AND (${session.requireMfa ? 1 : 0} = 0 OR (credential.mfa_verified = 1 AND EXISTS (SELECT 1 FROM ${mfaTotp} WHERE ${mfaTotp.userId} = actor.id AND ${mfaTotp.enabledAt} IS NOT NULL)))
    ${staff ? sql`AND EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = actor.id AND ${userRoles.role} IN ('moderator', 'admin', 'super_admin'))` : sql``})`;
}

/** Guarded insert and audit commit together: concurrent submissions cannot create two pending rows. */
export async function insertApplication(
  db: Db,
  actorId: string,
  input: InstructorApplicationInput,
  requestId: string,
  session: ActorSession,
) {
  const id = newId(),
    now = Date.now();
  const eligible = and(
    currentActor(actorId, session, false),
    sql`NOT EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${actorId} AND ${userRoles.role} = 'instructor')`,
    sql`NOT EXISTS (SELECT 1 FROM ${instructorApplications} WHERE ${instructorApplications.userId} = ${actorId} AND ${instructorApplications.status} = 'pending')`,
  );
  const insert = db
    .insert(instructorApplications)
    .select(
      sql`SELECT ${id}, ${actorId}, 'pending', ${input.headline}, ${JSON.stringify([...new Set(input.topics)])}, ${input.experience}, ${input.sampleUrl || null}, NULL, NULL, NULL, NULL, ${now} WHERE ${eligible}`,
    )
    .returning();
  const audit = db
    .insert(auditLogs)
    .select(
      sql`SELECT ${newId()}, ${actorId}, 'instructor.applied', 'instructor_application', ${id}, '{}', NULL, ${requestId}, ${now} WHERE EXISTS (SELECT 1 FROM ${instructorApplications} WHERE ${instructorApplications.id} = ${id})`,
    );
  const results = await db.batch([insert, audit]);
  return results[0][0];
}

/** Terminal pending -> approved/rejected/withdrawn transition; receipt, status and role grant are atomic. */
export async function transitionApplication(
  db: Db,
  id: string,
  applicantId: string,
  actorId: string,
  decision: 'approved' | 'rejected' | 'withdrawn',
  notes: string | null,
  requestId: string,
  session: ActorSession,
) {
  const receiptId = newId(),
    now = Date.now(),
    withdrawal = decision === 'withdrawn';
  const eligible = and(
    eq(instructorApplications.id, id),
    eq(instructorApplications.userId, applicantId),
    eq(instructorApplications.status, 'pending'),
    withdrawal
      ? eq(instructorApplications.userId, actorId)
      : sql`${instructorApplications.userId} <> ${actorId}`,
    currentActor(actorId, session, !withdrawal),
    decision === 'approved'
      ? sql`EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${applicantId} AND ${users.status} = 'active' AND ${users.emailVerifiedAt} IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${applicantId} AND ${userRoles.role} = 'instructor')`
      : undefined,
  );
  const receipt = db
    .insert(auditLogs)
    .select(
      sql`SELECT ${receiptId}, ${actorId}, ${`instructor.${decision}`}, ${withdrawal ? 'instructor_application' : 'user'}, ${withdrawal ? id : applicantId}, ${JSON.stringify({ applicationId: id, notes })}, NULL, ${requestId}, ${now} FROM ${instructorApplications} WHERE ${eligible}`,
    )
    .returning({ id: auditLogs.id });
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE ${auditLogs.id} = ${receiptId})`;
  const update = db
    .update(instructorApplications)
    .set(
      withdrawal
        ? {
            status: decision,
            withdrawnAt: new Date(now),
            reviewerId: null,
            reviewNotes: null,
            reviewedAt: null,
          }
        : { status: decision, reviewerId: actorId, reviewNotes: notes, reviewedAt: new Date(now) },
    )
    .where(and(eq(instructorApplications.id, id), guard));
  const grant = db
    .insert(userRoles)
    .select(sql`SELECT ${applicantId}, 'instructor', ${actorId}, ${now} WHERE ${guard}`)
    .onConflictDoNothing();
  const results =
    decision === 'approved'
      ? await db.batch([receipt, update, grant])
      : await db.batch([receipt, update]);
  return results[0].length === 1;
}
