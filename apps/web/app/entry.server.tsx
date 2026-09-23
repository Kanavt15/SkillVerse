/**
 * Server-side rendering entry. Runs inside the Worker for every page request.
 *
 * Based on React Router's default web-streams entry, plus:
 *   - the per-request CSP nonce (from workers/app.ts), passed to <ServerRouter>
 *     so React Router's own inline scripts are allowed by the Content-Security-Policy;
 *   - security headers on every HTML response (see lib/security.server.ts).
 */
import type { EntryContext, RouterContextProvider } from 'react-router';
import { ServerRouter } from 'react-router';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { env } from 'cloudflare:workers';
import { nonceContext } from './lib/request-context';
import { applyHtmlSecurityHeaders } from './lib/security.server';

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === 'HEAD') {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  }

  // Created in workers/app.ts; the root loader also sends it to the client for hydration.
  const nonce = loadContext.get(nonceContext);
  let shellRendered = false;
  const userAgent = request.headers.get('user-agent');

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    {
      nonce,
      signal: AbortSignal.timeout(streamTimeout + 1000),
      onError(error: unknown) {
        responseStatusCode = 500;
        // Errors during the initial shell are logged by React Router itself.
        if (shellRendered) console.error(error);
      },
    },
  );
  shellRendered = true;

  // Crawlers get the complete HTML in one go (better SEO); humans get streaming.
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  applyHtmlSecurityHeaders(responseHeaders, {
    nonce,
    dev: import.meta.env.DEV,
    production: env.ENVIRONMENT === 'production',
  });
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
