import { Form, Link } from 'react-router';
import type { SupportView } from '@skillverse/shared';
import type { Route } from './+types/contact';
import { api, apiGet } from '~/lib/api.server';
import { getUser } from '~/lib/auth.server';
import { Turnstile, turnstileToken } from '~/components/auth/turnstile';
import { PageHeading } from '~/components/layout/page-heading';
import { Alert } from '~/components/ui/alert';
import { Input, inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
export function meta() {
  return [
    { title: 'Private Contact and grievances | SkillVerse' },
    {
      name: 'description',
      content: 'Send a private account, privacy, guardian or content request to SkillVerse.',
    },
  ];
}
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request),
    meta = await apiGet<{ launchReady: boolean }>('/api/v1/meta');
  const result = user ? await api<SupportView[]>(request, '/api/v1/me/support') : null;
  return {
    launchReady: meta.launchReady,
    email: user?.email ?? null,
    tickets: result?.ok ? result.data : [],
  };
}
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const result = await api<{ message: string }>(request, '/api/v1/support', {
    method: 'POST',
    body: {
      email: String(form.get('email') || ''),
      subject: String(form.get('subject') || ''),
      message: String(form.get('message') || ''),
      category: String(form.get('category') || 'general'),
      website: String(form.get('website') || ''),
      acceptPrivacy: form.get('acceptPrivacy') === 'on',
      adultOrGuardian: form.get('adultOrGuardian') === 'on',
    },
    turnstileToken: turnstileToken(form),
  });
  return result.ok ? { message: result.data.message } : { error: result.error.message };
}
export default function Contact({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="page-shell max-w-3xl">
      <PageHeading
        title="Private Contact"
        description="Account help, privacy requests, child safety and grievances."
      />
      <p className="mb-6 text-sm text-fg-muted">
        Describe the issue and include relevant course or request references. Do not send passwords,
        security codes, Aadhaar numbers or identity documents. We aim to acknowledge verified
        requests within three working days; complex requests may take longer. Contact is not an
        emergency service. Signed-out visitors under 18 should ask a parent or guardian to submit.
      </p>
      {actionData?.error && <Alert tone="danger">{actionData.error}</Alert>}
      {actionData?.message && <Alert>{actionData.message}</Alert>}
      {!loaderData.launchReady ? (
        <Alert>Private Contact will open when account services launch. Please check back.</Alert>
      ) : (
        <Form method="post" className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm">
            <span>Email</span>
            <Input
              name="email"
              type="email"
              required
              defaultValue={loaderData.email ?? ''}
              readOnly={Boolean(loaderData.email)}
              autoComplete="email"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Request category</span>
            <select name="category" className={inputClass}>
              <option value="general">General help</option>
              <option value="account">Account access</option>
              <option value="privacy">Privacy, correction, deletion or grievance</option>
              <option value="guardian">Guardian permission or child safety</option>
              <option value="content">Content or conduct concern</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span>Subject</span>
            <Input name="subject" required minLength={5} maxLength={120} />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Private message</span>
            <textarea
              name="message"
              required
              minLength={20}
              maxLength={4000}
              rows={7}
              className={inputClass}
            />
          </label>
          <div hidden aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="acceptPrivacy" required />I have read the{' '}
            <Link to="/privacy" className="underline">
              Privacy Notice
            </Link>{' '}
            and consent to using this information to respond to this request.
          </label>
          {!loaderData.email && (
            <label className="flex gap-3 text-sm">
              <input type="checkbox" name="adultOrGuardian" required />I am 18 or older, or I am
              submitting as a parent or legal guardian.
            </label>
          )}
          <Turnstile action="contact" resetKey={actionData} />
          <SubmitButton>Send private request</SubmitButton>
        </Form>
      )}
      {loaderData.tickets.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold">Your private requests</h2>
          {loaderData.tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="surface-panel rounded-xl border border-border bg-surface p-5 space-y-3"
            >
              <h3 className="font-semibold">
                {ticket.subject} · {ticket.status}
              </h3>
              <p className="text-xs break-all">Reference {ticket.id}</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
              {ticket.replies.map((reply) => (
                <div key={reply.id} className="border-t border-border pt-3">
                  <p className="text-xs text-fg-muted">SkillVerse reply · {reply.createdAt}</p>
                  <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                </div>
              ))}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
