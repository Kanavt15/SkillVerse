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
import type { AuthContext } from '../env';

type Course = { instructorId: string; status: string };

/** Admins, super-admins and moderators run the review queues. */
export function isStaff(auth: AuthContext | null): boolean {
  return Boolean(
    auth?.roles.some((r) => r === 'admin' || r === 'super_admin' || r === 'moderator'),
  );
}

/** May create courses: an approved instructor with a verified email. */
export function canTeach(auth: AuthContext | null): boolean {
  return Boolean(auth?.user.emailVerified && auth.roles.includes('instructor'));
}

export function ownsCourse(auth: AuthContext | null, course: Course): boolean {
  return Boolean(auth && course.instructorId === auth.user.id);
}

/** Who may see a course that isn't published: its owner and staff. */
export function canViewUnpublishedCourse(auth: AuthContext | null, course: Course): boolean {
  return ownsCourse(auth, course) || isStaff(auth);
}

/**
 * The owner may edit while the course is a draft, rejected (fixing feedback) or
 * published (keeping content current). NOT while in review (the reviewer must
 * see what was submitted) and not once archived.
 */
export function canEditCourse(auth: AuthContext | null, course: Course): boolean {
  return (
    canTeach(auth) &&
    ownsCourse(auth, course) &&
    ['draft', 'rejected', 'published'].includes(course.status)
  );
}
