/**
 * Test helpers: send requests to the Worker exactly as a browser would.
 */
import { exports } from 'cloudflare:workers';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@skillverse/shared';

export const ORIGIN = 'http://localhost:5173';

/** Calls the Worker's fetch handler with a path like "/api/health". */
export function call(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`http://localhost:8787${path}`, init));
}

/** Like `call`, but with the headers our web app sends on state-changing requests. */
export function callAsWebApp(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('origin', ORIGIN);
  headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  headers.set('content-type', 'application/json');
  return call(path, { ...init, headers });
}
