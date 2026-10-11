/** Staff publication moderation: inspect through the review service, archive with an explained decision. */
import type { AdminCourseQuery } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { courseArchivedTemplate } from '../lib/email-templates';
import { AppError } from '../lib/errors';
import { canArchivePublishedCourse, isStaff, ownsCourse } from '../policies';
import * as repository from '../repositories/course-moderation.repository';
import { findCourse } from '../repositories/courses.repository';
import { findUserById } from '../repositories/users.repository';
import { sendEmail } from './email.service';

export async function listCourses(d: RequestDeps, auth: AuthContext, query: AdminCourseQuery) {
  if (!isStaff(auth)) throw new AppError('FORBIDDEN', 'Staff access required.');
  const [rows, counts] = await repository.listCourses(d.db, query),
    total = counts[0]?.total ?? 0;
  return {
    items: rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
    total,
    page: query.page,
    totalPages: Math.max(1, Math.ceil(total / repository.STAFF_COURSE_PAGE_SIZE)),
  };
}

export async function archive(d: RequestDeps, auth: AuthContext, courseId: string, notes: string) {
  if (!isStaff(auth)) throw new AppError('FORBIDDEN', 'Staff access required.');
  const course = await findCourse(d.db, courseId);
  if (!course) throw new AppError('NOT_FOUND', 'Course not found.');
  if (ownsCourse(auth, course))
    throw new AppError('FORBIDDEN', 'Use Studio to archive your own course.');
  if (
    !canArchivePublishedCourse(auth, course) ||
    !(await repository.archivePublished(d.db, course.id, auth.user.id, notes, d.requestId, {
      tokenHash: auth.session.tokenHash,
      requireMfa: d.env.ENFORCE_ADMIN_MFA !== 'off',
    }))
  )
    throw new AppError(
      'CONFLICT',
      'This course is no longer published or your access changed. Refresh and review it again.',
    );
  const instructor = await findUserById(d.db, course.instructorId);
  if (instructor)
    d.waitUntil(
      sendEmail(
        d.env,
        d.log,
        courseArchivedTemplate(
          instructor.email,
          instructor.displayName,
          course.title,
          notes,
          `${appBaseUrl(d.env)}/studio/courses/${course.id}`,
        ),
      ),
    );
}
