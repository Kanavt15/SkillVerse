/**
 * /verify-email?token=…: the link from the verification email.
 *
 * Opening the page does NOT verify anything; the visitor clicks "Confirm".
 * Corporate email scanners open every link in an email, and verifying on page
 * load would let a scanner confirm an address the owner never saw.
 */
import { Form, Link, redirect, useSearchParams } from 'react-router';
import { tokenOnlySchema } from '@skillverse/shared';
import type { Route } from './+types/verify-email';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { SubmitButton } from '~/components/ui/submit-button';
import { api, relayCookies } from '~/lib/api.server';
import type { User } from '~/lib/auth.server';
import { formError, formValues, validate } from '~/lib/forms';

export function meta() {
  // `noindex` + no referrer so the token in the URL never leaks to other sites.
  return [
    { title: 'Confirm your email | SkillVerse' },
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'no-referrer' },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const values = formValues(await request.formData(), ['token'] as const);
  const parsed = validate(tokenOnlySchema, values);
  if (!parsed.ok) return formError({ formError: 'This link is invalid or has expired.' });

  const res = await api<User>(request, '/api/v1/auth/verify-email', {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return formError({ formError: res.error.message }, res.status);
  const next = res.data.profile.onboarded ? '/dashboard' : '/onboarding';
  return redirect(next, { headers: relayCookies(res.headers) });
}

export default function VerifyEmail({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  return (
    <AuthShell title="Confirm your email" subtitle="One click and you're in.">
      {actionData?.formError ? (
        <div className="space-y-4">
          <Alert tone="danger">{actionData.formError}</Alert>
          <Link to="/check-email" className="text-sm font-medium text-brand hover:underline">
            Send me a new link
          </Link>
        </div>
      ) : token ? (
        <Form method="post">
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full" pendingText="Confirming…">
            Confirm my email
          </SubmitButton>
        </Form>
      ) : (
        <Alert tone="danger">
          This link is incomplete. Open the link from your email again, or{' '}
          <Link to="/check-email" className="underline">
            request a new one
          </Link>
          .
        </Alert>
      )}
    </AuthShell>
  );
}
