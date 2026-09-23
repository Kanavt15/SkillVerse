/** Inline message box. `tone="danger"` is announced immediately by screen readers. */
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

const TONES = {
  info: { box: 'border-border bg-bg-subtle text-fg', icon: Info },
  success: { box: 'border-accent/30 bg-accent-subtle text-fg', icon: CheckCircle2 },
  danger: { box: 'border-danger/30 bg-danger-subtle text-fg', icon: AlertTriangle },
};

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border p-3 text-sm', box, className)}
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', tone === 'danger' ? 'text-danger' : 'text-accent')}
        aria-hidden="true"
      />
      <div>{children}</div>
    </div>
  );
}
