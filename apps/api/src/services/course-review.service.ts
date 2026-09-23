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
import { isStaff } from '../policies';
import {
  findCourse,
  insertReviewEvent,
  listCoursesInReview,
  listReviewEvents,
  setCourseStatus,
} from '../repositories/courses.repository';
import { findUserById } from '../repositories/users.repository';
import { auditInsert } from './audit.service';
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
) {
  assertStaff(auth);
  const course = await findCourse(d.db, courseId);
  if (!course) throw new AppError('NOT_FOUND', 'Course not found.');
  if (course.instructorId === auth.user.id) {
    // Separation of duties: nobody approves their own course.
    throw new AppError('FORBIDDEN', "You can't review your own course.");
  }

  const moved = await setCourseStatus(
    d.db,
    course.id,
    ['in_review'],
    decision === 'approved'
      ? { status: 'published', publishedAt: course.publishedAt ?? new Date(), reviewNotes: null }
      : { status: 'rejected', reviewNotes: notes },
  );
  if (moved.length === 0)
    throw new AppError('CONFLICT', 'This course is no longer waiting for review.');

  await d.db.batch([
    insertReviewEvent(d.db, { courseId: course.id, event: decision, actorId: auth.user.id, notes }),
    auditInsert(d.db, {
      action: decision === 'approved' ? 'course.approved' : 'course.rejected',
      actorUserId: auth.user.id,
      targetType: 'course',
      targetId: course.id,
      requestId: d.requestId,
    }),
  ]);

  const instructor = await findUserById(d.db, course.instructorId);
  if (instructor) {
    const base = appBaseUrl(d.env);
    const url =
      decision === 'approved'
        ? `${base}/courses/${course.slug}`
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
