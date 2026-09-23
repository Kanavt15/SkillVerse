/** Centered card layout shared by sign-in, sign-up and password pages. */
import type { ReactNode } from 'react';
import { Card } from '~/components/ui/card';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
      </div>
    </section>
  );
}
