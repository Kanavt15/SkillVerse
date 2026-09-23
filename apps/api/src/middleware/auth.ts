/**
 * Authentication middleware.
 *
 *   loadSession      runs on every /api/v1 request: sets c.var.auth (or null)
 *   requireAuth      401 unless signed in
 *   requireVerified  403 unless the email address is verified
 *   requireRole(...) 403 unless the user holds one of the roles
 *
 * Authorization for specific resources ("can this user edit THIS course?")
 * lives in ../policies, not here.
 */
import { createMiddleware } from 'hono/factory';
import type { Role } from '@skillverse/shared';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { clearSessionCookie, readSessionToken, resolveSession } from '../services/session.service';

export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  c.set('auth', null);
  const token = readSessionToken(c);
  if (token) {
    const resolved = await resolveSession(c.get('db'), token);
    if (resolved) {
      c.set('auth', resolved.auth);
      if (resolved.touch) c.executionCtx.waitUntil(resolved.touch);
    } else {
      // Stale or forged cookie: remove it so the browser stops sending it.
      clearSessionCookie(c);
    }
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('auth')) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
  await next();
});

export const requireVerified = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.get('auth');
  if (!auth) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
  if (!auth.user.emailVerified) {
    throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address first.');
  }
  await next();
});

export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get('auth');
    if (!auth) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
    if (!roles.some((r) => auth.roles.includes(r))) {
      throw new AppError('FORBIDDEN', 'You do not have permission to do this.');
    }
    await next();
  });
}
