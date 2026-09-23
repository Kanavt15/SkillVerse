/**
 * Worker entry point for the website.
 *
 * 1. /api/* → forwarded to the API Worker through the service binding.
 *    In production Cloudflare routes https://<domain>/api/* straight to the API
 *    Worker, so those requests never arrive here. In local dev and on
 *    *.workers.dev staging they DO, and forwarding keeps the browser on a single
 *    origin, exactly like production.
 * 2. Cross-site form submissions are rejected (CSRF, see app/lib/csrf.server.ts).
 * 3. Everything else → React Router, with a per-request context holding the CSP nonce.
 */
import { createRequestHandler, RouterContextProvider } from 'react-router';
import { isCrossSiteRequest } from '../app/lib/csrf.server';
import { nonceContext } from '../app/lib/request-context';
import { createNonce } from '../app/lib/security.server';

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return env.API.fetch(request);
    }

    if (isCrossSiteRequest(request)) {
      return new Response('Cross-site form submission blocked.', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    const context = new RouterContextProvider();
    context.set(nonceContext, createNonce());
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
