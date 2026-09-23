/**
 * Response schemas for teaching endpoints (Studio, instructor applications,
 * review queues). Documented in OpenAPI.
 */
import { z } from '@hono/zod-openapi';
import { COURSE_LEVELS, COURSE_STATUSES, LESSON_TYPES } from '@skillverse/shared';

export const LessonEditorSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.enum(LESSON_TYPES),
    position: z.number().int(),
    isPreview: z.boolean(),
    durationMinutes: z.number().int(),
    contentMarkdown: z.string(),
    video: z
      .object({ provider: z.enum(['youtube', 'vimeo']), ref: z.string(), url: z.string() })
      .nullable(),
  })
  .openapi('LessonEditor');

export const CourseEditorSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    categoryId: z.string().nullable(),
    level: z.enum(COURSE_LEVELS),
    language: z.string(),
    priceInPaise: z.number().int(),
    currency: z.string(),
    learningOutcomes: z.array(z.string()),
    requirements: z.array(z.string()),
    tags: z.array(z.string()),
    status: z.enum(COURSE_STATUSES),
    reviewNotes: z.string().nullable(),
    lessonCount: z.number().int(),
    durationMinutes: z.number().int(),
    submittedAt: z.string().nullable(),
    publishedAt: z.string().nullable(),
    updatedAt: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        position: z.number().int(),
        lessons: z.array(LessonEditorSchema),
      }),
    ),
  })
  .openapi('CourseEditor');

export const CourseSummarySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    status: z.enum(COURSE_STATUSES),
    priceInPaise: z.number().int(),
    lessonCount: z.number().int(),
    durationMinutes: z.number().int(),
    enrollmentCount: z.number().int(),
    reviewNotes: z.string().nullable(),
    updatedAt: z.string(),
  })
  .openapi('CourseSummary');

export const ApplicationSchema = z
  .object({
    id: z.string(),
    status: z.enum(['pending', 'approved', 'rejected']),
    headline: z.string(),
    topics: z.array(z.string()),
    experience: z.string(),
    sampleUrl: z.string().nullable(),
    reviewNotes: z.string().nullable(),
    createdAt: z.string(),
    reviewedAt: z.string().nullable(),
  })
  .openapi('InstructorApplication');

export const ApplicationForReviewSchema = z
  .object({
    id: z.string(),
    status: z.enum(['pending', 'approved', 'rejected']),
    headline: z.string(),
    topics: z.array(z.string()),
    experience: z.string(),
    sampleUrl: z.string().nullable(),
    reviewNotes: z.string().nullable(),
    createdAt: z.string(),
    applicant: z.object({
      id: z.string(),
      displayName: z.string(),
      username: z.string(),
      email: z.string(),
    }),
  })
  .openapi('InstructorApplicationForReview');

export const ReviewQueueItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    submittedAt: z.string().nullable(),
    lessonCount: z.number().int(),
    durationMinutes: z.number().int(),
    priceInPaise: z.number().int(),
    instructor: z.object({ id: z.string(), displayName: z.string(), username: z.string() }),
  })
  .openapi('ReviewQueueItem');

export const CourseInspectionSchema = z
  .object({
    course: CourseEditorSchema,
    instructor: z
      .object({ id: z.string(), displayName: z.string(), username: z.string() })
      .nullable(),
    checklist: z.array(z.string()),
    history: z.array(
      z.object({
        event: z.enum(['submitted', 'approved', 'rejected', 'archived']),
        notes: z.string().nullable(),
        createdAt: z.string(),
        actorName: z.string().nullable(),
      }),
    ),
  })
  .openapi('CourseInspection');
