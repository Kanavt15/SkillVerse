/**
 * /check-email: shown after sign-up. Explains what to do next, and lets people
 * ask for a new verification email (the API answers the same whether or not
 * the address exists, so this can't be used to discover accounts).
 */
import { Form, Link } from 'react-router';
import { emailOnlySchema } from '@skillverse/shared';
import type { Route } from './+types/check-email';
import { Turnstile, turnstileToken } from '~/components/auth/turnstile';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { formError, formValues, fromApiError, validate } from '~/lib/forms';

export function meta() {
  return [{ title: 'Check your email | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const values = formValues(formData, ['email'] as const);
  const parsed = validate(emailOnlySchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api(request, '/api/v1/auth/resend-verification', {
    method: 'POST',
    body: parsed.data,
    turnstileToken: turnstileToken(formData),
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return { success: 'If that address has an unverified account, a new link is on its way.' };
}

export default function CheckEmail({ actionData }: Route.ComponentProps) {
  const data = actionData as
    { success?: string; fieldErrors?: Record<string, string[]>; formError?: string } | undefined;
  return (
    <AuthShell
      title="Check your email"
      subtitle="We've sent you a link to confirm your address. Click it to finish creating your account."
      footer={
        <Link to="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">
          The link expires in 24 hours. Can't find it? Check your spam folder, or send a new one:
        </p>
        {import.meta.env.DEV && (
          <Alert>
            Local development: emails aren't really sent. Open the{' '}
            <Link to="/dev/mailbox" className="font-medium text-brand underline">
              dev mailbox
            </Link>
            .
          </Alert>
        )}
        {data?.success && <Alert tone="success">{data.success}</Alert>}
        {data?.formError && <Alert tone="danger">{data.formError}</Alert>}
        <Form method="post" className="space-y-3" noValidate>
          <Field label="Email" name="email" errors={data?.fieldErrors?.email}>
            {(p) => <Input {...p} type="email" autoComplete="email" required />}
          </Field>
          <Turnstile
            action="resend_verification"
            resetKey={data}
            error={data?.fieldErrors?.turnstile?.[0]}
          />
          <SubmitButton variant="secondary" className="w-full" pendingText="Sending…">
            Resend verification email
          </SubmitButton>
        </Form>
      </div>
    </AuthShell>
  );
}
