/** /admin/courses: courses waiting for review, oldest submission first. */
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Route } from './+types/courses';
import { Alert } from '~/components/ui/alert';
import { Card } from '~/components/ui/card';
import { LocalTime } from '~/components/ui/local-time';
import { staffGet } from '~/features/admin/staff-api.server';
import { durationLabel, priceLabel } from '~/features/teaching/course-status';
import type { ReviewQueueItem } from '~/features/teaching/types';

const DECIDED = {
  published: 'Course published. The instructor has been emailed.',
  returned: 'Sent back to the instructor with your feedback.',
} as const;

export async function loader({ request }: Route.LoaderArgs) {
  const decided = new URL(request.url).searchParams.get('decided');
  return {
    queue: await staffGet<ReviewQueueItem[]>(request, '/api/v1/admin/course-reviews'),
    // Confirmation after a decision on the review page (fixed messages only, never echoed input).
    notice: decided === 'published' || decided === 'returned' ? DECIDED[decided] : null,
  };
}

export default function CourseQueue({ loaderData }: Route.ComponentProps) {
  const { queue, notice } = loaderData;
  return (
    <>
      <h1 className="text-3xl font-bold">Course reviews</h1>
      <p className="mt-1 text-fg-muted">
        Oldest submissions first. Aim to review within 3 working days.
      </p>
      {notice && (
        <Alert tone="success" className="mt-6">
          {notice}
        </Alert>
      )}
      {queue.length === 0 ? (
        <Card className="mt-6 text-center text-fg-muted">The queue is empty.</Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {queue.map((c) => (
            <li key={c.id}>
              <Link
                to={`/admin/courses/${c.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-card hover:border-border-strong"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{c.title}</h2>
                  <p className="mt-1 text-sm text-fg-muted">
                    by {c.instructor.displayName} · {c.lessonCount} lessons ·{' '}
                    {durationLabel(c.durationMinutes)} · {priceLabel(c.priceInPaise)}
                  </p>
                  {c.submittedAt && (
                    <p className="mt-1 text-xs text-fg-subtle">
                      Submitted <LocalTime iso={c.submittedAt} />
                    </p>
                  )}
                </div>
                <ChevronRight className="size-5 shrink-0 text-fg-subtle" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
