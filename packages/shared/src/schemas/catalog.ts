/**
 * Validation for teaching: instructor applications, the course builder and
 * moderation decisions. Shared by the Studio forms and the API.
 */
import { z } from 'zod';
import { idSchema } from './common';

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced', 'all_levels'] as const;
export const COURSE_STATUSES = ['draft', 'in_review', 'published', 'rejected', 'archived'] as const;
export const LESSON_TYPES = ['video', 'article', 'quiz', 'code'] as const;
/** Lesson types the builder can create today (quiz and code editors arrive in later phases). */
export const BUILDABLE_LESSON_TYPES = ['video', 'article'] as const;

/** Languages a course can be taught in (ISO 639-1). Indian languages first after English. */
export const COURSE_LANGUAGES = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
} as const;
export type CourseLanguage = keyof typeof COURSE_LANGUAGES;

export const LEVEL_LABELS: Record<(typeof COURSE_LEVELS)[number], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
};

/** Price rules: free, or ₹199 to ₹4,999 in whole rupees (stored as paise). */
export const MIN_PRICE_PAISE = 19_900;
export const MAX_PRICE_PAISE = 499_900;

const categorySlug = z.string().regex(/^[a-z0-9-]{2,40}$/);
const httpsUrl = z.url({ protocol: /^https$/, message: 'Use a full https:// link' }).max(500);
const shortLine = (max: number) =>
  z.string().trim().min(3, 'Too short').max(max, `At most ${max} characters`);

export const instructorApplicationSchema = z.strictObject({
  headline: z.string().trim().min(10, 'Tell us a bit more (10+ characters)').max(120),
  topics: z.array(categorySlug).min(1, 'Pick at least one topic').max(5, 'Pick up to 5 topics'),
  experience: z
    .string()
    .trim()
    .min(80, 'Please describe your experience in at least 80 characters')
    .max(3000),
  sampleUrl: z.union([z.literal(''), httpsUrl]).optional(),
});
export type InstructorApplicationInput = z.infer<typeof instructorApplicationSchema>;

export const createCourseSchema = z.strictObject({
  title: z.string().trim().min(5, 'Use at least 5 characters').max(120),
  categoryId: idSchema.optional(),
});

export const priceSchema = z
  .number()
  .int()
  .refine(
    (p) => p === 0 || (p >= MIN_PRICE_PAISE && p <= MAX_PRICE_PAISE && p % 100 === 0),
    'Free, or a whole-rupee price between ₹199 and ₹4,999',
  );

export const tagSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Letters, numbers and hyphens')
  .max(40);

export const updateCourseSchema = z.strictObject({
  title: z.string().trim().min(5).max(120).optional(),
  subtitle: z.string().trim().max(160).optional(),
  description: z.string().trim().max(20_000).optional(),
  categoryId: idSchema.nullable().optional(),
  level: z.enum(COURSE_LEVELS).optional(),
  language: z
    .enum(Object.keys(COURSE_LANGUAGES) as [CourseLanguage, ...CourseLanguage[]])
    .optional(),
  priceInPaise: priceSchema.optional(),
  learningOutcomes: z.array(shortLine(200)).max(12).optional(),
  requirements: z.array(shortLine(200)).max(12).optional(),
  tags: z.array(tagSlugSchema).max(10).optional(),
});
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const sectionSchema = z.strictObject({
  title: z.string().trim().min(1, 'Give the section a title').max(120),
});

export const createLessonSchema = z.strictObject({
  title: z.string().trim().min(1, 'Give the lesson a title').max(160),
  type: z.enum(BUILDABLE_LESSON_TYPES),
});

export const updateLessonSchema = z.strictObject({
  title: z.string().trim().min(1).max(160).optional(),
  isPreview: z.boolean().optional(),
  durationMinutes: z.number().int().min(0).max(600).optional(),
  contentMarkdown: z.string().max(50_000).optional(),
  /** A YouTube/Vimeo link, or '' to remove the video. Parsed to an id server-side. */
  videoUrl: z.string().trim().max(500).optional(),
  /** Move the lesson to another section of the same course (goes to the end). */
  sectionId: idSchema.optional(),
});
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

export const reorderSchema = z.strictObject({
  ids: z.array(idSchema).min(1).max(500),
});

export const approveSchema = z.strictObject({
  notes: z.string().trim().max(2000).optional(),
});

export const rejectSchema = z.strictObject({
  notes: z.string().trim().min(10, 'Explain what needs to change (10+ characters)').max(2000),
});
