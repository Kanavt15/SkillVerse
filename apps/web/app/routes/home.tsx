/** Landing page: live API courses, honest empty states, and a scroll-linked learning diagram. */
import { BookOpen, Check, ClipboardCheck, MessagesSquare, Repeat2, Users } from 'lucide-react';
import type { Route } from './+types/home';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { CourseCard } from '~/components/learning/course-card';
import { Hero } from '~/components/layout/hero';
import { FAQ } from '~/components/ui/faq';
import { apiGet } from '~/lib/api.server';
import type { CatalogResult } from '@skillverse/shared';

export async function loader() {
  const catalog = await apiGet<CatalogResult>('/api/v1/courses?price=free').catch(() => null);
  return { courses: catalog?.items.slice(0, 3) ?? [], unavailable: catalog === null };
}

export function meta(_: Route.MetaArgs) {
  const title = 'SkillVerse | Learn a skill, teach a skill, prove it';
  const description =
    'Learn with video lessons, articles, practice quizzes and community questions. Share your skills by becoming an instructor.';
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
  ];
}

const STEPS = [
  {
    title: 'Find your starting point',
    body: 'Choose a topic, explore the curriculum and try an open preview before enrolling.',
  },
  {
    title: 'Make it yours',
    body: 'Watch, read and practice. Keep private notes and ask your questions in the course community.',
  },
  {
    title: 'Show your progress',
    body: 'Pick up where you left off and earn a verifiable completion certificate when you finish.',
  },
];

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Hero />
      <section id="discover" className="home-section scroll-mt-24" aria-labelledby="featured-title">
        <div className="section-heading">
          <div>
            <h2 id="featured-title">A small start. A new possibility.</h2>
            <p>Explore a free course and put a new skill to work.</p>
          </div>
          <Button asLink to="/courses?price=free" variant="secondary">
            All free courses
          </Button>
        </div>
        {loaderData.courses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loaderData.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <BookOpen className="mx-auto size-9 text-brand" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-semibold">
              {loaderData.unavailable
                ? 'The catalog is temporarily unavailable'
                : 'New courses start with a great teacher'}
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-sm text-fg-muted">
              {loaderData.unavailable
                ? 'Please try the course catalog again in a moment.'
                : 'There are no published free courses yet. Browse the full catalog or share a skill by applying to teach.'}
            </p>
            <Button
              asLink
              to={loaderData.unavailable ? '/courses' : '/teach'}
              variant="secondary"
              className="mt-6"
            >
              {loaderData.unavailable ? 'Try the catalog' : 'Apply to teach'}
            </Button>
          </div>
        )}
      </section>
      <section
        id="how-it-works"
        className="process-section scroll-mt-24"
        aria-labelledby="how-title"
      >
        <div className="home-section process-grid">
          <div id="learn" className="scroll-mt-24">
            <h2 id="how-title" className="home-title">
              From curious
              <br />
              to capable.
            </h2>
            <p className="mt-5 max-w-sm text-fg-muted">
              A space to learn something useful, one lesson at a time.
            </p>
          </div>
          <ol className="process-list">
            {STEPS.map((step, i) => (
              <li key={step.title} id={i === 2 ? 'certify' : undefined} className="scroll-mt-24">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section id="teach" className="home-section scroll-mt-24" aria-labelledby="teach-title">
        <div className="teach-banner">
          <div>
            <h2 id="teach-title" className="home-title">
              Your experience could be someone else's starting point.
            </h2>
            <p>
              Turn what you know into a course. Build your lessons in the Studio and help learners
              find their next step.
            </p>
            <Button asLink to="/teach" className="mt-7" size="lg">
              Teach on SkillVerse
            </Button>
          </div>
          <ul>
            <li>
              <BookOpen aria-hidden="true" />
              Video, articles and practice quizzes
            </li>
            <li>
              <ClipboardCheck aria-hidden="true" />A review before every course goes live
            </li>
            <li>
              <MessagesSquare aria-hidden="true" />
              Questions and conversations with learners
            </li>
            <li>
              <Check aria-hidden="true" />
              Free courses can be published today
            </li>
          </ul>
        </div>
      </section>
      <section className="home-section !pt-0" aria-labelledby="future-title">
        <div className="section-heading">
          <div>
            <h2 id="future-title">More ways to learn, on the horizon.</h2>
            <p>We're building toward learning that goes both ways.</p>
          </div>
        </div>
        <div className="future-grid">
          <article id="mentors">
            <div className="flex items-center gap-3">
              <Users className="size-5 text-brand" aria-hidden="true" />
              <h3 className="text-xl font-semibold">Live mentors</h3>
              <Badge>Planned</Badge>
            </div>
            <p>
              One-to-one help from practitioners, for the question or project you want to work
              through.
            </p>
          </article>
          <article id="swap">
            <div className="flex items-center gap-3">
              <Repeat2 className="size-5 text-brand" aria-hidden="true" />
              <h3 className="text-xl font-semibold">Skill Swap</h3>
              <Badge>Planned</Badge>
            </div>
            <p>Share a skill you know in exchange for learning something new from someone else.</p>
          </article>
        </div>
      </section>
      <section className="border-t border-border bg-surface" aria-labelledby="faq-title">
        <div className="home-section faq-layout">
          <div>
            <h2 id="faq-title" className="home-title">
              A few things you
              <br />
              might be wondering.
            </h2>
            <p className="mt-5 max-w-sm text-fg-muted">
              Start with a lesson. We'll help with the rest.
            </p>
          </div>
          <FAQ />
        </div>
      </section>
    </>
  );
}
