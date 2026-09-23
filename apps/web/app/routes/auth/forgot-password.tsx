/**
 * /forgot-password: request a reset link. The answer is identical whether or
 * not the email has an account, so the page can't be used to discover accounts.
 */
import { Form, Link } from 'react-router';
import { emailOnlySchema } from '@skillverse/shared';
import type { Route } from './+types/forgot-password';
import { AuthShell } from '~/components/layout/auth-shell';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { formError, formValues, fromApiError, validate } from '~/lib/forms';

export function meta() {
  return [{ title: 'Reset your password | SkillVerse' }];
}

export async function action({ request }: Route.ActionArgs) {
  const values = formValues(await request.formData(), ['email'] as const);
  const parsed = validate(emailOnlySchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api(request, '/api/v1/auth/forgot-password', {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return {
    success:
      'If an account uses that email, we have sent a link to reset the password. It expires in 30 minutes.',
  };
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const data = actionData as
    { success?: string; fieldErrors?: Record<string, string[]>; formError?: string } | undefined;
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      {data?.success ? (
        <Alert tone="success">{data.success}</Alert>
      ) : (
        <Form method="post" className="space-y-4" noValidate>
          {data?.formError && <Alert tone="danger">{data.formError}</Alert>}
          <Field label="Email" name="email" errors={data?.fieldErrors?.email}>
            {(p) => <Input {...p} type="email" autoComplete="email" required />}
          </Field>
          <SubmitButton className="w-full" pendingText="Sending…">
            Send reset link
          </SubmitButton>
        </Form>
      )}
    </AuthShell>
  );
}
