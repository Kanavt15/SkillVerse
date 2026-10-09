/**
 * /studio/*: the Instructor Studio. Signed-in instructors only; everyone else
 * is sent to /teach to apply. (The API checks the role again on every call.)
 */
import { Outlet, redirect } from 'react-router';
import { BookOpen, GraduationCap, LayoutDashboard } from 'lucide-react';
import { WorkspaceShell } from '~/components/layout/workspace-shell';
import type { Route } from './+types/layout';
import { requireUser } from '~/lib/auth.server';
import { isInstructor } from '~/lib/roles';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  if (!isInstructor(user.roles)) throw redirect('/teach');
  return { user: { displayName: user.displayName, emailVerified: user.emailVerified } };
}

const SECTIONS = [
  { to: '/studio', label: 'Your courses', icon: BookOpen },
  { to: '/teach', label: 'Teaching overview', icon: GraduationCap },
  { to: '/dashboard', label: 'Learner dashboard', icon: LayoutDashboard },
];
export default function StudioLayout() {
  return (
    <WorkspaceShell title="Instructor Studio" label="Studio sections" sections={SECTIONS}>
      <Outlet />
    </WorkspaceShell>
  );
}
