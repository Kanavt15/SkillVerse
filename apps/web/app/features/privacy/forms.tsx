import { Link } from 'react-router';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { PasswordInput } from '~/components/ui/password-input';
export function AgreementFields({
  values,
  errors,
}: {
  values?: Record<string, string>;
  errors?: Record<string, string[]>;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 font-semibold">Eligibility and agreements</legend>
      <Field
        label="Private date of birth"
        name="birthDate"
        errors={errors?.birthDate}
        hint="Learning starts at 10; teaching starts at 16. Your birth date is private."
      >
        {(p) => <Input {...p} type="date" required defaultValue={values?.birthDate} />}
      </Field>
      <Field
        label="Guardian permission code (under 18)"
        name="guardianCode"
        errors={errors?.guardianCode}
        hint="A guardian aged 18+ must verify with DigiLocker in their own account, then create a code for your email and birth date before you sign up."
      >
        {(p) => <Input {...p} defaultValue={values?.guardianCode} autoComplete="off" />}
      </Field>
      <p className="text-sm text-fg-muted">
        Parents and guardians: create your own adult account first, then visit{' '}
        <Link to="/settings/guardians" className="underline">
          Guardian permissions
        </Link>
        . Choose a display alias for a child.
      </p>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-1" />{' '}
        <span>
          I agree to the{' '}
          <Link to="/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/community-guidelines" className="underline">
            Community Guidelines
          </Link>
          .
        </span>
      </label>
      {errors?.acceptTerms && <p className="text-sm text-danger">{errors.acceptTerms[0]}</p>}
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="acceptPrivacy" required className="mt-1" />{' '}
        <span>
          I have read and accept the{' '}
          <Link to="/privacy" className="underline">
            Privacy Notice
          </Link>
          .
        </span>
      </label>
      {errors?.acceptPrivacy && <p className="text-sm text-danger">{errors.acceptPrivacy[0]}</p>}
    </fieldset>
  );
}
export function SecurityProof() {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold">Confirm account security</legend>
      <Field
        label="Current password"
        name="password"
        hint="Required if your account has a password."
      >
        {(p) => <PasswordInput {...p} autoComplete="current-password" />}
      </Field>
      <Field
        label="Fresh authenticator or recovery code"
        name="code"
        hint="Required when MFA is enabled. Google-only accounts must enable MFA in Security first."
      >
        {(p) => <Input {...p} autoComplete="one-time-code" />}
      </Field>
    </fieldset>
  );
}
export function proofFrom(form: FormData) {
  return {
    password: String(form.get('password') || '') || undefined,
    code: String(form.get('code') || '') || undefined,
  };
}
