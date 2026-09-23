/**
 * Top navigation. On small screens the links collapse into a native
 * <details> menu, which works without JavaScript and is keyboard accessible.
 * Signed-in visitors get an account menu. Signing out is a POST form (never a
 * GET link, which any site could trigger with an <img> tag).
 */
import { Menu } from 'lucide-react';
import { Form, Link, NavLink } from 'react-router';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/cn';
import type { Theme } from '~/lib/theme';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

export interface HeaderUser {
  displayName: string;
  username: string;
  email: string;
}

/** Section links on the home page until the real pages ship. */
const NAV = [
  { to: '/#learn', label: 'Courses' },
  { to: '/#mentors', label: 'Mentors' },
  { to: '/#swap', label: 'Skill Swap' },
  { to: '/#certify', label: 'Certifications' },
  { to: '/#teach', label: 'Teach' },
];

const linkClass = 'rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:text-fg';
const menuClass =
  'absolute right-0 z-50 mt-2 flex w-60 flex-col rounded-lg border border-border bg-surface p-2 shadow-raised';
const menuItemClass = 'block rounded-md px-3 py-2 text-left text-sm text-fg hover:bg-surface-muted';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function AccountMenu({ user }: { user: HeaderUser }) {
  return (
    <details className="relative">
      <summary
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-fg [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        {initials(user.displayName)}
      </summary>
      <div className={menuClass}>
        <div className="border-b border-border px-3 pt-1 pb-2">
          <p className="truncate text-sm font-semibold">{user.displayName}</p>
          <p className="truncate text-xs text-fg-muted">{user.email}</p>
        </div>
        <Link to="/dashboard" className={cn(menuItemClass, 'mt-1')}>
          Dashboard
        </Link>
        <Link to="/settings" className={menuItemClass}>
          Settings
        </Link>
        <Form method="post" action="/logout">
          <button type="submit" className={cn(menuItemClass, 'w-full')}>
            Sign out
          </button>
        </Form>
      </div>
    </details>
  );
}

export function SiteHeader({ theme, user }: { theme: Theme; user: HeaderUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center lg:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle initial={theme} />
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
              <Button asLink to="/signup" size="sm">
                Get started
              </Button>
            </>
          )}
          <details className="relative lg:hidden">
            <summary
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </summary>
            <nav aria-label="Mobile" className={menuClass}>
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={cn(linkClass, 'block')}>
                  {item.label}
                </NavLink>
              ))}
              {!user && (
                <Link to="/login" className={cn(linkClass, 'block sm:hidden')}>
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
