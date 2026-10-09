/** GET is inert for email scanners. Only an explicit POST redeems the emailed sign-in token. */
import { Form, Link, useSearchParams } from 'react-router';
import { safeRedirect, tokenOnlySchema } from '@skillverse/shared';
import type { Route } from './+types/email-login-confirm';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { formError, formValues, validate } from '~/lib/forms';
import { continueAfterSignIn, type SignInResult } from '~/lib/sign-in.server';

export function meta() {
  return [
    { title: 'Confirm your sign-in | SkillVerse' },
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'no-referrer' },
  ];
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = validate(tokenOnlySchema, formValues(formData, ['token'] as const));
  if (!parsed.ok)
    return formError({
      formError: 'This sign-in link is incomplete or invalid. Request a new link.',
    });
  const res = await api<SignInResult>(request, '/api/v1/auth/magic-link/redeem', {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return formError({ formError: res.error.message }, res.status);
  return continueAfterSignIn(res.data, res.headers, safeRedirect(formData.get('redirectTo')));
}
export default function EmailLoginConfirm({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  return (
    <AuthShell title="Confirm your sign-in" subtitle="Continue only if you requested this link.">
      {actionData?.formError || !token ? (
        <div className="space-y-4">
          <Alert tone="danger">
            {actionData?.formError ??
              'This sign-in link is incomplete. Open the link from your email again.'}
          </Alert>
          <Link to="/login/email" className="text-sm font-medium text-brand hover:underline">
            Request a new sign-in link
          </Link>
        </div>
      ) : (
        <Form method="post" action="/login/email/confirm" className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="redirectTo" value={safeRedirect(params.get('redirectTo'))} />
          <p className="text-sm text-fg-muted">
            This link works once. If your account has two-factor authentication, we’ll ask for your
            code next.
          </p>
          <SubmitButton className="w-full" pendingText="Signing in…">
            Continue to SkillVerse
          </SubmitButton>
        </Form>
      )}
    </AuthShell>
  );
}
