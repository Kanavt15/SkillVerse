/** Staff catalog search and atomic publication archival; existing enrollments are untouched. */
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import { newId, type AdminCourseQuery } from '@skillverse/shared';

const { courses, users, userRoles, sessions, mfaTotp, auditLogs, courseReviewEvents } = schema;
export const STAFF_COURSE_PAGE_SIZE = 20;

export function listCourses(db: Db, query: AdminCourseQuery) {
  const filter = and(
    query.status === 'all' ? undefined : eq(courses.status, query.status),
    query.q
      ? sql`(instr(lower(${courses.title}), lower(${query.q})) > 0 OR instr(lower(${courses.slug}), lower(${query.q})) > 0 OR instr(lower(${users.displayName}), lower(${query.q})) > 0 OR instr(lower(${users.username}), lower(${query.q})) > 0)`
      : undefined,
  );
  return db.batch([
    db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        status: courses.status,
        enrollmentCount: courses.enrollmentCount,
        updatedAt: courses.updatedAt,
        instructor: {
          id: courses.instructorId,
          displayName: users.displayName,
          username: users.username,
        },
      })
      .from(courses)
      .innerJoin(users, eq(users.id, courses.instructorId))
      .where(filter)
      .orderBy(desc(courses.updatedAt), desc(courses.id))
      .limit(STAFF_COURSE_PAGE_SIZE)
      .offset((query.page - 1) * STAFF_COURSE_PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)` })
      .from(courses)
      .innerJoin(users, eq(users.id, courses.instructorId))
      .where(filter),
  ]);
}

/**
 * The one-way published -> archived transition is its own replay guard. A receipt,
 * course update and history entry commit together, and recheck current staff authority.
 * No public endpoint can restore an archived course, so a stale request cannot win later.
 */
export async function archivePublished(
  db: Db,
  courseId: string,
  actorId: string,
  notes: string,
  requestId: string,
  actorSession: { tokenHash: string; requireMfa: boolean },
) {
  const receiptId = newId(),
    now = Date.now();
  const eligible = and(
    eq(courses.id, courseId),
    eq(courses.status, 'published'),
    sql`${courses.instructorId} <> ${actorId}`,
    sql`EXISTS (SELECT 1 FROM ${users} AS actor
      INNER JOIN ${userRoles} AS authority ON authority.user_id = actor.id
      INNER JOIN ${sessions} AS credential ON credential.user_id = actor.id
      WHERE actor.id = ${actorId} AND actor.status = 'active'
      AND authority.role IN ('moderator', 'admin', 'super_admin')
      AND credential.id = ${actorSession.tokenHash} AND credential.expires_at > ${now} AND credential.idle_expires_at > ${now}
      AND (NOT EXISTS (SELECT 1 FROM ${mfaTotp} WHERE ${mfaTotp.userId} = actor.id AND ${mfaTotp.enabledAt} IS NOT NULL) OR credential.mfa_verified = 1)
      AND (${actorSession.requireMfa ? 1 : 0} = 0 OR (credential.mfa_verified = 1 AND EXISTS (SELECT 1 FROM ${mfaTotp} WHERE ${mfaTotp.userId} = actor.id AND ${mfaTotp.enabledAt} IS NOT NULL))))`,
  );
  const receipt = db
    .insert(auditLogs)
    .select(
      sql`SELECT ${receiptId}, ${actorId}, 'admin.course_archived', 'course', ${courseId}, ${JSON.stringify({ notes })}, NULL, ${requestId}, ${now} FROM ${courses} WHERE ${eligible}`,
    )
    .returning({ id: auditLogs.id });
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE ${auditLogs.id} = ${receiptId})`;
  const update = db
    .update(courses)
    .set({ status: 'archived', reviewNotes: notes, updatedAt: new Date(now) })
    .where(and(eq(courses.id, courseId), guard));
  const history = db
    .insert(courseReviewEvents)
    .select(
      sql`SELECT ${newId()}, ${courseId}, 'archived', ${actorId}, ${notes}, ${now} WHERE ${guard}`,
    );
  const results = await db.batch([receipt, update, history]);
  return results[0].length === 1;
}
