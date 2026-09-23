/**
 * /logout: POST only (a GET link would let any page sign people out with an <img> tag).
 * Ends the session in the API and relays the cookie-clearing header.
 */
import { redirect } from 'react-router';
import type { Route } from './+types/logout';
import { api, relayCookies } from '~/lib/api.server';

export async function action({ request }: Route.ActionArgs) {
  const res = await api(request, '/api/v1/auth/logout', { method: 'POST' });
  return redirect('/', { headers: relayCookies(res.headers) });
}

export function loader() {
  return redirect('/');
}
