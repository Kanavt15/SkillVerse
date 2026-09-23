/** Surface container: <Card> … </Card>. */
import type { HTMLAttributes } from 'react';
import { cn } from '~/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8', className)}
      {...rest}
    />
  );
}
