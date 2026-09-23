/**
 * Types describing what every request handler can access.
 *
 * - `Bindings` come from wrangler.jsonc (generated into worker-configuration.d.ts
 *   by `npm run cf-typegen`) plus the secrets declared below.
 * - `Variables` are per-request values set by middleware via `c.set(...)`.
 */
import type { Db } from '@skillverse/db';
import type { Logger } from './lib/logger';

/**
 * Secrets are not in wrangler.jsonc, so wrangler can't generate their types.
 * Every secret listed in .dev.vars.example must be declared here too.
 */
interface Secrets {
  IP_HASH_SALT: string;
}

declare global {
  // `Env` is what handlers receive; `Cloudflare.Env` is what `import { env } from 'cloudflare:workers'` returns.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env extends Secrets {}
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends Secrets {}
  }
}

export interface AppVariables {
  /** Unique ID of this request; echoed in the `x-request-id` header and in logs. */
  requestId: string;
  /** Typed Drizzle client for this request. */
  db: Db;
  /** Structured logger that stamps every line with the request ID. */
  log: Logger;
}

export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
