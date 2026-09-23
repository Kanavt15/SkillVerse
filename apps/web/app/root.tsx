/**
 * Root route: the HTML document shell shared by every page.
 *
 * The root loader runs on the server for every navigation and provides:
 *   - the theme from the sv_theme cookie (rendered into <html data-theme>)
 *   - the CSP nonce, so <Links>/<Scripts> render identically on server and client
 *   - public app config from the API (/api/v1/meta). If the API is down the
 *     site still renders (meta = null) instead of showing an error page.
 *   - the signed-in viewer (name only) for the header, or null
 */
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type { Route } from './+types/root';
import { SiteFooter } from './components/layout/site-footer';
import { SiteHeader, type HeaderUser } from './components/layout/site-header';
import { Button } from './components/ui/button';
import { apiGet } from './lib/api.server';
import { getUser } from './lib/auth.server';
import { nonceContext } from './lib/request-context';
import { parseThemeCookie, type Theme } from './lib/theme';
import './styles/app.css';

interface PublicMeta {
  appName: string;
  environment: string;
  features: Record<string, boolean>;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const theme = parseThemeCookie(request.headers.get('cookie'));
  // The CSP nonce must reach the client too, so hydration renders the same
  // nonce attributes the server did. It's already visible in this page's HTML,
  // so sending it again reveals nothing new, and every response gets a fresh one.
  const nonce = context.get(nonceContext);
  const [meta, user] = await Promise.all([
    apiGet<PublicMeta>('/api/v1/meta').catch((err: unknown) => {
      console.error(
        JSON.stringify({ level: 'error', msg: 'meta_unavailable', error: String(err) }),
      );
      return null;
    }),
    getUser(request).catch(() => null),
  ]);
  // Only what the header needs. Pages that need more call requireUser() themselves.
  const viewer: HeaderUser | null = user
    ? { displayName: user.displayName, username: user.username, email: user.email }
    : null;
  return { theme, meta, nonce, viewer };
}

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const theme: Theme = data?.theme ?? 'system';
  const nonce = data?.nonce;

  return (
    <html lang="en" data-theme={theme === 'system' ? undefined : theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6a46dc" />
        <Meta />
        <Links nonce={nonce} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-fg">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader theme={theme} user={data?.viewer ?? null} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter environment={data?.meta?.environment ?? null} />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

/** Shown when a page throws. Never reveals stack traces outside development. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
