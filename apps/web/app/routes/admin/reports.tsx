/** Staff report queue, paginated and filtered by decision status. */
import { data, Form, Link } from 'react-router';
import { reportQuerySchema, REPORT_REASON_LABELS, type ModerationList } from '@skillverse/shared';
import type { Route } from './+types/reports';
import { DiscussionPages } from '~/components/ui/discussion';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { staffGet } from '~/features/admin/staff-api.server';
export async function loader({ request }: Route.LoaderArgs) {
  const search = new URL(request.url).searchParams,
    parsed = reportQuerySchema.safeParse({
      page: search.get('page') ?? 1,
      status: search.get('status') ?? 'open',
    });
  if (!parsed.success) throw data('Invalid queue filters.', { status: 400 });
  const query = new URLSearchParams({ page: String(parsed.data.page), status: parsed.data.status });
  return {
    queue: await staffGet<ModerationList>(request, `/api/v1/admin/reports?${query}`),
    status: parsed.data.status,
  };
}
export default function Reports({ loaderData: { queue, status } }: Route.ComponentProps) {
  return (
    <>
      <h1 className="text-3xl font-bold">Content reports</h1>
      <p className="mt-3 text-fg-muted">
        Review concerns from learners. Decisions and feedback are recorded in the audit log.
      </p>
      <Form method="get" className="my-6 flex items-end gap-3">
        <Field name="status" label="Report status">
          {(p) => (
            <select {...p} className={inputClass} defaultValue={status}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          )}
        </Field>
        <SubmitButton variant="secondary" pendingText="Filtering…">
          Apply
        </SubmitButton>
      </Form>
      <p className="mb-3 text-sm text-fg-muted">{queue.total} reports</p>
      <div className="divide-y divide-border rounded-xl border border-border">
        {!queue.items.length && <p className="p-6 text-fg-muted">No {status} reports.</p>}
        {queue.items.map((r) => (
          <article key={r.id} className="p-5">
            <Link
              className="font-semibold text-brand hover:underline"
              to={`/admin/reports/${r.id}`}
            >
              {REPORT_REASON_LABELS[r.reason]} · {r.targetType}
            </Link>
            <p className="mt-2 text-sm text-fg-muted">
              {r.course.title} · Reported by {r.reporter.displayName} ·{' '}
              <LocalTime iso={r.createdAt} />
            </p>
            <p className="mt-3 line-clamp-2 text-sm">{r.details}</p>
          </article>
        ))}
      </div>
      <DiscussionPages page={queue.page} totalPages={queue.totalPages} query={`status=${status}`} />
    </>
  );
}
