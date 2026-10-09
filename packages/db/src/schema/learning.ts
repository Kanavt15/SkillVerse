/** Learner storage. Unique constraints make enrollment, progress and issuance retry-safe. */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id, timestamps } from './_columns';
import { courses, lessons } from './catalog';
import { users } from './identity';

export const enrollments = sqliteTable(
  'enrollments',
  {
    id: id(),
    /** Learner who owns this enrollment. */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Archived courses remain accessible to existing learners. */
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    /** Only free enrollment is granted by this phase; paid access comes from verified settlement later. */
    source: text('source', { enum: ['free', 'purchase', 'plus', 'org', 'gift'] })
      .notNull()
      .default('free'),
    /** Server-set date when the current curriculum was completed. */
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    /** Recent activity powers Continue learning. */
    lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('enrollments_user_course_idx').on(t.userId, t.courseId),
    index('enrollments_user_activity_idx').on(t.userId, t.lastAccessedAt),
    index('enrollments_course_idx').on(t.courseId),
  ],
);

export const lessonProgress = sqliteTable(
  'lesson_progress',
  {
    /** Enrollment, checked against the signed-in learner on every request. */
    enrollmentId: text('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    /** Only a lesson from the enrollment's course can be changed (service policy). */
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    /** NULL = in progress; set = learner-completed video/article or a server-graded quiz pass. */
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.enrollmentId, t.lessonId] }),
    index('lesson_progress_lesson_idx').on(t.lessonId),
  ],
);

export const notes = sqliteTable(
  'notes',
  {
    id: id(),
    /** Private notes belong to an enrollment, never exposed through catalog endpoints. */
    enrollmentId: text('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    /** Plain text rendered through the safe Markdown component. */
    body: text('body').notNull(),
    /** Optional video moment in seconds; NULL for untimed notes. */
    timestampSeconds: integer('timestamp_seconds'),
    ...timestamps(),
  },
  (t) => [index('notes_enrollment_lesson_idx').on(t.enrollmentId, t.lessonId, t.createdAt)],
);

export const reviews = sqliteTable(
  'reviews',
  {
    id: id(),
    /** One review per enrollment; edits replace it. */
    enrollmentId: text('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Integer star rating, 1 to 5, validated at the API boundary. */
    rating: integer('rating').notNull(),
    /** Hidden reviews stay editable by their author but do not affect public ratings. */
    hiddenAt: integer('hidden_at', { mode: 'timestamp_ms' }),
    moderatedBy: text('moderated_by').references(() => users.id, { onDelete: 'set null' }),
    moderationNotes: text('moderation_notes'),
    body: text('body').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('reviews_enrollment_idx').on(t.enrollmentId),
    index('reviews_course_idx').on(t.courseId, t.updatedAt),
  ],
);

export const certificates = sqliteTable(
  'certificates',
  {
    /** Public UUIDv7 verification serial. */
    serial: text('serial').primaryKey(),
    /** At most one immutable completion credential per enrollment. */
    enrollmentId: text('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    /** Immutable signed snapshots; renaming a course or learner never changes an issued credential. */
    learnerName: text('learner_name').notNull(),
    courseTitle: text('course_title').notNull(),
    courseSlug: text('course_slug').notNull(),
    instructorName: text('instructor_name').notNull(),
    lessonCount: integer('lesson_count').notNull(),
    issuedAt: integer('issued_at', { mode: 'timestamp_ms' }).notNull(),
    /** HMAC-SHA256 over the versioned snapshot, using a dedicated secret. */
    signature: text('signature').notNull(),
  },
  (t) => [uniqueIndex('certificates_enrollment_idx').on(t.enrollmentId)],
);
