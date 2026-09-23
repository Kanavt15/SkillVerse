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

/** Roles that run the review queues and the admin area. */
export const STAFF_ROLES = ['moderator', 'admin', 'super_admin'] as const satisfies readonly Role[];

/** Header the web app must send on every state-changing API call (CSRF defence in depth). */
export const CSRF_HEADER = 'x-skillverse-client';
export const CSRF_HEADER_VALUE = 'web';

/** Name of the session cookie. The `__Host-` prefix forces Secure, Path=/ and no Domain. */
export const SESSION_COOKIE_PROD = '__Host-sv_session';
/** Browsers reject `__Host-` cookies on http://localhost, so dev uses a plain name. */
export const SESSION_COOKIE_DEV = 'sv_session';

/**
 * Interests offered during onboarding (slug → label). Until the course catalog
 * exists these are a fixed list; the slugs will match catalog category slugs.
 */
export const INTEREST_OPTIONS = [
  { slug: 'web-development', label: 'Web development' },
  { slug: 'mobile-development', label: 'Mobile apps' },
  { slug: 'data-science', label: 'Data science' },
  { slug: 'ai-ml', label: 'AI & machine learning' },
  { slug: 'design', label: 'Design' },
  { slug: 'marketing', label: 'Digital marketing' },
  { slug: 'business', label: 'Business & startups' },
  { slug: 'personal-finance', label: 'Personal finance' },
  { slug: 'languages', label: 'Languages' },
  { slug: 'music', label: 'Music' },
  { slug: 'photography', label: 'Photography & video' },
  { slug: 'writing', label: 'Writing' },
] as const;

/** Learning goals asked during onboarding, with the text shown to users. */
export const GOAL_OPTIONS = [
  {
    value: 'career_switch',
    label: 'Switch careers',
    hint: 'Build job-ready skills in a new field',
  },
  { value: 'upskill', label: 'Grow in my current role', hint: 'Get better at what I already do' },
  { value: 'hobby', label: 'Learn for fun', hint: 'Explore something I enjoy' },
  { value: 'teach', label: 'Teach and earn', hint: 'Share what I know with others' },
] as const;
