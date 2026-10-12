/** Server-only replacement for Cloudflare bindings when building for Vercel. */
import { AsyncLocalStorage } from 'node:async_hooks';
declare const process: { env: Record<string, string | undefined> };
const visitor = new AsyncLocalStorage<string>();
export function withBackendContext<T>(request: Request, work: () => T): T {
  return visitor.run(request.headers.get('cf-connecting-ip') ?? '127.0.0.1', work);
}

export async function fetchBackend(request: Request): Promise<Response> {
  const backend = process.env.API_BASE_URL,
    key = process.env.WEB_PROXY_KEY;
  if (!backend || !key || key.length < 32)
    throw new Error('Configure API_BASE_URL and WEB_PROXY_KEY in Vercel.');
  const target = new URL(backend);
  if (
    target.protocol !== 'https:' ||
    target.pathname !== '/' ||
    target.search ||
    target.hash ||
    target.username ||
    target.password
  )
    throw new Error('API_BASE_URL must be an HTTPS origin.');
  const source = new URL(request.url);
  target.pathname = source.pathname;
  target.search = source.search;
  const headers = new Headers();
  for (const name of [
    'cookie',
    'origin',
    'user-agent',
    'accept',
    'accept-language',
    'content-type',
    'x-skillverse-client',
    'x-turnstile-token',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-sv-proxy-key', key);
  headers.set(
    'x-sv-client-ip',
    request.headers.get('cf-connecting-ip') ?? visitor.getStore() ?? '127.0.0.1',
  );
  return fetch(
    new Request(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      ...(!['GET', 'HEAD'].includes(request.method) ? { duplex: 'half' } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(25000),
    }),
  );
}

export const env = {
  get ENVIRONMENT() {
    return process.env.ENVIRONMENT ?? 'production';
  },
  get TURNSTILE_SITE_KEY() {
    return process.env.TURNSTILE_SITE_KEY ?? '';
  },
  API: { fetch: fetchBackend },
};
