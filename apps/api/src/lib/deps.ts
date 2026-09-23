/**
 * `RequestDeps`: everything a service needs from the current request, as a
 * plain object. Services take this instead of Hono's `Context`, so they can be
 * called from tests, cron jobs or queue consumers without an HTTP request.
 */
import type { Context } from 'hono';
import type { Db } from '@skillverse/db';
import type { AppEnv } from '../env';
import type { Logger } from './logger';
import { clientIp } from '../middleware/rate-limit';

export interface RequestDeps {
  db: Db;
  env: Env;
  log: Logger;
  requestId: string;
  ip: string;
  userAgent: string | undefined;
  /** Run work after the response is sent (emails, audit writes that can lag). */
  waitUntil: (promise: Promise<unknown>) => void;
}

export function depsFrom(c: Context<AppEnv>): RequestDeps {
  return {
    db: c.get('db'),
    env: c.env,
    log: c.get('log'),
    requestId: c.get('requestId'),
    ip: clientIp(c),
    userAgent: c.req.header('user-agent'),
    waitUntil: (p) => c.executionCtx.waitUntil(p),
  };
}

/** Public base URL of the website, used to build links in emails. */
export function appBaseUrl(env: Env): string {
  return env.APP_ORIGINS.split(',')[0]!.trim();
}
