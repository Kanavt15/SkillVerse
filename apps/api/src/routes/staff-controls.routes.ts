/** Explicit privileged controls. No generic settings write or bootstrap HTTP endpoint. */
import { createRoute, z } from '@hono/zod-openapi';
import {
  idSchema,
  staffRoleDecisionSchema,
  staffSettingDecisionSchema,
  staffFlagDecisionSchema,
  staffControlsSchema,
  staffAuditSchema,
  staffAuditQuerySchema,
  operationalQuerySchema,
  operationalSummarySchema,
} from '@skillverse/shared';
import {
  createRouter,
  errors,
  jsonBody,
  jsonResponse,
  MessageSchema,
  sessionSecurity,
  success,
} from '../lib/openapi';
import { depsFrom } from '../lib/deps';
import { requireRole, requireMfa } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import * as controls from '../services/staff-controls.service';
import { operationalSummary } from '../services/operational.service';

const route = <T extends Parameters<typeof createRoute>[0]>(definition: T) =>
  createRoute({ tags: ['Staff controls'], security: sessionSecurity, ...definition });
const responses = {
  200: jsonResponse('Saved', success(MessageSchema)),
  ...errors(400, 401, 403, 404, 409, 429),
};
const roles = route({
  method: 'post',
  path: '/admin/users/{userId}/roles',
  summary: 'Super-admin role decision with fresh password/factor, reason and account version',
  request: { params: z.object({ userId: idSchema }), body: jsonBody(staffRoleDecisionSchema) },
  responses,
});
const settings = route({
  method: 'post',
  path: '/admin/controls/settings',
  summary: 'Update an allowlisted operational setting with fresh security proof',
  request: { body: jsonBody(staffSettingDecisionSchema) },
  responses,
});
const flags = route({
  method: 'post',
  path: '/admin/controls/flags',
  summary: 'Update the Google sign-in flag with fresh security proof',
  request: { body: jsonBody(staffFlagDecisionSchema) },
  responses,
});
const configuration = route({
  method: 'get',
  path: '/admin/controls',
  summary: 'Validated platform controls without secrets',
  responses: { 200: jsonResponse('OK', success(staffControlsSchema)), ...errors(401, 403) },
});
const audit = route({
  method: 'get',
  path: '/admin/audit',
  summary: '50 audit decisions with exact filters and a keyset cursor; no raw metadata',
  request: { query: staffAuditQuerySchema },
  responses: { 200: jsonResponse('OK', success(staffAuditSchema)), ...errors(400, 401, 403) },
});
const operations = route({
  method: 'get',
  path: '/admin/operations',
  summary: 'Bounded operational aggregates and last 30 alerts',
  request: { query: operationalQuerySchema },
  responses: {
    200: jsonResponse('OK', success(operationalSummarySchema)),
    ...errors(400, 401, 403),
  },
});
const router = createRouter();
// This router has its own gates even if mounted before the existing admin router.
for (const path of [
  '/admin/controls',
  '/admin/controls/*',
  '/admin/audit',
  '/admin/operations',
  '/admin/users/*/roles',
])
  router.use(path, requireRole('admin', 'super_admin'), requireMfa);
for (const path of ['/admin/controls/settings', '/admin/controls/flags', '/admin/users/*/roles']) {
  router.use(
    path,
    requireRole('super_admin'),
    rateLimit('RL_AUTH', 'staff-control', (c) => c.get('auth')!.user.id),
  );
}
const saved = { ok: true as const, data: { message: 'Decision saved.' } };
export const staffControlsRoutes = router
  .openapi(roles, async (c) => {
    await controls.decideRole(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('param').userId,
      c.req.valid('json'),
    );
    return c.json(saved, 200);
  })
  .openapi(settings, async (c) => {
    await controls.decideSetting(depsFrom(c), c.get('auth')!, c.req.valid('json'));
    return c.json(saved, 200);
  })
  .openapi(flags, async (c) => {
    await controls.decideFlag(depsFrom(c), c.get('auth')!, c.req.valid('json'));
    return c.json(saved, 200);
  })
  .openapi(configuration, async (c) =>
    c.json({ ok: true as const, data: await controls.controls(depsFrom(c), c.get('auth')!) }, 200),
  )
  .openapi(audit, async (c) =>
    c.json(
      {
        ok: true as const,
        data: await controls.audit(depsFrom(c), c.get('auth')!, c.req.valid('query')),
      },
      200,
    ),
  )
  .openapi(operations, async (c) =>
    c.json(
      {
        ok: true as const,
        data: await operationalSummary(
          c.get('db'),
          c.env,
          c.get('auth')!,
          c.req.valid('query').hours,
        ),
      },
      200,
    ),
  );
