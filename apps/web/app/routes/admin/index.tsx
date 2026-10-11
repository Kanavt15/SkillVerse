/** Current operational totals and review queues, read from one API database snapshot. */
import { BookOpen, ClipboardList, Flag } from 'lucide-react';
import { Link } from 'react-router';
import type { AdminOverview } from '@skillverse/shared';
import type { Route } from './+types/index';
import { PageHeading } from '~/components/layout/page-heading';
import { Card } from '~/components/ui/card';
import { LocalTime } from '~/components/ui/local-time';
import { staffGet } from '~/features/admin/staff-api.server';

export async function loader({ request }: Route.LoaderArgs) {
  return staffGet<AdminOverview>(request, '/api/v1/admin/overview');
}
export default function AdminHome({ loaderData: overview }: Route.ComponentProps) {
  const queues = [
    {
      to: '/admin/applications',
      icon: ClipboardList,
      label: 'Instructor applications',
      ...overview.queues.applications,
    },
    { to: '/admin/courses', icon: BookOpen, label: 'Course reviews', ...overview.queues.courses },
    { to: '/admin/reports', icon: Flag, label: 'Content reports', ...overview.queues.reports },
  ];
  const metrics = [
    ['Active accounts', overview.users.active],
    ['Suspended accounts', overview.users.suspended],
    ['Active instructors', overview.activeInstructors],
    ['Published courses', overview.publishedCourses],
    ['Course enrollments', overview.enrollments],
    ['Completed enrollments', overview.completedEnrollments],
  ] as const;
  return (
    <>
      <PageHeading
        title="Overview"
        description="Review pending work and see the current learning community."
      />
      <section aria-labelledby="pending-work" className="mt-7">
        <h2 id="pending-work" className="text-xl font-semibold">
          Waiting for a decision
        </h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {queues.map(({ to, icon: Icon, label, count, oldestAt }) => (
            <Link key={to} to={to} className="block rounded-xl hover:text-brand">
              <Card className="h-full p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{label}</h3>
                  <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                </div>
                <p className="mt-5 text-4xl font-bold tabular-nums">
                  {count}
                  <span className="ml-2 text-sm font-normal text-fg-muted">pending</span>
                </p>
                <p className="mt-3 text-xs leading-5 text-fg-muted">
                  {oldestAt ? (
                    <>
                      Oldest received <LocalTime iso={oldestAt} />
                    </>
                  ) : (
                    'Queue is clear.'
                  )}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="platform-totals" className="mt-9">
        <h2 id="platform-totals" className="text-xl font-semibold">
          Platform totals
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-7 rounded-xl border border-border bg-surface p-5 lg:grid-cols-3 sm:p-7">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-fg-muted">{label}</dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-5 text-fg-muted">
          Current database counts as of <LocalTime iso={overview.measuredAt} />. Enrollments count
          course registrations; completed enrollments count finished courses.
        </p>
      </section>
    </>
  );
}
