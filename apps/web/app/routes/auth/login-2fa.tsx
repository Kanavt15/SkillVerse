/**
 * /login/2fa: second sign-in step for accounts with two-factor authentication.
 * The browser holds a PENDING session cookie (from the password step) that is
 * good only for this form. After 5 wrong codes, or 10 idle minutes, it expires.
 */
import { Form, Link, redirect, useSearchParams } from 'react-router';
import { mfaCodeSchema } from '@skillverse/shared';
import type { Route } from './+types/login-2fa';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { formError, formValues, validate } from '~/lib/forms';
import { continueAfterSignIn, type SignInResult } from '~/lib/sign-in.server';

export function meta() {
  return [
    { title: 'Two-factor authentication | SkillVerse' },
    { name: 'robots', content: 'noindex' },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const values = formValues(formData, ['code', 'redirectTo'] as const);
  const parsed = validate(mfaCodeSchema, { code: values.code });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors });

  const res = await api<SignInResult>(request, '/api/v1/auth/mfa/verify', {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) {
    // The pending session is gone (expired or too many attempts): start over.
    if (res.status === 401) {
      throw redirect(
        `/login?expired=1&redirectTo=${encodeURIComponent(values.redirectTo || '/dashboard')}`,
      );
    }
    return formError({
      fieldErrors: res.error.fields,
      formError: res.error.fields ? undefined : res.error.message,
    });
  }
  return continueAfterSignIn(res.data, res.headers, values.redirectTo);
}

export default function LoginTwoFactor({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  return (
    <AuthShell
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app."
      footer={
        <Link to="/login" className="font-medium text-brand hover:underline">
          Start over
        </Link>
      }
    >
      <Form method="post" action="/login/2fa" className="space-y-4" noValidate>
        {actionData?.formError && <Alert tone="danger">{actionData.formError}</Alert>}
        <input type="hidden" name="redirectTo" value={params.get('redirectTo') ?? ''} />
        <Field
          label="Authentication code"
          name="code"
          hint="Lost your phone? Enter one of your recovery codes instead (like ABCDE-FGHJK)."
          errors={actionData?.fieldErrors?.code}
        >
          {(p) => (
            <Input
              {...p}
              autoComplete="one-time-code"
              inputMode="text"
              autoCapitalize="characters"
              autoFocus
              maxLength={16}
              className="text-center font-mono text-lg tracking-widest"
              required
            />
          )}
        </Field>
        <SubmitButton className="w-full" pendingText="Checking…">
          Verify
        </SubmitButton>
      </Form>
    </AuthShell>
  );
}
