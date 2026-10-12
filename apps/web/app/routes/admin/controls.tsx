import { Form } from 'react-router';
import {
  staffSettingDecisionSchema,
  staffFlagDecisionSchema,
  type StaffControls,
} from '@skillverse/shared';
import type { Route } from './+types/controls';
import { PageHeading } from '~/components/layout/page-heading';
import { Alert } from '~/components/ui/alert';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { staffFormError, staffApiError } from '~/features/admin/staff-action.server';
import { StaffProof } from '~/features/admin/staff-proof';
import { requireAccountAdmin } from '~/features/admin/require-admin.server';
import { staffGet } from '~/features/admin/staff-api.server';
import { api } from '~/lib/api.server';
import { formValues, validate, type FormState } from '~/lib/forms';
export async function loader({ request }: Route.LoaderArgs) {
  await requireAccountAdmin(request);
  return staffGet<StaffControls>(request, '/api/v1/admin/controls');
}
export async function action({ request }: Route.ActionArgs) {
  const user = await requireAccountAdmin(request);
  if (!user.roles.includes('super_admin')) throw new Response('Not Found', { status: 404 });
  const form = await request.formData(),
    values = formValues(form, ['key', 'notes', 'version', 'password', 'code']);
  const intent = form.get('intent');
  const base = { ...values, version: values.version === '' ? NaN : Number(values.version) };
  const parsed =
    intent === 'setting'
      ? validate(staffSettingDecisionSchema, {
          ...base,
          value: form.get('value') === '' ? NaN : Number(form.get('value')),
        })
      : intent === 'flag'
        ? validate(staffFlagDecisionSchema, {
            ...base,
            enabled: form.get('enabled') === 'true',
            rolloutPercent: form.get('enabled') === 'true' ? 100 : 0,
          })
        : null;
  if (!parsed) return staffFormError({ formError: 'Unknown control.' });
  if (!parsed.ok) return staffFormError({ fieldErrors: parsed.fieldErrors });
  const result = await api(
    request,
    `/api/v1/admin/controls/${intent === 'setting' ? 'settings' : 'flags'}`,
    { method: 'POST', body: parsed.data },
  );
  if (!result.ok) return staffApiError(result.error, result.status);
  return {
    success: 'Control saved and recorded in the audit trail.',
    submissionId: crypto.randomUUID(),
  };
}
export default function Controls({ loaderData: data, actionData }: Route.ComponentProps) {
  const state = actionData as FormState | undefined;
  return (
    <div className="max-w-3xl [overflow-wrap:anywhere]">
      <PageHeading
        title="Platform controls"
        description="Operational thresholds and supported feature switches. Every change requires a reason and a fresh security check."
      />
      {state?.success && (
        <Alert tone="success" className="mt-5">
          {state.success}
        </Alert>
      )}
      {state?.formError && (
        <Alert tone="danger" className="mt-5">
          {state.formError}
        </Alert>
      )}
      {state?.fieldErrors && (
        <Alert tone="danger" className="mt-5">
          {Object.values(state.fieldErrors).flat().join(' ')}
        </Alert>
      )}
      <p className="mt-5 text-sm text-fg-muted">
        Telemetry: {data.telemetryEnabled ? 'enabled' : 'disabled'}. Alert delivery:{' '}
        {data.alertDeliveryConfigured ? 'configured' : 'not configured'}. An operator manages these
        environment settings.
      </p>
      {!data.canWrite && (
        <p className="mt-3 text-sm text-fg-muted">
          Only a super administrator can change controls.
        </p>
      )}
      <h2 className="mt-8 text-xl font-semibold">Operational settings</h2>
      <div className="mt-4 space-y-4">
        {data.settings.map((setting) => (
          <section
            aria-labelledby={`${setting.key}-label`}
            key={setting.key}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <h3 id={`${setting.key}-label`} className="font-semibold">
              {setting.label}
            </h3>
            <p className="mt-2 text-sm text-fg-muted">
              Current value: {setting.value} · Allowed: {setting.min}–{setting.max}
            </p>
            {data.canWrite && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-brand">Change setting</summary>
                <Form
                  method="post"
                  className="mt-4 space-y-4"
                  key={`${setting.version}-${state?.submissionId}`}
                  noValidate
                >
                  <input type="hidden" name="intent" value="setting" />
                  <input type="hidden" name="key" value={setting.key} />
                  <input type="hidden" name="version" value={setting.version} />
                  <label className="block text-sm">
                    New value
                    <input
                      className={`${inputClass} mt-2`}
                      type="number"
                      name="value"
                      min={setting.min}
                      max={setting.max}
                      step={1}
                      defaultValue={setting.value}
                      required
                    />
                  </label>
                  <StaffProof />
                  <SubmitButton pendingText="Saving…">Save setting</SubmitButton>
                </Form>
              </details>
            )}
          </section>
        ))}
      </div>
      <h2 className="mt-8 text-xl font-semibold">Feature switches</h2>
      <div className="mt-4 space-y-4">
        {data.flags.map((flag) => (
          <section key={flag.key} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="font-semibold">{flag.key}</h3>
            <p className="mt-2 text-sm text-fg-muted">
              {flag.label} · {flag.enabled ? 'Enabled' : 'Disabled'} · {flag.rolloutPercent}%
            </p>
            {flag.editable && data.canWrite && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-brand">
                  Change sign-in availability
                </summary>
                <Form
                  method="post"
                  className="mt-4 space-y-4"
                  key={`${flag.version}-${state?.submissionId}`}
                  noValidate
                >
                  <input type="hidden" name="intent" value="flag" />
                  <input type="hidden" name="key" value={flag.key} />
                  <input type="hidden" name="version" value={flag.version} />
                  <input type="hidden" name="enabled" value={String(!flag.enabled)} />
                  <p className="text-sm">
                    This will {flag.enabled ? 'disable' : 'enable'} Google sign-in for everyone.
                    Enabling requires a configured provider.
                  </p>
                  <StaffProof />
                  <SubmitButton variant={flag.enabled ? 'danger' : 'primary'} pendingText="Saving…">
                    {flag.enabled ? 'Disable' : 'Enable'} Google sign-in
                  </SubmitButton>
                </Form>
              </details>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
