/**
 * Field: label + control + hint + error messages, wired for screen readers.
 *
 *   <Field label="Email" name="email" errors={state?.fieldErrors?.email}>
 *     {(props) => <Input type="email" autoComplete="email" {...props} />}
 *   </Field>
 *
 * The render function receives `id`, `name`, `aria-invalid` and
 * `aria-describedby`, so the error text is announced when the input is focused.
 */
import { useId, type ReactNode } from 'react';

export interface FieldControlProps {
  id: string;
  name: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
}

export function Field({
  label,
  name,
  hint,
  errors,
  children,
}: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  errors?: string[];
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, name, 'aria-invalid': Boolean(errorId), 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {errorId && (
        <ul id={errorId} className="space-y-0.5 text-xs text-danger" role="alert">
          {errors!.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
