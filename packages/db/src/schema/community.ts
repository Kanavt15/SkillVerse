/** Enrollment-scoped Q&A and a staff-reviewed abuse queue; hidden content stays available for review. */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { id, timestamps } from './_columns';
import { courses, lessons } from './catalog';
import { users } from './identity';

const moderationColumns = () => ({
  /** Hidden content is excluded from learner responses but retained for staff decisions. */
  hiddenAt: integer('hidden_at', { mode: 'timestamp_ms' }),
  /** Staff member who last hid or restored the content. */
  moderatedBy: text('moderated_by').references(() => users.id, { onDelete: 'set null' }),
  /** Staff feedback, private to the author and moderation queue. */
  moderationNotes: text('moderation_notes'),
});

export const discussionQuestions = sqliteTable(
  'discussion_questions',
  {
    id: id(),
    /** Course membership gates all reads and writes. */
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    /** Nullable for a course-wide question; deleted lessons retain the conversation. */
    lessonId: text('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
    /** Preserve conversation history when an account is erased. */
    authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Plain title and sanitized Markdown body. */
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Optional video moment; only valid for the selected course video lesson. */
    timestampSeconds: integer('timestamp_seconds'),
    /** Service validates that this references a visible reply in this question. */
    acceptedReplyId: text('accepted_reply_id'),
    ...moderationColumns(),
    ...timestamps(),
  },
  (t) => [
    index('discussion_questions_course_idx').on(t.courseId, t.createdAt),
    index('discussion_questions_lesson_idx').on(t.lessonId),
  ],
);

export const discussionReplies = sqliteTable(
  'discussion_replies',
  {
    id: id(),
    /** A reply always belongs to one question; membership is checked through that question. */
    questionId: text('question_id')
      .notNull()
      .references(() => discussionQuestions.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Sanitized Markdown, bounded by the shared schema. */
    body: text('body').notNull(),
    ...moderationColumns(),
    ...timestamps(),
  },
  (t) => [index('discussion_replies_question_idx').on(t.questionId, t.createdAt)],
);

export const contentReports = sqliteTable(
  'content_reports',
  {
    id: id(),
    /** Polymorphic target; the service verifies the target's course and current visibility. */
    targetType: text('target_type', { enum: ['question', 'reply', 'review'] }).notNull(),
    targetId: text('target_id').notNull(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    /** Reports are never exposed to the reported user or course instructor. */
    reporterUserId: text('reporter_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason', {
      enum: ['spam', 'harassment', 'unsafe', 'misleading', 'other'],
    }).notNull(),
    details: text('details').notNull(),
    status: text('status', { enum: ['open', 'resolved', 'dismissed'] })
      .notNull()
      .default('open'),
    /** Optimistic version prevents a stale staff tab overwriting a newer decision. */
    version: integer('version').notNull().default(0),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    reviewNotes: text('review_notes'),
    /** Unique operation token scopes the target/audit writes inside an atomic D1 batch. */
    decisionToken: text('decision_token'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('content_reports_reporter_target_idx').on(
      t.reporterUserId,
      t.targetType,
      t.targetId,
    ),
    index('content_reports_status_idx').on(t.status, t.createdAt),
  ],
);
