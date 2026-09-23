/**
 * Submit button that shows a pending state while its form is being submitted,
 * and is disabled meanwhile so a double-click can't submit twice.
 */
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigation } from 'react-router';
import { Button } from './button';

export function SubmitButton({
  children,
  pendingText,
  className,
  name,
  value,
  variant,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  /** Lets one form have several actions: <SubmitButton name="intent" value="revoke"> */
  name?: string;
  value?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const navigation = useNavigation();
  const pending =
    navigation.state === 'submitting' && (!name || navigation.formData?.get(name) === value);
  return (
    <Button
      type="submit"
      className={className}
      disabled={pending}
      name={name}
      value={value}
      variant={variant}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {pending ? (pendingText ?? 'Please wait…') : children}
    </Button>
  );
}
