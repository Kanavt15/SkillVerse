/**
 * "Continue with Google". Shown only when the API reports Google sign-in as
 * available (configured + `auth.google` flag on), via the root loader's meta.
 *
 * It's a plain link, not a form or fetch: the browser must navigate to our API,
 * which redirects to Google and back (OAuth needs top-level navigations).
 */
import { useRouteLoaderData } from 'react-router';
import { cn } from '~/lib/cn';

interface RootData {
  meta: { authProviders?: { google?: boolean } } | null;
}

/** The official multi-colour "G" mark (Google sign-in branding guidelines). */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"
      />
    </svg>
  );
}

export function GoogleButton({
  redirectTo,
  label = 'Continue with Google',
}: {
  redirectTo?: string;
  label?: string;
}) {
  const root = useRouteLoaderData('root') as RootData | undefined;
  if (!root?.meta?.authProviders?.google) return null;

  const href = `/api/v1/auth/google/start${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`;
  return (
    <div className="space-y-4">
      <a
        href={href}
        className={cn(
          'flex h-10 w-full items-center justify-center gap-3 rounded-md border border-border-strong bg-white px-4',
          'text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f7f8f8]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <GoogleLogo />
        {label}
      </a>
      <div className="flex items-center gap-3 text-xs text-fg-subtle" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/** User-facing text for the `?error=` codes the API's Google callback redirects with. */
export const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_unavailable:
    'Google sign-in is not available right now. Please use your email and password.',
  google_failed: 'Google sign-in did not complete. Please try again.',
  account_suspended: 'This account is suspended. Contact support for help.',
};
