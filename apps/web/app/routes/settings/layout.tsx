/** /settings/*: shared layout with section navigation. All settings pages require sign-in. */
import { NavLink, Outlet } from 'react-router';
import type { Route } from './+types/layout';
import { requireUser } from '~/lib/auth.server';
import { cn } from '~/lib/cn';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

const SECTIONS = [
  { to: '/settings', label: 'Profile', end: true },
  { to: '/settings/security', label: 'Password & devices', end: false },
];

export default function SettingsLayout() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <nav aria-label="Settings sections" className="mt-6 flex gap-1 border-b border-border">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            end={s.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
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
      <div className="mt-8">
        <Outlet />
      </div>
    </section>
  );
}
