import { Form, Link } from 'react-router';
import { operationalQuerySchema, type OperationalSummary } from '@skillverse/shared';
import type { Route } from './+types/operations';
import { PageHeading } from '~/components/layout/page-heading';
import { LocalTime } from '~/components/ui/local-time';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { requireAccountAdmin } from '~/features/admin/require-admin.server';
import { staffGet } from '~/features/admin/staff-api.server';
export async function loader({ request }: Route.LoaderArgs) {
  await requireAccountAdmin(request);
  const query = operationalQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) throw new Response('Invalid observation window', { status: 400 });
  return staffGet<OperationalSummary>(
    request,
    `/api/v1/admin/operations?hours=${query.data.hours}`,
  );
}
export default function Operations({ loaderData: data }: Route.ComponentProps) {
  const facts = [
    ['Requests', data.requests],
    ['Server errors', data.errors],
    ['Rate limited', data.rateLimited],
    ['Slow requests', data.slowRequests],
    ['Average duration', `${data.averageDurationMs} ms`],
  ];
  return (
    <div className="max-w-4xl [overflow-wrap:anywhere]">
      <PageHeading
        title="Operations"
        description="Aggregate API observations in five-minute buckets. These counts exclude health checks and may arrive after requests finish."
      />
      {!data.telemetryEnabled && (
        <p className="mt-5 rounded-xl border border-border p-4 text-fg-muted">
          Operational telemetry is disabled in this environment. Existing observations may still
          appear.
        </p>
      )}
      <Form method="get" className="mt-6 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          Window
          <select name="hours" className={`${inputClass} mt-2`} defaultValue={data.hours}>
            {[1, 6, 12, 24].map((hours) => (
              <option key={hours} value={hours}>
                Last {hours} hours
              </option>
            ))}
          </select>
        </label>
        <SubmitButton>Refresh</SubmitButton>
        <Link className="text-brand underline" to="/admin/controls">
          Alert controls
        </Link>
      </Form>
      <p className="mt-3 text-xs text-fg-muted">
        Measured <LocalTime iso={data.measuredAt} />
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-5">
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-8 text-xl font-semibold">Request groups</h2>
      <ul className="mt-4 space-y-2">
        {data.scopes.map((scope) => (
          <li key={scope.scope} className="rounded-xl border border-border p-4">
            {scope.scope}: {scope.requests} requests · {scope.errors} server errors
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-xl font-semibold">Recent alerts</h2>
      <p className="mt-2 text-sm text-fg-muted">
        Up to 30 alerts. Delivery makes at most three attempts; receivers should deduplicate by
        alert ID.
      </p>
      {!data.alerts.length && <p className="mt-4 text-fg-muted">No alerts in this window.</p>}
      <ol className="mt-4 divide-y divide-border rounded-xl border border-border">
        {data.alerts.map((alert) => (
          <li key={alert.id} className="space-y-2 p-5">
            <h3 className="font-semibold">
              {alert.kind.replaceAll('_', ' ')}: {alert.count}
            </h3>
            <p className="text-sm text-fg-muted">
              <LocalTime iso={alert.bucket} /> · {alert.state.replaceAll('_', ' ')} ·{' '}
              {alert.attempts} attempts
            </p>
            <p className="text-xs text-fg-subtle">Alert {alert.id}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
