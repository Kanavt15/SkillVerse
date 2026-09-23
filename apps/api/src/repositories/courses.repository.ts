/**
 * Data access for courses, sections, lessons and tags (the course builder and
 * review queue). Public catalog queries (published courses) are added with the
 * catalog pages.
 */
import { and, asc, desc, eq, inArray, max, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';

const { courses, sections, lessons, tags, courseTags, categories, courseReviewEvents, users } =
  schema;

export type CourseRow = typeof courses.$inferSelect;
export type SectionRow = typeof sections.$inferSelect;
export type LessonRow = typeof lessons.$inferSelect;

export function findCourse(db: Db, id: string) {
  return db.select().from(courses).where(eq(courses.id, id)).get();
}

export function slugTaken(db: Db, slug: string) {
  return db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).get();
}

/** The instructor's own courses, most recently edited first. */
export function listCoursesByInstructor(db: Db, instructorId: string) {
  return db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      status: courses.status,
      priceInPaise: courses.priceInPaise,
      lessonCount: courses.lessonCount,
      durationMinutes: courses.durationMinutes,
      enrollmentCount: courses.enrollmentCount,
      reviewNotes: courses.reviewNotes,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .orderBy(desc(courses.updatedAt))
    .limit(200);
}

export function listSections(db: Db, courseId: string) {
  return db
    .select()
    .from(sections)
    .where(eq(sections.courseId, courseId))
    .orderBy(asc(sections.position), asc(sections.createdAt));
}

export function listLessons(db: Db, courseId: string) {
  return db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.position), asc(lessons.createdAt));
}

export function listCourseTagSlugs(db: Db, courseId: string) {
  return db
    .select({ slug: tags.slug })
    .from(courseTags)
    .innerJoin(tags, eq(tags.id, courseTags.tagId))
    .where(eq(courseTags.courseId, courseId))
    .orderBy(asc(tags.slug));
}

export function findSection(db: Db, id: string) {
  return db.select().from(sections).where(eq(sections.id, id)).get();
}

export function findLesson(db: Db, id: string) {
  return db.select().from(lessons).where(eq(lessons.id, id)).get();
}

export async function nextSectionPosition(db: Db, courseId: string): Promise<number> {
  const row = await db
    .select({ max: max(sections.position) })
    .from(sections)
    .where(eq(sections.courseId, courseId))
    .get();
  return (row?.max ?? -1) + 1;
}

export async function nextLessonPosition(db: Db, sectionId: string): Promise<number> {
  const row = await db
    .select({ max: max(lessons.position) })
    .from(lessons)
    .where(eq(lessons.sectionId, sectionId))
    .get();
  return (row?.max ?? -1) + 1;
}

/** Recomputes lesson count and total duration from the lessons table (one statement). */
export function refreshCourseStats(db: Db, courseId: string) {
  return db
    .update(courses)
    .set({
      lessonCount: sql`(SELECT count(*) FROM ${lessons} WHERE ${lessons.courseId} = ${courseId})`,
      durationMinutes: sql`(SELECT coalesce(sum(${lessons.durationMinutes}), 0) FROM ${lessons} WHERE ${lessons.courseId} = ${courseId})`,
    })
    .where(eq(courses.id, courseId));
}

/** Makes sure every tag slug exists; returns their ids. */
export async function upsertTags(db: Db, slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  await db
    .insert(tags)
    .values(slugs.map((slug) => ({ slug, name: slug.replace(/-/g, ' ') })))
    .onConflictDoNothing({ target: tags.slug });
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.slug, slugs));
  return rows.map((r) => r.id);
}

export function replaceCourseTagsStatements(db: Db, courseId: string, tagIds: string[]) {
  return [
    db.delete(courseTags).where(eq(courseTags.courseId, courseId)),
    ...(tagIds.length
      ? [db.insert(courseTags).values(tagIds.map((tagId) => ({ courseId, tagId })))]
      : []),
  ];
}

export function insertReviewEvent(
  db: Db,
  values: {
    courseId: string;
    event: 'submitted' | 'approved' | 'rejected' | 'archived';
    actorId: string;
    notes?: string | null;
  },
) {
  return db.insert(courseReviewEvents).values({ ...values, notes: values.notes ?? null });
}

export function categoryExists(db: Db, id: string) {
  return db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).get();
}

/** Review queue: courses waiting for a decision, oldest submission first. */
export function listCoursesInReview(db: Db) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      submittedAt: courses.submittedAt,
      lessonCount: courses.lessonCount,
      durationMinutes: courses.durationMinutes,
      priceInPaise: courses.priceInPaise,
      // Instructor id comes from courses.instructor_id: selecting users.id too would
      // duplicate the column name "id" in this join (see the D1 primer).
      instructor: {
        id: courses.instructorId,
        displayName: users.displayName,
        username: users.username,
      },
    })
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(courses.status, 'in_review'))
    .orderBy(asc(courses.submittedAt))
    .limit(200);
}

export function listReviewEvents(db: Db, courseId: string) {
  return db
    .select({
      event: courseReviewEvents.event,
      notes: courseReviewEvents.notes,
      createdAt: courseReviewEvents.createdAt,
      actorName: users.displayName,
    })
    .from(courseReviewEvents)
    .leftJoin(users, eq(users.id, courseReviewEvents.actorId))
    .where(eq(courseReviewEvents.courseId, courseId))
    .orderBy(desc(courseReviewEvents.createdAt))
    .limit(50);
}

export function setCourseStatus(
  db: Db,
  courseId: string,
  fromStatuses: string[],
  patch: Partial<typeof courses.$inferInsert>,
) {
  // Conditional update: only moves the course if it's still in an expected status
  // (two reviewers clicking at once can't both act).
  return db
    .update(courses)
    .set(patch)
    .where(
      and(eq(courses.id, courseId), inArray(courses.status, fromStatuses as CourseRow['status'][])),
    )
    .returning({ id: courses.id });
}
