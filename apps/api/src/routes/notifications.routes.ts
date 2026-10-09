/** Authenticated recipient-scoped notification endpoints, with strict Origin checks for live sockets. */
import { createRoute, z } from '@hono/zod-openapi';
import {
  idSchema,
  notificationCountSchema,
  notificationInboxSchema,
  notificationPreferenceSchema,
  notificationQuerySchema,
} from '@skillverse/shared';
import { depsFrom } from '../lib/deps';
import { AppError } from '../lib/errors';
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
import * as notifications from '../services/notifications.service';
const router = createRouter();
router.use('/me/notifications', requireAuth);
router.use('/me/notifications/*', requireAuth);
const r = <T extends Parameters<typeof createRoute>[0]>(def: T) =>
  createRoute({ tags: ['Notifications'], security: sessionSecurity, ...def });
const ok = <T>(data: T) => ({ ok: true as const, data });
const done = () => ok({ message: 'Saved.' });
const writes = {
  200: jsonResponse('Saved', success(MessageSchema)),
  ...errors(400, 401, 403, 404),
};
export const notificationRoutes = router
  .openapi(
    r({
      method: 'get',
      path: '/me/notifications',
      summary: 'My persisted inbox (20 per page)',
      request: { query: notificationQuerySchema },
      responses: {
        200: jsonResponse('Inbox', success(notificationInboxSchema)),
        ...errors(400, 401),
      },
    }),
    async (c) =>
      c.json(ok(await notifications.inbox(depsFrom(c), c.get('auth')!, c.req.valid('query'))), 200),
  )
  .openapi(
    r({
      method: 'get',
      path: '/me/notifications/unread',
      summary: 'My unread count',
      responses: { 200: jsonResponse('Unread', success(notificationCountSchema)), ...errors(401) },
    }),
    async (c) => c.json(ok(await notifications.unread(depsFrom(c), c.get('auth')!)), 200),
  )
  .openapi(
    r({
      method: 'post',
      path: '/me/notifications/read-all',
      summary: 'Mark all my current alerts read',
      responses: writes,
    }),
    async (c) => {
      await notifications.readAll(depsFrom(c), c.get('auth')!);
      return c.json(done(), 200);
    },
  )
  .openapi(
    r({
      method: 'post',
      path: '/me/notifications/{notificationId}/read',
      summary: 'Mark one owned alert read (retry-safe)',
      request: { params: z.object({ notificationId: idSchema }) },
      responses: writes,
    }),
    async (c) => {
      await notifications.read(depsFrom(c), c.get('auth')!, c.req.valid('param').notificationId);
      return c.json(done(), 200);
    },
  )
  .openapi(
    r({
      method: 'patch',
      path: '/me/notifications/preferences',
      summary: 'Enable or disable future discussion alerts',
      request: { body: jsonBody(notificationPreferenceSchema) },
      responses: writes,
    }),
    async (c) => {
      await notifications.preferences(depsFrom(c), c.get('auth')!, c.req.valid('json').discussions);
      return c.json(done(), 200);
    },
  )
  .openapi(
    r({
      method: 'get',
      path: '/me/notifications/live',
      summary: 'Same-origin authenticated live refresh hints',
      responses: {
        101: { description: 'WebSocket connection' },
        ...errors(401, 403, 429),
        426: { description: 'Upgrade required' },
      },
    }),
    async (c) => {
      const origin = c.req.header('origin');
      if (
        !origin ||
        !c.env.APP_ORIGINS.split(',')
          .map((o) => o.trim())
          .includes(origin)
      )
        throw new AppError('FORBIDDEN', 'Live alerts require an allowed website origin.');
      const auth = c.get('auth')!;
      const response = await c.env.NOTIFICATIONS.getByName(auth.user.id).fetch(
        'https://notifications.internal/connect',
        {
          headers: {
            upgrade: c.req.header('upgrade') ?? '',
            'x-session-hash': auth.session.tokenHash,
            'x-user-id': auth.user.id,
          },
        },
      );
      // Binding responses have immutable headers. Preserve the upgrade when making headers writable for middleware.
      return new Response(response.body, {
        status: response.status,
        headers: new Headers(response.headers),
        webSocket: response.webSocket,
      });
    },
  );
