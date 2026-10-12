/** Account access controls with reasons, optimistic versions and a bounded decision history. */
import { Form, Link } from 'react-router';
import {
  adminUserDecisionSchema,
  staffRoleDecisionSchema,
  PRIVILEGED_ROLES,
  type AdminUserDetail,
} from '@skillverse/shared';
import type { Route } from './+types/user';
import { PageHeading } from '~/components/layout/page-heading';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { ACCOUNT_DECISION_LABELS } from '~/features/admin/account-labels';
import { requireAccountAdmin } from '~/features/admin/require-admin.server';
import { staffFormError, staffApiError } from '~/features/admin/staff-action.server';
import { StaffProof } from '~/features/admin/staff-proof';
import { staffGet } from '~/features/admin/staff-api.server';
import { api } from '~/lib/api.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireId } from '~/lib/params';

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAccountAdmin(request);
  return staffGet<AdminUserDetail>(request, `/api/v1/admin/users/${requireId(params.userId)}`);
}
export async function action({ request, params }: Route.ActionArgs) {
  const actor = await requireAccountAdmin(request);
  const form = await request.formData();
  if (form.get('intent') === 'role') {
    if (!actor.roles.includes('super_admin')) throw new Response('Not Found', { status: 404 });
    const input = formValues(form, ['role', 'decision', 'notes', 'version', 'password', 'code']);
    const parsed = validate(staffRoleDecisionSchema, {
      ...input,
      version: input.version === '' ? NaN : Number(input.version),
    });
    if (!parsed.ok) return staffFormError({ fieldErrors: parsed.fieldErrors });
    const result = await api(request, `/api/v1/admin/users/${requireId(params.userId)}/roles`, {
      method: 'POST',
      body: parsed.data,
    });
    if (!result.ok) return staffApiError(result.error, result.status);
    return {
      success: 'Privileged role decision saved. All target sessions were revoked.',
      submissionId: crypto.randomUUID(),
    };
  }
  const values = formValues(form, ['decision', 'notes', 'version']);
  const parsed = validate(adminUserDecisionSchema, {
    ...values,
    version: values.version === '' ? NaN : Number(values.version),
  });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const result = await api(request, `/api/v1/admin/users/${requireId(params.userId)}`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!result.ok) return fromApiError(result.error, result.status, values);
  return {
    success: `${ACCOUNT_DECISION_LABELS[`admin.user_${parsed.data.decision}`]}. Previous sessions were revoked.`,
  };
}
export default function User({ loaderData: detail, actionData }: Route.ComponentProps) {
  const { user, history } = detail,
    state = actionData as FormState | undefined;
  const facts = [
    ['Email', user.email],
    ['Username', `@${user.username}`],
    ['Roles', user.roles.join(', ')],
    ['Email verification', user.emailVerified ? 'Verified' : 'Unverified'],
    ['Two-factor authentication', detail.mfaEnabled ? 'Enabled' : 'Not enabled'],
    ['Unexpired sessions', String(detail.activeSessions)],
    ['Course enrollments', String(detail.enrollments)],
    ['Authored courses', String(detail.authoredCourses)],
  ];
  return (
    <div className="max-w-3xl [overflow-wrap:anywhere]">
      <Link className="text-sm text-fg-muted hover:text-brand" to="/admin/users">
        ← Accounts
      </Link>
      <div className="mt-5">
        <PageHeading
          title={user.displayName}
          description={
            <>
              Joined <LocalTime iso={user.createdAt} />
            </>
          }
        >
          <Badge tone={user.status === 'active' ? 'accent' : 'danger'}>{user.status}</Badge>
        </PageHeading>
      </div>
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
      <dl className="mt-6 grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2 sm:p-7">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-8" aria-labelledby="account-access">
        <h2 id="account-access" className="text-xl font-semibold">
          Account access
        </h2>
        {detail.canManage ? (
          <>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              Suspension blocks sign-in. Reactivation restores access after a fresh sign-in.
              Revoking sessions signs out existing devices. Every decision requires a staff-only
              reason; saved learning progress and course content are preserved.
            </p>
            <Form method="post" className="mt-5 space-y-4" noValidate key={user.version}>
              <input type="hidden" name="version" value={user.version} />
              <Field
                name="notes"
                label="Decision reason"
                hint="Describe the evidence and why this action is appropriate. Visible to admins in the account history."
                errors={state?.fieldErrors?.notes}
              >
                {(p) => (
                  <textarea
                    {...p}
                    className={inputClass}
                    rows={4}
                    required
                    minLength={10}
                    maxLength={2000}
                    defaultValue={state?.success ? '' : state?.values?.notes}
                  />
                )}
              </Field>
              <div className="flex flex-wrap gap-3">
                <SubmitButton
                  name="decision"
                  value={user.status === 'active' ? 'suspend' : 'reactivate'}
                  variant={user.status === 'active' ? 'danger' : 'primary'}
                  pendingText="Saving…"
                >
                  {user.status === 'active' ? 'Suspend account' : 'Reactivate account'}
                </SubmitButton>
                <SubmitButton
                  name="decision"
                  value="revoke_sessions"
                  variant="secondary"
                  pendingText="Revoking…"
                >
                  Revoke sessions
                </SubmitButton>
              </div>
            </Form>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-fg-muted">
            Staff accounts, your own account and deleted accounts are protected from these controls.
            Manage your own devices in{' '}
            <Link to="/settings/security" className="text-brand underline">
              Security settings
            </Link>
            .
          </p>
        )}
      </section>
      <section className="mt-9" aria-labelledby="privileged-roles">
        <h2 id="privileged-roles" className="text-xl font-semibold">
          Privileged roles
        </h2>
        <p className="mt-3 text-sm text-fg-muted">
          Grants require an active, email-verified account with MFA enabled. Every change signs out
          all target devices. Your own roles and the last administrator are protected.
        </p>
        {detail.canManageRoles ? (
          <Form
            method="post"
            className="mt-5 space-y-4"
            noValidate
            key={`role-${user.version}-${state?.submissionId}`}
          >
            <input type="hidden" name="intent" value="role" />
            <input type="hidden" name="version" value={user.version} />
            <label htmlFor="privileged-role" className="block text-sm">
              Role
            </label>
            <select id="privileged-role" name="role" className={`${inputClass} mt-2`}>
              {PRIVILEGED_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            <label htmlFor="role-decision" className="block text-sm">
              Decision
            </label>
            <select id="role-decision" name="decision" className={`${inputClass} mt-2`}>
              <option value="grant">Grant</option>
              <option value="revoke">Revoke</option>
            </select>
            <StaffProof state={state} />
            <SubmitButton pendingText="Saving...">Confirm role decision</SubmitButton>
          </Form>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">
            An independent super administrator must manage this account's staff roles.
          </p>
        )}
      </section>
      <section className="mt-9" aria-labelledby="decision-history">
        <h2 id="decision-history" className="text-xl font-semibold">
          Recent account decisions
        </h2>
        <p className="mt-2 text-xs text-fg-muted">Up to 20 most recent decisions, newest first.</p>
        {!history.length ? (
          <p className="mt-4 rounded-xl border border-border p-5 text-sm text-fg-muted">
            No account decisions recorded.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
            {history.map((entry) => (
              <li key={entry.id} className="p-5">
                <h3 className="font-semibold">
                  {ACCOUNT_DECISION_LABELS[entry.action] ?? entry.action}
                </h3>
                <p className="mt-2 text-xs leading-5 text-fg-muted">
                  {entry.actorName ?? 'Former staff account'} · <LocalTime iso={entry.createdAt} />
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{entry.notes}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
