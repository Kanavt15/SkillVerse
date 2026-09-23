/**
 * /settings/security: change password, and see / sign out devices.
 * One action handles three intents: "password", "revoke" (one device) and "revoke-others".
 */
import { Laptop } from 'lucide-react';
import { Form } from 'react-router';
import { changePasswordSchema, idSchema } from '@skillverse/shared';
import type { Route } from './+types/security';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { Field } from '~/components/ui/field';
import { LocalTime } from '~/components/ui/local-time';
import { PasswordInput } from '~/components/ui/password-input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate } from '~/lib/forms';
import { describeUserAgent } from '~/lib/user-agent';

export function meta() {
  return [{ title: 'Password & devices | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

interface SessionInfo {
  handle: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const res = await api<SessionInfo[]>(request, '/api/v1/me/sessions');
  return { sessions: res.ok ? res.data : [] };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'password') {
    const values = formValues(formData, [
      'currentPassword',
      'newPassword',
      'confirmPassword',
    ] as const);
    if (values.newPassword !== values.confirmPassword) {
      return formError({ fieldErrors: { confirmPassword: ['The two passwords do not match.'] } });
    }
    const parsed = validate(changePasswordSchema, {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors });
    const res = await api(request, '/api/v1/me/password', { method: 'POST', body: parsed.data });
    if (!res.ok) return fromApiError(res.error, res.status);
    return { success: 'Password changed. Your other devices have been signed out.' };
  }

  if (intent === 'revoke') {
    const handle = idSchema.safeParse(formData.get('handle'));
    if (!handle.success) return formError({ formError: 'Unknown device.' });
    const res = await api(request, `/api/v1/me/sessions/${handle.data}`, { method: 'DELETE' });
    if (!res.ok) return fromApiError(res.error, res.status);
    return { success: 'Device signed out.' };
  }

  if (intent === 'revoke-others') {
    const res = await api(request, '/api/v1/me/sessions/revoke-others', { method: 'POST' });
    if (!res.ok) return fromApiError(res.error, res.status);
    return { success: 'All other devices have been signed out.' };
  }

  return formError({ formError: 'Unknown action.' });
}

export default function SecuritySettings({ loaderData, actionData }: Route.ComponentProps) {
  const state = actionData as
    { success?: string; formError?: string; fieldErrors?: Record<string, string[]> } | undefined;
  const errors = state?.fieldErrors;
  const others = loaderData.sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-8">
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      {state?.formError && <Alert tone="danger">{state.formError}</Alert>}

      <Card>
        <h2 className="text-xl font-semibold">Change password</h2>
        <Form method="post" className="mt-6 max-w-md space-y-4" noValidate>
          <input type="hidden" name="intent" value="password" />
          <Field label="Current password" name="currentPassword" errors={errors?.currentPassword}>
            {(p) => <PasswordInput {...p} autoComplete="current-password" required />}
          </Field>
          <Field
            label="New password"
            name="newPassword"
            hint="At least 10 characters."
            errors={errors?.newPassword}
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
          <SubmitButton name="intent" value="password" pendingText="Saving…">
            Change password
          </SubmitButton>
        </Form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Your devices</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Places where you're signed in. Sign out anything you don't recognise.
            </p>
          </div>
          {others > 0 && (
            <Form method="post">
              <SubmitButton
                variant="secondary"
                name="intent"
                value="revoke-others"
                pendingText="Signing out…"
              >
                Sign out all other devices
              </SubmitButton>
            </Form>
          )}
        </div>
        <ul className="mt-6 divide-y divide-border">
          {loaderData.sessions.map((s) => (
            <li key={s.handle} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-start gap-3">
                <Laptop className="mt-0.5 size-5 text-fg-subtle" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {describeUserAgent(s.userAgent)}{' '}
                    {s.current && <Badge tone="accent">This device</Badge>}
                  </p>
                  <p className="text-sm text-fg-muted">
                    Last active <LocalTime iso={s.lastSeenAt} /> · Signed in{' '}
                    <LocalTime iso={s.createdAt} />
                  </p>
                </div>
              </div>
              {!s.current && (
                <Form method="post">
                  <input type="hidden" name="handle" value={s.handle} />
                  <SubmitButton variant="ghost" name="intent" value="revoke" pendingText="…">
                    Sign out
                  </SubmitButton>
                </Form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
