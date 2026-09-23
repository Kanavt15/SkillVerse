/**
 * Sign-in page (/login). On success the API's session cookie is relayed to the
 * browser, and the visitor goes to `redirectTo` (validated, same site only),
 * or to onboarding if they haven't finished it.
 */
import { Form, Link, redirect, useSearchParams } from 'react-router';
import { loginSchema } from '@skillverse/shared';
import type { Route } from './+types/login';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { PasswordInput } from '~/components/ui/password-input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api, relayCookies } from '~/lib/api.server';
import { redirectIfSignedIn, type User } from '~/lib/auth.server';
import { formError, formValues, validate } from '~/lib/forms';
import { safeRedirect } from '~/lib/redirect';

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

  const res = await api<User>(request, '/api/v1/auth/login', { method: 'POST', body: parsed.data });
  if (!res.ok) return formError({ formError: res.error.message, values }, res.status);

  const target = res.data.profile.onboarded
    ? safeRedirect(formData.get('redirectTo'))
    : '/onboarding';
  return redirect(target, { headers: relayCookies(res.headers) });
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
      {/* Explicit action: the redirect target travels in the hidden field below, and an implicit
          action (current URL + query) is encoded differently on server and client. */}
      <Form method="post" action="/login" className="space-y-4" noValidate>
        {actionData?.formError && <Alert tone="danger">{actionData.formError}</Alert>}
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
        <SubmitButton className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </Form>
    </AuthShell>
  );
}
