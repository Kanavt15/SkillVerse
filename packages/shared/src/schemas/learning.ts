/** Public catalog and learner contracts shared by the API and SSR website. */
import { z } from 'zod';
import { COURSE_LANGUAGES, COURSE_LEVELS, LESSON_TYPES } from './catalog';
import { idSchema, slugSchema, usernameSchema } from './common';
import { learnerQuizSchema } from './quizzes';
import { videoLearningSchema } from './video-learning';

export const catalogQuerySchema = z.strictObject({
  q: z.string().trim().max(100).default(''),
  category: slugSchema.optional(),
  level: z.enum(COURSE_LEVELS).optional(),
  language: z.enum(Object.keys(COURSE_LANGUAGES) as [string, ...string[]]).optional(),
  price: z.enum(['all', 'free', 'paid']).default('all'),
  sort: z.enum(['newest', 'popular', 'rating']).default('newest'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const courseSlugParams = z.object({ slug: slugSchema });
export const instructorParams = z.object({ username: usernameSchema });
export const learnerLessonParams = z.object({ slug: slugSchema, lessonId: idSchema });
export const noteSchema = z.strictObject({
  body: z.string().trim().min(1, 'Write a note first').max(5000),
  timestampSeconds: z.number().int().min(0).max(36_000).nullable().default(null),
});
export const progressSchema = z.strictObject({ completed: z.boolean() });
export const reviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10, 'Use at least 10 characters').max(2000),
});

export const publicInstructorSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  headline: z.string(),
  bio: z.string(),
});
export const publicCourseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: z.string(),
  category: z.object({ slug: z.string(), name: z.string() }).nullable(),
  level: z.enum(COURSE_LEVELS),
  language: z.string(),
  priceInPaise: z.number().int(),
  lessonCount: z.number().int(),
  durationMinutes: z.number().int(),
  enrollmentCount: z.number().int(),
  ratingAverage: z.number().nullable(),
  ratingCount: z.number().int(),
  instructor: publicInstructorSchema,
});
export const curriculumLessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(LESSON_TYPES),
  durationMinutes: z.number().int(),
  isPreview: z.boolean(),
});
export const curriculumSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  lessons: z.array(curriculumLessonSchema),
});
export const courseDetailSchema = publicCourseSchema.extend({
  description: z.string(),
  learningOutcomes: z.array(z.string()),
  requirements: z.array(z.string()),
  tags: z.array(z.string()),
  sections: z.array(curriculumSectionSchema),
  publishedAt: z.string().nullable(),
});
export const catalogResultSchema = z.object({
  items: z.array(publicCourseSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
});
export const learningCourseSchema = publicCourseSchema.extend({
  status: z.enum(['published', 'archived']),
  completedLessons: z.number().int(),
  progressPercent: z.number().int(),
  nextLessonId: z.string().nullable(),
  completedAt: z.string().nullable(),
  lastAccessedAt: z.string(),
  certificateSerial: z.string().nullable(),
});
export const noteViewSchema = z.object({
  id: z.string(),
  body: z.string(),
  timestampSeconds: z.number().nullable(),
  createdAt: z.string(),
});
export const playerSchema = z.object({
  course: z.object({ id: z.string(), slug: z.string(), title: z.string() }),
  lesson: curriculumLessonSchema.extend({
    contentMarkdown: z.string(),
    video: z.object({ provider: z.enum(['youtube', 'vimeo']), ref: z.string() }).nullable(),
    quiz: learnerQuizSchema.nullable(),
    videoLearning: videoLearningSchema,
  }),
  sections: z.array(curriculumSectionSchema),
  enrolled: z.boolean(),
  completedLessonIds: z.array(z.string()),
  notes: z.array(noteViewSchema),
  previousLessonId: z.string().nullable(),
  nextLessonId: z.string().nullable(),
  certificateSerial: z.string().nullable(),
});
export const reviewViewSchema = z.object({
  id: z.string(),
  rating: z.number().int(),
  body: z.string(),
  author: z.object({ displayName: z.string(), username: z.string() }),
  updatedAt: z.string(),
});
export const enrollmentStatusSchema = z.object({
  enrolled: z.boolean(),
  nextLessonId: z.string().nullable(),
  review: reviewSchema.extend({ hidden: z.boolean() }).nullable(),
});
export const certificateSchema = z.object({
  serial: z.string(),
  learnerName: z.string(),
  courseTitle: z.string(),
  courseSlug: z.string(),
  instructorName: z.string(),
  lessonCount: z.number().int(),
  issuedAt: z.string(),
  signature: z.string(),
  version: z.literal(1),
});
export type PublicCourse = z.infer<typeof publicCourseSchema>;
export type CourseDetail = z.infer<typeof courseDetailSchema>;
export type CatalogResult = z.infer<typeof catalogResultSchema>;
export type LearningCourse = z.infer<typeof learningCourseSchema>;
export type Player = z.infer<typeof playerSchema>;
export type ReviewView = z.infer<typeof reviewViewSchema>;
export type Certificate = z.infer<typeof certificateSchema>;
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;
