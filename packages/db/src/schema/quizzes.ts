/** Versioned lesson quizzes; answer keys stay server-side and attempts belong to an enrollment. */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { lessons } from './catalog';
import { enrollments } from './learning';

export const lessonQuizzes = sqliteTable('lesson_quizzes', {
  lessonId: text('lesson_id')
    .primaryKey()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  /** UUIDv7 changes when the definition changes; stale submissions cannot earn completion. */
  revision: text('revision').notNull(),
  /** Validated QuizDefinition JSON, including the private correct choices and explanations. */
  definition: text('definition').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const quizAttempts = sqliteTable(
  'quiz_attempts',
  {
    /** Client-created UUIDv7 idempotency key. Reuse with different answers is a conflict. */
    id: text('id').primaryKey(),
    enrollmentId: text('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    quizRevision: text('quiz_revision').notNull(),
    /** Canonical selected IDs, compared on replay; never trusted for grading. */
    answers: text('answers').notNull(),
    /** Immutable QuizResult snapshot; visible only to this learner after submission. */
    result: text('result').notNull(),
    passed: integer('passed', { mode: 'boolean' }).notNull(),
    /** Internal write receipt guards progress side effects when a concurrent retry loses its insert. */
    receiptId: text('receipt_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('quiz_attempts_enrollment_lesson_idx').on(t.enrollmentId, t.lessonId, t.createdAt)],
);
