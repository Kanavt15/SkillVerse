/**
 * Authentication middleware.
 *
 *   loadSession      runs on every /api/v1 request: sets c.var.auth (or null),
 *                    and c.var.pendingMfa for sessions still waiting for a 2FA code
 *   requireAuth      401 unless signed in
 *   requireVerified  403 unless the email address is verified
 *   requireRole(...) 403 unless the user holds one of the roles
 *   requireMfa       403 unless the account has 2FA switched on (admins, payees)
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
  c.set('pendingMfa', null);
  const token = readSessionToken(c);
  if (token) {
    const resolved = await resolveSession(c.get('db'), token);
    if (resolved?.kind === 'active') {
      c.set('auth', resolved.auth);
      if (resolved.touch) c.executionCtx.waitUntil(resolved.touch);
    } else if (resolved?.kind === 'pending_mfa') {
      c.set('pendingMfa', resolved.pending);
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

/**
 * For high-risk areas (admin, payouts): the account must have 2FA switched on.
 * Because pending-2FA sessions never produce `auth`, an active session of a 2FA
 * account has always passed the code check.
 */
export const requireMfa = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.get('auth');
  if (!auth) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
  if (!auth.user.mfaEnabled) {
    throw new AppError(
      'MFA_SETUP_REQUIRED',
      'Turn on two-factor authentication in Settings → Security to access this area.',
    );
  }
  await next();
});
