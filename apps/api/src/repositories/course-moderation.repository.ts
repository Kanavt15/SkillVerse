/** Staff catalog search and atomic publication archival; existing enrollments are untouched. */
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import { type AdminCourseQuery } from '@skillverse/shared';

const { courses, users } = schema;
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
