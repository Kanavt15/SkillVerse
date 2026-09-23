/**
 * Types describing what every request handler can access.
 *
 * - `Bindings` come from wrangler.jsonc (generated into worker-configuration.d.ts
 *   by `npm run cf-typegen`) plus the secrets declared below.
 * - `Variables` are per-request values set by middleware via `c.set(...)`.
 */
import type { Db } from '@skillverse/db';
import type { Role } from '@skillverse/shared';
import type { Logger } from './lib/logger';

/**
 * Secrets are not in wrangler.jsonc, so wrangler can't generate their types.
 * Every secret listed in .dev.vars.example must be declared here too.
 */
interface Secrets {
  IP_HASH_SALT: string;
  /** 64 hex chars (32 bytes): AES-GCM key that encrypts TOTP secrets at rest. */
  MFA_ENCRYPTION_KEY: string;
  /** Optional: without it, emails go to the dev mailbox (never in production). */
  RESEND_API_KEY?: string;
}

/** Non-secret vars declared in wrangler.jsonc; listed here so they are typed even before cf-typegen. */
interface Vars {
  ENVIRONMENT: string;
  APP_ORIGINS: string;
  EMAIL_FROM: string;
  PASSWORD_BREACH_CHECK: string;
}

declare global {
  // `Env` is what handlers receive; `Cloudflare.Env` is what `import { env } from 'cloudflare:workers'` returns.
  interface Env extends Secrets, Vars {}
  namespace Cloudflare {
    interface Env extends Secrets, Vars {}
  }
}

/** The signed-in user for this request, resolved from the session cookie. */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    emailVerified: boolean;
    avatarKey: string | null;
    /** True when the account has an authenticator app (TOTP) enabled. */
    mfaEnabled: boolean;
  };
  roles: Role[];
  session: {
    /** SHA-256 of the cookie token (server-side only; never sent to clients). */
    tokenHash: string;
    handle: string;
    mfaVerified: boolean;
  };
}

/** A session that passed the password step but still needs a 2FA code. */
export interface PendingMfa {
  tokenHash: string;
  userId: string;
  attempts: number;
}

export interface AppVariables {
  /** Unique ID of this request; echoed in the `x-request-id` header and in logs. */
  requestId: string;
  /** Typed Drizzle client for this request. */
  db: Db;
  /** Structured logger that stamps every line with the request ID. */
  log: Logger;
  /** Signed-in user, or null for anonymous requests. Set by `loadSession`. */
  auth: AuthContext | null;
  /**
   * Set instead of `auth` when the password step passed but the 2FA code is still
   * missing. Only POST /auth/mfa/verify may use it.
   */
  pendingMfa: PendingMfa | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
