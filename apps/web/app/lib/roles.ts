/**
 * Role checks for DISPLAY decisions only (which links and pages to show).
 * The API enforces every permission itself; hiding a link is never security.
 */
import { STAFF_ROLES } from '@skillverse/shared';

export function isStaff(roles: readonly string[]): boolean {
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}

export function isInstructor(roles: readonly string[]): boolean {
  return roles.includes('instructor');
}
