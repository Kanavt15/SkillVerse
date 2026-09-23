/**
 * Shared "what happens after a successful first sign-in step" logic, used by
 * sign-in, email verification and password reset.
 *
 * The API either signs the user in (returns the user) or, for accounts with
 * two-factor authentication, starts a pending session and returns
 * `{ mfaRequired: true }`. In that case we continue at /login/2fa.
 */
import { redirect } from 'react-router';
import { relayCookies } from './api.server';
import type { User } from './auth.server';
import { safeRedirect } from './redirect';

export type SignInResult = User | { mfaRequired: true };

export function continueAfterSignIn(
  result: SignInResult,
  apiHeaders: Headers,
  redirectTo?: string | null,
) {
  const headers = relayCookies(apiHeaders);
  const target = safeRedirect(redirectTo);
  if ('mfaRequired' in result) {
    return redirect(`/login/2fa?redirectTo=${encodeURIComponent(target)}`, { headers });
  }
  return redirect(result.profile.onboarded ? target : '/onboarding', { headers });
}
