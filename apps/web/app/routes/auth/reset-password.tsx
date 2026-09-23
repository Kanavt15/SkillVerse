/**
 * /reset-password?token=…: choose a new password from the emailed link.
 * On success every other device is signed out and this browser is signed in.
 */
import { Form, Link, redirect, useSearchParams } from 'react-router';
import { resetPasswordSchema } from '@skillverse/shared';
import type { Route } from './+types/reset-password';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { PasswordInput } from '~/components/ui/password-input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api, relayCookies } from '~/lib/api.server';
import { formError, formValues, fromApiError, validate } from '~/lib/forms';

export function meta() {
  return [
    { title: 'Choose a new password | SkillVerse' },
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'no-referrer' },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const values = formValues(await request.formData(), [
    'token',
    'password',
    'confirmPassword',
  ] as const);
  if (values.password !== values.confirmPassword) {
    return formError({ fieldErrors: { confirmPassword: ['The two passwords do not match.'] } });
  }
  const parsed = validate(resetPasswordSchema, { token: values.token, password: values.password });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors });

  const res = await api(request, '/api/v1/auth/reset-password', {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status);
  return redirect('/dashboard', { headers: relayCookies(res.headers) });
}

export default function ResetPassword({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const errors = actionData?.fieldErrors;
  const tokenProblem = errors?.token?.[0];

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="You'll be signed out on every other device."
      footer={
        <Link to="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      {!token || tokenProblem ? (
        <div className="space-y-4">
          <Alert tone="danger">{tokenProblem ?? 'This link is incomplete.'}</Alert>
          <Link to="/forgot-password" className="text-sm font-medium text-brand hover:underline">
            Request a new link
          </Link>
        </div>
      ) : (
        <Form method="post" className="space-y-4" noValidate>
          {actionData?.formError && <Alert tone="danger">{actionData.formError}</Alert>}
          <input type="hidden" name="token" value={token} />
          <Field
            label="New password"
            name="password"
            hint="At least 10 characters."
            errors={errors?.password}
          >
            {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={10} />}
          </Field>
          <Field
            label="Confirm new password"
            name="confirmPassword"
            errors={errors?.confirmPassword}
          >
            {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
          </Field>
          <SubmitButton className="w-full" pendingText="Saving…">
            Save new password
          </SubmitButton>
        </Form>
      )}
    </AuthShell>
  );
}
