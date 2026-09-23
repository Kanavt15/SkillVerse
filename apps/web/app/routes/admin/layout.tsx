/**
 * /admin/*: staff area (review queues). Visible only to moderators and admins;
 * everyone else gets a plain 404 so the area isn't advertised.
 *
 * Real protection is in the API (role + 2FA on every call). In production,
 * Cloudflare Access also sits in front of /admin (docs/operations/deployment.md).
 */
import { ShieldCheck } from 'lucide-react';
import { isRouteErrorResponse, NavLink, Outlet, useRouteError } from 'react-router';
import type { Route } from './+types/layout';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ErrorPage } from '~/components/layout/error-page';
import { isAdminErrorData } from '~/features/admin/types';
import { requireUser } from '~/lib/auth.server';
import { cn } from '~/lib/cn';
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
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/applications', label: 'Instructor applications', end: false },
  { to: '/admin/courses', label: 'Course reviews', end: false },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold tracking-wide text-brand uppercase">Admin</p>
      {/* The border sits on a wrapper so the scrollable tab row never grows a vertical scrollbar. */}
      <div className="mt-4 border-b border-border">
        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cn(
                  'border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap',
                  isActive
                    ? 'border-brand text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg',
                )
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-8">{children}</div>
    </section>
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
