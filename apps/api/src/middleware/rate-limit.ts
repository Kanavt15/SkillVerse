/**
 * Rate limiting using Cloudflare's built-in Rate Limiting binding
 * (configured under `ratelimits` in wrangler.jsonc).
 *
 *   app.use('/api/v1/auth/*', rateLimit('RL_AUTH', 'auth'));
 *
 * Counters are per Cloudflare location and eventually consistent, so this is a
 * brake against abuse (credential stuffing, scraping), not an exact quota.
 */
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';

type LimiterBinding = 'RL_API' | 'RL_AUTH';

/** Client IP as seen by Cloudflare. Falls back to a constant in local tests. */
export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('cf-connecting-ip') ?? '127.0.0.1';
}

/**
 * @param binding  which limiter from wrangler.jsonc to use
 * @param scope    label mixed into the key so different route groups don't share a counter
 * @param keyFn    what to count by (default: client IP)
 */
export function rateLimit(
  binding: LimiterBinding,
  scope: string,
  keyFn: (c: Context<AppEnv>) => string = clientIp,
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { success } = await c.env[binding].limit({ key: `${scope}:${keyFn(c)}` });
    if (!success) {
      c.get('log').warn('rate_limited', { scope });
      c.header('Retry-After', '60');
      throw new AppError('RATE_LIMITED', 'Too many requests. Please wait a minute and try again.');
    }
    return next();
  });
}
