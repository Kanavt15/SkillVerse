/** /instructors/:username: public instructor biography and published course shelf. */
import { data, Link } from 'react-router';
import { usernameSchema, type CatalogResult, type PublicCourse } from '@skillverse/shared';
import type { Route } from './+types/instructor';
import { CourseCard } from '~/components/learning/course-card';
import { SafeMarkdown } from '~/components/ui/safe-markdown';
import { api } from '~/lib/api.server';
import { catalogUrl } from '~/features/learning/catalog-url';
import { catalogQuerySchema } from '@skillverse/shared';

interface Instructor {
  profile: PublicCourse['instructor'];
  courses: CatalogResult;
}
export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.profile.displayName ?? 'Instructor'} | SkillVerse` },
    {
      name: 'description',
      content: data?.profile.headline ?? 'Meet the people sharing their skills.',
    },
  ];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const username = usernameSchema.safeParse(params.username);
  const query = catalogQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!username.success || !query.success) throw data('Invalid profile URL', { status: 400 });
  const suffix = catalogUrl(query.data).slice('/courses'.length);
  const res = await api<Instructor>(request, `/api/v1/instructors/${username.data}${suffix}`);
  if (!res.ok) throw data(res.error.message, { status: res.status });
  return res.data;
}
export default function Instructor({ loaderData }: Route.ComponentProps) {
  const { profile, courses } = loaderData;
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link to="/courses" className="text-sm text-brand">
        Explore courses
      </Link>
      <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
        <aside>
          <div
            className="flex size-20 items-center justify-center rounded-full bg-brand-subtle font-display text-3xl text-brand-subtle-fg"
            aria-hidden="true"
          >
            {profile.displayName.slice(0, 1)}
          </div>
          <h1 className="mt-4 text-3xl font-bold">{profile.displayName}</h1>
          <p className="mt-3 text-fg-muted">{profile.headline}</p>
        </aside>
        <div className="min-w-0">
          {profile.bio && (
            <div className="mb-10 max-w-2xl">
              <h2 className="mb-4 text-xl font-semibold">About me</h2>
              <SafeMarkdown>{profile.bio}</SafeMarkdown>
            </div>
          )}
          <h2 className="mb-5 text-2xl font-semibold">Courses by {profile.displayName}</h2>
          {courses.items.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {courses.items.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <p className="text-fg-muted">This instructor hasn’t published a course yet.</p>
          )}
          <nav
            aria-label="Instructor course pages"
            className="mt-6 flex justify-between text-sm text-brand"
          >
            {courses.page > 1 ? <Link to={`?page=${courses.page - 1}`}>Previous</Link> : <span />}
            {courses.page < courses.totalPages && (
              <Link to={`?page=${courses.page + 1}`}>Next</Link>
            )}
          </nav>
        </div>
      </div>
    </section>
  );
}
