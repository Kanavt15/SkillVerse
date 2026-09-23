/**
 * Server-side API client for loaders and actions.
 *
 * Calls go through the `API` service binding (wrangler.jsonc), a direct
 * Worker-to-Worker call. The hostname below is never resolved on the internet;
 * the binding ignores it and only the path matters.
 *
 *   const meta = await apiGet<Meta>('/api/v1/meta');
 */
import { env } from 'cloudflare:workers';
import type { ApiResponse } from '@skillverse/shared';

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

/** GET a JSON endpoint and unwrap `{ ok: true, data }`, or throw ApiRequestError. */
export async function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await env.API.fetch(new Request(`${INTERNAL_ORIGIN}${path}`, init));
  const body = (await res.json()) as ApiResponse<T>;
  if (!body.ok) throw new ApiRequestError(res.status, body.error.code, body.error.message);
  return body.data;
}
