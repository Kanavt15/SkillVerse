/**
 * Sign-up page (/signup). Creates the account through the API, then sends the
 * visitor to /check-email. They're signed in when they click the link in the email.
 */
import { Form, Link, redirect } from 'react-router';
import { registerSchema } from '@skillverse/shared';
import type { Route } from './+types/signup';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { PasswordInput } from '~/components/ui/password-input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { redirectIfSignedIn } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate } from '~/lib/forms';

export function meta() {
  return [
    { title: 'Create your account | SkillVerse' },
    { name: 'description', content: 'Join SkillVerse to learn, teach and prove your skills.' },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectIfSignedIn(request);
  return null;
}

const FIELDS = ['displayName', 'username', 'email', 'password'] as const;

export async function action({ request }: Route.ActionArgs) {
  const values = formValues(await request.formData(), FIELDS);
  const parsed = validate(registerSchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });

  const res = await api(request, '/api/v1/auth/register', { method: 'POST', body: parsed.data });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return redirect('/check-email');
}

export default function Signup({ actionData }: Route.ComponentProps) {
  const errors = actionData?.fieldErrors;
  const values = actionData?.values;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Learn from courses and mentors, teach what you know, and earn certificates."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Form method="post" className="space-y-4" noValidate>
        {actionData?.formError && <Alert tone="danger">{actionData.formError}</Alert>}
        <Field label="Full name" name="displayName" errors={errors?.displayName}>
          {(p) => <Input {...p} autoComplete="name" defaultValue={values?.displayName} required />}
        </Field>
        <Field
          label="Username"
          name="username"
          hint="3–30 characters: letters, numbers and underscores. It appears in your profile URL."
          errors={errors?.username}
        >
          {(p) => (
            <Input
              {...p}
              autoComplete="username"
              autoCapitalize="none"
              defaultValue={values?.username}
              required
            />
          )}
        </Field>
        <Field label="Email" name="email" errors={errors?.email}>
          {(p) => (
            <Input {...p} type="email" autoComplete="email" defaultValue={values?.email} required />
          )}
        </Field>
        <Field
          label="Password"
          name="password"
          hint="At least 10 characters. A few random words make a strong, memorable password."
          errors={errors?.password}
        >
          {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={10} />}
        </Field>
        <SubmitButton className="w-full" pendingText="Creating account…">
          Create account
        </SubmitButton>
        <p className="text-xs text-fg-subtle">
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </p>
      </Form>
    </AuthShell>
  );
}
