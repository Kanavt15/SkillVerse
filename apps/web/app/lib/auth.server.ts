/**
 * Who is the visitor? Helpers for loaders and actions.
 *
 *   const user = await getUser(request);          // User | null
 *   const user = await requireUser(request);      // redirects to /login if signed out
 */
import { redirect } from 'react-router';
import { SESSION_COOKIE_DEV } from '@skillverse/shared';
import { api } from './api.server';
import { safeRedirect } from './redirect';

/** The signed-in user as returned by GET /api/v1/me. */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  roles: string[];
  profile: {
    headline: string;
    bio: string;
    websiteUrl: string | null;
    location: string | null;
    timezone: string;
    interests: string[];
    goal: string | null;
    onboarded: boolean;
  };
}

/** True if the request carries a session cookie at all (dev or __Host- name). */
function hasSessionCookie(request: Request): boolean {
  return (request.headers.get('cookie') ?? '').includes(`${SESSION_COOKIE_DEV}=`);
}

export async function getUser(request: Request): Promise<User | null> {
  // Skip the API call entirely for visitors who aren't signed in (most traffic).
  if (!hasSessionCookie(request)) return null;
  const res = await api<User>(request, '/api/v1/me');
  return res.ok ? res.data : null;
}

/** Returns the user, or redirects to sign-in and back to this page afterwards. */
export async function requireUser(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    const back = safeRedirect(`${url.pathname}${url.search}`);
    throw redirect(`/login?redirectTo=${encodeURIComponent(back)}`);
  }
  return user;
}

/** For sign-in/sign-up pages: already signed-in visitors go to their dashboard. */
export async function redirectIfSignedIn(request: Request): Promise<void> {
  if (await getUser(request)) throw redirect('/dashboard');
}
