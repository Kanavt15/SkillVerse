/**
 * URL → page mapping. Every page is listed here explicitly so the site map is
 * readable in one place. See docs/guides/add-a-page.md.
 */
import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),

  // Published catalog and shareable completion credentials
  route('courses', 'routes/catalog.tsx'),
  route('courses/:slug', 'routes/course.tsx'),
  route('courses/:slug/questions', 'routes/questions.tsx'),
  route('courses/:slug/questions/:questionId', 'routes/question.tsx'),
  route('courses/:slug/report', 'routes/report.tsx'),
  route('categories/:slug', 'routes/category.tsx'),
  route('instructors/:username', 'routes/instructor.tsx'),
  route('verify/:serial', 'routes/verify.tsx'),

  // Accounts
  route('signup', 'routes/auth/signup.tsx'),
  route('login', 'routes/auth/login.tsx'),
  route('login/email', 'routes/auth/email-login.tsx'),
  route('login/email/confirm', 'routes/auth/email-login-confirm.tsx'),
  route('login/2fa', 'routes/auth/login-2fa.tsx'),
  route('logout', 'routes/auth/logout.tsx'),
  route('check-email', 'routes/auth/check-email.tsx'),
  route('verify-email', 'routes/auth/verify-email.tsx'),
  route('forgot-password', 'routes/auth/forgot-password.tsx'),
  route('reset-password', 'routes/auth/reset-password.tsx'),

  // Signed-in area
  route('onboarding', 'routes/onboarding.tsx'),
  route('dashboard', 'routes/dashboard.tsx'),
  route('learning', 'routes/learning.tsx'),
  route('notifications', 'routes/notifications.tsx'),
  route('learn/:slug/:lessonId', 'routes/player.tsx'),
  route('account/certificates', 'routes/certificates.tsx'),
  route('settings', 'routes/settings/layout.tsx', [
    index('routes/settings/profile.tsx'),
    route('security', 'routes/settings/security.tsx'),
  ]),

  // Teaching
  route('teach', 'routes/teach.tsx'),
  route('studio', 'routes/studio/layout.tsx', [
    index('routes/studio/index.tsx'),
    route('courses/:courseId', 'routes/studio/course.tsx'),
    route('courses/:courseId/lessons/:lessonId', 'routes/studio/lesson.tsx'),
  ]),

  // Staff (moderators and admins)
  route('admin', 'routes/admin/layout.tsx', [
    index('routes/admin/index.tsx'),
    route('applications', 'routes/admin/applications.tsx'),
    route('courses', 'routes/admin/courses.tsx'),
    route('courses/:courseId', 'routes/admin/course.tsx'),
    route('reports', 'routes/admin/reports.tsx'),
    route('reports/:reportId', 'routes/admin/report.tsx'),
  ]),

  // Local development helpers (404 elsewhere)
  route('dev/mailbox', 'routes/dev/mailbox.tsx'),

  // Must stay last: renders the 404 page for any unknown URL (with a real 404 status).
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
