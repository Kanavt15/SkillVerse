/** Enrollment-scoped reads and atomic writes; counters are recomputed, never incremented on retries. */
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import { newId } from '@skillverse/shared';

const { enrollments, lessonProgress, notes, reviews, certificates, courses, lessons, users } =
  schema;

export function findEnrollment(db: Db, userId: string, courseId: string) {
  return db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .get();
}
export function listEnrollments(db: Db, userId: string) {
  return db
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.lastAccessedAt))
    .limit(200);
}

/** SQL guard rechecks publication and price at write time, after any concurrent edits. */
export async function enrollFree(db: Db, userId: string, courseId: string) {
  const now = Date.now();
  await db.batch([
    // Keep the insert as a query builder: db.run() executes immediately and cannot join batch().
    db
      .insert(enrollments)
      .select(
        sql`SELECT ${newId()}, ${userId}, ${courses.id}, 'free', NULL, ${now}, ${now}, ${now} FROM ${courses}
      WHERE ${courses.id} = ${courseId} AND ${courses.status} = 'published' AND ${courses.priceInPaise} = 0`,
      )
      .onConflictDoNothing({ target: [enrollments.userId, enrollments.courseId] }),
    db
      .update(courses)
      .set({
        enrollmentCount: sql`(SELECT count(*) FROM ${enrollments} WHERE ${enrollments.courseId} = ${courseId})`,
      })
      .where(eq(courses.id, courseId)),
  ]);
  return findEnrollment(db, userId, courseId);
}

export function completedLessons(db: Db, enrollmentId: string) {
  return db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(
      and(eq(lessonProgress.enrollmentId, enrollmentId), isNotNull(lessonProgress.completedAt)),
    );
}

export async function setProgress(
  db: Db,
  enrollmentId: string,
  courseId: string,
  lessonId: string,
  completed: boolean,
) {
  const now = new Date();
  await db.batch([
    db
      .insert(lessonProgress)
      .values({ enrollmentId, lessonId, completedAt: completed ? now : null })
      .onConflictDoUpdate({
        target: [lessonProgress.enrollmentId, lessonProgress.lessonId],
        set: { completedAt: completed ? now : null, updatedAt: now },
      }),
    db
      .update(enrollments)
      .set({
        lastAccessedAt: now,
        completedAt: sql`CASE WHEN EXISTS (SELECT 1 FROM ${lessons} WHERE ${lessons.courseId} = ${courseId})
        AND NOT EXISTS (SELECT 1 FROM ${lessons} WHERE ${lessons.courseId} = ${courseId}
          AND NOT EXISTS (SELECT 1 FROM ${lessonProgress} WHERE ${lessonProgress.enrollmentId} = ${enrollmentId}
            AND ${lessonProgress.lessonId} = ${lessons.id} AND ${lessonProgress.completedAt} IS NOT NULL))
        THEN coalesce(${enrollments.completedAt}, ${now.getTime()}) ELSE NULL END`,
      })
      .where(eq(enrollments.id, enrollmentId)),
  ]);
}

export function listNotes(db: Db, enrollmentId: string, lessonId: string) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      timestampSeconds: notes.timestampSeconds,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(and(eq(notes.enrollmentId, enrollmentId), eq(notes.lessonId, lessonId)))
    .orderBy(desc(notes.createdAt), desc(notes.id))
    .limit(100);
}
export function addNote(
  db: Db,
  enrollmentId: string,
  lessonId: string,
  input: { body: string; timestampSeconds: number | null },
) {
  return db
    .insert(notes)
    .values({ enrollmentId, lessonId, ...input })
    .returning();
}
export function deleteNote(db: Db, enrollmentId: string, lessonId: string, noteId: string) {
  return db
    .delete(notes)
    .where(
      and(eq(notes.id, noteId), eq(notes.enrollmentId, enrollmentId), eq(notes.lessonId, lessonId)),
    )
    .returning({ id: notes.id });
}

export async function saveReview(
  db: Db,
  enrollmentId: string,
  userId: string,
  courseId: string,
  input: { rating: number; body: string },
) {
  await db.batch([
    db
      .insert(reviews)
      .values({ enrollmentId, userId, courseId, ...input })
      .onConflictDoUpdate({
        target: reviews.enrollmentId,
        set: { ...input, updatedAt: new Date() },
      }),
    db
      .update(courses)
      .set({
        ratingSum: sql`(SELECT coalesce(sum(${reviews.rating}), 0) FROM ${reviews} WHERE ${reviews.courseId} = ${courseId})`,
        ratingCount: sql`(SELECT count(*) FROM ${reviews} WHERE ${reviews.courseId} = ${courseId})`,
      })
      .where(eq(courses.id, courseId)),
  ]);
}
export function listReviews(db: Db, courseId: string, page: number) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      updatedAt: reviews.updatedAt,
      author: { displayName: users.displayName, username: users.username },
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.courseId, courseId))
    .orderBy(desc(reviews.updatedAt), desc(reviews.id))
    .limit(20)
    .offset((page - 1) * 20);
}
export function myReview(db: Db, enrollmentId: string) {
  return db
    .select({ rating: reviews.rating, body: reviews.body })
    .from(reviews)
    .where(eq(reviews.enrollmentId, enrollmentId))
    .get();
}
export function findCertificate(db: Db, enrollmentId: string) {
  return db.select().from(certificates).where(eq(certificates.enrollmentId, enrollmentId)).get();
}
export function certificateBySerial(db: Db, serial: string) {
  return db.select().from(certificates).where(eq(certificates.serial, serial)).get();
}
export function listCertificates(db: Db, userId: string) {
  return db
    .select({ credential: certificates })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(certificates.issuedAt))
    .limit(200);
}

/** Insert only if every current lesson is complete, in the same SQL statement as issuance. */
export function insertCertificate(
  db: Db,
  value: typeof certificates.$inferInsert,
  courseId: string,
) {
  return db.run(sql`INSERT INTO certificates (serial, enrollment_id, learner_name, course_title, course_slug, instructor_name, lesson_count, issued_at, signature)
    SELECT ${value.serial}, ${value.enrollmentId}, ${value.learnerName}, ${value.courseTitle}, ${value.courseSlug}, ${value.instructorName}, ${value.lessonCount}, ${value.issuedAt.getTime()}, ${value.signature}
    WHERE (SELECT count(*) FROM ${lessons} WHERE ${lessons.courseId} = ${courseId}) = ${value.lessonCount}
      AND ${value.lessonCount} > 0 AND NOT EXISTS (SELECT 1 FROM ${lessons} WHERE ${lessons.courseId} = ${courseId}
        AND NOT EXISTS (SELECT 1 FROM ${lessonProgress} WHERE ${lessonProgress.enrollmentId} = ${value.enrollmentId}
          AND ${lessonProgress.lessonId} = ${lessons.id} AND ${lessonProgress.completedAt} IS NOT NULL))
    ON CONFLICT(enrollment_id) DO NOTHING`);
}
