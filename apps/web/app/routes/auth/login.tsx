/**
 * Sign-in page (/login). On success the API's session cookie is relayed to the
 * browser, and the visitor goes to `redirectTo` (validated, same site only),
 * or to onboarding if they haven't finished it.
 */
import { Form, Link, useSearchParams } from 'react-router';
import { loginSchema } from '@skillverse/shared';
import type { Route } from './+types/login';
import { GOOGLE_ERRORS, GoogleButton } from '~/components/auth/google-button';
import { Turnstile, turnstileToken } from '~/components/auth/turnstile';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { PasswordInput } from '~/components/ui/password-input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { redirectIfSignedIn } from '~/lib/auth.server';
import { formError, formValues, validate } from '~/lib/forms';
import { continueAfterSignIn, type SignInResult } from '~/lib/sign-in.server';

export function meta() {
  return [{ title: 'Sign in | SkillVerse' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectIfSignedIn(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const values = formValues(formData, ['email', 'password'] as const);
  const parsed = validate(loginSchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });

  const res = await api<SignInResult>(request, '/api/v1/auth/login', {
    method: 'POST',
    body: parsed.data,
    turnstileToken: turnstileToken(formData),
  });
  if (!res.ok) return formError({ formError: res.error.message, values }, res.status);
  // Continues to /login/2fa for accounts with two-factor authentication.
  const redirectTo = formData.get('redirectTo');
  return continueAfterSignIn(
    res.data,
    res.headers,
    typeof redirectTo === 'string' ? redirectTo : null,
  );
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const errors = actionData?.fieldErrors;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue learning."
      footer={
        <>
          New to SkillVerse?{' '}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {!actionData && GOOGLE_ERRORS[params.get('error') ?? ''] && (
        <Alert tone="danger" className="mb-4">
          {GOOGLE_ERRORS[params.get('error') ?? '']}
        </Alert>
      )}
      <GoogleButton redirectTo={params.get('redirectTo') ?? undefined} />
      {/* Explicit action: the redirect target travels in the hidden field below, and an implicit
          action (current URL + query) is encoded differently on server and client. */}
      <Form method="post" action="/login" className="mt-4 space-y-4" noValidate>
        {actionData?.formError && <Alert tone="danger">{actionData.formError}</Alert>}
        {!actionData && params.get('expired') && (
          <Alert>Your sign-in expired or had too many wrong codes. Please sign in again.</Alert>
        )}
        <input type="hidden" name="redirectTo" value={params.get('redirectTo') ?? ''} />
        <Field label="Email" name="email" errors={errors?.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              defaultValue={actionData?.values?.email}
              required
            />
          )}
        </Field>
        <Field label="Password" name="password" errors={errors?.password}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" required />}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Turnstile action="login" resetKey={actionData} error={errors?.turnstile?.[0]} />
        <SubmitButton className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </Form>
    </AuthShell>
  );
}
