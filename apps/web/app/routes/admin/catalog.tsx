/** Staff catalog: real course states, literal search, bounded pagination and native GET forms. */
import { data, Form, Link } from 'react-router';
import { adminCourseQuerySchema, COURSE_STATUSES, type AdminCourseList } from '@skillverse/shared';
import type { Route } from './+types/catalog';
import { PageHeading } from '~/components/layout/page-heading';
import { DiscussionPages } from '~/components/ui/discussion';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { staffGet } from '~/features/admin/staff-api.server';
import { CourseStatusBadge } from '~/features/teaching/course-status';

export function meta() {
  return [{ title: 'Course catalog | Staff | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}
export async function loader({ request }: Route.LoaderArgs) {
  const search = new URL(request.url).searchParams;
  const parsed = adminCourseQuerySchema.safeParse({
    q: search.get('q') ?? '',
    status: search.get('status') ?? 'all',
    page: search.get('page') ?? 1,
  });
  if (!parsed.success) throw data('Invalid course filters.', { status: 400 });
  const query = new URLSearchParams({
    q: parsed.data.q,
    status: parsed.data.status,
    page: String(parsed.data.page),
  });
  return {
    catalog: await staffGet<AdminCourseList>(request, `/api/v1/admin/courses?${query}`),
    filters: parsed.data,
  };
}

export default function StaffCatalog({ loaderData: { catalog, filters } }: Route.ComponentProps) {
  return (
    <>
      <PageHeading
        title="Course catalog"
        description="Find any course, inspect its content and history, or archive a published course after review."
      />
      <Form
        method="get"
        className="my-7 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
        key={`${filters.q}:${filters.status}`}
      >
        <Field
          name="q"
          label="Search courses"
          hint="Title, slug, instructor name or username. Search is literal."
        >
          {(props) => (
            <input
              {...props}
              type="search"
              defaultValue={filters.q}
              maxLength={100}
              className={inputClass}
            />
          )}
        </Field>
        <Field name="status" label="Course status">
          {(props) => (
            <select {...props} defaultValue={filters.status} className={inputClass}>
              <option value="all">All statuses</option>
              {COURSE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </select>
          )}
        </Field>
        <SubmitButton variant="secondary" pendingText="Searching…">
          Search
        </SubmitButton>
      </Form>
      <p className="mb-4 text-sm text-fg-muted">
        {catalog.total} matching {catalog.total === 1 ? 'course' : 'courses'}
      </p>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {!catalog.items.length && (
          <p className="p-6 text-fg-muted">
            No courses match these filters. Try another search or status.
          </p>
        )}
        {catalog.items.map((course) => (
          <article key={course.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                <Link
                  to={`/admin/courses/${course.id}`}
                  className="font-semibold text-brand hover:underline"
                >
                  {course.title}
                </Link>
                <p className="mt-1 text-sm text-fg-muted">
                  {course.instructor.displayName} (@{course.instructor.username})
                </p>
                <p className="mt-2 text-xs text-fg-subtle">{course.slug}</p>
              </div>
              <CourseStatusBadge status={course.status} />
            </div>
            <p className="mt-3 text-xs leading-5 text-fg-muted">
              {course.enrollmentCount} enrolled · Updated <LocalTime iso={course.updatedAt} />
            </p>
          </article>
        ))}
      </div>
      <DiscussionPages
        page={catalog.page}
        totalPages={catalog.totalPages}
        query={new URLSearchParams({ q: filters.q, status: filters.status }).toString()}
      />
    </>
  );
}
