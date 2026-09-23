/** Site footer. Legal pages arrive in Phase 1 (required for payments and ads). */
import { APP_NAME } from '@skillverse/shared';
import { Logo } from './logo';

export function SiteFooter({ environment }: { environment: string | null }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-bg-subtle">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm text-sm text-fg-muted">
            Learn a skill, teach a skill, prove it. Made in India, for learners everywhere.
          </p>
        </div>
        <div className="flex flex-col gap-1 text-sm text-fg-subtle md:items-end">
          <span>
            © {year} {APP_NAME}. All rights reserved.
          </span>
          {environment && environment !== 'production' && (
            <span className="font-mono text-xs">env: {environment}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
