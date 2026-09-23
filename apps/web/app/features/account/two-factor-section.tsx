/**
 * Two-factor authentication card for Settings → Password & devices.
 *
 * States:
 *   off                 → "Set up" button
 *   setup in progress   → QR code + manual key + "enter a code to confirm"
 *   just enabled        → recovery codes, shown ONCE, with copy/download
 *   on                  → remaining recovery codes, regenerate, turn off
 *
 * All changes go through the security route's action (intents "mfa-*").
 */
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Form } from 'react-router';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { PasswordInput } from '~/components/ui/password-input';
import { SubmitButton } from '~/components/ui/submit-button';

export interface MfaStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export interface MfaActionData {
  mfaSetup?: { secret: string; qrDataUrl: string };
  recoveryCodes?: string[];
  mfaFieldErrors?: Record<string, string[]>;
}

function CodeInput(props: Record<string, unknown>) {
  return (
    <Input
      {...props}
      autoComplete="one-time-code"
      maxLength={16}
      className="max-w-48 font-mono tracking-widest"
      required
    />
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = `SkillVerse recovery codes (each works once)\n\n${codes.join('\n')}\n`;
  return (
    <div className="space-y-4">
      <Alert tone="success">
        <p>
          <strong>Two-factor authentication is on.</strong> Save these recovery codes somewhere
          safe, such as a password manager. Each works once if you lose your phone.{' '}
          <strong>You won't see them again.</strong>
        </p>
      </Alert>
      <ol className="grid grid-cols-2 gap-2 rounded-lg bg-surface-muted p-4 font-mono text-sm sm:grid-cols-5">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'skillverse-recovery-codes.txt';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download .txt
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorSection({ status, data }: { status: MfaStatus; data?: MfaActionData }) {
  const errors = data?.mfaFieldErrors;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 size-6 text-accent" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            Two-factor authentication
            {status.enabled ? <Badge tone="accent">On</Badge> : <Badge>Off</Badge>}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Protect your account with a code from an authenticator app (Google Authenticator,
            Microsoft Authenticator, 1Password…) in addition to your password. Required for
            instructors receiving payouts and for admins.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {data?.recoveryCodes ? (
          <RecoveryCodes codes={data.recoveryCodes} />
        ) : data?.mfaSetup ? (
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <img
              src={data.mfaSetup.qrDataUrl}
              alt="QR code to scan with your authenticator app"
              width={180}
              height={180}
              className="rounded-lg border border-border bg-white p-2"
            />
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Open your authenticator app and scan the QR code.</li>
                <li>
                  Can't scan? Enter this key manually:{' '}
                  <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs break-all">
                    {data.mfaSetup.secret.match(/.{1,4}/g)?.join(' ')}
                  </code>
                </li>
                <li>Type the 6-digit code the app shows.</li>
              </ol>
              <Form method="post" className="space-y-3" noValidate>
                <input type="hidden" name="secret" value={data.mfaSetup.secret} />
                <Field label="Code from the app" name="code" errors={errors?.code}>
                  {(p) => <CodeInput {...p} inputMode="numeric" />}
                </Field>
                <SubmitButton name="intent" value="mfa-enable" pendingText="Checking…">
                  Turn on
                </SubmitButton>
              </Form>
            </div>
          </div>
        ) : status.enabled ? (
          <div className="space-y-6">
            <p className="text-sm">
              Recovery codes left: <strong>{status.recoveryCodesRemaining}</strong>
              {status.recoveryCodesRemaining < 3 && ' (running low: generate new ones)'}
            </p>
            <details className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Generate new recovery codes
              </summary>
              <Form method="post" className="mt-4 space-y-3" noValidate>
                <p className="text-sm text-fg-muted">Your old codes stop working immediately.</p>
                <Field label="Current code from your app" name="code" errors={errors?.code}>
                  {(p) => <CodeInput {...p} />}
                </Field>
                <SubmitButton
                  variant="secondary"
                  name="intent"
                  value="mfa-regenerate"
                  pendingText="Generating…"
                >
                  Generate new codes
                </SubmitButton>
              </Form>
            </details>
            <details className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium text-danger">
                Turn off two-factor authentication
              </summary>
              <Form method="post" className="mt-4 max-w-md space-y-3" noValidate>
                <Field label="Password" name="password" errors={errors?.password}>
                  {(p) => <PasswordInput {...p} autoComplete="current-password" />}
                </Field>
                <Field
                  label="Code from your app (or a recovery code)"
                  name="code"
                  errors={errors?.code}
                >
                  {(p) => <CodeInput {...p} />}
                </Field>
                <SubmitButton
                  variant="danger"
                  name="intent"
                  value="mfa-disable"
                  pendingText="Turning off…"
                >
                  Turn off
                </SubmitButton>
              </Form>
            </details>
          </div>
        ) : (
          <Form method="post">
            <SubmitButton name="intent" value="mfa-setup" pendingText="Preparing…">
              Set up two-factor authentication
            </SubmitButton>
          </Form>
        )}
      </div>
    </Card>
  );
}
