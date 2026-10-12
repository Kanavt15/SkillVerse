/** Credentials are blank after every server response and excluded from returned form values. */
import { Field } from '~/components/ui/field';
import { PasswordInput } from '~/components/ui/password-input';
import { inputClass } from '~/components/ui/input';
import type { FormState } from '~/lib/forms';
export function StaffProof({ state }: { state?: FormState }) {
  return (
    <>
      <Field
        name="notes"
        label="Decision reason"
        hint="Record the evidence and purpose. Visible only to administrators."
        errors={state?.fieldErrors?.notes}
      >
        {(p) => (
          <textarea
            {...p}
            className={inputClass}
            rows={3}
            required
            minLength={10}
            maxLength={2000}
          />
        )}
      </Field>
      <Field
        name="password"
        label="Your current password"
        hint="Required if your account has a password."
        errors={state?.fieldErrors?.password}
      >
        {(p) => <PasswordInput {...p} autoComplete="current-password" maxLength={128} />}
      </Field>
      <Field
        name="code"
        label="Fresh security code"
        hint="Use a fresh authenticator code or an unused recovery code for each decision."
        errors={state?.fieldErrors?.code}
      >
        {(p) => (
          <input
            {...p}
            className={inputClass}
            autoComplete="one-time-code"
            required
            maxLength={40}
          />
        )}
      </Field>
    </>
  );
}
