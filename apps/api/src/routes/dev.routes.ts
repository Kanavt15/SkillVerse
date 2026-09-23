/**
 * /api/v1/dev/*: development-only helpers. Every route returns 404 unless
 * ENVIRONMENT is "development", so they can never be reached on staging or production.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { AppError } from '../lib/errors';
import { createRouter, jsonResponse, success } from '../lib/openapi';
import { devMailbox } from '../services/email.service';

const mailbox = createRoute({
  method: 'get',
  path: '/dev/mailbox',
  tags: ['Development'],
  summary: 'Emails "sent" in local development (newest first)',
  responses: {
    200: jsonResponse(
      'OK',
      success(
        z.array(
          z.object({
            id: z.string(),
            to: z.string(),
            subject: z.string(),
            text: z.string(),
            sentAt: z.string(),
          }),
        ),
      ),
    ),
  },
});

const router = createRouter();
router.use('/dev/*', async (c, next) => {
  if (c.env.ENVIRONMENT !== 'development') throw new AppError('NOT_FOUND', 'Route not found.');
  await next();
});

export const devRoutes = router.openapi(mailbox, (c) =>
  c.json(
    {
      ok: true as const,
      data: devMailbox.map(({ id, to, subject, text, sentAt }) => ({
        id,
        to,
        subject,
        text,
        sentAt,
      })),
    },
    200,
  ),
);
