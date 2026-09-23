/**
 * Bot protection with Cloudflare Turnstile (free, privacy-friendly CAPTCHA alternative).
 *
 * The website renders the Turnstile widget on sign-up, sign-in and similar
 * forms, and forwards the one-time token it produces in the
 * `x-turnstile-token` header. This middleware asks Cloudflare whether the token
 * is valid before the route runs.
 *
 * - Off when TURNSTILE_SECRET_KEY isn't set (local development works offline).
 * - Fails OPEN if Cloudflare's verify endpoint can't be reached (logged), so an
 *   outage there doesn't lock everyone out. Rate limits and account lockout still apply.
 */
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { clientIp } from './rate-limit';

export const TURNSTILE_HEADER = 'x-turnstile-token';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function requireHuman(opts: { fetcher?: typeof fetch } = {}) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const secret = c.env.TURNSTILE_SECRET_KEY;
    if (!secret) return next();

    const token = c.req.header(TURNSTILE_HEADER);
    const reject = () => {
      throw new AppError('VALIDATION_FAILED', 'Please complete the security check.', {
        turnstile: ['Please complete the security check and try again.'],
      });
    };
    if (!token || token.length > 2048) reject();

    let result: { success?: boolean; 'error-codes'?: string[] };
    try {
      const res = await (opts.fetcher ?? fetch)(VERIFY_URL, {
        method: 'POST',
        body: new URLSearchParams({ secret, response: token!, remoteip: clientIp(c) }),
        signal: AbortSignal.timeout(4000),
      });
      result = await res.json();
    } catch (err) {
      c.get('log').warn('turnstile.unavailable', { message: (err as Error).message });
      return next();
    }

    if (!result.success) {
      c.get('log').warn('turnstile.failed', { codes: result['error-codes'] ?? [] });
      reject();
    }
    return next();
  });
}
