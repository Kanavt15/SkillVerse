import { Form, Link } from 'react-router';
import type { GuardianView } from '@skillverse/shared';
import type { Route } from './+types/guardians';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { SecurityProof, proofFrom } from '~/features/privacy/forms';
import { Alert } from '~/components/ui/alert';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request),
    page = Math.max(1, Math.min(1000, Number(new URL(request.url).searchParams.get('page')) || 1)),
    result = await api<GuardianView[]>(request, `/api/v1/admin/guardians?page=${page}`);
  if (!result.ok) throw new Response(result.error.message, { status: result.status });
  return {
    requests: result.data,
    page,
    reviewerId: user.id,
    canReject: user.roles.includes('super_admin'),
  };
}
export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData(),
    id = String(form.get('id'));
  if (!/^[a-f0-9-]{36}$/.test(id)) return { error: 'Invalid request.' };
  const result = await api(request, `/api/v1/admin/guardians/${id}/decision`, {
    method: 'POST',
    body: {
      ...proofFrom(form),
      version: Number(form.get('version')),
      decision: 'reject',
      notes: String(form.get('notes') || ''),
    },
  });
  return result.ok
    ? { message: 'Request rejected with an audited decision.' }
    : { error: result.error.message };
}
export default function Guardians({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Private guardian verification</h1>
      <p className="text-sm text-fg-muted">
        Provider verification is required for approval. Staff cannot approve a typed reference or
        uploaded document. An independent super administrator can reject a pending request with
        fresh password and MFA proof. Child email and birth date are not displayed in this queue.
      </p>
      {actionData?.error && <Alert tone="danger">{actionData.error}</Alert>}
      {actionData?.message && <Alert>{actionData.message}</Alert>}
      {loaderData.requests.map((item) => (
        <section
          className="surface-panel rounded-xl border border-border bg-surface p-6 space-y-4"
          key={item.id}
        >
          <h2 className="font-semibold">
            {item.guardianName} · {item.scope} · {item.status}
          </h2>
          <p className="text-sm break-all">
            {item.guardianEmail} · request {item.id}
          </p>
          {item.identityMethod && (
            <p className="text-xs">
              Provider: {item.identityMethod} · receipt {item.verificationReference}
            </p>
          )}
          {item.reviewNotes && <p className="text-sm whitespace-pre-wrap">{item.reviewNotes}</p>}
          {item.status === 'pending' &&
            loaderData.canReject &&
            item.guardianUserId !== loaderData.reviewerId && (
              <Form method="post" className="space-y-4">
                <input name="id" type="hidden" value={item.id} />
                <input name="version" type="hidden" value={item.version} />
                <label className="block space-y-2 text-sm">
                  <span>Reason shared privately with the guardian</span>
                  <textarea
                    name="notes"
                    className={inputClass}
                    rows={4}
                    minLength={10}
                    maxLength={2000}
                    required
                  />
                </label>
                <SecurityProof />
                <SubmitButton>Reject pending request</SubmitButton>
              </Form>
            )}
        </section>
      ))}
      <nav aria-label="Guardian queue pages" className="flex gap-4 text-sm">
        {loaderData.page > 1 && <Link to={`?page=${loaderData.page - 1}`}>Previous</Link>}
        {loaderData.requests.length === 20 && <Link to={`?page=${loaderData.page + 1}`}>Next</Link>}
      </nav>
    </div>
  );
}
