import { Form, Link, redirect, useRevalidator } from 'react-router';
import { useEffect } from 'react';
import { POLICY_VERSION, type PrivacyDetails, type ExportView } from '@skillverse/shared';
import type { Route } from './+types/privacy';
import { api, relayCookies } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { AgreementFields, SecurityProof, proofFrom } from '~/features/privacy/forms';
import { Alert } from '~/components/ui/alert';
import { SubmitButton } from '~/components/ui/submit-button';
import { Input } from '~/components/ui/input';
export function meta() {
  return [
    { title: 'Privacy and account rights | SkillVerse' },
    { name: 'robots', content: 'noindex' },
  ];
}
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const details = await api<PrivacyDetails>(request, '/api/v1/me/privacy'),
    exports = await api<ExportView[]>(request, '/api/v1/me/privacy/exports');
  if (!details.ok) throw new Response(details.error.message, { status: details.status });
  return { details: details.data, exports: exports.ok ? exports.data : [] };
}
export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData(),
    intent = String(form.get('intent')),
    proof = proofFrom(form);
  let path: string, body: unknown;
  if (intent === 'eligibility') {
    path = 'eligibility';
    body = {
      birthDate: String(form.get('birthDate')),
      guardianCode: String(form.get('guardianCode') || '') || undefined,
      termsVersion: POLICY_VERSION,
      privacyVersion: POLICY_VERSION,
      acceptTerms: form.get('acceptTerms') === 'on',
      acceptPrivacy: form.get('acceptPrivacy') === 'on',
    };
  } else if (intent === 'media') {
    path = 'media';
    body = { enabled: form.get('enabled') === 'on', version: POLICY_VERSION };
  } else if (intent === 'export') {
    path = 'exports';
    body = proof;
  } else if (intent === 'unlock') {
    path = 'unlock';
    body = proof;
  } else if (intent === 'delete') {
    path = 'delete';
    body = {
      ...proof,
      confirmation: String(form.get('confirmation')),
      version: Number(form.get('version')),
    };
  } else return { error: 'Unknown action.' };
  const res = await api(request, `/api/v1/me/privacy/${path}`, { method: 'POST', body });
  if (!res.ok) return { error: res.error.message };
  if (intent === 'delete')
    return redirect('/?account=deleted', { headers: relayCookies(res.headers) });
  return {
    message:
      intent === 'export'
        ? 'Your export is queued. It will expire 24 hours after this request.'
        : 'Saved.',
  };
}
export default function Privacy({ loaderData, actionData }: Route.ComponentProps) {
  const { details, exports } = loaderData,
    revalidator = useRevalidator(),
    pending = exports.some((job) => job.state === 'queued' || job.state === 'building');
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && revalidator.state === 'idle')
        void revalidator.revalidate();
    }, 10000);
    return () => clearInterval(timer);
  }, [pending, revalidator]);
  return (
    <div className="space-y-8">
      {actionData?.error && <Alert tone="danger">{actionData.error}</Alert>}
      {actionData?.message && <Alert>{actionData.message}</Alert>}
      <section className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xl font-semibold">Eligibility and agreements</h2>
        <p className="text-sm text-fg-muted">
          Learning: {details.canLearn ? 'eligible' : 'confirmation required'}. Teaching:{' '}
          {details.canTeach ? 'eligible' : 'permission and Instructor Terms required'}. Current
          policy: {POLICY_VERSION}. Your private birth date:{' '}
          {details.birthDate ?? 'not yet confirmed'}.
        </p>
        {!details.canLearn && (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="eligibility" />
            <AgreementFields values={{ birthDate: details.birthDate ?? '' }} />
            <SubmitButton>Confirm eligibility</SubmitButton>
          </Form>
        )}
        <p className="text-sm">
          Birth dates cannot be edited here. Use{' '}
          <Link to="/contact" className="underline">
            private Contact
          </Link>{' '}
          to request a verified correction.{' '}
          <Link to="/settings/guardians" className="underline">
            Manage guardian permissions
          </Link>
          .
        </p>
      </section>
      <section className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xl font-semibold">External video privacy</h2>
        <p className="text-sm text-fg-muted">
          YouTube and Vimeo receive your IP and browser details when an embed loads. Embeds are off
          by default and unavailable for accounts under 18. External links remain available for
          guardian-guided viewing. Withdrawing consent unloads the player when the page refreshes.
        </p>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="media" />
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={details.externalMedia}
              disabled={details.isMinor || !details.canLearn}
            />
            Allow external video embeds on my adult account
          </label>
          <SubmitButton>Save video preference</SubmitButton>
        </Form>
      </section>
      <section className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xl font-semibold">Download your data</h2>
        <p className="text-sm text-fg-muted">
          A private NDJSON copy includes your account, learning records, notes, authored material
          and support history. Records are captured while the job runs; changes during that time may
          appear at different points. Exports are capped at 20 MB and expire after 24 hours.
          Download access lasts 10 minutes after a fresh security check.
        </p>
        <Form method="post" className="space-y-4">
          <SecurityProof />
          <div className="flex flex-wrap gap-3">
            <SubmitButton name="intent" value="export">
              Request export
            </SubmitButton>
            <SubmitButton name="intent" value="unlock">
              Unlock existing download
            </SubmitButton>
          </div>
        </Form>
        <ul className="space-y-3">
          {exports.map((job) => (
            <li key={job.id} className="rounded-md border border-border p-3 text-sm">
              <p>
                {job.state} · {job.bytes} bytes · expires {new Date(job.expiresAt).toLocaleString()}
              </p>
              {job.error && <p>{job.error}</p>}
              {job.canDownload && (
                <a href={`/settings/export/${job.id}`} className="underline">
                  Download private copy
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xl font-semibold">Delete this account</h2>
        <p className="text-sm text-fg-muted">
          Deletion is immediate and irreversible. It signs out every device, removes your learning
          records and certificates, erases your authored Q&amp;A text and withdraws your courses
          from discovery. Existing learners keep course access and their own certificates. Limited
          course and security records remain with an anonymized identity. Deleting a guardian
          account withdraws linked child permissions and signs those children out.
        </p>
        {details.canDelete ? (
          <Form method="post" className="space-y-4">
            <input type="hidden" name="version" value={details.version} />
            <input type="hidden" name="intent" value="delete" />
            <SecurityProof />
            <label className="block space-y-2 text-sm">
              <span>Type DELETE to confirm</span>
              <Input name="confirmation" required autoComplete="off" />
            </label>
            <SubmitButton>Delete account permanently</SubmitButton>
          </Form>
        ) : (
          <Alert>
            Staff accounts require an independent super administrator to revoke every staff role
            first.
          </Alert>
        )}
        <Link to="/privacy" className="text-sm underline">
          Read the full Privacy Notice and retention rules
        </Link>
      </section>
    </div>
  );
}
