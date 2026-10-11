/** Admin-only account search with bounded pagination and native GET filters. */
import { data, Form, Link } from 'react-router';
import { adminUserQuerySchema, type AdminUserList } from '@skillverse/shared';
import type { Route } from './+types/users';
import { PageHeading } from '~/components/layout/page-heading';
import { Badge } from '~/components/ui/badge';
import { DiscussionPages } from '~/components/ui/discussion';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { requireAccountAdmin } from '~/features/admin/require-admin.server';
import { staffGet } from '~/features/admin/staff-api.server';

export async function loader({ request }: Route.LoaderArgs) {
  await requireAccountAdmin(request);
  const search = new URL(request.url).searchParams;
  const parsed = adminUserQuerySchema.safeParse({
    q: search.get('q') ?? '',
    status: search.get('status') ?? 'all',
    page: search.get('page') ?? 1,
  });
  if (!parsed.success) throw data('Invalid account filters.', { status: 400 });
  const query = new URLSearchParams({
    q: parsed.data.q,
    status: parsed.data.status,
    page: String(parsed.data.page),
  });
  return {
    accounts: await staffGet<AdminUserList>(request, `/api/v1/admin/users?${query}`),
    filters: parsed.data,
  };
}
export default function Users({ loaderData: { accounts, filters } }: Route.ComponentProps) {
  return (
    <>
      <PageHeading
        title="Accounts"
        description="Find a learner or instructor, review account access and record a decision."
      />
      <Form
        method="get"
        className="my-7 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
        key={`${filters.q}:${filters.status}`}
      >
        <Field name="q" label="Search accounts" hint="Name, username or email">
          {(p) => (
            <input
              {...p}
              type="search"
              className={inputClass}
              defaultValue={filters.q}
              maxLength={100}
            />
          )}
        </Field>
        <Field name="status" label="Account status">
          {(p) => (
            <select {...p} className={inputClass} defaultValue={filters.status}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
          )}
        </Field>
        <SubmitButton variant="secondary" pendingText="Searching…">
          Search
        </SubmitButton>
      </Form>
      <p className="mb-4 text-sm text-fg-muted">
        {accounts.total} matching {accounts.total === 1 ? 'account' : 'accounts'}
      </p>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {!accounts.items.length && (
          <p className="p-6 text-fg-muted">
            No accounts match these filters. Try another search or status.
          </p>
        )}
        {accounts.items.map((user) => (
          <article key={user.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                <Link
                  to={`/admin/users/${user.id}`}
                  className="font-semibold text-brand hover:underline"
                >
                  {user.displayName}
                </Link>
                <p className="mt-1 text-sm text-fg-muted">@{user.username}</p>
                <p className="mt-2 text-sm">{user.email}</p>
              </div>
              <Badge
                tone={
                  user.status === 'suspended'
                    ? 'danger'
                    : user.status === 'active'
                      ? 'accent'
                      : 'neutral'
                }
              >
                {user.status}
              </Badge>
            </div>
            <p className="mt-3 text-xs leading-5 text-fg-muted">
              {user.roles.join(', ')} · {user.emailVerified ? 'Email verified' : 'Email unverified'}{' '}
              · Joined <LocalTime iso={user.createdAt} />
            </p>
          </article>
        ))}
      </div>
      <DiscussionPages
        page={accounts.page}
        totalPages={accounts.totalPages}
        query={new URLSearchParams({ q: filters.q, status: filters.status }).toString()}
      />
    </>
  );
}
