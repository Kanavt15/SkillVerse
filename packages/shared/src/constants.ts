/**
 * Product-wide constants shared by the API and the web app.
 */

export const APP_NAME = 'SkillVerse';

/**
 * Roles a user can hold. A user may hold several (e.g. learner + instructor).
 * `learner` is implicit for every account. Authorization decisions are made by
 * the policy functions in apps/api/src/policies, never by comparing roles inline.
 */
export const ROLES = [
  'learner',
  'instructor',
  'mentor',
  'moderator',
  'org_admin',
  'admin',
  'super_admin',
] as const;
export type Role = (typeof ROLES)[number];

/** Header the web app must send on every state-changing API call (CSRF defence in depth). */
export const CSRF_HEADER = 'x-skillverse-client';
export const CSRF_HEADER_VALUE = 'web';

/** Name of the session cookie. The `__Host-` prefix forces Secure, Path=/ and no Domain. */
export const SESSION_COOKIE_PROD = '__Host-sv_session';
/** Browsers reject `__Host-` cookies on http://localhost, so dev uses a plain name. */
export const SESSION_COOKIE_DEV = 'sv_session';
