import { LearnerWorkspace } from '~/components/layout/learner-workspace';
/** /learning: personal enrollment shelf, with a retry-safe next unfinished lesson. */
import { data, Link } from 'react-router';
import type { LearningCourse } from '@skillverse/shared';
import type { Route } from './+types/learning';
import { LearningShelf } from '~/components/learning/learning-shelf';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';

export function meta() {
  return [{ title: 'My learning | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const res = await api<LearningCourse[]>(request, '/api/v1/me/learning');
  if (!res.ok) throw data(res.error.message, { status: res.status });
  return { courses: res.data };
}
export default function Learning({ loaderData }: Route.ComponentProps) {
  return (
    <LearnerWorkspace>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My learning</h1>
          <p className="mt-2 text-fg-muted">
            A little progress today becomes a skill you can use tomorrow.
          </p>
        </div>
        <Link to="/account/certificates" className="text-sm text-brand">
          My certificates
        </Link>
      </div>
      <LearningShelf courses={loaderData.courses} />
    </LearnerWorkspace>
  );
}
