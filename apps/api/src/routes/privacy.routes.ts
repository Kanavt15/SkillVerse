import { AppError } from '../lib/errors';
import * as teacher from '../services/teacher-verification.service';
/** Private account rights and a consented, server-verified guardian journey. */
import { createRoute, z } from '@hono/zod-openapi';
import {
  eligibilitySchema,
  ownProofSchema,
  deleteAccountSchema,
  instructorAgreementSchema,
  mediaConsentSchema,
  guardianRequestSchema,
  guardianDecisionSchema,
  guardianStartSchema,
  guardianFinishSchema,
  guardianInviteSchema,
  guardianWithdrawSchema,
  supportRequestSchema,
  supportReplySchema,
  idSchema,
  privatePageQuerySchema,
} from '@skillverse/shared';
import { createRouter, errors, jsonBody, jsonResponse, success } from '../lib/openapi';
import { depsFrom } from '../lib/deps';
import { requireAuth, requireMfa, requireRole } from '../middleware/auth';
import { requireHuman } from '../middleware/turnstile';
import { rateLimit } from '../middleware/rate-limit';
import { clearSessionCookie } from '../services/session.service';
import { confirmEligibility } from '../repositories/consent.repository';
import * as privacy from '../services/privacy.service';
import * as guardians from '../services/guardian.service';
import * as setu from '../services/setu.service';
import * as exports from '../services/privacy-export.service';
import * as support from '../services/support.service';

const router = createRouter();
router.use('/me/privacy', requireAuth);
router.use('/me/privacy/*', requireAuth);
router.use('/me/privacy/teacher/start', requireAuth);
router.use('/me/guardians', requireAuth);
router.use('/me/guardians/*', requireAuth);
router.use('/me/support', requireAuth);
router.use('/admin/guardians', requireRole('admin', 'super_admin'), requireMfa);
router.use('/admin/guardians/*', requireRole('super_admin'), requireMfa);
router.use('/admin/support', requireRole('admin', 'super_admin'), requireMfa);
router.use('/admin/support/*', requireRole('admin', 'super_admin'), requireMfa);
router.use('/support', requireHuman(), rateLimit('RL_AUTH', 'contact'));
router.use('/support/confirm', rateLimit('RL_AUTH', 'contact-confirm'));
router.use('/me/privacy/*', (c, next) =>
  ['GET', 'HEAD'].includes(c.req.method)
    ? next()
    : rateLimit('RL_AUTH', 'privacy', (ctx) => ctx.get('auth')!.user.id)(c, next),
);
router.use('/me/guardians/*', (c, next) =>
  ['GET', 'HEAD'].includes(c.req.method)
    ? next()
    : rateLimit('RL_AUTH', 'guardian', (ctx) => ctx.get('auth')!.user.id)(c, next),
);
const response = {
  200: jsonResponse('Owner-private result', success(z.unknown())),
  ...errors(400, 401, 403, 404, 409, 429),
};
const saved = { message: 'Saved.' };
router.openapi(
  createRoute({ method: 'get', path: '/me/privacy', tags: ['Privacy'], responses: response }),
  async (c) =>
    c.json({ ok: true as const, data: await privacy.details(depsFrom(c), c.get('auth')!) }, 200),
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/eligibility',
    tags: ['Privacy'],
    request: { body: jsonBody(eligibilitySchema) },
    responses: response,
  }),
  async (c) => {
    const auth = c.get('auth')!;
    await confirmEligibility(
      c.get('db'),
      auth.user.id,
      auth.user.email,
      c.req.valid('json'),
      c.get('requestId'),
      auth.session.tokenHash,
    );
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/instructor-terms',
    tags: ['Privacy'],
    request: { body: jsonBody(instructorAgreementSchema) },
    responses: response,
  }),
  async (c) => {
    await privacy.preference(depsFrom(c), c.get('auth')!, 'instructor', true);
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/media',
    tags: ['Privacy'],
    request: { body: jsonBody(mediaConsentSchema) },
    responses: response,
  }),
  async (c) => {
    await privacy.preference(depsFrom(c), c.get('auth')!, 'media', c.req.valid('json').enabled);
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/delete',
    tags: ['Privacy'],
    request: { body: jsonBody(deleteAccountSchema) },
    responses: response,
  }),
  async (c) => {
    await privacy.eraseAccount(depsFrom(c), c.get('auth')!, c.req.valid('json'));
    clearSessionCookie(c);
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'get',
    path: '/me/privacy/exports',
    tags: ['Privacy'],
    responses: response,
  }),
  async (c) =>
    c.json({ ok: true as const, data: await exports.list(depsFrom(c), c.get('auth')!) }, 200),
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/exports',
    tags: ['Privacy'],
    request: { body: jsonBody(ownProofSchema) },
    responses: response,
  }),
  async (c) =>
    c.json(
      {
        ok: true as const,
        data: await exports.create(depsFrom(c), c.get('auth')!, c.req.valid('json')),
      },
      200,
    ),
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/unlock',
    tags: ['Privacy'],
    request: { body: jsonBody(ownProofSchema) },
    responses: response,
  }),
  async (c) => {
    await exports.unlock(depsFrom(c), c.get('auth')!, c.req.valid('json'));
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.get('/me/privacy/exports/:id/download', async (c) => {
  const parsed = idSchema.safeParse(c.req.param('id'));
  if (!parsed.success) throw new AppError('NOT_FOUND', 'Export not found.');
  const id = parsed.data;
  const stream = await exports.download(depsFrom(c), c.get('auth')!, id);
  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'content-disposition': `attachment; filename="skillverse-${id}.ndjson"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});
for (const admin of [false, true]) {
  router.openapi(
    createRoute({
      method: 'get',
      path: admin ? '/admin/guardians' : '/me/guardians',
      tags: ['Privacy'],
      request: { query: privatePageQuerySchema },
      responses: response,
    }),
    async (c) =>
      c.json(
        {
          ok: true as const,
          data: await guardians.list(depsFrom(c), c.get('auth')!, admin, c.req.valid('query').page),
        },
        200,
      ),
  );
  router.openapi(
    createRoute({
      method: 'get',
      path: admin ? '/admin/support' : '/me/support',
      tags: ['Contact'],
      request: { query: privatePageQuerySchema },
      responses: response,
    }),
    async (c) =>
      c.json(
        {
          ok: true as const,
          data: await support.list(depsFrom(c), c.get('auth')!, admin, c.req.valid('query').page),
        },
        200,
      ),
  );
}
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/guardians',
    tags: ['Privacy'],
    request: { body: jsonBody(guardianRequestSchema) },
    responses: response,
  }),
  async (c) =>
    c.json(
      {
        ok: true as const,
        data: await guardians.requestConsent(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('json').scope,
        ),
      },
      200,
    ),
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/guardians/invite',
    tags: ['Privacy'],
    request: { body: jsonBody(guardianInviteSchema) },
    responses: response,
  }),
  async (c) =>
    c.json(
      {
        ok: true as const,
        data: await guardians.invite(depsFrom(c), c.get('auth')!, c.req.valid('json')),
      },
      200,
    ),
);
const params = z.object({ id: idSchema });
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/guardians/{id}/start',
    tags: ['Privacy'],
    request: { params, body: jsonBody(guardianStartSchema) },
    responses: response,
  }),
  async (c) =>
    c.json(
      {
        ok: true as const,
        data: await setu.start(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      },
      200,
    ),
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/guardians/{id}/finish',
    tags: ['Privacy'],
    request: { params, body: jsonBody(guardianFinishSchema) },
    responses: response,
  }),
  async (c) => {
    await setu.finish(depsFrom(c), c.get('auth')!, c.req.valid('param').id, c.req.valid('json'));
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/guardians/{id}/withdraw',
    tags: ['Privacy'],
    request: { params, body: jsonBody(guardianWithdrawSchema) },
    responses: response,
  }),
  async (c) => {
    await guardians.withdraw(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/admin/guardians/{id}/decision',
    tags: ['Privacy'],
    request: { params, body: jsonBody(guardianDecisionSchema) },
    responses: response,
  }),
  async (c) => {
    await guardians.decide(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/support',
    tags: ['Contact'],
    request: { body: jsonBody(supportRequestSchema) },
    responses: response,
  }),
  async (c) => {
    await support.create(depsFrom(c), c.get('auth'), c.req.valid('json'));
    return c.json(
      {
        ok: true as const,
        data: {
          message:
            'Request received. If you are signed out, check your email to confirm it before staff can read it.',
        },
      },
      200,
    );
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/support/confirm',
    tags: ['Contact'],
    request: { body: jsonBody(z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })) },
    responses: response,
  }),
  async (c) => {
    await support.confirm(depsFrom(c), c.req.valid('json').token);
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/admin/support/{id}/reply',
    tags: ['Contact'],
    request: { params, body: jsonBody(supportReplySchema) },
    responses: response,
  }),
  async (c) => {
    await support.reply(depsFrom(c), c.get('auth')!, c.req.valid('param').id, c.req.valid('json'));
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
router.openapi(
  createRoute({
    method: 'get',
    path: '/me/privacy/teacher',
    tags: ['Privacy'],
    responses: response,
  }),
  async (c) =>
    c.json({ ok: true as const, data: await teacher.details(depsFrom(c), c.get('auth')!) }, 200),
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/teacher/start',
    tags: ['Privacy'],
    request: { body: jsonBody(guardianStartSchema.omit({ version: true })) },
    responses: response,
  }),
  async (c) =>
    c.json(
      {
        ok: true as const,
        data: await teacher.start(depsFrom(c), c.get('auth')!, c.req.valid('json')),
      },
      200,
    ),
);
router.openapi(
  createRoute({
    method: 'post',
    path: '/me/privacy/teacher/finish',
    tags: ['Privacy'],
    request: { body: jsonBody(guardianFinishSchema.omit({ version: true })) },
    responses: response,
  }),
  async (c) => {
    await teacher.finish(depsFrom(c), c.get('auth')!, c.req.valid('json'));
    return c.json({ ok: true as const, data: saved }, 200);
  },
);
export const privacyRoutes = router;
