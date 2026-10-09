/** Published catalog queries with bounded pagination and parameterized FTS5 search. */
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import type { CatalogQuery } from '@skillverse/shared';

const { courses, categories, users, userProfiles, userRoles } = schema;
export const CATALOG_PAGE_SIZE = 12;

/** Quote every token so punctuation/operators cannot become an FTS expression. */
export function searchExpression(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 20)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(' AND ');
}

function filters(query: CatalogQuery, instructorId?: string) {
  const expression = searchExpression(query.q);
  return and(
    eq(courses.status, 'published'),
    eq(users.status, 'active'),
    instructorId ? eq(courses.instructorId, instructorId) : undefined,
    query.category ? eq(categories.slug, query.category) : undefined,
    query.level ? eq(courses.level, query.level) : undefined,
    query.language ? eq(courses.language, query.language) : undefined,
    query.price === 'free' ? eq(courses.priceInPaise, 0) : undefined,
    query.price === 'paid' ? sql`${courses.priceInPaise} > 0` : undefined,
    expression
      ? sql`${courses}.rowid IN (SELECT rowid FROM courses_fts WHERE courses_fts MATCH ${expression})`
      : undefined,
  );
}

const selection = {
  course: courses,
  // D1 maps column names, so aliases avoid overwriting courses.slug/status in joins.
  categorySlug: sql<string | null>`${categories.slug}`.as('category_slug'),
  categoryName: categories.name,
  instructorUsername: users.username,
  instructorName: users.displayName,
  instructorHeadline: userProfiles.headline,
  instructorBio: userProfiles.bio,
  instructorStatus: sql<string>`${users.status}`.as('instructor_status'),
};

function joined(db: Db) {
  return db
    .select(selection)
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(categories, eq(categories.id, courses.categoryId));
}

export async function listCatalog(db: Db, query: CatalogQuery, instructorId?: string) {
  const where = filters(query, instructorId);
  const sort =
    query.sort === 'popular'
      ? desc(courses.enrollmentCount)
      : query.sort === 'rating'
        ? desc(
            sql`CASE WHEN ${courses.ratingCount} > 0 THEN 1.0 * ${courses.ratingSum} / ${courses.ratingCount} ELSE 0 END`,
          )
        : desc(courses.publishedAt);
  const [items, total] = await Promise.all([
    joined(db)
      .where(where)
      .orderBy(sort, desc(courses.publishedAt), desc(courses.id))
      .limit(CATALOG_PAGE_SIZE)
      .offset((query.page - 1) * CATALOG_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(courses)
      .innerJoin(users, eq(users.id, courses.instructorId))
      .leftJoin(categories, eq(categories.id, courses.categoryId))
      .where(where)
      .get(),
  ]);
  return { items, total: total?.total ?? 0 };
}

/** Internal load: service decides whether an archived course may be learned. */
export function findCatalogCourse(db: Db, slug: string) {
  return joined(db).where(eq(courses.slug, slug)).get();
}

export function findPublicInstructor(db: Db, username: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      headline: userProfiles.headline,
      bio: userProfiles.bio,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.username, username),
        eq(users.status, 'active'),
        sql`EXISTS (SELECT 1 FROM ${userRoles} WHERE ${userRoles.userId} = ${users.id} AND ${userRoles.role} = 'instructor')`,
      ),
    )
    .get();
}

export type CatalogRow = NonNullable<Awaited<ReturnType<typeof findCatalogCourse>>>;

/** One bounded query for the learner shelf, rather than one set of queries per course. */
export function listLearningRows(db: Db, userId: string) {
  const { enrollments, lessonProgress, lessons, sections, certificates } = schema;
  return db
    .select({
      ...selection,
      lastAccessedAt: sql<number>`${enrollments.lastAccessedAt}`.as('enrollment_last_accessed'),
      completedAt: sql<number | null>`${enrollments.completedAt}`.as('enrollment_completed_at'),
      completedLessons:
        sql<number>`(SELECT count(*) FROM ${lessonProgress} INNER JOIN ${lessons} ON ${lessons.id} = ${lessonProgress.lessonId} WHERE ${lessonProgress.enrollmentId} = ${enrollments.id} AND ${lessons.courseId} = ${courses.id} AND ${lessonProgress.completedAt} IS NOT NULL)`.as(
          'completed_lessons',
        ),
      nextLessonId: sql<
        string | null
      >`(SELECT ${lessons.id} FROM ${lessons} INNER JOIN ${sections} ON ${sections.id} = ${lessons.sectionId} WHERE ${lessons.courseId} = ${courses.id} AND NOT EXISTS (SELECT 1 FROM ${lessonProgress} WHERE ${lessonProgress.enrollmentId} = ${enrollments.id} AND ${lessonProgress.lessonId} = ${lessons.id} AND ${lessonProgress.completedAt} IS NOT NULL) ORDER BY ${sections.position}, ${sections.createdAt}, ${lessons.position}, ${lessons.createdAt} LIMIT 1)`.as(
        'next_lesson_id',
      ),
      certificateSerial: sql<
        string | null
      >`(SELECT ${certificates.serial} FROM ${certificates} WHERE ${certificates.enrollmentId} = ${enrollments.id})`.as(
        'certificate_serial',
      ),
    })
    .from(courses)
    .innerJoin(
      enrollments,
      and(eq(enrollments.courseId, courses.id), eq(enrollments.userId, userId)),
    )
    .innerJoin(users, eq(users.id, courses.instructorId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(sql`${courses.status} IN ('published', 'archived')`)
    .orderBy(desc(enrollments.lastAccessedAt))
    .limit(200);
}
