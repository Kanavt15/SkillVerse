/**
 * Account lifecycle: register, sign in, verify email, reset and change password.
 *
 * Security properties (each has a test in apps/api/test/auth.test.ts):
 *   - No account enumeration: register / forgot-password / resend-verification
 *     answer the same whether or not the email exists, and sign-in failures are
 *     generic and take the same time for unknown emails (dummy hash).
 *   - Brute force: per-IP rate limits (route level) + per-account lockout after
 *     10 failures for 15 minutes.
 *   - Tokens in emailed links are single-use, short-lived, stored hashed, and
 *     redeemed atomically.
 *   - Resetting or changing a password signs out every other session.
 *   - Breached passwords are rejected (HIBP k-anonymity check).
 */
import { eq } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import { newId, type LoginInput, type RegisterInput } from '@skillverse/shared';
import { hashIp, randomToken, sha256Hex } from '../lib/crypto';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import {
  accountExistsTemplate,
  passwordChangedTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from '../lib/email-templates';
import { AppError } from '../lib/errors';
import { getDummyHash, hashPassword, needsRehash, verifyPassword } from '../lib/password';
import {
  deleteUnusedTokens,
  insertEmailToken,
  redeemToken,
  type EmailTokenPurpose,
} from '../repositories/email-tokens.repository';
import { deleteUserSessions } from '../repositories/sessions.repository';
import {
  clearFailedLogins,
  findUserById,
  findUserByEmail,
  findUserForLogin,
  insertUserStatements,
  recordFailedLogin,
  setPasswordHash,
  usernameTaken,
} from '../repositories/users.repository';
import { auditInsert } from './audit.service';
import { isPasswordBreached } from './breached-password.service';
import { sendEmail } from './email.service';
import { createSession, type NewSession } from './session.service';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_MS = 15 * 60 * 1000;

const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';

async function ipHashOf(d: RequestDeps) {
  return hashIp(d.ip, d.env.IP_HASH_SALT);
}

async function rejectBreached(d: RequestDeps, password: string, field: string) {
  const breached = await isPasswordBreached(password, {
    enabled: d.env.PASSWORD_BREACH_CHECK === 'on',
    log: d.log,
  });
  if (breached) {
    throw new AppError('VALIDATION_FAILED', 'Please choose a different password.', {
      [field]: [
        'This password has appeared in a data breach, so attackers try it first. Choose a different one.',
      ],
    });
  }
}

/** Creates a single-use email token and returns the raw value for the link. */
async function issueEmailToken(
  d: RequestDeps,
  userId: string,
  purpose: EmailTokenPurpose,
  ttlMs: number,
) {
  const token = randomToken();
  await d.db.batch([
    deleteUnusedTokens(d.db, userId, purpose),
    insertEmailToken(d.db, {
      id: await sha256Hex(token),
      userId,
      purpose,
      expiresAt: new Date(Date.now() + ttlMs),
    }),
  ]);
  return token;
}

function newSessionFor(d: RequestDeps, userId: string) {
  return createSession(d.db, {
    userId,
    ip: d.ip,
    userAgent: d.userAgent,
    ipSalt: d.env.IP_HASH_SALT,
  });
}

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Creates an account and emails a verification link. Does NOT sign the user in:
 * that happens when they click the link, which proves they own the address.
 * If the email is already registered we send that owner a heads-up instead and
 * return the same response, so the endpoint can't be used to discover accounts.
 */
export async function register(d: RequestDeps, input: RegisterInput): Promise<void> {
  await rejectBreached(d, input.password, 'password');

  const existing = await findUserByEmail(d.db, input.email);
  if (existing) {
    const base = appBaseUrl(d.env);
    d.waitUntil(
      sendEmail(
        d.env,
        d.log,
        accountExistsTemplate(
          existing.email,
          existing.displayName,
          `${base}/login`,
          `${base}/forgot-password`,
        ),
      ),
    );
    d.waitUntil(
      auditInsert(d.db, {
        action: 'auth.register_existing_email',
        targetType: 'user',
        targetId: existing.id,
        ipHash: await ipHashOf(d),
        requestId: d.requestId,
      }).then(() => undefined),
    );
    return;
  }

  // Usernames are public (they appear in profile URLs), so saying one is taken reveals nothing.
  if (await usernameTaken(d.db, input.username)) {
    throw new AppError('CONFLICT', 'That username is taken.', {
      username: ['That username is taken. Try another one.'],
    });
  }

  const userId = newId();
  const token = randomToken();
  try {
    await d.db.batch([
      ...insertUserStatements(d.db, {
        id: userId,
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
      }),
      insertEmailToken(d.db, {
        id: await sha256Hex(token),
        userId,
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      }),
      auditInsert(d.db, {
        action: 'auth.registered',
        actorUserId: userId,
        targetType: 'user',
        targetId: userId,
        ipHash: await ipHashOf(d),
        requestId: d.requestId,
      }),
    ]);
  } catch (err) {
    // A simultaneous sign-up won the race for this username or email.
    const message = String((err as Error).message);
    if (message.includes('users.username')) {
      throw new AppError('CONFLICT', 'That username is taken.', {
        username: ['That username is taken. Try another one.'],
      });
    }
    if (message.includes('users.email')) return; // same generic answer as above
    throw err;
  }

  const url = `${appBaseUrl(d.env)}/verify-email?token=${token}`;
  d.waitUntil(sendEmail(d.env, d.log, verifyEmailTemplate(input.email, input.displayName, url)));
}

/** Sends a fresh verification link if the account exists and isn't verified. Always "succeeds". */
export async function resendVerification(d: RequestDeps, email: string): Promise<void> {
  const user = await findUserByEmail(d.db, email);
  if (!user || user.emailVerifiedAt || user.status !== 'active') return;
  const token = await issueEmailToken(d, user.id, 'verify_email', VERIFY_TTL_MS);
  const url = `${appBaseUrl(d.env)}/verify-email?token=${token}`;
  d.waitUntil(sendEmail(d.env, d.log, verifyEmailTemplate(user.email, user.displayName, url)));
}

/** Redeems a verification link: marks the email verified and signs the user in. */
export async function verifyEmail(d: RequestDeps, token: string): Promise<NewSession> {
  const userId = await redeemToken(d.db, await sha256Hex(token), 'verify_email');
  if (!userId) {
    throw new AppError('VALIDATION_FAILED', 'This link is invalid or has expired.', {
      token: ['This link is invalid or has expired. Request a new one.'],
    });
  }
  const user = await findUserById(d.db, userId);
  if (!user || user.status !== 'active') {
    throw new AppError('FORBIDDEN', 'This account is not active.');
  }
  await d.db.batch([
    d.db
      .update(schema.users)
      .set({ emailVerifiedAt: user.emailVerifiedAt ?? new Date() })
      .where(eq(schema.users.id, userId)),
    auditInsert(d.db, {
      action: 'auth.email_verified',
      actorUserId: userId,
      targetType: 'user',
      targetId: userId,
      ipHash: await ipHashOf(d),
      requestId: d.requestId,
    }),
  ]);
  return newSessionFor(d, userId);
}

// ─── Sign in ─────────────────────────────────────────────────────────────────

export async function login(
  d: RequestDeps,
  input: LoginInput,
): Promise<{ session: NewSession; userId: string }> {
  const user = await findUserForLogin(d.db, input.email);
  const ipHash = await ipHashOf(d);

  if (!user || !user.passwordHash) {
    await verifyPassword(input.password, await getDummyHash()); // equalise timing
    d.waitUntil(
      auditInsert(d.db, {
        action: 'auth.login_failed',
        metadata: { reason: 'unknown_email' },
        ipHash,
        requestId: d.requestId,
      }).then(() => undefined),
    );
    throw new AppError('UNAUTHENTICATED', GENERIC_LOGIN_ERROR);
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AppError(
      'RATE_LIMITED',
      'Too many failed attempts. Try again in 15 minutes, or reset your password.',
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    await d.db.batch([
      recordFailedLogin(d.db, user.id, MAX_FAILED_LOGINS, LOCKOUT_MS),
      auditInsert(d.db, {
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: user.id,
        metadata: { reason: 'wrong_password', attempt: user.failedLoginCount + 1 },
        ipHash,
        requestId: d.requestId,
      }),
    ]);
    throw new AppError('UNAUTHENTICATED', GENERIC_LOGIN_ERROR);
  }

  // Correct password: it's now safe to say why the account can't be used.
  if (user.status !== 'active') {
    throw new AppError('FORBIDDEN', 'This account is suspended. Contact support for help.');
  }

  const statements = [
    clearFailedLogins(d.db, user.id),
    auditInsert(d.db, {
      action: 'auth.login',
      actorUserId: user.id,
      targetType: 'user',
      targetId: user.id,
      ipHash,
      requestId: d.requestId,
    }),
  ] as const;
  if (needsRehash(user.passwordHash)) {
    await d.db.batch([
      ...statements,
      setPasswordHash(d.db, user.id, await hashPassword(input.password)),
    ]);
  } else {
    await d.db.batch(statements);
  }

  return { session: await newSessionFor(d, user.id), userId: user.id };
}

// ─── Password reset and change ───────────────────────────────────────────────

/** Emails a reset link if the account exists. Always "succeeds" (no enumeration). */
export async function requestPasswordReset(d: RequestDeps, email: string): Promise<void> {
  const user = await findUserByEmail(d.db, email);
  if (!user || user.status !== 'active') return;
  const token = await issueEmailToken(d, user.id, 'reset_password', RESET_TTL_MS);
  const url = `${appBaseUrl(d.env)}/reset-password?token=${token}`;
  d.waitUntil(sendEmail(d.env, d.log, resetPasswordTemplate(user.email, user.displayName, url)));
}

/**
 * Sets a new password from a reset link. Signs out every device, then signs the
 * user in here. Receiving the link also proves email ownership, so the address
 * becomes verified.
 */
export async function resetPassword(
  d: RequestDeps,
  token: string,
  password: string,
): Promise<NewSession> {
  // Check the password BEFORE redeeming, so a rejected password doesn't burn the link.
  await rejectBreached(d, password, 'password');
  const userId = await redeemToken(d.db, await sha256Hex(token), 'reset_password');
  if (!userId) {
    throw new AppError('VALIDATION_FAILED', 'This link is invalid or has expired.', {
      token: ['This link is invalid or has expired. Request a new one.'],
    });
  }
  const user = await findUserById(d.db, userId);
  if (!user || user.status !== 'active')
    throw new AppError('FORBIDDEN', 'This account is not active.');

  await d.db.batch([
    d.db
      .update(schema.users)
      .set({
        passwordHash: await hashPassword(password),
        failedLoginCount: 0,
        lockedUntil: null,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      })
      .where(eq(schema.users.id, userId)),
    deleteUserSessions(d.db, userId),
    auditInsert(d.db, {
      action: 'auth.password_reset',
      actorUserId: userId,
      targetType: 'user',
      targetId: userId,
      ipHash: await ipHashOf(d),
      requestId: d.requestId,
    }),
  ]);

  d.waitUntil(
    sendEmail(
      d.env,
      d.log,
      passwordChangedTemplate(user.email, user.displayName, `${appBaseUrl(d.env)}/forgot-password`),
    ),
  );
  return newSessionFor(d, userId);
}

/** Changes the password of a signed-in user and signs out their other devices. */
export async function changePassword(
  d: RequestDeps,
  opts: { userId: string; currentTokenHash: string; currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await findUserById(d.db, opts.userId);
  const withHash = user ? await findUserForLogin(d.db, user.email) : undefined;
  if (
    !withHash?.passwordHash ||
    !(await verifyPassword(opts.currentPassword, withHash.passwordHash))
  ) {
    throw new AppError('VALIDATION_FAILED', 'Your current password is incorrect.', {
      currentPassword: ['Your current password is incorrect.'],
    });
  }
  await rejectBreached(d, opts.newPassword, 'newPassword');

  await d.db.batch([
    setPasswordHash(d.db, opts.userId, await hashPassword(opts.newPassword)),
    deleteUserSessions(d.db, opts.userId, opts.currentTokenHash),
    auditInsert(d.db, {
      action: 'auth.password_changed',
      actorUserId: opts.userId,
      targetType: 'user',
      targetId: opts.userId,
      ipHash: await ipHashOf(d),
      requestId: d.requestId,
    }),
  ]);
  d.waitUntil(
    sendEmail(
      d.env,
      d.log,
      passwordChangedTemplate(
        withHash.email,
        withHash.displayName,
        `${appBaseUrl(d.env)}/forgot-password`,
      ),
    ),
  );
}
