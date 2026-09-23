/**
 * /studio/*: the Instructor Studio. Signed-in instructors only; everyone else
 * is sent to /teach to apply. (The API checks the role again on every call.)
 */
import { Outlet, redirect } from 'react-router';
import type { Route } from './+types/layout';
import { requireUser } from '~/lib/auth.server';
import { isInstructor } from '~/lib/roles';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  if (!isInstructor(user.roles)) throw redirect('/teach');
  return { user: { displayName: user.displayName, emailVerified: user.emailVerified } };
}

export default function StudioLayout() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Outlet />
    </section>
  );
}
