/**
 * Authorization policies: the ONLY place that decides "may this user do this
 * to that thing?". Routes check coarse access with middleware (requireAuth,
 * requireRole); services call these functions for resource-level decisions.
 *
 * Rules of thumb:
 *   - Deny by default: a function returns true only for explicitly allowed cases.
 *   - For things a user isn't allowed to SEE, services answer NOT_FOUND (not
 *     FORBIDDEN), so ids can't be probed to discover other people's drafts.
 */
import { STAFF_ROLES, type Role } from '@skillverse/shared';
import type { AuthContext } from '../env';

type Course = { instructorId: string; status: string };

/** Admins, super-admins and moderators run the review queues. */
export function isStaff(auth: AuthContext | null): boolean {
  return Boolean(auth?.roles.some((r) => (STAFF_ROLES as readonly Role[]).includes(r)));
}

/** Account identities and controls are reserved for admins, rather than content moderators. */
export function canManageUsers(auth: AuthContext | null): boolean {
  return Boolean(auth?.roles.some((role) => role === 'admin' || role === 'super_admin'));
}

/** The account workspace cannot alter staff, the acting admin, or deleted accounts. */
export function canManageUser(
  auth: AuthContext,
  target: { id: string; status: string; roles: readonly Role[] },
): boolean {
  return (
    canManageUsers(auth) &&
    target.id !== auth.user.id &&
    target.status !== 'deleted' &&
    !target.roles.some((role) => (STAFF_ROLES as readonly Role[]).includes(role))
  );
}

/** May create courses: an approved instructor with a verified email. */
export function canTeach(auth: AuthContext | null): boolean {
  return Boolean(auth?.user.emailVerified && auth.roles.includes('instructor'));
}

export function ownsCourse(auth: AuthContext | null, course: Course): boolean {
  return Boolean(auth && course.instructorId === auth.user.id);
}

/** Publication moderation is separate from the instructor's own archive workflow. */
export function canArchivePublishedCourse(auth: AuthContext | null, course: Course): boolean {
  return isStaff(auth) && !ownsCourse(auth, course) && course.status === 'published';
}

/** Who may see a course that isn't published: its owner and staff. */
export function canViewUnpublishedCourse(auth: AuthContext | null, course: Course): boolean {
  return ownsCourse(auth, course) || isStaff(auth);
}

/**
 * Owners edit draft/rejected copies. Published changes require a private revision;
 * in-review, archived and taken-down content is locked.
 */
export function canEditCourse(auth: AuthContext | null, course: Course): boolean {
  return (
    canTeach(auth) && ownsCourse(auth, course) && ['draft', 'rejected'].includes(course.status)
  );
}

/** Public previews require publication; enrollment grants access even after archival. */
export function canLearnLesson(
  auth: AuthContext | null,
  course: { id: string; status: string },
  lesson: { courseId: string; isPreview: boolean; retiredAt?: Date | null },
  enrollment: { userId: string; courseId: string; createdAt?: Date } | undefined,
): boolean {
  if (lesson.courseId !== course.id) return false;
  if (lesson.retiredAt && (!enrollment?.createdAt || enrollment.createdAt > lesson.retiredAt))
    return false;
  if (
    enrollment &&
    auth &&
    enrollment.userId === auth.user.id &&
    enrollment.courseId === course.id
  ) {
    return ['published', 'archived'].includes(course.status);
  }
  return course.status === 'published' && lesson.isPreview;
}
