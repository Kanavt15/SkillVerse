import { AgreementFields } from '~/features/privacy/forms';
/**
 * Sign-up page (/signup). Creates the account through the API, then sends the
 * visitor to /check-email. They're signed in when they click the link in the email.
 */
import { Form, Link, redirect } from 'react-router';
import { POLICY_VERSION, registerSchema, googleRegistrationSchema } from '@skillverse/shared';
import type { Route } from './+types/signup';
import { GoogleButton } from '~/components/auth/google-button';
import { Turnstile, turnstileToken } from '~/components/auth/turnstile';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { PasswordInput } from '~/components/ui/password-input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api, apiGet, relayCookies } from '~/lib/api.server';
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
  const meta = await apiGet<{ launchReady?: boolean }>('/api/v1/meta').catch(() => null);
  return { launchReady: meta?.launchReady ?? false };
}

const FIELDS = [
  'displayName',
  'username',
  'email',
  'password',
  'birthDate',
  'guardianCode',
] as const;

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const values = formValues(formData, FIELDS);
  const agreements = {
    birthDate: values.birthDate,
    guardianCode: values.guardianCode || undefined,
    termsVersion: POLICY_VERSION,
    privacyVersion: POLICY_VERSION,
    acceptTerms: formData.get('acceptTerms') === 'on',
    acceptPrivacy: formData.get('acceptPrivacy') === 'on',
  };
  if (formData.get('intent') === 'google') {
    const google = validate(googleRegistrationSchema, {
      ...agreements,
      email: values.email,
      displayName: values.displayName || undefined,
    });
    if (!google.ok) return formError({ fieldErrors: google.fieldErrors, values });
    const result = await api<{ url: string }>(request, '/api/v1/auth/google/signup', {
      method: 'POST',
      body: google.data,
      turnstileToken: turnstileToken(formData),
    });
    if (!result.ok) return fromApiError(result.error, result.status, values);
    return redirect(result.data.url, { headers: relayCookies(result.headers) });
  }
  const parsed = validate(registerSchema, { ...values, ...agreements });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });

  const res = await api(request, '/api/v1/auth/register', {
    method: 'POST',
    body: parsed.data,
    turnstileToken: turnstileToken(formData),
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return redirect('/check-email');
}

export default function Signup({ actionData, loaderData }: Route.ComponentProps) {
  const errors = actionData?.fieldErrors;
  const values = actionData?.values;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Learn from free courses, teach what you know, and earn completion certificates."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {!loaderData.launchReady ? (
        <Alert>
          New accounts are not open yet. You can explore the{' '}
          <Link to="/courses" className="underline">
            catalog
          </Link>{' '}
          and{' '}
          <Link to="/about" className="underline">
            learn about SkillVerse
          </Link>{' '}
          while launch setup is completed.
        </Alert>
      ) : (
        <Form method="post" className="mt-4 space-y-4" noValidate>
          {actionData?.formError && <Alert tone="danger">{actionData.formError}</Alert>}
          <Field label="Display name or alias" name="displayName" errors={errors?.displayName}>
            {(p) => (
              <Input {...p} autoComplete="name" defaultValue={values?.displayName} required />
            )}
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
              <Input
                {...p}
                type="email"
                autoComplete="email"
                defaultValue={values?.email}
                required
              />
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
          <AgreementFields values={values} errors={errors} />
          <GoogleButton label="Sign up with Google" submit />
          <Turnstile action="signup" resetKey={actionData} error={errors?.turnstile?.[0]} />
          <SubmitButton className="w-full" pendingText="Creating account…">
            Create account
          </SubmitButton>
        </Form>
      )}
    </AuthShell>
  );
}
