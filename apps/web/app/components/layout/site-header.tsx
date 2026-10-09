/** Responsive navigation. Native fallbacks preserve navigation before hydration. Sign-out remains POST. */
import { Menu } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link, NavLink } from 'react-router';
import { Button } from '~/components/ui/button';
import { NativeAccountMenu } from './account-menu-data';
import { useHydrated } from '~/lib/use-hydrated';
import type { Theme } from '~/lib/theme';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { NotificationBell } from './notification-bell';

export interface HeaderUser {
  displayName: string;
  username: string;
  email: string;
  roles: string[];
}
const NAV = [
  { to: '/courses', label: 'Courses' },
  { to: '/#mentors', label: 'Mentors' },
  { to: '/#swap', label: 'Skill Swap' },
  { to: '/#certify', label: 'Certificates' },
  { to: '/teach', label: 'Teach' },
];
const EnhancedAccountMenu = lazy(() => import('./account-menu'));
function AccountMenu({ user }: { user: HeaderUser }) {
  const hydrated = useHydrated();
  const native = <NativeAccountMenu user={user} />;
  return hydrated ? (
    <Suspense fallback={native}>
      <EnhancedAccountMenu user={user} />
    </Suspense>
  ) : (
    native
  );
}

function NavigationLinks() {
  return (
    <>
      {NAV.map((item) =>
        item.to.includes('#') ? (
          <Link key={item.to} to={item.to} className="nav-link">
            {item.label}
          </Link>
        ) : (
          <NavLink key={item.to} to={item.to} className="nav-link">
            {item.label}
          </NavLink>
        ),
      )}
    </>
  );
}
export function SiteHeader({
  theme,
  user,
  unreadCount = 0,
}: {
  theme: Theme;
  user: HeaderUser | null;
  unreadCount?: number;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav aria-label="Main" className="hidden items-center xl:flex">
          <NavigationLinks />
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle initial={theme} />
          {user && <NotificationBell key={user.username} initialCount={unreadCount} />}
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <>
              <Button
                asLink
                to="/login"
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Sign in
              </Button>
              <Button
                asLink
                to="/signup"
                size="sm"
                className="hidden px-3 text-xs min-[360px]:inline-flex sm:px-4 sm:text-sm"
              >
                Get started
              </Button>
            </>
          )}
          <details className="relative xl:hidden">
            <summary
              className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <nav
              aria-label="Mobile"
              className="menu-content absolute right-0 mt-3 flex flex-col"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('a'))
                  event.currentTarget.closest('details')?.removeAttribute('open');
              }}
            >
              <NavigationLinks />
              {!user && (
                <Link to="/signup" className="nav-link min-[360px]:hidden">
                  Get started
                </Link>
              )}
              {!user && (
                <Link to="/login" className="nav-link sm:hidden">
                  Sign in
                </Link>
              )}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
