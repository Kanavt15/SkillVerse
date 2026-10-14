/** Resource proxy streams only the caller's authorized export; never parses or buffers it. */
import { env } from 'cloudflare:workers';
import type { Route } from './+types/export';
import { requireUser } from '~/lib/auth.server';
import { requireId } from '~/lib/params';
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const id = requireId(params.id);
  const response = await env.API.fetch(
    new Request(`https://api.internal/api/v1/me/privacy/exports/${id}/download`, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        'cf-connecting-ip': request.headers.get('cf-connecting-ip') ?? '',
        'user-agent': request.headers.get('user-agent') ?? '',
      },
    }),
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/x-ndjson',
      'content-disposition': response.headers.get('content-disposition') ?? 'inline',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
