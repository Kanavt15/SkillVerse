/** Narrower account-workspace gate; moderator review pages retain their existing permissions. */
import { requireUser } from '~/lib/auth.server';
import { canManageUsers } from '~/lib/roles';

export async function requireAccountAdmin(request: Request) {
  const user = await requireUser(request);
  if (!canManageUsers(user.roles)) throw new Response('Not Found', { status: 404 });
  return user;
}
