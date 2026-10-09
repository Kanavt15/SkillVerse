/** Loaded for signed-in viewers after hydration, keeping menu code off the public critical path. */
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut } from 'lucide-react';
import { Form, Link } from 'react-router';
import type { HeaderUser } from './site-header';
import { accountMenuData } from './account-menu-data';
export default function AccountMenu({ user }: { user: HeaderUser }) {
  const { items, profile, trigger } = accountMenuData(user);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="account-trigger" aria-label="Account menu">
        {trigger}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="end" sideOffset={12}>
          {profile}
          {items.map(({ to, text, icon: Icon }) => (
            <DropdownMenu.Item key={to} asChild>
              <Link to={to} className="menu-item">
                <Icon aria-hidden="true" />
                {text}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <Form method="post" action="/logout">
            {/* Keep the form mounted until its native submit completes. */}
            <DropdownMenu.Item asChild onSelect={(event) => event.preventDefault()}>
              <button type="submit" className="menu-item">
                <LogOut aria-hidden="true" />
                Sign out
              </button>
            </DropdownMenu.Item>
          </Form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
