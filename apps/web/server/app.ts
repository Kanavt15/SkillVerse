/** Vercel custom entry: same-origin API proxy and the existing SSR/CSRF/CSP context. */
import { createRequestHandler, RouterContextProvider } from 'react-router';
import { isCrossSiteRequest } from '../app/lib/csrf.server';
import { nonceContext } from '../app/lib/request-context';
import { createNonce } from '../app/lib/security.server';
import { fetchBackend, withBackendContext } from './env.server';

const handler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  'production',
);

export default async function handle(request: Request): Promise<Response> {
  if (isCrossSiteRequest(request))
    return new Response('Cross-site form submission blocked.', { status: 403 });
  const headers = new Headers(request.headers);
  // Vercel overwrites x-forwarded-for at its edge; browser-supplied CF headers are discarded.
  headers.set(
    'cf-connecting-ip',
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1',
  );
  request = new Request(request, { headers });
  const path = new URL(request.url).pathname;
  if (path === '/api' || path.startsWith('/api/')) {
    if (path === '/api/v1/me/notifications/live') return new Response(null, { status: 426 });
    try {
      return await fetchBackend(request);
    } catch {
      return Response.json(
        { ok: false, error: { code: 'INTERNAL', message: 'The API is temporarily unavailable.' } },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }
  }
  const context = new RouterContextProvider();
  context.set(nonceContext, createNonce());
  return withBackendContext(request, () => handler(request, context));
}
