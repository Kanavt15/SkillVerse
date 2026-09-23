/**
 * Worker entry point for the website.
 *
 * 1. /api/* → forwarded to the API Worker through the service binding.
 *    In production Cloudflare routes https://<domain>/api/* straight to the API
 *    Worker, so those requests never arrive here. In local dev and on
 *    *.workers.dev staging they DO, and forwarding keeps the browser on a single
 *    origin, exactly like production.
 * 2. Everything else → React Router, with a per-request context holding the CSP nonce.
 */
import { createRequestHandler, RouterContextProvider } from 'react-router';
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

    const context = new RouterContextProvider();
    context.set(nonceContext, createNonce());
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
