/**
 * Security headers for API responses.
 *
 * The API only returns JSON, so its Content-Security-Policy can be the
 * strictest possible ("load nothing, embed nowhere"). The web app sets its own,
 * richer CSP for HTML pages. Routes may override a header (e.g. the dev-only
 * /api/docs page needs scripts), which is why we only fill in missing headers.
 */
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';

const API_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  // API data is per-user; never let a shared cache store it unless a route opts in.
  'Cache-Control': 'no-store',
};

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(API_HEADERS)) {
    if (!c.res.headers.has(name)) c.res.headers.set(name, value);
  }
  if (c.env.ENVIRONMENT === 'production') {
    c.res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
});
