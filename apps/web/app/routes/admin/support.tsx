import { Form, Link } from 'react-router';
import type { SupportView } from '@skillverse/shared';
import type { Route } from './+types/support';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { Alert } from '~/components/ui/alert';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const page = Math.max(
      1,
      Math.min(1000, Number(new URL(request.url).searchParams.get('page')) || 1),
    ),
    result = await api<SupportView[]>(request, `/api/v1/admin/support?page=${page}`);
  if (!result.ok) throw new Response(result.error.message, { status: result.status });
  return { tickets: result.data, page };
}
export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData(),
    id = String(form.get('id'));
  if (!/^[a-f0-9-]{36}$/.test(id)) return { error: 'Invalid request.' };
  const result = await api(request, `/api/v1/admin/support/${id}/reply`, {
    method: 'POST',
    body: {
      version: Number(form.get('version')),
      reply: String(form.get('reply') || ''),
      resolve: form.get('resolve') === 'on',
    },
  });
  return result.ok
    ? { message: 'Reply saved. Delivery state is shown below.' }
    : { error: result.error.message };
}
export default function Support({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Private support and grievances</h1>
      <p className="text-sm text-fg-muted">
        Administrators only. Guest email is verified before a ticket appears here. Use the account
        security and provider workflows for identity checks; never ask for passwords, codes or
        document uploads in a reply. Resolved requests are removed after 90 days.
      </p>
      {actionData?.error && <Alert tone="danger">{actionData.error}</Alert>}
      {actionData?.message && <Alert>{actionData.message}</Alert>}
      {loaderData.tickets.map((ticket) => (
        <section
          key={ticket.id}
          className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4"
        >
          <h2 className="font-semibold">
            {ticket.subject} · {ticket.status}
          </h2>
          <p className="text-sm break-all">
            {ticket.email} · {ticket.category} · {ticket.id}
          </p>
          <p className="whitespace-pre-wrap text-sm">{ticket.message}</p>
          {ticket.replies.map((reply) => (
            <div key={reply.id} className="border-t border-border pt-3">
              <p className="text-xs text-fg-muted">
                Delivery: {reply.deliveryState} · attempts {reply.attempts}
              </p>
              <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
            </div>
          ))}
          <Form method="post" className="space-y-3">
            <input name="id" type="hidden" value={ticket.id} />
            <input name="version" type="hidden" value={ticket.version} />
            <label className="block space-y-2 text-sm">
              <span>Private reply to {ticket.email}</span>
              <textarea
                name="reply"
                className={inputClass}
                rows={5}
                minLength={20}
                maxLength={4000}
                required
              />
            </label>
            <label className="flex gap-3 text-sm">
              <input name="resolve" type="checkbox" />
              Resolve after this reply
            </label>
            <SubmitButton>Save and send reply</SubmitButton>
          </Form>
        </section>
      ))}
      {!loaderData.tickets.length && <p>No verified requests on this page.</p>}
      <nav aria-label="Support pages" className="flex gap-5 text-sm">
        {loaderData.page > 1 && <Link to={`?page=${loaderData.page - 1}`}>Previous</Link>}
        {loaderData.tickets.length === 20 && <Link to={`?page=${loaderData.page + 1}`}>Next</Link>}
      </nav>
    </div>
  );
}
