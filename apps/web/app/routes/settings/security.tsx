/**
 * /settings/security: password, two-factor authentication, and signed-in devices.
 * One action handles several intents: "password", "revoke", "revoke-others",
 * and "mfa-setup" / "mfa-enable" / "mfa-regenerate" / "mfa-disable".
 */
import { Laptop } from 'lucide-react';
import { data, Form } from 'react-router';
import { renderSVG } from 'uqr';
import {
  APP_NAME,
  changePasswordSchema,
  disableMfaSchema,
  idSchema,
  mfaCodeSchema,
  otpauthUri,
  TOTP_SECRET_PATTERN,
} from '@skillverse/shared';
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
import {
  TwoFactorSection,
  type MfaActionData,
  type MfaStatus,
} from '~/features/account/two-factor-section';

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
  const [sessions, mfa] = await Promise.all([
    api<SessionInfo[]>(request, '/api/v1/me/sessions'),
    api<MfaStatus>(request, '/api/v1/me/mfa'),
  ]);
  return {
    sessions: sessions.ok ? sessions.data : [],
    mfa: mfa.ok ? mfa.data : { enabled: false, recoveryCodesRemaining: 0 },
  };
}

/** Errors from the 2FA forms go under `mfaFieldErrors` so they show in the 2FA card, not the password form. */
function mfaError(
  error: { message: string; fields?: Record<string, string[]> },
  status: number,
  mfaSetup?: MfaActionData['mfaSetup'],
) {
  return data<MfaActionData & { formError?: string }>(
    { mfaFieldErrors: error.fields, formError: error.fields ? undefined : error.message, mfaSetup },
    { status },
  );
}

/**
 * QR code rendered on the server as SVG and shown via <img src="data:…">: no
 * third-party QR service ever sees the secret, and no raw HTML enters the page.
 */
function setupView(secret: string, otpauthUrl: string) {
  const svg = renderSVG(otpauthUrl, { border: 1 });
  return { secret, qrDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'mfa-setup') {
    const res = await api<{ secret: string; otpauthUrl: string }>(
      request,
      '/api/v1/me/mfa/totp/setup',
      { method: 'POST' },
    );
    if (!res.ok) return mfaError(res.error, res.status);
    return { mfaSetup: setupView(res.data.secret, res.data.otpauthUrl) };
  }

  if (intent === 'mfa-enable' || intent === 'mfa-regenerate') {
    // While enabling, keep showing the same QR code if the code was wrong. The secret comes back
    // from a hidden field; it's the user's own secret, already on their screen.
    const secret = formData.get('secret');
    const keepSetup =
      intent === 'mfa-enable' && typeof secret === 'string' && TOTP_SECRET_PATTERN.test(secret)
        ? setupView(secret, otpauthUri(APP_NAME, user.email, secret))
        : undefined;

    const parsed = validate(mfaCodeSchema, { code: formData.get('code') ?? '' });
    if (!parsed.ok) {
      return mfaError({ message: 'Invalid code', fields: parsed.fieldErrors }, 400, keepSetup);
    }
    const path =
      intent === 'mfa-enable' ? '/api/v1/me/mfa/totp/enable' : '/api/v1/me/mfa/recovery-codes';
    const res = await api<{ recoveryCodes: string[] }>(request, path, {
      method: 'POST',
      body: parsed.data,
    });
    if (!res.ok) return mfaError(res.error, res.status, keepSetup);
    return { recoveryCodes: res.data.recoveryCodes };
  }

  if (intent === 'mfa-disable') {
    const password = formData.get('password');
    const parsed = validate(disableMfaSchema, {
      code: formData.get('code') ?? '',
      ...(typeof password === 'string' && password ? { password } : {}),
    });
    if (!parsed.ok) return mfaError({ message: 'Invalid input', fields: parsed.fieldErrors }, 400);
    const res = await api(request, '/api/v1/me/mfa/disable', { method: 'POST', body: parsed.data });
    if (!res.ok) return mfaError(res.error, res.status);
    return { success: 'Two-factor authentication is off.' };
  }

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
    | ({
        success?: string;
        formError?: string;
        fieldErrors?: Record<string, string[]>;
      } & MfaActionData)
    | undefined;
  const errors = state?.fieldErrors;
  const others = loaderData.sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-8">
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      {state?.formError && <Alert tone="danger">{state.formError}</Alert>}

      <TwoFactorSection status={loaderData.mfa} data={state} />

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
