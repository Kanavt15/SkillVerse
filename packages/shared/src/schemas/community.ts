/** Course Q&A, reports and moderation contracts shared by the API and form routes. */
import { z } from 'zod';
import { idSchema } from './common';
import { courseSlugParams } from './learning';

export const questionParams = courseSlugParams.extend({ questionId: idSchema });
export const questionQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  lessonId: idSchema.optional(),
  status: z.enum(['all', 'unanswered', 'resolved']).default('all'),
});
export const questionSchema = z.strictObject({
  title: z.string().trim().min(5).max(160),
  body: z.string().trim().min(10).max(5000),
  lessonId: idSchema.nullable().default(null),
  timestampSeconds: z.number().int().min(0).max(36000).nullable().default(null),
});
export const replySchema = z.strictObject({ body: z.string().trim().min(10).max(5000) });
export const solutionSchema = z.strictObject({ replyId: idSchema.nullable() });
export const REPORT_REASONS = ['spam', 'harassment', 'unsafe', 'misleading', 'other'] as const;
export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: 'Spam or promotion',
  harassment: 'Harassment or hate',
  unsafe: 'Unsafe content',
  misleading: 'Misleading information',
  other: 'Another concern',
};
export const reportSchema = z.strictObject({
  targetType: z.enum(['question', 'reply', 'review']),
  targetId: idSchema,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().min(10).max(2000),
});
export const reportQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  status: z.enum(['open', 'resolved', 'dismissed']).default('open'),
});
export const moderationSchema = z.strictObject({
  decision: z.enum(['hide', 'dismiss', 'restore']),
  notes: z.string().trim().min(10).max(2000),
  version: z.number().int().min(0),
});

const authorSchema = z.object({
  displayName: z.string(),
  username: z.string().nullable(),
  instructor: z.boolean(),
});
export const questionViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  author: authorSchema,
  lesson: z.object({ id: z.string(), title: z.string() }).nullable(),
  timestampSeconds: z.number().nullable(),
  acceptedReplyId: z.string().nullable(),
  replyCount: z.number().int(),
  canResolve: z.boolean(),
});
export const replyViewSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  author: authorSchema,
});
export const questionListSchema = z.object({
  course: z.object({ slug: z.string(), title: z.string(), archived: z.boolean() }),
  items: z.array(questionViewSchema),
  total: z.number().int(),
  page: z.number().int(),
  totalPages: z.number().int(),
  lessons: z.array(z.object({ id: z.string(), title: z.string(), type: z.string() })),
});
export const questionDetailSchema = z.object({
  course: z.object({ slug: z.string(), title: z.string(), archived: z.boolean() }),
  question: questionViewSchema,
  replies: z.array(replyViewSchema),
  acceptedReply: replyViewSchema.nullable(),
  page: z.number().int(),
  totalReplies: z.number().int(),
  totalPages: z.number().int(),
});
export const moderationReportSchema = z.object({
  id: z.string(),
  targetType: reportSchema.shape.targetType,
  targetId: z.string(),
  reason: reportSchema.shape.reason,
  details: z.string(),
  status: z.enum(['open', 'resolved', 'dismissed']),
  createdAt: z.string(),
  version: z.number().int(),
  reviewNotes: z.string().nullable(),
  course: z.object({ slug: z.string(), title: z.string() }),
  reporter: z.object({ displayName: z.string() }),
});
export const moderationListSchema = z.object({
  items: z.array(moderationReportSchema),
  total: z.number().int(),
  page: z.number().int(),
  totalPages: z.number().int(),
});
export const moderationDetailSchema = z.object({
  report: moderationReportSchema,
  content: z
    .object({
      title: z.string(),
      body: z.string(),
      hidden: z.boolean(),
      authorId: z.string().nullable(),
    })
    .nullable(),
});
export type QuestionInput = z.infer<typeof questionSchema>;
export type QuestionQuery = z.infer<typeof questionQuerySchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ModerationInput = z.infer<typeof moderationSchema>;
export type QuestionView = z.infer<typeof questionViewSchema>;
export type ReplyView = z.infer<typeof replyViewSchema>;
export type QuestionList = z.infer<typeof questionListSchema>;
export type QuestionDetail = z.infer<typeof questionDetailSchema>;
export type ModerationReport = z.infer<typeof moderationReportSchema>;
export type ModerationList = z.infer<typeof moderationListSchema>;
export type ModerationDetail = z.infer<typeof moderationDetailSchema>;
