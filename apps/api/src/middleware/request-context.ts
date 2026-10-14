/**
 * First middleware in the chain. For every request it:
 *   1. assigns a request ID (reusing a trusted incoming one from our own web Worker),
 *   2. attaches a request-scoped logger and a Drizzle DB client,
 *   3. logs one summary line when the response is ready (method, path, status, duration).
 */
import { createMiddleware } from 'hono/factory';
import { newId } from '@skillverse/shared';
import { createDb } from '@skillverse/db';
import type { AppEnv } from '../env';
import { createLogger } from '../lib/logger';
import { recordOperation, operationScope } from '../services/operational.service';

/** Only accept an incoming request ID that looks like one of ours (prevents log injection). */
const SAFE_REQUEST_ID = /^[0-9a-f-]{36}$/;

export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : newId();
  const log = createLogger({ requestId });

  c.set('requestId', requestId);
  c.set('log', log);
  c.set('db', createDb(c.env.DB));

  const started = Date.now();
  await next();

  c.header('x-request-id', requestId);
  log.info('request', {
    method: c.req.method,
    path: new URL(c.req.url).pathname, // pathname only: query strings may contain tokens
    status: c.res.status,
    ms: Date.now() - started,
  });
  if (
    c.env.OPERATIONS_TELEMETRY === 'on' &&
    !c.get('skipObservation') &&
    c.req.path !== '/api/health'
  )
    c.executionCtx.waitUntil(
      recordOperation(c.get('db'), c.env, log, {
        scope: operationScope(c.req.path),
        status: c.res.status,
        durationMs: Date.now() - started,
      }).catch(() => log.error('operations.observation_failed')),
    );
});
