import { Form, Link } from 'react-router';
import { staffAuditQuerySchema, type StaffAudit } from '@skillverse/shared';
import type { Route } from './+types/audit';
import { PageHeading } from '~/components/layout/page-heading';
import { LocalTime } from '~/components/ui/local-time';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { requireAccountAdmin } from '~/features/admin/require-admin.server';
import { staffGet } from '~/features/admin/staff-api.server';
export async function loader({ request }: Route.LoaderArgs) {
  await requireAccountAdmin(request);
  const query = staffAuditQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) throw new Response('Invalid audit filters', { status: 400 });
  const params = new URLSearchParams(
    Object.entries(query.data).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  const result = await staffGet<StaffAudit>(request, `/api/v1/admin/audit?${params}`);
  params.delete('before');
  return {
    ...result,
    filters: query.data,
    nextHref: result.nextCursor
      ? `/admin/audit?${params}&before=${encodeURIComponent(result.nextCursor)}`
      : null,
  };
}
export default function Audit({ loaderData: data }: Route.ComponentProps) {
  return (
    <div className="max-w-4xl [overflow-wrap:anywhere]">
      <PageHeading
        title="Audit trail"
        description="Recorded decisions, newest first. Up to 50 entries per page."
      />
      <Form
        method="get"
        className="mt-6 grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2"
      >
        <label className="text-sm">
          Exact action
          <input
            className={`${inputClass} mt-2`}
            name="action"
            defaultValue={data.filters.action}
            maxLength={80}
            placeholder="admin.role_granted"
          />
        </label>
        <label className="text-sm">
          Exact target ID
          <input
            className={`${inputClass} mt-2`}
            name="targetId"
            defaultValue={data.filters.targetId}
            maxLength={120}
          />
        </label>
        <label className="text-sm">
          Actor account ID
          <input
            className={`${inputClass} mt-2`}
            name="actorId"
            defaultValue={data.filters.actorId}
          />
        </label>
        <div className="flex items-end gap-4">
          <SubmitButton>Filter</SubmitButton>
          <Link className="text-brand underline" to="/admin/audit">
            Clear
          </Link>
        </div>
      </Form>
      <ol className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
        {data.items.map((entry) => (
          <li key={entry.id} className="space-y-2 p-5">
            <h2 className="font-semibold">{entry.action}</h2>
            <p className="text-xs text-fg-muted">
              {entry.actorName ?? 'System or former account'} · <LocalTime iso={entry.createdAt} />
            </p>
            <p className="text-sm text-fg-muted">
              {entry.targetType}: {entry.targetId ?? 'None'}
            </p>
            {entry.summary && <p className="text-sm">{entry.summary}</p>}
            {entry.notes && <p className="whitespace-pre-wrap text-sm">{entry.notes}</p>}
            {entry.requestId && (
              <p className="text-xs text-fg-subtle">Request: {entry.requestId}</p>
            )}
          </li>
        ))}
      </ol>
      {!data.items.length && <p className="mt-6 text-fg-muted">No matching decisions.</p>}
      {data.nextHref && (
        <Link className="mt-6 inline-block text-brand underline" to={data.nextHref}>
          Older decisions
        </Link>
      )}
    </div>
  );
}
