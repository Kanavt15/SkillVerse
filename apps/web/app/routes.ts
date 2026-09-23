/**
 * URL → page mapping. Every page is listed here explicitly so the site map is
 * readable in one place. See docs/guides/add-a-page.md.
 */
import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),

  // Accounts
  route('signup', 'routes/auth/signup.tsx'),
  route('login', 'routes/auth/login.tsx'),
  route('login/2fa', 'routes/auth/login-2fa.tsx'),
  route('logout', 'routes/auth/logout.tsx'),
  route('check-email', 'routes/auth/check-email.tsx'),
  route('verify-email', 'routes/auth/verify-email.tsx'),
  route('forgot-password', 'routes/auth/forgot-password.tsx'),
  route('reset-password', 'routes/auth/reset-password.tsx'),

  // Signed-in area
  route('onboarding', 'routes/onboarding.tsx'),
  route('dashboard', 'routes/dashboard.tsx'),
  route('settings', 'routes/settings/layout.tsx', [
    index('routes/settings/profile.tsx'),
    route('security', 'routes/settings/security.tsx'),
  ]),

  // Local development helpers (404 elsewhere)
  route('dev/mailbox', 'routes/dev/mailbox.tsx'),

  // Must stay last: renders the 404 page for any unknown URL (with a real 404 status).
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
