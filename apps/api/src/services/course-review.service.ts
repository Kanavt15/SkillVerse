/**
 * The course review queue (staff side): see what's waiting, inspect a
 * submission, approve (→ published) or reject with feedback (→ rejected, the
 * instructor edits and resubmits).
 */
import { submissionChecklist } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { courseDecisionTemplate } from '../lib/email-templates';
import { AppError } from '../lib/errors';
import { canArchivePublishedCourse, isStaff } from '../policies';
import {
  findCourse,
  listCoursesInReview,
  listReviewEvents,
} from '../repositories/courses.repository';
import { findUserById } from '../repositories/users.repository';
import { reviewDecision } from '../repositories/course-lifecycle.repository';
import { buildEditorView } from './course-builder.service';
import { sendEmail } from './email.service';

function assertStaff(auth: AuthContext) {
  if (!isStaff(auth)) throw new AppError('FORBIDDEN', 'Only reviewers can do this.');
}

export async function queue(d: RequestDeps, auth: AuthContext) {
  assertStaff(auth);
  const rows = await listCoursesInReview(d.db);
  return rows.map((r) => ({ ...r, submittedAt: r.submittedAt?.toISOString() ?? null }));
}

/** Full submission (any status) plus its moderation history and checklist. */
export async function inspect(d: RequestDeps, auth: AuthContext, courseId: string) {
  assertStaff(auth);
  const course = await findCourse(d.db, courseId);
  if (!course) throw new AppError('NOT_FOUND', 'Course not found.');
  const [view, history, instructor] = await Promise.all([
    buildEditorView(d, course),
    listReviewEvents(d.db, course.id),
    findUserById(d.db, course.instructorId),
  ]);
  return {
    course: view,
    canArchive: !course.sourceCourseId && canArchivePublishedCourse(auth, course),
    canRestore:
      !course.sourceCourseId &&
      course.instructorId !== auth.user.id &&
      course.status === 'archived',
    canTakedown:
      !course.sourceCourseId &&
      course.instructorId !== auth.user.id &&
      ['published', 'archived'].includes(course.status),
    instructor: instructor
      ? { id: instructor.id, displayName: instructor.displayName, username: instructor.username }
      : null,
    checklist: submissionChecklist(view),
    history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
  };
}

export async function decide(
  d: RequestDeps,
  auth: AuthContext,
  courseId: string,
  decision: 'approved' | 'rejected',
  notes: string | null,
  version: number,
) {
  assertStaff(auth);
  const course = await findCourse(d.db, courseId);
  if (!course) throw new AppError('NOT_FOUND', 'Course not found.');
  if (course.instructorId === auth.user.id) {
    // Separation of duties: nobody approves their own course.
    throw new AppError('FORBIDDEN', "You can't review your own course.");
  }
  if (decision === 'approved') {
    const view = await buildEditorView(d, course);
    if (view.lessonCount > 150 || view.sections.length > 50)
      throw new AppError(
        'VALIDATION_FAILED',
        'Publication supports up to 150 lessons and 50 sections per course.',
      );
    const problems = submissionChecklist(view);
    if (problems.length)
      throw new AppError('VALIDATION_FAILED', 'The course is not ready to publish.', {
        checklist: problems,
      });
  }

  if (
    !(await reviewDecision(
      d.db,
      auth,
      courseId,
      version,
      decision,
      notes,
      d.requestId,
      d.env.ENFORCE_ADMIN_MFA !== 'off',
    ))
  )
    throw new AppError(
      'CONFLICT',
      'The reviewed version, live publication or your access changed. Refresh and review again.',
    );

  const instructor = await findUserById(d.db, course.instructorId);
  if (instructor) {
    const base = appBaseUrl(d.env);
    const url =
      decision === 'approved'
        ? `${base}/courses/${course.sourceCourseId ? (await findCourse(d.db, course.sourceCourseId))!.slug : course.slug}`
        : `${base}/studio/courses/${course.id}`;
    d.waitUntil(
      sendEmail(
        d.env,
        d.log,
        courseDecisionTemplate(
          instructor.email,
          instructor.displayName,
          course.title,
          decision === 'approved',
          notes,
          url,
        ),
      ),
    );
  }
}
