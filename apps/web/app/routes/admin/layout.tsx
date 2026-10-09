/**
 * /admin/*: staff area (review queues). Visible only to moderators and admins;
 * everyone else gets a plain 404 so the area isn't advertised.
 *
 * Real protection is in the API (role + 2FA on every call). In production,
 * Cloudflare Access also sits in front of /admin (docs/operations/deployment.md).
 */
import { BookOpen, ClipboardList, Flag, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { isRouteErrorResponse, Outlet, useRouteError } from 'react-router';
import type { Route } from './+types/layout';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ErrorPage } from '~/components/layout/error-page';
import { isAdminErrorData } from '~/features/admin/types';
import { requireUser } from '~/lib/auth.server';
import { WorkspaceShell } from '~/components/layout/workspace-shell';
import { isStaff } from '~/lib/roles';

export function meta() {
  return [{ title: 'Admin | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  if (!isStaff(user.roles)) throw new Response('Not Found', { status: 404 });
  return null;
}

const SECTIONS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/applications', label: 'Instructor applications', icon: ClipboardList },
  { to: '/admin/courses', label: 'Course reviews', icon: BookOpen },
  { to: '/admin/reports', label: 'Content reports', icon: Flag },
];
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell title="Review workspace" label="Admin sections" sections={SECTIONS}>
      {children}
    </WorkspaceShell>
  );
}

export default function AdminLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const info = isRouteErrorResponse(error) && isAdminErrorData(error.data) ? error.data : null;
  // Not staff, unknown page, crash: the normal site error page, without the admin navigation.
  if (!info) return <ErrorPage error={error} />;

  if (info?.reason === 'mfa') {
    return (
      <Shell>
        <Card className="mx-auto max-w-xl text-center">
          <ShieldCheck className="mx-auto size-10 text-brand" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold">Turn on two-factor authentication</h1>
          <p className="mt-2 text-fg-muted">
            Staff accounts must use an authenticator app. It takes about a minute to set up.
          </p>
          <Button asLink to="/settings/security" className="mt-6">
            Set up 2FA
          </Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-fg-muted">{info.message}</p>
      </Card>
    </Shell>
  );
}
