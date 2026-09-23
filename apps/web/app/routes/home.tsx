/**
 * Home / landing page (/).
 * Phase 0 version: explains the product and its four pillars. Sections gain
 * live data (featured courses, top mentors) as each phase ships.
 */
import {
  ArrowRight,
  Award,
  BookOpen,
  IndianRupee,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Route } from './+types/home';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

export function meta(_: Route.MetaArgs) {
  const title = 'SkillVerse | Learn a skill, teach a skill, prove it';
  const description =
    'Courses, live mentors, skill swaps and verifiable certifications, on one platform built for India.';
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
  ];
}

const PILLARS = [
  {
    id: 'learn',
    icon: BookOpen,
    title: 'Courses',
    body: 'Video, reading, quizzes and hands-on coding exercises from vetted instructors. Free and paid.',
  },
  {
    id: 'mentors',
    icon: Users,
    title: 'Live mentors',
    body: 'Book 1:1 time with practitioners. Get unstuck, review your project, plan your career.',
  },
  {
    id: 'swap',
    icon: Repeat2,
    title: 'Skill Swap',
    body: 'Teach what you know and learn what you don’t, paid in time credits instead of money.',
  },
  {
    id: 'certify',
    icon: Award,
    title: 'Certifications',
    body: 'Timed, proctored exams and signed credentials anyone can verify with a QR code.',
  },
];

const STEPS = [
  {
    title: 'Pick a goal',
    body: 'Tell us what you want to become. We map the skills and a path to get there.',
  },
  {
    title: 'Learn by doing',
    body: 'Courses, practice problems and mentors, with streaks and study pods to keep you going.',
  },
  {
    title: 'Prove it',
    body: 'Earn verifiable certificates and a public Skill Passport that shows what you can do.',
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--brand-subtle),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28">
          <Badge tone="brand" className="mb-6">
            <Sparkles className="size-3.5" aria-hidden="true" /> Building in public: early access
            soon
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-bold sm:text-6xl">
            Learn a skill. <span className="text-brand">Teach a skill.</span> Prove it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-fg-muted">
            SkillVerse brings courses, live mentors, skill swaps and trusted certifications into one
            place, so you can go from curious to certified and get paid to teach what you know.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asLink to="/#how-it-works" size="lg">
              See how it works <ArrowRight aria-hidden="true" />
            </Button>
            <Button asLink to="/#teach" size="lg" variant="secondary">
              Teach on SkillVerse
            </Button>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="text-center text-3xl font-bold">
          Everything you need to grow a skill
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ id, icon: Icon, title, body }) => (
            <article
              key={id}
              id={id}
              className="scroll-mt-24 rounded-xl border border-border bg-surface p-6 shadow-card"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-fg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-16 border-y border-border bg-bg-subtle"
        aria-labelledby="how-title"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="how-title" className="text-center text-3xl font-bold">
            How it works
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="font-display text-5xl font-bold text-border-strong">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-fg-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Teach */}
      <section id="teach" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 rounded-xl border border-border bg-surface p-8 shadow-card md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-3xl font-bold">Turn what you know into income</h2>
            <p className="mt-4 text-fg-muted">
              Publish courses, run live workshops, or mentor one-on-one. Keep up to 95% when
              learners come through your own link, and get paid straight to your bank account.
            </p>
          </div>
          <ul className="space-y-4">
            {[
              { icon: IndianRupee, text: 'Transparent revenue share and monthly payouts' },
              { icon: Users, text: 'Built-in audience of motivated learners' },
              { icon: ShieldCheck, text: 'Secure payments, verified identities, fair refunds' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
