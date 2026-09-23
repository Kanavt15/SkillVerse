/**
 * CSRF protection for state-changing requests (POST/PUT/PATCH/DELETE).
 *
 * Cross-Site Request Forgery: a malicious site makes the victim's browser send
 * a request to our API with the victim's cookies. We block that with two checks:
 *
 *   1. `Origin` must be one of APP_ORIGINS. Browsers always send Origin on
 *      cross-origin and non-GET requests, and a page cannot forge it.
 *   2. A custom header (`x-skillverse-client: web`) must be present. A plain
 *      HTML form cannot set custom headers, and cross-origin JS that tries to
 *      triggers a CORS preflight, which we never approve.
 *
 * SameSite=Lax session cookies (Phase 1) are a third, independent layer.
 *
 * Exempt: webhook endpoints. They are called server-to-server by payment
 * providers and authenticate with an HMAC signature instead of cookies.
 */
import { createMiddleware } from 'hono/factory';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@skillverse/shared';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PREFIXES = ['/api/v1/webhooks/'];

export const csrfProtection = createMiddleware<AppEnv>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();

  const path = new URL(c.req.url).pathname;
  if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return next();

  const allowed = c.env.APP_ORIGINS.split(',').map((o) => o.trim());
  const origin = c.req.header('origin');

  if (!origin || !allowed.includes(origin)) {
    c.get('log').warn('csrf.bad_origin', { origin: origin ?? null, path });
    throw new AppError('FORBIDDEN', 'Request origin not allowed.');
  }
  if (c.req.header(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    c.get('log').warn('csrf.missing_header', { path });
    throw new AppError('FORBIDDEN', 'Missing client header.');
  }
  return next();
});
