/**
 * GET /api/health: liveness + dependency check for uptime monitors.
 * Returns 503 when the database is unreachable so monitors alert.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import { createRouter } from '../lib/openapi';

const HealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    environment: z.string(),
    checks: z.object({ database: z.enum(['up', 'down']) }),
    time: z.string().openapi({ example: '2026-09-23T10:00:00.000Z' }),
  })
  .openapi('Health');

const route = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Service health',
  responses: {
    200: {
      description: 'All dependencies up',
      content: { 'application/json': { schema: HealthSchema } },
    },
    503: {
      description: 'A dependency is down',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
});

export const healthRoutes = createRouter().openapi(route, async (c) => {
  let database: 'up' | 'down' = 'up';
  try {
    await c.get('db').run(sql`select 1`);
  } catch (err) {
    database = 'down';
    c.get('log').error('health.db_down', { message: (err as Error).message });
  }
  const body = {
    status: database === 'up' ? ('ok' as const) : ('degraded' as const),
    environment: c.env.ENVIRONMENT,
    checks: { database },
    time: new Date().toISOString(),
  };
  return database === 'up' ? c.json(body, 200) : c.json(body, 503);
});
