/** Membership checks and public DTOs for Q&A; staff-only report inspection and decisions. */
import {
  STAFF_ROLES,
  type ModerationInput,
  type ModerationReport,
  type QuestionInput,
  type QuestionQuery,
  type QuestionView,
  type ReplyView,
  type ReportInput,
  type ReportQuery,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { findCatalogCourse } from '../repositories/catalog.repository';
import { findLesson } from '../repositories/courses.repository';
import { findEnrollment } from '../repositories/learning.repository';
import * as repository from '../repositories/community.repository';
import { curriculum } from './catalog.service';

async function access(d: RequestDeps, auth: AuthContext, slug: string, write = false) {
  const row = await findCatalogCourse(d.db, slug);
  if (!row || !['published', 'archived'].includes(row.course.status))
    throw new AppError('NOT_FOUND', 'Course not found.');
  const enrollment = await findEnrollment(d.db, auth.user.id, row.course.id);
  const instructor = row.course.instructorId === auth.user.id;
  const staff = STAFF_ROLES.some((role) => auth.roles.includes(role));
  if (!enrollment && !instructor) {
    if (!staff) throw new AppError('NOT_FOUND', 'Enroll in this course to join its Q&A.');
    if (!auth.user.mfaEnabled && d.env.ENFORCE_ADMIN_MFA !== 'off')
      throw new AppError(
        'MFA_SETUP_REQUIRED',
        'Turn on two-factor authentication to inspect course discussions.',
      );
  }
  if (write) {
    if (!auth.user.emailVerified)
      throw new AppError('EMAIL_NOT_VERIFIED', 'Verify your email to join the discussion.');
    if (row.course.status !== 'published')
      throw new AppError('FORBIDDEN', 'This archived course is read-only.');
  }
  return row.course;
}
type Course = Awaited<ReturnType<typeof access>>;
const courseView = (course: Course) => ({
  slug: course.slug,
  title: course.title,
  archived: course.status === 'archived',
});
type QuestionRow = NonNullable<Awaited<ReturnType<typeof repository.findQuestion>>>;
function questionView(row: QuestionRow, course: Course, auth: AuthContext): QuestionView {
  const q = row.question;
  return {
    id: q.id,
    title: q.title,
    body: q.body,
    createdAt: q.createdAt.toISOString(),
    author: {
      displayName: row.displayName ?? 'Deleted learner',
      username: row.username,
      instructor: q.authorUserId === course.instructorId,
    },
    lesson: q.lessonId && row.lessonTitle ? { id: q.lessonId, title: row.lessonTitle } : null,
    timestampSeconds: q.timestampSeconds,
    acceptedReplyId: q.acceptedReplyId,
    replyCount: row.replyCount,
    canResolve:
      course.status === 'published' &&
      (q.authorUserId === auth.user.id || course.instructorId === auth.user.id),
  };
}
type ReplyRow = NonNullable<Awaited<ReturnType<typeof repository.findReply>>>;
function replyView(row: ReplyRow, course: Course): ReplyView {
  return {
    id: row.reply.id,
    body: row.reply.body,
    createdAt: row.reply.createdAt.toISOString(),
    author: {
      displayName: row.displayName ?? 'Deleted learner',
      username: row.username,
      instructor: row.reply.authorUserId === course.instructorId,
    },
  };
}
async function question(d: RequestDeps, course: Course, id: string) {
  const row = await repository.findQuestion(d.db, course.id, id);
  if (!row) throw new AppError('NOT_FOUND', 'Question not found.');
  return row;
}
export async function list(d: RequestDeps, auth: AuthContext, slug: string, query: QuestionQuery) {
  const course = await access(d, auth, slug);
  if (query.lessonId && (await findLesson(d.db, query.lessonId))?.courseId !== course.id)
    throw new AppError('NOT_FOUND', 'Lesson not found.');
  const [rows, count, sections] = await Promise.all([
    repository.listQuestions(d.db, course.id, query),
    repository.countQuestions(d.db, course.id, query),
    curriculum(d, course.id),
  ]);
  const total = count?.total ?? 0;
  return {
    course: courseView(course),
    items: rows.map((r) => questionView(r, course, auth)),
    total,
    page: query.page,
    totalPages: Math.max(1, Math.ceil(total / repository.PAGE_SIZE)),
    lessons: sections.flatMap((s) =>
      s.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type })),
    ),
  };
}
export async function detail(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  id: string,
  page: number,
) {
  const course = await access(d, auth, slug),
    row = await question(d, course, id);
  const [replies, accepted] = await Promise.all([
    repository.listReplies(d.db, id, page),
    row.question.acceptedReplyId
      ? repository.findReply(d.db, id, row.question.acceptedReplyId)
      : undefined,
  ]);
  return {
    course: courseView(course),
    question: questionView(row, course, auth),
    replies: replies.map((r) => replyView(r, course)),
    acceptedReply: accepted ? replyView(accepted, course) : null,
    page,
    totalReplies: row.replyCount,
    totalPages: Math.max(1, Math.ceil(row.replyCount / repository.PAGE_SIZE)),
  };
}
export async function ask(d: RequestDeps, auth: AuthContext, slug: string, input: QuestionInput) {
  const course = await access(d, auth, slug, true);
  const lesson = input.lessonId ? await findLesson(d.db, input.lessonId) : null;
  if (input.lessonId && lesson?.courseId !== course.id)
    throw new AppError('NOT_FOUND', 'Lesson not found.');
  if (input.timestampSeconds !== null && lesson?.type !== 'video')
    throw new AppError('VALIDATION_FAILED', 'Choose a video lesson to add a timestamp.');
  const row = await repository.addQuestion(d.db, course.id, auth.user.id, input);
  if (!row) throw new AppError('CONFLICT', 'The course changed. Refresh and try again.');
  return { id: row.question.id };
}
export async function reply(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  id: string,
  body: string,
) {
  const course = await access(d, auth, slug, true);
  await question(d, course, id);
  const row = await repository.addReply(d.db, course.id, id, auth.user.id, body);
  if (!row) throw new AppError('CONFLICT', 'The question changed. Refresh and try again.');
  return { id: row.reply.id };
}
export async function solution(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  id: string,
  replyId: string | null,
) {
  const course = await access(d, auth, slug, true),
    row = await question(d, course, id);
  if (row.question.authorUserId !== auth.user.id && course.instructorId !== auth.user.id)
    throw new AppError(
      'FORBIDDEN',
      'Only the question author or course instructor can choose an answer.',
    );
  if (replyId && !(await repository.findReply(d.db, id, replyId)))
    throw new AppError('NOT_FOUND', 'Reply not found.');
  if (!(await repository.setSolution(d.db, course.id, id, replyId)).length)
    throw new AppError('CONFLICT', 'The discussion changed. Refresh and try again.');
}
export async function report(d: RequestDeps, auth: AuthContext, slug: string, input: ReportInput) {
  const course = await access(d, auth, slug);
  if (!auth.user.emailVerified)
    throw new AppError('EMAIL_NOT_VERIFIED', 'Verify your email before reporting content.');
  const content = await repository.targetContent(d.db, input.targetType, input.targetId);
  if (
    !content ||
    content.courseId !== course.id ||
    content.hidden ||
    ('parentHidden' in content && content.parentHidden)
  )
    throw new AppError('NOT_FOUND', 'Content not found.');
  await repository.addReport(d.db, course.id, auth.user.id, input);
}
type ReportRow = NonNullable<Awaited<ReturnType<typeof repository.findReport>>>;
function reportView(row: ReportRow): ModerationReport {
  const r = row.report;
  return {
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    version: r.version,
    reviewNotes: r.reviewNotes,
    course: { slug: row.courseSlug, title: row.courseTitle },
    reporter: { displayName: row.reporterName },
  };
}
export async function reports(d: RequestDeps, query: ReportQuery) {
  const [rows, count] = await Promise.all([
    repository.listReports(d.db, query),
    repository.countReports(d.db, query),
  ]);
  const total = count?.total ?? 0;
  return {
    items: rows.map(reportView),
    total,
    page: query.page,
    totalPages: Math.max(1, Math.ceil(total / repository.PAGE_SIZE)),
  };
}
export async function inspect(d: RequestDeps, id: string) {
  const row = await repository.findReport(d.db, id);
  if (!row) throw new AppError('NOT_FOUND', 'Report not found.');
  const content = await repository.targetContent(d.db, row.report.targetType, row.report.targetId);
  return {
    report: reportView(row),
    content: content
      ? {
          title: content.title,
          body: content.body,
          hidden: content.hidden,
          authorId: content.authorId,
        }
      : null,
  };
}
export async function decide(
  d: RequestDeps,
  auth: AuthContext,
  id: string,
  input: ModerationInput,
) {
  const row = await repository.findReport(d.db, id);
  if (!row) throw new AppError('NOT_FOUND', 'Report not found.');
  if (
    input.decision !== 'dismiss' &&
    !(await repository.targetContent(d.db, row.report.targetType, row.report.targetId))
  )
    throw new AppError('NOT_FOUND', 'The reported content has been removed. Dismiss this report.');
  if (!(await repository.moderate(d.db, auth.user.id, d.requestId, row.report, input)))
    throw new AppError(
      'CONFLICT',
      'Another staff member reviewed this report. Refresh before deciding.',
    );
}
