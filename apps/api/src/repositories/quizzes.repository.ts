/** Versioned quiz reads and guarded writes; attempts, completion and totals commit in one batch. */
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import type { QuizDefinition, QuizResult } from '@skillverse/shared';
import { refreshEnrollmentProgress } from './learning.repository';
const {
  lessonQuizzes: quizzes,
  quizAttempts: attempts,
  lessons,
  courses,
  enrollments,
  lessonProgress,
} = schema;

export function findQuiz(db: Db, lessonId: string) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}
export function courseQuizzes(db: Db, courseId: string) {
  return db
    .select({ lessonId: quizzes.lessonId, definition: quizzes.definition })
    .from(quizzes)
    .innerJoin(lessons, eq(lessons.id, quizzes.lessonId))
    .where(eq(lessons.courseId, courseId));
}
export function findAttempt(db: Db, id: string) {
  return db.select().from(attempts).where(eq(attempts.id, id)).get();
}
export function recentAttempts(db: Db, enrollmentId: string, lessonId: string, revision: string) {
  return db
    .select({ result: attempts.result })
    .from(attempts)
    .where(
      and(
        eq(attempts.enrollmentId, enrollmentId),
        eq(attempts.lessonId, lessonId),
        eq(attempts.quizRevision, revision),
      ),
    )
    .orderBy(desc(attempts.createdAt), desc(attempts.id))
    .limit(10);
}

/** A new revision invalidates unissued completion; issued certificates remain immutable. */
export async function saveQuiz(
  db: Db,
  lessonId: string,
  courseId: string,
  ownerId: string,
  definition: QuizDefinition,
  revision: string,
) {
  const now = Date.now();
  const editable = sql`EXISTS (SELECT 1 FROM ${courses} WHERE ${courses.id} = ${courseId}
    AND ${courses.instructorId} = ${ownerId} AND ${courses.status} IN ('draft', 'rejected', 'published'))`;
  const newRevision = sql`EXISTS (SELECT 1 FROM ${quizzes} WHERE ${quizzes.lessonId} = ${lessonId} AND ${quizzes.revision} = ${revision})`;
  const [saved] = await db.batch([
    db
      .insert(quizzes)
      .select(
        sql`SELECT ${lessonId}, ${revision}, ${JSON.stringify(definition)}, ${now}
      FROM ${lessons} WHERE ${lessons.id} = ${lessonId} AND ${lessons.courseId} = ${courseId}
      AND ${lessons.type} = 'quiz' AND ${editable}`,
      )
      .onConflictDoUpdate({
        target: quizzes.lessonId,
        set: { revision, definition: JSON.stringify(definition), updatedAt: new Date(now) },
        setWhere: editable,
      })
      .returning({ lessonId: quizzes.lessonId }),
    db
      .update(lessonProgress)
      .set({ completedAt: null, updatedAt: new Date(now) })
      .where(and(eq(lessonProgress.lessonId, lessonId), newRevision)),
    db
      .update(enrollments)
      .set({ completedAt: null, updatedAt: new Date(now) })
      .where(and(eq(enrollments.courseId, courseId), newRevision)),
  ]);
  return Boolean(saved.length);
}

/** Receipt guard prevents concurrent idempotent retries from repeating progress side effects. */
export async function recordAttempt(
  db: Db,
  values: {
    enrollmentId: string;
    lessonId: string;
    courseId: string;
    userId: string;
    answers: string;
    result: QuizResult;
    receiptId: string;
  },
) {
  const { enrollmentId, lessonId, courseId, userId, answers, result, receiptId } = values;
  const now = Date.parse(result.submittedAt);
  const receipt = sql`EXISTS (SELECT 1 FROM ${attempts} WHERE ${attempts.id} = ${result.attemptId}
    AND ${attempts.receiptId} = ${receiptId})`;
  await db.batch([
    db
      .insert(attempts)
      .select(
        sql`SELECT ${result.attemptId}, ${enrollmentId}, ${lessonId}, ${result.revision},
      ${answers}, ${JSON.stringify(result)}, ${result.passed ? 1 : 0}, ${receiptId}, ${now}
      FROM ${quizzes} JOIN ${lessons} ON ${lessons.id} = ${quizzes.lessonId}
      JOIN ${courses} ON ${courses.id} = ${lessons.courseId}
      JOIN ${enrollments} ON ${enrollments.courseId} = ${courses.id}
      WHERE ${quizzes.lessonId} = ${lessonId} AND ${quizzes.revision} = ${result.revision}
        AND ${lessons.type} = 'quiz' AND ${courses.id} = ${courseId} AND ${courses.status} IN ('published', 'archived')
        AND ${enrollments.id} = ${enrollmentId} AND ${enrollments.userId} = ${userId}
        AND (SELECT count(*) FROM ${attempts} WHERE ${attempts.enrollmentId} = ${enrollmentId}
          AND ${attempts.lessonId} = ${lessonId} AND ${attempts.createdAt} > ${now - 3_600_000}) < 20`,
      )
      .onConflictDoNothing({ target: attempts.id }),
    db
      .insert(lessonProgress)
      .select(
        sql`SELECT ${enrollmentId}, ${lessonId}, ${now}, ${now}, ${now}
      WHERE ${result.passed ? 1 : 0} = 1 AND ${receipt}`,
      )
      .onConflictDoUpdate({
        target: [lessonProgress.enrollmentId, lessonProgress.lessonId],
        set: {
          completedAt: sql`coalesce(${lessonProgress.completedAt}, ${now})`,
          updatedAt: new Date(now),
        },
      }),
    refreshEnrollmentProgress(db, enrollmentId, courseId, new Date(now), receipt),
  ]);
  return findAttempt(db, result.attemptId);
}
