/**
 * "Continue with Google" (OpenID Connect, authorization code flow + PKCE).
 *
 *   start    → random state, PKCE verifier and nonce, kept in a signed HttpOnly cookie → redirect to Google
 *   callback → check state against the cookie → exchange the code DIRECTLY with Google
 *              (server-to-server, with the verifier) → validate the ID token claims
 *              → find, link or create the account → session (pending if 2FA is on)
 *
 * ID token signature: we don't verify Google's JWT signature because the token is
 * received directly from Google's token endpoint over TLS, which OpenID Connect
 * Core §3.1.3.7 allows. We DO validate issuer, audience, expiry, nonce and
 * email_verified.
 *
 * Account linking rules (see docs/architecture/authentication.md):
 *   - An existing Google link (provider user id `sub`) wins, even if the email changed.
 *   - Otherwise, match by email. If that local account was NEVER VERIFIED, someone
 *     else may have registered the victim's email with their own password
 *     ("pre-hijacking"), so we clear the password and sign out all its sessions
 *     before linking. Google has proven who owns the address.
 *   - Otherwise create a new, already-verified account without a password.
 */
import { and, eq } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import { newId } from '@skillverse/shared';
import { hashIp, randomToken, toBase64Url } from '../lib/crypto';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { isMfaEnabled } from '../repositories/mfa.repository';
import { deleteUserSessions } from '../repositories/sessions.repository';
import {
  findProfile,
  findUserByEmail,
  findUserById,
  insertUserStatements,
  usernameTaken,
} from '../repositories/users.repository';
import { auditInsert } from './audit.service';
import { getPublicFeatures } from './feature-flags.service';
import { createSession, type NewSession } from './session.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface OAuthState {
  state: string;
  verifier: string;
  nonce: string;
  redirectTo: string;
  /** Epoch ms after which this sign-in attempt is void. */
  exp: number;
}

export interface GoogleClaims {
  sub: string;
  email: string;
  name?: string;
}

/** Google sign-in is available only when configured AND switched on with the `auth.google` flag. */
export async function isGoogleEnabled(d: Pick<RequestDeps, 'db' | 'env'>): Promise<boolean> {
  if (!d.env.GOOGLE_CLIENT_ID || !d.env.GOOGLE_CLIENT_SECRET) return false;
  const features = await getPublicFeatures(d.db);
  return features['auth.google'] === true;
}

export function redirectUri(env: Env): string {
  return `${appBaseUrl(env)}/api/v1/auth/google/callback`;
}

/** Builds the Google consent URL and the state to remember in the signed cookie. */
export async function beginGoogleSignIn(env: Env, redirectTo: string) {
  const state: OAuthState = {
    state: randomToken(),
    verifier: randomToken(),
    nonce: randomToken(),
    redirectTo,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const challenge = toBase64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state.verifier))),
  );
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(env),
    response_type: 'code',
    scope: 'openid email profile',
    state: state.state,
    nonce: state.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}`, state };
}

/** Decodes a JWT's payload WITHOUT verifying the signature (see the header comment for why that's OK here). */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('Malformed ID token');
  const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
}

/** Validates ID token claims. Throws with a short reason (logged, not shown to users). */
export function validateIdTokenClaims(
  payload: Record<string, unknown>,
  expected: { clientId: string; nonce: string; nowMs?: number },
): GoogleClaims {
  const now = Math.floor((expected.nowMs ?? Date.now()) / 1000);
  if (!GOOGLE_ISSUERS.includes(String(payload.iss))) throw new Error('bad issuer');
  const aud = payload.aud;
  if (Array.isArray(aud) ? !aud.includes(expected.clientId) : aud !== expected.clientId) {
    throw new Error('bad audience');
  }
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('expired');
  if (payload.nonce !== expected.nonce) throw new Error('bad nonce');
  if (payload.email_verified !== true) throw new Error('email not verified by Google');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('missing sub');
  if (typeof payload.email !== 'string' || !payload.email.includes('@'))
    throw new Error('missing email');
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

/** Exchanges the authorization code with Google and returns validated claims. */
export async function exchangeGoogleCode(
  env: Env,
  code: string,
  state: OAuthState,
  fetcher: typeof fetch = fetch,
): Promise<GoogleClaims> {
  const res = await fetcher(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(env),
      grant_type: 'authorization_code',
      code_verifier: state.verifier,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`token endpoint responded ${res.status}`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error('no id_token');
  return validateIdTokenClaims(decodeJwtPayload(body.id_token), {
    clientId: env.GOOGLE_CLIENT_ID,
    nonce: state.nonce,
  });
}

/** Turns an email's local part into an available username (letters, digits, underscore). */
async function pickUsername(d: RequestDeps, email: string): Promise<string> {
  const base =
    email
      .split('@')[0]!
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20) || 'learner';
  const padded = base.length < 3 ? `${base}_user` : base;
  if (!(await usernameTaken(d.db, padded))) return padded;
  for (let i = 0; i < 5; i++) {
    const candidate = `${padded}_${
      randomToken(3)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 4) || i
    }`;
    if (!(await usernameTaken(d.db, candidate))) return candidate;
  }
  return `user_${newId().replace(/-/g, '').slice(-12)}`;
}

/**
 * Finds, links or creates the account for these Google claims and starts a
 * session (a PENDING one if the account has 2FA).
 */
export async function signInWithGoogle(
  d: RequestDeps,
  claims: GoogleClaims,
): Promise<{ session: NewSession; onboarded: boolean }> {
  const { oauthAccounts, users } = schema;
  const ipHash = await hashIp(d.ip, d.env.IP_HASH_SALT);

  const link = await d.db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, 'google'), eq(oauthAccounts.providerUserId, claims.sub)))
    .get();

  let userId: string;
  if (link) {
    userId = link.userId;
  } else {
    const existing = await findUserByEmail(d.db, claims.email);
    if (existing) {
      if (existing.status !== 'active')
        throw new AppError('FORBIDDEN', 'This account is suspended.');
      userId = existing.id;
      const linkStatements = [
        d.db.insert(oauthAccounts).values({
          provider: 'google',
          providerUserId: claims.sub,
          userId,
          email: claims.email,
        }),
        auditInsert(d.db, {
          action: 'auth.oauth_linked',
          actorUserId: userId,
          targetType: 'user',
          targetId: userId,
          metadata: { provider: 'google', wasUnverified: !existing.emailVerifiedAt },
          ipHash,
          requestId: d.requestId,
        }),
      ] as const;
      if (!existing.emailVerifiedAt) {
        // Pre-hijacking defence: the unverified password (and any sessions) may belong to an attacker.
        await d.db.batch([
          d.db
            .update(users)
            .set({
              emailVerifiedAt: new Date(),
              passwordHash: null,
              failedLoginCount: 0,
              lockedUntil: null,
            })
            .where(eq(users.id, userId)),
          deleteUserSessions(d.db, userId),
          ...linkStatements,
        ]);
      } else {
        await d.db.batch(linkStatements);
      }
    } else {
      userId = newId();
      await d.db.batch([
        ...insertUserStatements(d.db, {
          id: userId,
          email: claims.email,
          username: await pickUsername(d, claims.email),
          displayName: (claims.name?.trim() || claims.email.split('@')[0]!).slice(0, 60),
          passwordHash: null,
          emailVerifiedAt: new Date(),
        }),
        d.db.insert(oauthAccounts).values({
          provider: 'google',
          providerUserId: claims.sub,
          userId,
          email: claims.email,
        }),
        auditInsert(d.db, {
          action: 'auth.registered',
          actorUserId: userId,
          targetType: 'user',
          targetId: userId,
          metadata: { provider: 'google' },
          ipHash,
          requestId: d.requestId,
        }),
      ]);
    }
  }

  const user = await findUserById(d.db, userId);
  if (!user || user.status !== 'active')
    throw new AppError('FORBIDDEN', 'This account is suspended.');

  await auditInsert(d.db, {
    action: 'auth.login',
    actorUserId: userId,
    targetType: 'user',
    targetId: userId,
    metadata: { provider: 'google' },
    ipHash,
    requestId: d.requestId,
  });

  const session = await createSession(d.db, {
    userId,
    ip: d.ip,
    userAgent: d.userAgent,
    ipSalt: d.env.IP_HASH_SALT,
    pendingMfa: await isMfaEnabled(d.db, userId),
  });
  const profile = await findProfile(d.db, userId);
  return { session, onboarded: Boolean(profile?.onboardedAt) };
}
