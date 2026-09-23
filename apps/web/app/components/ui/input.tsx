/** Text input styled with design tokens. Use inside <Field> to get a label and errors. */
import type { InputHTMLAttributes } from 'react';
import { cn } from '~/lib/cn';

export const inputClass =
  'block w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50 aria-[invalid=true]:border-danger';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...rest} />;
}
