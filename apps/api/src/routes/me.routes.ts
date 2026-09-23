/**
 * /api/v1/me/*: the signed-in user's own account. Every route requires a session
 * (enforced by `requireAuth` on the router) and only ever touches the caller's data.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { changePasswordSchema, idSchema, updateProfileSchema } from '@skillverse/shared';
import { depsFrom } from '../lib/deps';
import {
  createRouter,
  errors,
  jsonBody,
  jsonResponse,
  MessageSchema,
  sessionSecurity,
  success,
} from '../lib/openapi';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import * as account from '../services/account.service';
import { changePassword } from '../services/auth.service';
import { MeSchema, SessionSchema } from './schemas';

const tags = ['Account'];
const security = sessionSecurity;

const getMe = createRoute({
  method: 'get',
  path: '/me',
  tags,
  security,
  summary: 'The signed-in user',
  responses: { 200: jsonResponse('OK', success(MeSchema)), ...errors(401) },
});

const patchProfile = createRoute({
  method: 'patch',
  path: '/me/profile',
  tags,
  security,
  summary: 'Update profile and onboarding answers',
  request: { body: jsonBody(updateProfileSchema) },
  responses: { 200: jsonResponse('Updated', success(MeSchema)), ...errors(400, 401) },
});

const listSessions = createRoute({
  method: 'get',
  path: '/me/sessions',
  tags,
  security,
  summary: 'Devices signed in to this account',
  responses: { 200: jsonResponse('OK', success(z.array(SessionSchema))), ...errors(401) },
});

const revokeSession = createRoute({
  method: 'delete',
  path: '/me/sessions/{handle}',
  tags,
  security,
  summary: 'Sign out one device',
  request: { params: z.object({ handle: idSchema }) },
  responses: { 200: jsonResponse('Signed out', success(MessageSchema)), ...errors(401, 404) },
});

const revokeOthers = createRoute({
  method: 'post',
  path: '/me/sessions/revoke-others',
  tags,
  security,
  summary: 'Sign out every other device',
  responses: { 200: jsonResponse('Done', success(MessageSchema)), ...errors(401) },
});

const postPassword = createRoute({
  method: 'post',
  path: '/me/password',
  tags,
  security,
  summary: 'Change password (signs out other devices)',
  request: { body: jsonBody(changePasswordSchema) },
  responses: { 200: jsonResponse('Changed', success(MessageSchema)), ...errors(400, 401, 429) },
});

const router = createRouter();
router.use('/me', requireAuth);
router.use('/me/*', requireAuth);
router.use('/me/password', rateLimit('RL_AUTH', 'change-password'));

export const meRoutes = router
  .openapi(getMe, async (c) => {
    return c.json(
      { ok: true as const, data: await account.getMe(c.get('db'), c.get('auth')!) },
      200,
    );
  })
  .openapi(patchProfile, async (c) => {
    const auth = c.get('auth')!;
    const input = c.req.valid('json');
    await account.updateProfile(c.get('db'), auth.user.id, input);
    if (input.displayName) auth.user.displayName = input.displayName;
    return c.json({ ok: true as const, data: await account.getMe(c.get('db'), auth) }, 200);
  })
  .openapi(listSessions, async (c) => {
    return c.json(
      { ok: true as const, data: await account.listSessions(c.get('db'), c.get('auth')!) },
      200,
    );
  })
  .openapi(revokeSession, async (c) => {
    await account.revokeSession(c.get('db'), c.get('auth')!, c.req.valid('param').handle);
    return c.json({ ok: true as const, data: { message: 'Device signed out.' } }, 200);
  })
  .openapi(revokeOthers, async (c) => {
    await account.revokeOtherSessions(c.get('db'), c.get('auth')!);
    return c.json({ ok: true as const, data: { message: 'All other devices signed out.' } }, 200);
  })
  .openapi(postPassword, async (c) => {
    const auth = c.get('auth')!;
    const { currentPassword, newPassword } = c.req.valid('json');
    await changePassword(depsFrom(c), {
      userId: auth.user.id,
      currentTokenHash: auth.session.tokenHash,
      currentPassword,
      newPassword,
    });
    return c.json({ ok: true as const, data: { message: 'Password changed.' } }, 200);
  });
