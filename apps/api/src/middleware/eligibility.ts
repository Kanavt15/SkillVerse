/** Rights/security stay available when consent is missing or withdrawn. Domain access fails closed. */
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { privacyState, verifiedTeacher } from '../repositories/consent.repository';
import { ageOn } from '@skillverse/shared';
import { schema } from '@skillverse/db';
import { eq, sql } from 'drizzle-orm';
export const eligibilityGate = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.get('auth');
  if (!auth) return next();
  const path = c.req.path.slice('/api/v1'.length);
  if (
    /^\/(auth|me\/privacy|me\/guardians|me\/support|me\/mfa|support)(\/|$)/.test(path) ||
    ['/me', '/me/profile', '/me/password', '/me/sessions'].includes(path) ||
    path.startsWith('/me/sessions/')
  )
    return next();
  const protectedDomain =
    /^\/(learning|community|studio|admin|notifications)(\/|$)/.test(path) ||
    /^\/me\/(learning|certificates|instructor-application)/.test(path);
  const state = await privacyState(c.get('db'), auth.user.id);
  if (protectedDomain && !state.canLearn)
    throw new AppError(
      'FORBIDDEN',
      'Confirm your account eligibility and current policies in Settings > Privacy. A guardian permission code is required under 18.',
    );
  if (
    path.startsWith('/studio') ||
    (path === '/me/instructor-application' && c.req.method === 'POST')
  ) {
    if (
      !state.canTeach ||
      !(
        await c
          .get('db')
          .get<{ valid: number }>(sql`SELECT ${verifiedTeacher(auth.user.id)} AS valid`)
      )?.valid
    )
      throw new AppError(
        'FORBIDDEN',
        'Teaching requires age 16+, current Instructor Terms, DigiLocker teacher verification and guardian teaching permission under 18.',
      );
  }
  if (path.startsWith('/admin')) {
    const row = await c
      .get('db')
      .select({ date: schema.accountPrivacy.birthDate })
      .from(schema.accountPrivacy)
      .where(eq(schema.accountPrivacy.userId, auth.user.id))
      .get();
    if (!row?.date || ageOn(row.date) < 18)
      throw new AppError('FORBIDDEN', 'Staff access requires a confirmed adult account.');
  }
  // Public preview handlers must not use an ineligible session as enrollment authority.
  if (!protectedDomain && !state.canLearn) c.set('auth', null);
  return next();
});
