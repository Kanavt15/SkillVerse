/** Enrollment, protected lesson access, private notes, progress and earned completion credentials. */
import type { AuthContext } from '../env';
import {
  newId,
  quizDefinitionFromJson,
  quizResultSchema,
  type Certificate,
  type LearningCourse,
  type LearnerQuiz,
} from '@skillverse/shared';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { canLearnLesson } from '../policies';
import { findCatalogCourse, listLearningRows } from '../repositories/catalog.repository';
import { findLesson } from '../repositories/courses.repository';
import * as repository from '../repositories/learning.repository';
import * as quizzes from '../repositories/quizzes.repository';
import { curriculum, publicCourse, publishedCourse } from './catalog.service';

function assertVerified(auth: AuthContext) {
  if (!auth.user.emailVerified)
    throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address first.');
}

async function enrolled(d: RequestDeps, auth: AuthContext, slug: string) {
  const row = await findCatalogCourse(d.db, slug);
  if (!row || !['published', 'archived'].includes(row.course.status))
    throw new AppError('NOT_FOUND', 'Course not found.');
  const enrollment = await repository.findEnrollment(d.db, auth.user.id, row.course.id);
  if (!enrollment)
    throw new AppError('NOT_FOUND', 'Enrollment not found. Enroll in the course first.');
  return { row, enrollment };
}

export async function enroll(d: RequestDeps, auth: AuthContext, slug: string) {
  assertVerified(auth);
  const row = await publishedCourse(d, slug);
  // A course becoming paid later must not revoke an existing learner's access.
  const existing = await repository.findEnrollment(d.db, auth.user.id, row.course.id);
  if (!existing) {
    if (row.course.priceInPaise !== 0)
      throw new AppError(
        'FORBIDDEN',
        'This course requires a purchase. Checkout is not available yet.',
      );
    if (!(await repository.enrollFree(d.db, auth.user.id, row.course.id)))
      throw new AppError('CONFLICT', 'The course changed. Refresh the page and try again.');
  }
  const sections = await curriculum(d, row.course.id);
  return { firstLessonId: sections.flatMap((s) => s.lessons)[0]?.id ?? null };
}

export async function myLearning(d: RequestDeps, auth: AuthContext): Promise<LearningCourse[]> {
  const rows = await listLearningRows(d.db, auth.user.id);
  return rows.map((r) => ({
    ...publicCourse(r),
    status: r.course.status as 'published' | 'archived',
    completedLessons: r.completedLessons,
    progressPercent: r.course.lessonCount
      ? Math.min(100, Math.floor((r.completedLessons / r.course.lessonCount) * 100))
      : 0,
    nextLessonId: r.nextLessonId,
    completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
    lastAccessedAt: new Date(r.lastAccessedAt).toISOString(),
    certificateSerial: r.certificateSerial,
  }));
}

export async function enrollmentStatus(d: RequestDeps, auth: AuthContext, slug: string) {
  const row = await publishedCourse(d, slug);
  const enrollment = await repository.findEnrollment(d.db, auth.user.id, row.course.id);
  const [sections, done, review] = enrollment
    ? await Promise.all([
        curriculum(d, row.course.id),
        repository.completedLessons(d.db, enrollment.id),
        repository.myReview(d.db, enrollment.id),
      ])
    : ([[], [], null] as const);
  const lessons = sections.flatMap((section) => section.lessons);
  const completed = new Set(done.map((lesson) => lesson.lessonId));
  return {
    enrolled: Boolean(enrollment),
    nextLessonId: lessons.find((lesson) => !completed.has(lesson.id))?.id ?? lessons[0]?.id ?? null,
    review: review ?? null,
  };
}

/** The only read path that returns lesson bodies or video ids. */
export async function player(
  d: RequestDeps,
  auth: AuthContext | null,
  slug: string,
  lessonId: string,
) {
  const row = await findCatalogCourse(d.db, slug);
  const lesson = await findLesson(d.db, lessonId);
  const enrollment =
    row && auth ? await repository.findEnrollment(d.db, auth.user.id, row.course.id) : undefined;
  if (
    !row ||
    !lesson ||
    !canLearnLesson(auth, row.course, lesson, enrollment) ||
    (!enrollment && row.instructorStatus !== 'active')
  )
    throw new AppError('NOT_FOUND', 'Lesson not found. Enroll to access the full course.');
  const [sections, done, notes, certificate] = await Promise.all([
    curriculum(d, row.course.id),
    enrollment ? repository.completedLessons(d.db, enrollment.id) : [],
    enrollment ? repository.listNotes(d.db, enrollment.id, lesson.id) : [],
    enrollment ? repository.findCertificate(d.db, enrollment.id) : undefined,
  ]);
  const ids = sections.flatMap((s) => s.lessons.map((l) => l.id));
  const index = ids.indexOf(lessonId);
  let quiz: LearnerQuiz | null = null;
  if (lesson.type === 'quiz') {
    const saved = await quizzes.findQuiz(d.db, lessonId);
    const definition = quizDefinitionFromJson(saved?.definition);
    if (saved && definition) {
      const attempts = enrollment
        ? await quizzes.recentAttempts(d.db, enrollment.id, lessonId, saved.revision)
        : [];
      const results = attempts.map((a) => quizResultSchema.parse(JSON.parse(a.result)));
      quiz = {
        revision: saved.revision,
        passingPercent: definition.passingPercent,
        questions: definition.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
        })),
        lastAttempt: results[0] ?? null,
        recentAttempts: results.map(({ feedback: _feedback, ...summary }) => summary),
      };
    }
  }
  return {
    course: { id: row.course.id, slug, title: row.course.title },
    lesson: {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      durationMinutes: lesson.durationMinutes,
      isPreview: lesson.isPreview,
      contentMarkdown: lesson.contentMarkdown,
      quiz,
      video:
        lesson.videoProvider && lesson.videoRef && lesson.videoProvider !== 'r2'
          ? { provider: lesson.videoProvider, ref: lesson.videoRef }
          : null,
    },
    sections,
    enrolled: Boolean(enrollment),
    completedLessonIds: done.map((l) => l.lessonId),
    notes: notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    previousLessonId: ids[index - 1] ?? null,
    nextLessonId: ids[index + 1] ?? null,
    certificateSerial: certificate?.serial ?? null,
  };
}

/** Shared learner-write policy: a current enrollment and a lesson from exactly that course. */
export async function enrolledLesson(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  lessonId: string,
) {
  const access = await enrolled(d, auth, slug);
  const lesson = await findLesson(d.db, lessonId);
  if (!lesson || !canLearnLesson(auth, access.row.course, lesson, access.enrollment))
    throw new AppError('NOT_FOUND', 'Lesson not found.');
  return { ...access, lesson };
}

export async function progress(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  lessonId: string,
  completed: boolean,
) {
  const { row, enrollment, lesson } = await enrolledLesson(d, auth, slug, lessonId);
  if (lesson.type === 'quiz' && completed)
    throw new AppError('FORBIDDEN', 'Pass the quiz to complete this lesson.');
  await repository.setProgress(d.db, enrollment.id, row.course.id, lessonId, completed);
}

export async function addNote(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  lessonId: string,
  input: { body: string; timestampSeconds: number | null },
) {
  const { enrollment, lesson } = await enrolledLesson(d, auth, slug, lessonId);
  if (input.timestampSeconds !== null && lesson.type !== 'video')
    throw new AppError('VALIDATION_FAILED', 'Timestamps are only available for video notes.');
  const [note] = await repository.addNote(d.db, enrollment.id, lessonId, input);
  return {
    id: note!.id,
    body: note!.body,
    timestampSeconds: note!.timestampSeconds,
    createdAt: note!.createdAt.toISOString(),
  };
}
export async function deleteNote(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  lessonId: string,
  noteId: string,
) {
  const { enrollment } = await enrolledLesson(d, auth, slug, lessonId);
  if (!(await repository.deleteNote(d.db, enrollment.id, lessonId, noteId)).length)
    throw new AppError('NOT_FOUND', 'Note not found.');
}

export async function review(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  input: { rating: number; body: string },
) {
  assertVerified(auth);
  const { row, enrollment } = await enrolled(d, auth, slug);
  if (row.course.instructorId === auth.user.id)
    throw new AppError('FORBIDDEN', "You can't review your own course.");
  if (!(await repository.completedLessons(d.db, enrollment.id)).length)
    throw new AppError('FORBIDDEN', 'Complete at least one lesson before reviewing this course.');
  await repository.saveReview(d.db, enrollment.id, auth.user.id, row.course.id, input);
}

type CertificateRow = NonNullable<Awaited<ReturnType<typeof repository.findCertificate>>>;
function credential(row: CertificateRow): Certificate {
  return {
    serial: row.serial,
    learnerName: row.learnerName,
    courseTitle: row.courseTitle,
    courseSlug: row.courseSlug,
    instructorName: row.instructorName,
    lessonCount: row.lessonCount,
    issuedAt: row.issuedAt.toISOString(),
    signature: row.signature,
    version: 1,
  };
}

function claims(c: Certificate): string {
  return JSON.stringify([
    c.version,
    c.serial,
    c.learnerName,
    c.courseTitle,
    c.courseSlug,
    c.instructorName,
    c.lessonCount,
    c.issuedAt,
  ]);
}
async function signingKey(env: Env) {
  if (!env.CERTIFICATE_SIGNING_KEY)
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'Certificate signing is not configured. Please try again later.',
    );
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.CERTIFICATE_SIGNING_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function issueCertificate(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
): Promise<Certificate> {
  const { row, enrollment } = await enrolled(d, auth, slug);
  const existing = await repository.findCertificate(d.db, enrollment.id);
  if (existing) return credential(existing);
  const sections = await curriculum(d, row.course.id);
  const ids = sections.flatMap((s) => s.lessons.map((l) => l.id));
  const done = new Set(
    (await repository.completedLessons(d.db, enrollment.id)).map((l) => l.lessonId),
  );
  if (!ids.length || !ids.every((id) => done.has(id)))
    throw new AppError('FORBIDDEN', 'Complete every lesson to earn your certificate.');
  const value = {
    serial: newId(),
    enrollmentId: enrollment.id,
    learnerName: auth.user.displayName,
    courseTitle: row.course.title,
    courseSlug: slug,
    instructorName: row.instructorName,
    lessonCount: ids.length,
    issuedAt: new Date(),
    signature: '',
  };
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(d.env),
    new TextEncoder().encode(claims(credential(value))),
  );
  value.signature = Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  await repository.insertCertificate(d.db, value, row.course.id);
  const issued = await repository.findCertificate(d.db, enrollment.id);
  if (!issued)
    throw new AppError('CONFLICT', 'The curriculum changed. Finish the new lessons and try again.');
  return credential(issued);
}

export async function verifyCertificate(d: RequestDeps, serial: string): Promise<Certificate> {
  const row = await repository.certificateBySerial(d.db, serial);
  if (!row || !/^[a-f0-9]{64}$/.test(row.signature))
    throw new AppError('NOT_FOUND', 'Certificate not found.');
  const c = credential(row);
  const bytes = Uint8Array.from(row.signature.match(/../g)!, (hex) => parseInt(hex, 16));
  if (
    !(await crypto.subtle.verify(
      'HMAC',
      await signingKey(d.env),
      bytes,
      new TextEncoder().encode(claims(c)),
    ))
  )
    throw new AppError('NOT_FOUND', 'Certificate could not be verified.');
  return c;
}
export async function myCertificates(d: RequestDeps, auth: AuthContext) {
  return (await repository.listCertificates(d.db, auth.user.id)).map((r) =>
    credential(r.credential),
  );
}
