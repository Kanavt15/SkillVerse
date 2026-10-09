/** Shared account navigation data for native and keyboard-enhanced menus. */
import {
  Award,
  BookOpen,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Form, Link } from 'react-router';
import type { HeaderUser } from './site-header';
import { isInstructor, isStaff } from '~/lib/roles';
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function accountMenuData(user: HeaderUser) {
  const items = [
    { to: '/dashboard', text: 'Dashboard', icon: LayoutDashboard },
    { to: '/learning', text: 'My learning', icon: BookOpen },
    { to: '/account/certificates', text: 'My certificates', icon: Award },
    {
      to: isInstructor(user.roles) ? '/studio' : '/teach',
      text: isInstructor(user.roles) ? 'Instructor Studio' : 'Teach on SkillVerse',
      icon: GraduationCap,
    },
    ...(isStaff(user.roles) ? [{ to: '/admin', text: 'Admin', icon: ShieldCheck }] : []),
    { to: '/settings', text: 'Settings', icon: Settings },
  ];
  const profile = (
    <div className="mb-1 border-b border-border px-3 py-3">
      <p className="truncate text-sm font-semibold">{user.displayName}</p>
      <p className="mt-1 truncate text-xs text-fg-muted">{user.email}</p>
    </div>
  );
  const trigger = (
    <>
      <span className="account-initials">{initials(user.displayName)}</span>
      <ChevronDown className="mr-1 size-3.5 text-fg-muted" aria-hidden="true" />
    </>
  );
  return { items, profile, trigger };
}
export function NativeAccountMenu({ user }: { user: HeaderUser }) {
  const { items, profile, trigger } = accountMenuData(user);
  return (
    <details className="relative">
      <summary
        className="account-trigger list-none [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        {trigger}
      </summary>
      <div className="menu-content absolute right-0 mt-3">
        {profile}
        {items.map(({ to, text, icon: Icon }) => (
          <Link key={to} to={to} className="menu-item">
            <Icon aria-hidden="true" />
            {text}
          </Link>
        ))}
        <Form method="post" action="/logout">
          <button type="submit" className="menu-item">
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </Form>
      </div>
    </details>
  );
}
