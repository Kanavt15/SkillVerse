/**
 * Server-side sessions (see docs/architecture/adr/0005-server-sessions.md).
 *
 *   - The browser holds a random 256-bit token in an HttpOnly cookie.
 *   - The database holds only SHA-256(token), so a DB leak can't be replayed.
 *   - Two expiries: idle (7 days, sliding) and absolute (30 days).
 *   - `lastSeenAt`/idle expiry are refreshed at most once per hour per session,
 *     which keeps D1 writes (100k/day on the free plan) low.
 */
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Db } from '@skillverse/db';
import { SESSION_COOKIE_DEV } from '@skillverse/shared';
import type { AppEnv, AuthContext, PendingMfa } from '../env';
import { hashIp, randomToken, sha256Hex } from '../lib/crypto';
import {
  findSessionWithUser,
  insertSession,
  touchSession,
} from '../repositories/sessions.repository';

export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Cookie settings. Deployed environments use HTTPS, so the cookie is Secure and
 * gets the `__Host-` prefix (hono's `prefix: 'host'`), which also forbids a
 * Domain attribute: only this exact origin can ever receive it. Local dev runs
 * on http://localhost, where browsers reject Secure/__Host- cookies.
 */
function cookieOptions(c: Context<AppEnv>) {
  const secure = c.env.ENVIRONMENT !== 'development';
  return {
    secure,
    prefix: secure ? ('host' as const) : undefined,
  };
}

export function readSessionToken(c: Context<AppEnv>): string | undefined {
  const { prefix } = cookieOptions(c);
  return getCookie(c, SESSION_COOKIE_DEV, prefix);
}

export function setSessionCookie(c: Context<AppEnv>, token: string, expires: Date): void {
  const { secure, prefix } = cookieOptions(c);
  setCookie(c, SESSION_COOKIE_DEV, token, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    expires,
    prefix,
  });
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  const { secure, prefix } = cookieOptions(c);
  deleteCookie(c, SESSION_COOKIE_DEV, { path: '/', secure, prefix });
}

export interface NewSession {
  token: string;
  handle: string;
  expiresAt: Date;
  /** True when this is only a pending session: the account has 2FA and a code is still needed. */
  mfaRequired: boolean;
}

/** A pending (2FA not yet passed) session dies after 10 idle minutes. */
export const PENDING_MFA_IDLE_MS = 10 * 60 * 1000;

/**
 * Creates a session row and returns the raw token (to put in the cookie, never stored).
 * With `pendingMfa`, the session is only good for submitting a 2FA code.
 */
export async function createSession(
  db: Db,
  opts: {
    userId: string;
    ip: string;
    userAgent: string | undefined;
    ipSalt: string;
    mfaVerified?: boolean;
    pendingMfa?: boolean;
  },
): Promise<NewSession> {
  const token = randomToken();
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_ABSOLUTE_MS);
  const [row] = await insertSession(db, {
    id: await sha256Hex(token),
    userId: opts.userId,
    expiresAt,
    idleExpiresAt: new Date(now + (opts.pendingMfa ? PENDING_MFA_IDLE_MS : SESSION_IDLE_MS)),
    mfaVerified: opts.mfaVerified ?? false,
    ipHash: await hashIp(opts.ip, opts.ipSalt),
    userAgent: opts.userAgent?.slice(0, 255) ?? null,
  });
  return { token, handle: row!.handle, expiresAt, mfaRequired: Boolean(opts.pendingMfa) };
}

export type ResolvedSession =
  | { kind: 'active'; auth: AuthContext; touch: Promise<unknown> | null }
  | { kind: 'pending_mfa'; pending: PendingMfa };

/**
 * Turns a cookie token into a signed-in AuthContext, a pending-2FA session, or
 * null if the session is unknown, expired, or its account isn't active.
 * For active sessions it may return a `touch` promise to run in the background.
 */
export async function resolveSession(
  db: Db,
  token: string,
  now = Date.now(),
): Promise<ResolvedSession | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const row = await findSessionWithUser(db, tokenHash);
  if (!row) return null;
  if (row.expiresAt.getTime() <= now || row.idleExpiresAt.getTime() <= now) return null;
  if (row.user.status !== 'active') return null;

  const mfaEnabled = row.mfaEnabledAt !== null;
  if (mfaEnabled && !row.mfaVerified) {
    return {
      kind: 'pending_mfa',
      pending: { tokenHash, userId: row.user.id, attempts: row.mfaAttempts },
    };
  }

  const touch =
    now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS
      ? touchSession(
          db,
          tokenHash,
          new Date(now),
          new Date(Math.min(now + SESSION_IDLE_MS, row.expiresAt.getTime())),
        ).then(() => undefined)
      : null;

  return {
    kind: 'active',
    auth: {
      user: {
        id: row.user.id,
        email: row.user.email,
        username: row.user.username,
        displayName: row.user.displayName,
        emailVerified: row.user.emailVerifiedAt !== null,
        avatarKey: row.user.avatarKey,
        mfaEnabled,
      },
      roles: row.roles,
      session: { tokenHash, handle: row.handle, mfaVerified: row.mfaVerified },
    },
    touch,
  };
}
