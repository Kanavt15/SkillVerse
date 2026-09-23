/**
 * /api/v1/me/mfa/*: manage two-factor authentication for the signed-in user.
 * The sign-in step itself (POST /auth/mfa/verify) lives in auth.routes.ts.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { disableMfaSchema, mfaCodeSchema } from '@skillverse/shared';
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
import * as mfa from '../services/mfa.service';

const tags = ['Two-factor authentication'];
const security = sessionSecurity;

const StatusSchema = z
  .object({ enabled: z.boolean(), recoveryCodesRemaining: z.number().int() })
  .openapi('MfaStatus');
const SetupSchema = z
  .object({
    secret: z.string().openapi({ description: 'Base32 secret for manual entry in the app' }),
    otpauthUrl: z.string().openapi({ description: 'otpauth:// URI to show as a QR code' }),
  })
  .openapi('MfaSetup');
const RecoveryCodesSchema = z
  .object({ recoveryCodes: z.array(z.string()) })
  .openapi('RecoveryCodes', { description: 'Shown ONCE. Store them somewhere safe.' });

const status = createRoute({
  method: 'get',
  path: '/me/mfa',
  tags,
  security,
  summary: 'Is 2FA on, and how many recovery codes are left',
  responses: { 200: jsonResponse('OK', success(StatusSchema)), ...errors(401) },
});

const setup = createRoute({
  method: 'post',
  path: '/me/mfa/totp/setup',
  tags,
  security,
  summary: 'Start authenticator-app setup (returns the secret for the QR code)',
  responses: { 200: jsonResponse('OK', success(SetupSchema)), ...errors(401, 409) },
});

const enable = createRoute({
  method: 'post',
  path: '/me/mfa/totp/enable',
  tags,
  security,
  summary: 'Confirm setup with a code; returns recovery codes',
  request: { body: jsonBody(mfaCodeSchema) },
  responses: {
    200: jsonResponse('Enabled', success(RecoveryCodesSchema)),
    ...errors(400, 401, 409),
  },
});

const disable = createRoute({
  method: 'post',
  path: '/me/mfa/disable',
  tags,
  security,
  summary: 'Turn off 2FA (needs password + a current code)',
  request: { body: jsonBody(disableMfaSchema) },
  responses: { 200: jsonResponse('Disabled', success(MessageSchema)), ...errors(400, 401) },
});

const regenerate = createRoute({
  method: 'post',
  path: '/me/mfa/recovery-codes',
  tags,
  security,
  summary: 'Replace all recovery codes (needs a current code)',
  request: { body: jsonBody(mfaCodeSchema) },
  responses: { 200: jsonResponse('New codes', success(RecoveryCodesSchema)), ...errors(400, 401) },
});

const router = createRouter();
router.use('/me/mfa', requireAuth);
router.use('/me/mfa/*', requireAuth);
// Code guessing protection on every endpoint that checks a code.
router.use('/me/mfa/*', rateLimit('RL_AUTH', 'mfa-manage'));

export const mfaRoutes = router
  .openapi(status, async (c) =>
    c.json(
      { ok: true as const, data: await mfa.getStatus(depsFrom(c), c.get('auth')!.user.id) },
      200,
    ),
  )
  .openapi(setup, async (c) =>
    c.json({ ok: true as const, data: await mfa.startSetup(depsFrom(c), c.get('auth')!) }, 200),
  )
  .openapi(enable, async (c) => {
    const codes = await mfa.enable(depsFrom(c), c.get('auth')!, c.req.valid('json').code);
    return c.json({ ok: true as const, data: { recoveryCodes: codes } }, 200);
  })
  .openapi(disable, async (c) => {
    await mfa.disable(depsFrom(c), c.get('auth')!, c.req.valid('json'));
    return c.json(
      { ok: true as const, data: { message: 'Two-factor authentication is off.' } },
      200,
    );
  })
  .openapi(regenerate, async (c) => {
    const codes = await mfa.regenerateRecoveryCodes(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('json').code,
    );
    return c.json({ ok: true as const, data: { recoveryCodes: codes } }, 200);
  });
