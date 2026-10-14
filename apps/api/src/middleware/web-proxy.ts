/** Cloudflare + Vercel: only the authenticated SSR proxy may supply the visitor IP. */
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { constantTimeEqual } from '../lib/crypto';
import { AppError } from '../lib/errors';
export const trustedWebProxy = createMiddleware<AppEnv>(async (c, next) => {
  if (c.env.WEB_PROXY_MODE !== 'vercel' || c.req.path === '/api/health') return next();
  const expected = c.env.WEB_PROXY_KEY;
  if (!expected || expected.length < 32)
    throw new AppError('SERVICE_UNAVAILABLE', 'The frontend connection is not configured.');
  const candidate = c.req.header('x-sv-proxy-key') ?? '';
  if (!constantTimeEqual(new TextEncoder().encode(candidate), new TextEncoder().encode(expected))) {
    c.set('skipObservation', true);
    const limit = await c.env.RL_AUTH.limit({
      key: `proxy:${c.req.header('cf-connecting-ip') ?? 'unknown'}`,
    });
    if (!limit.success) {
      c.header('Retry-After', '60');
      throw new AppError('RATE_LIMITED', 'Too many requests.');
    }
    throw new AppError('FORBIDDEN', 'Use the SkillVerse website to access this API.');
  }
  const ip = c.req.header('x-sv-client-ip') ?? '';
  // Values come from Vercel's overwritten edge header, not from the browser's CF header.
  if (ip.length > 45 || !(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-f0-9:]+$/i.test(ip)))
    throw new AppError('VALIDATION_FAILED', 'Invalid visitor address.');
  c.set('trustedClientIp', ip);
  return next();
});
