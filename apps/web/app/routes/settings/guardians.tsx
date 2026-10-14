import { Form, redirect } from 'react-router';
import { POLICY_VERSION, type GuardianView, type PrivacyDetails } from '@skillverse/shared';
import type { Route } from './+types/guardians';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SecurityProof, proofFrom } from '~/features/privacy/forms';
import { Alert } from '~/components/ui/alert';
import { Input, inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
export function meta() {
  return [
    { title: 'Guardian permissions | SkillVerse' },
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'same-origin' },
  ];
}
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const permissions = await api<GuardianView[]>(request, '/api/v1/me/guardians'),
    privacy = await api<PrivacyDetails>(request, '/api/v1/me/privacy');
  if (!permissions.ok)
    throw new Response(permissions.error.message, { status: permissions.status });
  const url = new URL(request.url);
  return {
    permissions: permissions.data,
    privacy: privacy.ok ? privacy.data : null,
    requestId: url.searchParams.get('request'),
    state: url.searchParams.get('state'),
  };
}
export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData(),
    intent = String(form.get('intent')),
    id = String(form.get('id') || ''),
    version = Number(form.get('version')),
    proof = proofFrom(form);
  let path: string, body: unknown;
  if (intent === 'request') {
    path = '/me/guardians';
    body = {
      scope: form.get('scope'),
      consentVersion: POLICY_VERSION,
      consent: form.get('consent') === 'on',
    };
  } else if (intent === 'start') {
    path = `/me/guardians/${id}/start`;
    body = {
      ...proof,
      version,
      shareIdentity: form.get('shareIdentity') === 'on',
      guardianDeclaration: form.get('guardianDeclaration') === 'on',
    };
  } else if (intent === 'finish') {
    path = `/me/guardians/${id}/finish`;
    body = { ...proof, version, state: form.get('state'), legalName: form.get('legalName') };
  } else if (intent === 'invite') {
    path = '/me/guardians/invite';
    body = {
      ...proof,
      requestId: id,
      version,
      childEmail: form.get('childEmail'),
      childBirthDate: form.get('childBirthDate'),
    };
  } else if (intent === 'withdraw') {
    path = `/me/guardians/${id}/withdraw`;
    body = { ...proof, version, confirmation: form.get('confirmation') };
  } else return { error: 'Unknown action.' };
  const res = await api<{ url?: string; code?: string; expiresAt?: string }>(
    request,
    `/api/v1${path}`,
    { method: 'POST', body },
  );
  if (!res.ok) return { error: res.error.message };
  if (intent === 'start' && res.data.url) return redirect(res.data.url);
  return {
    message:
      intent === 'invite'
        ? 'Share this code privately with the child. It is displayed only once.'
        : 'Saved.',
    code: res.data.code,
    expiresAt: res.data.expiresAt,
  };
}
export default function Guardians({ loaderData, actionData }: Route.ComponentProps) {
  const { permissions, privacy, requestId, state } = loaderData;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Guardian permissions</h2>
      <p className="text-sm text-fg-muted">
        A guardian aged 18+ verifies their own adult identity with Setu DigiLocker before providing
        child details. Permission covers learning from age 10; teaching permission additionally
        covers a public instructor alias and licensed course publication from age 16. DigiLocker
        verifies identity and age; it does not prove your relationship to a child. You must
        truthfully declare parental or legal guardianship. No identity documents, Aadhaar number,
        photo or address are stored by SkillVerse.
      </p>
      {actionData?.error && <Alert tone="danger">{actionData.error}</Alert>}
      {actionData?.message && <Alert>{actionData.message}</Alert>}
      {actionData?.code && (
        <div className="rounded-md border border-border p-4 break-all">
          <p className="font-mono">{actionData.code}</p>
          <p className="text-sm">
            Expires {actionData.expiresAt}. One use; bound to the exact child email and birth date.
          </p>
        </div>
      )}
      {!privacy?.canLearn || privacy.isMinor ? (
        <Alert>
          Confirm a verified adult account and current agreements in Privacy settings first.
        </Alert>
      ) : (
        <Form
          method="post"
          className="surface-panel rounded-xl border border-border bg-surface space-y-4 p-6"
        >
          <input type="hidden" name="intent" value="request" />
          <label className="block text-sm space-y-2">
            <span>Permission scope</span>
            <select name="scope" className={inputClass}>
              <option value="learning">Learning (10–17)</option>
              <option value="teaching">Learning and teaching (16–17)</option>
            </select>
          </label>
          <label className="flex gap-3 text-sm">
            <input name="consent" type="checkbox" required />I consent to the selected child account
            activities described in the Privacy Notice, Terms and, for teaching, Instructor Terms.
          </label>
          <SubmitButton>Create verification request</SubmitButton>
        </Form>
      )}
      {permissions.map((item) => (
        <section
          className="surface-panel rounded-xl border border-border bg-surface space-y-4 p-6"
          key={item.id}
        >
          <h3 className="font-semibold">
            {item.scope} · {item.status}
          </h3>
          <p className="text-xs break-all text-fg-muted">Request {item.id}</p>
          {item.reviewNotes && <p className="text-sm whitespace-pre-wrap">{item.reviewNotes}</p>}
          {item.status === 'pending' && (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="version" value={item.version} />
              <SecurityProof />
              {requestId === item.id && state ? (
                <>
                  <input type="hidden" name="intent" value="finish" />
                  <input type="hidden" name="state" value={state} />
                  <label className="block space-y-2 text-sm">
                    <span>Your legal name exactly as on the shared identity</span>
                    <Input name="legalName" autoComplete="name" required />
                  </label>
                  <SubmitButton>Confirm DigiLocker verification</SubmitButton>
                </>
              ) : (
                <>
                  <input type="hidden" name="intent" value="start" />
                  <label className="flex gap-3 text-sm">
                    <input name="shareIdentity" type="checkbox" required />I consent to Setu
                    DigiLocker sharing my identity to verify my name and private birth date. The
                    provider handles the document; SkillVerse retains a receipt.
                  </label>
                  <label className="flex gap-3 text-sm">
                    <input name="guardianDeclaration" type="checkbox" required />I am a parent or
                    legal guardian and will provide codes only for children in my care.
                  </label>
                  <SubmitButton>Verify with DigiLocker</SubmitButton>
                </>
              )}
            </Form>
          )}
          {item.status === 'approved' && (
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="invite" />
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="version" value={item.version} />
              <label className="block space-y-2 text-sm">
                <span>Child email</span>
                <Input name="childEmail" type="email" required />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Child private date of birth</span>
                <Input name="childBirthDate" type="date" required />
              </label>
              <SecurityProof />
              <SubmitButton>Create child permission code</SubmitButton>
            </Form>
          )}
          {['pending', 'approved'].includes(item.status) && (
            <details className="text-sm">
              <summary className="cursor-pointer">Withdraw permission</summary>
              <Form method="post" className="mt-4 space-y-4">
                <p>
                  This disables unused codes and signs linked children under 18 out immediately.
                  Their data stays private until a separate verified deletion request.
                </p>
                <input type="hidden" name="intent" value="withdraw" />
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="version" value={item.version} />
                <SecurityProof />
                <label className="block space-y-2">
                  <span>Type WITHDRAW</span>
                  <Input name="confirmation" required />
                </label>
                <SubmitButton>Withdraw permission</SubmitButton>
              </Form>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
