/**
 * GET /api/v1/meta: public, non-personal app configuration the web app needs
 * on boot (environment name, which features are on).
 *
 * This file is also the reference example for how a route is built:
 * schema → createRoute (validation + docs) → handler that calls a service.
 * See docs/guides/add-an-api-endpoint.md.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { APP_NAME } from '@skillverse/shared';
import { createRouter, success } from '../lib/openapi';
import { getPublicFeatures } from '../services/feature-flags.service';

const MetaSchema = z
  .object({
    appName: z.string().openapi({ example: 'SkillVerse' }),
    environment: z.string().openapi({ example: 'development' }),
    features: z.record(z.string(), z.boolean()).openapi({ example: { 'ads.house': true } }),
  })
  .openapi('Meta');

const route = createRoute({
  method: 'get',
  path: '/meta',
  tags: ['System'],
  summary: 'Public app configuration',
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: success(MetaSchema) } } },
  },
});

export const metaRoutes = createRouter().openapi(route, async (c) => {
  const features = await getPublicFeatures(c.get('db'), c.env.CACHE);
  // Same answer for every visitor, so browsers/CDN may cache it briefly.
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(
    { ok: true as const, data: { appName: APP_NAME, environment: c.env.ENVIRONMENT, features } },
    200,
  );
});
