/**
 * Server-side API client for loaders and actions.
 *
 * Calls go through the `API` service binding (wrangler.jsonc), a direct
 * Worker-to-Worker call. The hostname below is never resolved on the internet;
 * the binding ignores it and only the path matters.
 *
 *   const meta = await apiGet<Meta>('/api/v1/meta');              // public, no user context
 *   const res  = await api<Me>(request, '/api/v1/me');              // on behalf of the visitor
 *   const res  = await api(request, '/api/v1/auth/login', { method: 'POST', body })
 *
 * `api()` acts ON BEHALF OF the visitor. It forwards their session cookie, IP
 * and user agent (so the API's per-IP rate limits and "your devices" list see
 * the real visitor, not this Worker), and it adds the Origin + client header
 * the API's CSRF check requires. The web Worker already verified the browser's
 * Origin for this request (workers/app.ts).
 */
import { env } from 'cloudflare:workers';
import {
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  type ApiErrorBody,
  type ApiResponse,
} from '@skillverse/shared';

const INTERNAL_ORIGIN = 'https://api.internal';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** GET a public JSON endpoint and unwrap `{ ok: true, data }`, or throw ApiRequestError. */
export async function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await env.API.fetch(new Request(`${INTERNAL_ORIGIN}${path}`, init));
  const body = (await res.json()) as ApiResponse<T>;
  if (!body.ok) throw new ApiRequestError(res.status, body.error.code, body.error.message);
  return body.data;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T; headers: Headers }
  | { ok: false; status: number; error: ApiErrorBody['error']; headers: Headers };

const FORWARDED_HEADERS = ['cookie', 'cf-connecting-ip', 'user-agent', 'accept-language'];

/** Calls the API as the visitor who made `request`. Never throws for API errors; check `ok`. */
export async function api<T>(
  request: Request,
  path: string,
  opts: { method?: string; body?: unknown; turnstileToken?: string } = {},
): Promise<ApiResult<T>> {
  const method = opts.method ?? 'GET';
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (method !== 'GET') {
    headers.set('origin', new URL(request.url).origin);
    headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
    headers.set('content-type', 'application/json');
  }
  // Bot-check token from the Turnstile widget, verified by the API (middleware/turnstile.ts).
  if (opts.turnstileToken) headers.set('x-turnstile-token', opts.turnstileToken);

  const res = await env.API.fetch(
    new Request(`${INTERNAL_ORIGIN}${path}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(opts.body ?? {}),
    }),
  );
  const body = (await res.json()) as ApiResponse<T>;
  return body.ok
    ? { ok: true, status: res.status, data: body.data, headers: res.headers }
    : { ok: false, status: res.status, error: body.error, headers: res.headers };
}

/**
 * Copies the API's Set-Cookie headers (session created or cleared) onto a
 * response we send to the browser. The cookie is set by the API and passed
 * through untouched: this Worker never reads or builds session tokens itself.
 */
export function relayCookies(from: Headers, into: Headers = new Headers()): Headers {
  for (const cookie of from.getSetCookie()) into.append('Set-Cookie', cookie);
  return into;
}
