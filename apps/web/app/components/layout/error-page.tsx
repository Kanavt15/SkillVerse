/**
 * The site's error page (404, 500…). Used by the root ErrorBoundary and by
 * nested boundaries that want the same page for errors they don't handle.
 */
import { isRouteErrorResponse } from 'react-router';
import { Button } from '~/components/ui/button';

export function ErrorPage({ error }: { error: unknown }) {
  let title = 'Something went wrong';
  let message = 'An unexpected error occurred. Please try again in a moment.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? 'Page not found' : `Error ${error.status}`;
    message =
      error.status === 404
        ? "The page you're looking for doesn't exist or has moved."
        : error.statusText || message;
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
    stack = error.stack;
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      {/* React 19 hoists <title>/<meta> into <head>; noindex keeps error pages out of search results. */}
      <title>{`${title} | SkillVerse`}</title>
      <meta name="robots" content="noindex" />
      <p className="font-display text-7xl font-bold text-brand">
        {isRouteErrorResponse(error) ? error.status : '!'}
      </p>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-fg-muted">{message}</p>
      <Button asLink to="/" className="mt-8">
        Back to home
      </Button>
      {stack && (
        <pre className="mt-8 w-full overflow-x-auto rounded-lg bg-surface-muted p-4 text-left text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </section>
  );
}
