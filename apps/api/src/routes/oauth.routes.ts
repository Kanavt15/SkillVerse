/**
 * /api/v1/auth/google/*: "Continue with Google". These are browser NAVIGATIONS
 * (not fetch calls), so every outcome is a redirect: into the app on success,
 * or back to /login?error=… on failure. Details go to the log, never to the URL.
 */
import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { constantTimeEqual } from '../lib/crypto';
import { depsFrom } from '../lib/deps';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/openapi';
import { signValue, verifyValue } from '../lib/signed-cookie';
import {
  beginGoogleSignIn,
  exchangeGoogleCode,
  isGoogleEnabled,
  signInWithGoogle,
  type OAuthState,
} from '../services/google-auth.service';
import { setSessionCookie } from '../services/session.service';

const tags = ['Auth'];
const STATE_COOKIE = 'sv_oauth';
const COOKIE_PATH = '/api/v1/auth/google';

/** Same-site path only (open-redirect protection, mirrors the website's safeRedirect). */
function safePath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value))
    return '/dashboard';
  return value.slice(0, 500);
}

function cookieOpts(c: Context<AppEnv>) {
  const secure = c.env.ENVIRONMENT !== 'development';
  return { secure, prefix: secure ? ('secure' as const) : undefined };
}

function fail(c: Context<AppEnv>, reason: string, error = 'google_failed') {
  c.get('log').warn('oauth.google_failed', { reason });
  deleteCookie(c, STATE_COOKIE, { path: COOKIE_PATH, ...cookieOpts(c) });
  return c.redirect(`/login?error=${error}`, 302);
}

const start = createRoute({
  method: 'get',
  path: '/auth/google/start',
  tags,
  summary: 'Begin "Continue with Google" (redirects to Google)',
  request: { query: z.object({ redirectTo: z.string().max(500).optional() }) },
  responses: {
    302: { description: 'Redirect to Google, or back to /login if Google sign-in is off' },
  },
});

const callback = createRoute({
  method: 'get',
  path: '/auth/google/callback',
  tags,
  summary: 'Google redirects here after consent',
  request: {
    query: z.object({
      code: z.string().max(2048).optional(),
      state: z.string().max(200).optional(),
      error: z.string().max(200).optional(),
    }),
  },
  responses: { 302: { description: 'Signed in → app; failure → /login?error=…' } },
});

export const oauthRoutes = createRouter()
  .openapi(start, async (c) => {
    const d = depsFrom(c);
    if (!(await isGoogleEnabled(d))) return c.redirect('/login?error=google_unavailable', 302);
    const { url, state } = await beginGoogleSignIn(
      c.env,
      safePath(c.req.valid('query').redirectTo),
    );
    setCookie(c, STATE_COOKIE, await signValue(state, c.env.COOKIE_SIGNING_KEY), {
      httpOnly: true,
      sameSite: 'Lax', // Google's redirect back is a top-level GET, which Lax allows
      path: COOKIE_PATH,
      maxAge: 600,
      ...cookieOpts(c),
    });
    return c.redirect(url, 302);
  })
  .openapi(callback, async (c) => {
    const d = depsFrom(c);
    const query = c.req.valid('query');
    const saved = await verifyValue<OAuthState>(
      getCookie(c, STATE_COOKIE, cookieOpts(c).prefix),
      c.env.COOKIE_SIGNING_KEY,
    );

    if (query.error) return fail(c, `google returned ${query.error}`, 'google_cancelled');
    if (!saved || saved.exp < Date.now()) return fail(c, 'missing or expired state cookie');
    if (
      !query.state ||
      !constantTimeEqual(
        new TextEncoder().encode(query.state),
        new TextEncoder().encode(saved.state),
      )
    ) {
      return fail(c, 'state mismatch'); // CSRF / mixed-up flows
    }
    if (!query.code) return fail(c, 'missing code');
    if (!(await isGoogleEnabled(d))) return fail(c, 'disabled', 'google_unavailable');

    try {
      const claims = await exchangeGoogleCode(c.env, query.code, saved);
      const { session, onboarded } = await signInWithGoogle(d, claims);
      deleteCookie(c, STATE_COOKIE, { path: COOKIE_PATH, ...cookieOpts(c) });
      setSessionCookie(c, session.token, session.expiresAt);
      const target = session.mfaRequired
        ? `/login/2fa?redirectTo=${encodeURIComponent(saved.redirectTo)}`
        : onboarded
          ? saved.redirectTo
          : '/onboarding';
      return c.redirect(target, 302);
    } catch (err) {
      if (err instanceof AppError && err.code === 'FORBIDDEN')
        return fail(c, err.message, 'account_suspended');
      return fail(c, (err as Error).message);
    }
  });
