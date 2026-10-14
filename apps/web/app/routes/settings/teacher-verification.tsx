import { Form, Link, redirect } from 'react-router';
import { INSTRUCTOR_POLICY_VERSION } from '@skillverse/shared';
import type { Route } from './+types/teacher-verification';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SecurityProof, proofFrom } from '~/features/privacy/forms';
import { Alert } from '~/components/ui/alert';
import { Input } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
export function meta() {
  return [
    { title: 'Teacher verification | SkillVerse' },
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'same-origin' },
  ];
}
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request),
    result = await api<{ verified: boolean; validUntil: string | null }>(
      request,
      '/api/v1/me/privacy/teacher',
    );
  if (!result.ok) throw new Response(result.error.message, { status: result.status });
  return { user, identity: result.data, state: new URL(request.url).searchParams.get('state') };
}
export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData(),
    intent = form.get('intent');
  let path: string, body: unknown;
  if (intent === 'terms') {
    path = 'instructor-terms';
    body = { version: INSTRUCTOR_POLICY_VERSION, accepted: form.get('accepted') === 'on' };
  } else if (intent === 'start') {
    path = 'teacher/start';
    body = {
      ...proofFrom(form),
      shareIdentity: form.get('shareIdentity') === 'on',
      guardianDeclaration: form.get('teachingDeclaration') === 'on',
    };
  } else if (intent === 'finish') {
    path = 'teacher/finish';
    body = { ...proofFrom(form), state: form.get('state'), legalName: form.get('legalName') };
  } else return { error: 'Unknown action.' };
  const result = await api<{ url?: string }>(request, `/api/v1/me/privacy/${path}`, {
    method: 'POST',
    body,
  });
  if (!result.ok) return { error: result.error.message };
  if (result.data.url) return redirect(result.data.url);
  return { message: 'Saved.' };
}
export default function TeacherVerification({ loaderData, actionData }: Route.ComponentProps) {
  const { user, identity, state } = loaderData;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Teacher verification</h2>
      <p className="text-sm text-fg-muted">
        Teachers must be at least 16, accept the Instructor Terms and verify identity through Setu
        DigiLocker. Teachers aged 16–17 also need a verified guardian's teaching permission.
        Identity verification lasts 180 days. Staff separately review your teaching application and
        each course. Your legal name and birth date stay private; use an instructor display alias
        publicly.
      </p>
      {actionData?.error && <Alert tone="danger">{actionData.error}</Alert>}
      {actionData?.message && <Alert>{actionData.message}</Alert>}
      <section className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4">
        <h3 className="font-semibold">1. Teaching permission and terms</h3>
        <Link to="/settings/privacy" className="text-sm underline">
          Confirm eligibility or guardian teaching permission
        </Link>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="terms" />
          <label className="flex gap-3 text-sm">
            <input name="accepted" type="checkbox" required />I accept the{' '}
            <Link to="/instructor-terms" className="underline">
              Instructor Terms
            </Link>{' '}
            for publishing free courses.
          </label>
          <SubmitButton>Accept Instructor Terms</SubmitButton>
        </Form>
      </section>
      <section className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4">
        <h3 className="font-semibold">2. Verify your identity</h3>
        {identity.verified ? (
          <Alert>
            Identity verified until {identity.validUntil}.{' '}
            <Link to="/teach" className="underline">
              Continue to your teaching application
            </Link>
            .
          </Alert>
        ) : !user.eligibility.canTeach ? (
          <Alert>
            Complete step 1 and the required guardian permission before starting identity
            verification.
          </Alert>
        ) : (
          <Form method="post" className="space-y-4">
            <SecurityProof />
            {state ? (
              <>
                <input type="hidden" name="intent" value="finish" />
                <input type="hidden" name="state" value={state} />
                <label className="block space-y-2 text-sm">
                  <span>Legal name exactly as on your shared identity</span>
                  <Input name="legalName" required autoComplete="name" />
                </label>
                <SubmitButton>Confirm teacher verification</SubmitButton>
              </>
            ) : (
              <>
                <input type="hidden" name="intent" value="start" />
                <label className="flex gap-3 text-sm">
                  <input name="shareIdentity" type="checkbox" required />I consent to Setu
                  DigiLocker sharing my identity to verify my age and legal name. SkillVerse retains
                  a verification receipt and does not store my Aadhaar number, document, address or
                  photo.
                </label>
                <label className="flex gap-3 text-sm">
                  <input name="teachingDeclaration" type="checkbox" required />
                  This is my own identity. I have the required permission to teach.
                </label>
                <SubmitButton>Verify teacher identity with DigiLocker</SubmitButton>
              </>
            )}
          </Form>
        )}
      </section>
    </div>
  );
}
