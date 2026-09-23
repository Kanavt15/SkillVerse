/**
 * Top navigation. On small screens the links collapse into a native
 * <details> menu, which works without JavaScript and is keyboard accessible.
 */
import { Menu } from 'lucide-react';
import { NavLink } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/cn';
import type { Theme } from '~/lib/theme';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

/** Section links on the home page until the real pages ship (Phase 1+). */
const NAV = [
  { to: '/#learn', label: 'Courses' },
  { to: '/#mentors', label: 'Mentors' },
  { to: '/#swap', label: 'Skill Swap' },
  { to: '/#certify', label: 'Certifications' },
  { to: '/#teach', label: 'Teach' },
];

const linkClass = 'rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:text-fg';

export function SiteHeader({ theme }: { theme: Theme }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Main" className="hidden items-center md:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Badge tone="brand" className="hidden sm:inline-flex">
            Early access soon
          </Badge>
          <ThemeToggle initial={theme} />
          <details className="relative md:hidden">
            <summary
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 mt-2 flex w-56 flex-col rounded-lg border border-border bg-surface p-2 shadow-raised"
            >
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={cn(linkClass, 'block')}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
