/**
 * /api/v1/auth/*: public account endpoints (register, sign in/out, verify
 * email, password reset). All are behind the strict RL_AUTH rate limiter (app.ts).
 */
import { createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import {
  emailOnlySchema,
  loginSchema,
  mfaCodeSchema,
  registerSchema,
  resetPasswordSchema,
  tokenOnlySchema,
} from '@skillverse/shared';
import type { AppEnv } from '../env';
import { depsFrom } from '../lib/deps';
import { AppError } from '../lib/errors';
import {
  createRouter,
  errors,
  jsonBody,
  jsonResponse,
  MessageSchema,
  success,
} from '../lib/openapi';
import { deleteSession } from '../repositories/sessions.repository';
import { getMe } from '../services/account.service';
import * as auth from '../services/auth.service';
import { verifyPendingSession } from '../services/mfa.service';
import {
  clearSessionCookie,
  resolveSession,
  setSessionCookie,
  type NewSession,
} from '../services/session.service';
import { MeSchema, SignInResultSchema } from './schemas';

const tags = ['Auth'];

/**
 * Sets the cookie for a new session. Returns the "me" payload, or
 * `{ mfaRequired: true }` when the account has 2FA and this is only a pending session.
 */
async function signedIn(c: Context<AppEnv>, session: NewSession) {
  setSessionCookie(c, session.token, session.expiresAt);
  if (session.mfaRequired) return { mfaRequired: true as const };
  const resolved = await resolveSession(c.get('db'), session.token);
  if (resolved?.kind !== 'active') throw new AppError('INTERNAL', 'Session could not be started.');
  return getMe(c.get('db'), resolved.auth);
}

const CHECK_EMAIL = 'If that address can receive email, we have sent further instructions.';

const register = createRoute({
  method: 'post',
  path: '/auth/register',
  tags,
  summary: 'Create an account (sends a verification email)',
  request: { body: jsonBody(registerSchema) },
  responses: {
    202: jsonResponse('Accepted: check your email', success(MessageSchema)),
    ...errors(400, 409, 429),
  },
});

const login = createRoute({
  method: 'post',
  path: '/auth/login',
  tags,
  summary: 'Sign in with email and password',
  request: { body: jsonBody(loginSchema) },
  responses: {
    200: jsonResponse(
      'Signed in (sets the session cookie), or 2FA code needed',
      success(SignInResultSchema),
    ),
    ...errors(400, 401, 403, 429),
  },
});

const logout = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags,
  summary: 'Sign out of this device',
  responses: { 200: jsonResponse('Signed out', success(MessageSchema)) },
});

const verifyEmail = createRoute({
  method: 'post',
  path: '/auth/verify-email',
  tags,
  summary: 'Confirm an email address with the emailed token (signs in)',
  request: { body: jsonBody(tokenOnlySchema) },
  responses: {
    200: jsonResponse('Verified and signed in (or 2FA code needed)', success(SignInResultSchema)),
    ...errors(400, 403, 429),
  },
});

const resendVerification = createRoute({
  method: 'post',
  path: '/auth/resend-verification',
  tags,
  summary: 'Send a new verification email',
  request: { body: jsonBody(emailOnlySchema) },
  responses: { 202: jsonResponse('Accepted', success(MessageSchema)), ...errors(400, 429) },
});

const forgotPassword = createRoute({
  method: 'post',
  path: '/auth/forgot-password',
  tags,
  summary: 'Email a password reset link',
  request: { body: jsonBody(emailOnlySchema) },
  responses: { 202: jsonResponse('Accepted', success(MessageSchema)), ...errors(400, 429) },
});

const resetPassword = createRoute({
  method: 'post',
  path: '/auth/reset-password',
  tags,
  summary: 'Set a new password with the emailed token (signs out other devices, signs in)',
  request: { body: jsonBody(resetPasswordSchema) },
  responses: {
    200: jsonResponse(
      'Password changed and signed in (or 2FA code needed)',
      success(SignInResultSchema),
    ),
    ...errors(400, 403, 429),
  },
});

const mfaVerify = createRoute({
  method: 'post',
  path: '/auth/mfa/verify',
  tags,
  summary: 'Second sign-in step: submit the 2FA code (needs the pending session cookie)',
  request: { body: jsonBody(mfaCodeSchema) },
  responses: {
    200: jsonResponse('Signed in (the session token is rotated)', success(MeSchema)),
    ...errors(400, 401, 429),
  },
});

export const authRoutes = createRouter()
  .openapi(register, async (c) => {
    await auth.register(depsFrom(c), c.req.valid('json'));
    return c.json({ ok: true as const, data: { message: CHECK_EMAIL } }, 202);
  })
  .openapi(login, async (c) => {
    const { session } = await auth.login(depsFrom(c), c.req.valid('json'));
    return c.json({ ok: true as const, data: await signedIn(c, session) }, 200);
  })
  .openapi(logout, async (c) => {
    const current = c.get('auth');
    if (current) await deleteSession(c.get('db'), current.session.tokenHash);
    clearSessionCookie(c);
    return c.json({ ok: true as const, data: { message: 'Signed out.' } }, 200);
  })
  .openapi(verifyEmail, async (c) => {
    const session = await auth.verifyEmail(depsFrom(c), c.req.valid('json').token);
    return c.json({ ok: true as const, data: await signedIn(c, session) }, 200);
  })
  .openapi(resendVerification, async (c) => {
    await auth.resendVerification(depsFrom(c), c.req.valid('json').email);
    return c.json({ ok: true as const, data: { message: CHECK_EMAIL } }, 202);
  })
  .openapi(forgotPassword, async (c) => {
    await auth.requestPasswordReset(depsFrom(c), c.req.valid('json').email);
    return c.json({ ok: true as const, data: { message: CHECK_EMAIL } }, 202);
  })
  .openapi(resetPassword, async (c) => {
    const { token, password } = c.req.valid('json');
    const session = await auth.resetPassword(depsFrom(c), token, password);
    return c.json({ ok: true as const, data: await signedIn(c, session) }, 200);
  })
  .openapi(mfaVerify, async (c) => {
    const pending = c.get('pendingMfa');
    if (!pending)
      throw new AppError('UNAUTHENTICATED', 'Your sign-in has expired. Please sign in again.');
    const session = await verifyPendingSession(depsFrom(c), pending, c.req.valid('json').code);
    const me = await signedIn(c, session);
    if ('mfaRequired' in me) throw new AppError('INTERNAL', 'Unexpected 2FA state.');
    return c.json({ ok: true as const, data: me }, 200);
  });
