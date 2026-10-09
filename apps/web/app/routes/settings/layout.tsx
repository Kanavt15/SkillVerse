/** /settings/*: shared layout with section navigation. All settings pages require sign-in. */
import { Outlet } from 'react-router';
import { Settings, ShieldCheck } from 'lucide-react';
import { WorkspaceShell } from '~/components/layout/workspace-shell';
import { PageHeading } from '~/components/layout/page-heading';
import type { Route } from './+types/layout';
import { requireUser } from '~/lib/auth.server';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

const SECTIONS = [
  { to: '/settings', label: 'Profile', icon: Settings, end: true },
  { to: '/settings/security', label: 'Password & devices', icon: ShieldCheck },
];
export default function SettingsLayout() {
  return (
    <WorkspaceShell title="Account settings" label="Settings sections" sections={SECTIONS}>
      <PageHeading
        title="Settings"
        description="Make this space yours. Keep your account secure."
      />
      <div className="max-w-3xl">
        <Outlet />
      </div>
    </WorkspaceShell>
  );
}
