/** Request an emailed first factor without revealing whether an account exists. */
import { Form, Link, useSearchParams } from 'react-router';
import { magicLinkRequestSchema, safeRedirect } from '@skillverse/shared';
import type { Route } from './+types/email-login';
import { Turnstile, turnstileToken } from '~/components/auth/turnstile';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { redirectIfSignedIn } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate } from '~/lib/forms';

export function meta() {
  return [{ title: 'Sign in by email | SkillVerse' }];
}
export async function loader({ request }: Route.LoaderArgs) {
  await redirectIfSignedIn(request);
  return null;
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const values = formValues(formData, ['email', 'redirectTo'] as const);
  const parsed = validate(magicLinkRequestSchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api(request, '/api/v1/auth/magic-link', {
    method: 'POST',
    body: parsed.data,
    turnstileToken: turnstileToken(formData),
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return { success: true, redirectTo: parsed.data.redirectTo };
}
export default function EmailLogin({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const data = actionData as
    | {
        success?: boolean;
        redirectTo?: string;
        values?: Record<string, string>;
        fieldErrors?: Record<string, string[]>;
        formError?: string;
      }
    | undefined;
  const target = safeRedirect(data?.redirectTo ?? params.get('redirectTo'));
  return (
    <AuthShell
      title={data?.success ? 'Check your inbox' : 'Sign in by email'}
      subtitle={
        data?.success
          ? 'Your next lesson is one click away.'
          : 'We’ll send you a link. No password to remember.'
      }
      footer={
        <Link
          to={`/login?redirectTo=${encodeURIComponent(target)}`}
          className="font-medium text-brand hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      {data?.success ? (
        <div className="space-y-4">
          <Alert tone="success">
            If an active SkillVerse account uses that email, a sign-in link is on its way.
          </Alert>
          <p className="text-sm text-fg-muted">
            The link works once and expires in 15 minutes. Check your spam folder too. You can
            request another link after one minute.
          </p>
          <Link
            to={`/login/email?redirectTo=${encodeURIComponent(target)}`}
            reloadDocument
            className="text-sm font-medium text-brand hover:underline"
          >
            Send another link
          </Link>
        </div>
      ) : (
        <Form method="post" action="/login/email" className="space-y-4" noValidate>
          {data?.formError && <Alert tone="danger">{data.formError}</Alert>}
          <input type="hidden" name="redirectTo" value={target} />
          <Field label="Email" name="email" errors={data?.fieldErrors?.email}>
            {(p) => (
              <Input
                {...p}
                type="email"
                autoComplete="email"
                defaultValue={data?.values?.email}
                required
              />
            )}
          </Field>
          <Turnstile
            action="magic_link"
            resetKey={data}
            error={data?.fieldErrors?.turnstile?.[0]}
          />
          <SubmitButton className="w-full" pendingText="Sending…">
            Email me a sign-in link
          </SubmitButton>
        </Form>
      )}
    </AuthShell>
  );
}
