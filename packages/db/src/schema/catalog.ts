/**
 * Catalog tables: what can be learned, and how courses are structured.
 *
 *   categories ─┬─< courses ─┬─< sections ─< lessons
 *               │            ├─< course_tags >─ tags
 *               │            └─< course_review_events   (moderation history)
 *   users ──────┴─< instructor_applications              (who may teach)
 *
 * Courses move through: draft → in_review → published (or rejected → draft
 * edits → in_review again); published courses can be archived.
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { COURSE_LEVELS, COURSE_STATUSES, LESSON_TYPES } from '@skillverse/shared';
import { id, timestamps } from './_columns';
import { users } from './identity';

// Enum values are shared with the API and website, so they live in @skillverse/shared.
export const VIDEO_PROVIDERS = ['youtube', 'vimeo', 'r2'] as const;

export const categories = sqliteTable(
  'categories',
  {
    id: id(),
    /** URL key, e.g. "web-development". Also used in onboarding interests. */
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    /** Parent for sub-categories; NULL = top level. */
    parentId: text('parent_id').references((): AnySQLiteColumn => categories.id, {
      onDelete: 'set null',
    }),
    /** lucide-react icon name shown in menus, e.g. "code". */
    icon: text('icon').notNull().default('book-open'),
    /** Menu order; lower first. */
    position: integer('position').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('categories_parent_idx').on(t.parentId, t.position)],
);

/** Free-form topic labels ("react", "excel", "guitar-chords"), shared across courses. */
export const tags = sqliteTable('tags', {
  id: id(),
  /** Lower-case, hyphenated, unique. */
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const courses = sqliteTable(
  'courses',
  {
    id: id(),
    /** Instructor who owns the course. RESTRICT: deleting an instructor must be handled explicitly (enrolled learners keep access). */
    instructorId: text('instructor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Public URL key (/courses/:slug). Unique; generated from the title plus a short random suffix. */
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    /** One-line promise shown under the title. Max 160 chars. */
    subtitle: text('subtitle').notNull().default(''),
    /** Full description in Markdown (rendered sanitised). */
    description: text('description').notNull().default(''),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    level: text('level', { enum: COURSE_LEVELS }).notNull().default('all_levels'),
    /** ISO 639-1 language of instruction, e.g. "en", "hi". */
    language: text('language').notNull().default('en'),
    /** Price in PAISE (₹499 = 49900). 0 = free. */
    priceInPaise: integer('price_in_paise').notNull().default(0),
    currency: text('currency', { enum: ['INR'] })
      .notNull()
      .default('INR'),
    /** JSON array of strings: "What you'll learn". */
    learningOutcomes: text('learning_outcomes').notNull().default('[]'),
    /** JSON array of strings: prerequisites. */
    requirements: text('requirements').notNull().default('[]'),
    /** R2 key of the cover image (uploads arrive later in Phase 1). */
    thumbnailKey: text('thumbnail_key'),
    status: text('status', { enum: COURSE_STATUSES }).notNull().default('draft'),
    /** Included in the SkillVerse Plus subscription catalog (Phase 6). */
    isPlusEligible: integer('is_plus_eligible', { mode: 'boolean' }).notNull().default(false),
    /** Denormalised counters, recomputed when lessons change or learners enroll. */
    lessonCount: integer('lesson_count').notNull().default(0),
    durationMinutes: integer('duration_minutes').notNull().default(0),
    enrollmentCount: integer('enrollment_count').notNull().default(0),
    /** Ratings kept as sum + count (integers) so the average never drifts. */
    ratingSum: integer('rating_sum').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    /** Reviewer's latest feedback when rejected (shown to the instructor). */
    reviewNotes: text('review_notes'),
    ...timestamps(),
  },
  (t) => [
    index('courses_status_published_idx').on(t.status, t.publishedAt),
    index('courses_category_status_idx').on(t.categoryId, t.status),
    index('courses_instructor_idx').on(t.instructorId, t.updatedAt),
  ],
);

export const courseTags = sqliteTable(
  'course_tags',
  {
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.tagId] }), index('course_tags_tag_idx').on(t.tagId)],
);

export const sections = sqliteTable(
  'sections',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Order within the course; lower first. */
    position: integer('position').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('sections_course_idx').on(t.courseId, t.position)],
);

export const lessons = sqliteTable(
  'lessons',
  {
    id: id(),
    /** Denormalised from the section so course-wide queries don't need a join. */
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    sectionId: text('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type', { enum: LESSON_TYPES }).notNull().default('video'),
    /** Order within the section; lower first. */
    position: integer('position').notNull().default(0),
    /** Free preview: visible on the course page without enrolling. */
    isPreview: integer('is_preview', { mode: 'boolean' }).notNull().default(false),
    durationMinutes: integer('duration_minutes').notNull().default(0),
    /** Article body / notes under a video, in Markdown (rendered sanitised). */
    contentMarkdown: text('content_markdown').notNull().default(''),
    /** Where the video lives. NULL for non-video lessons. */
    videoProvider: text('video_provider', { enum: VIDEO_PROVIDERS }),
    /** Provider-specific id: YouTube/Vimeo video id, or an R2 object key. Never a full URL. */
    videoRef: text('video_ref'),
    ...timestamps(),
  },
  (t) => [
    index('lessons_section_idx').on(t.sectionId, t.position),
    index('lessons_course_idx').on(t.courseId),
  ],
);

/** People asking to teach. Approval grants the `instructor` role. */
export const instructorApplications = sqliteTable(
  'instructor_applications',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    /** "Senior data analyst, 6 years in fintech". */
    headline: text('headline').notNull(),
    /** JSON array of category slugs they want to teach. */
    topics: text('topics').notNull().default('[]'),
    /** Why they're qualified (experience, credentials). */
    experience: text('experience').notNull(),
    /** Link to a sample of their teaching (YouTube video, blog, GitHub…). https only. */
    sampleUrl: text('sample_url'),
    reviewerId: text('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    /** Reviewer's message to the applicant. */
    reviewNotes: text('review_notes'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('instructor_applications_status_idx').on(t.status, t.createdAt),
    index('instructor_applications_user_idx').on(t.userId, t.createdAt),
  ],
);

/** History of moderation decisions on courses (append-only). */
export const courseReviewEvents = sqliteTable(
  'course_review_events',
  {
    id: id(),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    /** submitted = instructor sent it for review; approved/rejected = reviewer decision. */
    event: text('event', { enum: ['submitted', 'approved', 'rejected', 'archived'] }).notNull(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('course_review_events_course_idx').on(t.courseId, t.createdAt)],
);
