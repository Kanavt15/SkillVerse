/** /admin: what's waiting for staff. */
import { ClipboardList, GraduationCap } from 'lucide-react';
import { Link } from 'react-router';
import type { Route } from './+types/index';
import { Card } from '~/components/ui/card';
import { staffGet } from '~/features/admin/staff-api.server';
import type { ApplicationForReview, ReviewQueueItem } from '~/features/teaching/types';

export async function loader({ request }: Route.LoaderArgs) {
  const [applications, courses] = await Promise.all([
    staffGet<ApplicationForReview[]>(
      request,
      '/api/v1/admin/instructor-applications?status=pending',
    ),
    staffGet<ReviewQueueItem[]>(request, '/api/v1/admin/course-reviews'),
  ]);
  return { pendingApplications: applications.length, pendingCourses: courses.length };
}

export default function AdminHome({ loaderData }: Route.ComponentProps) {
  const tiles = [
    {
      to: '/admin/applications',
      icon: GraduationCap,
      label: 'Instructor applications waiting',
      count: loaderData.pendingApplications,
    },
    {
      to: '/admin/courses',
      icon: ClipboardList,
      label: 'Courses waiting for review',
      count: loaderData.pendingCourses,
    },
  ];
  return (
    <>
      <h1 className="text-3xl font-bold">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tiles.map(({ to, icon: Icon, label, count }) => (
          <Link
            key={to}
            to={to}
            className="block rounded-xl transition-transform hover:-translate-y-0.5"
          >
            <Card className="flex items-center gap-4 p-5 sm:p-6">
              <span className="inline-flex size-12 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-fg">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-3xl font-bold">{count}</span>
                <span className="block text-sm text-fg-muted">{label}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
