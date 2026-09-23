/**
 * /dashboard: the signed-in home. Phase 1 starts simple (greeting, email
 * verification reminder, next steps); learning progress, streaks and
 * recommendations are added as those features ship.
 */
import { BookOpen, GraduationCap, Settings, Users } from 'lucide-react';
import { Form, Link } from 'react-router';
import type { Route } from './+types/dashboard';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { SubmitButton } from '~/components/ui/submit-button';
import { requireUser } from '~/lib/auth.server';

export function meta() {
  return [{ title: 'Dashboard | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

const NEXT_STEPS = [
  {
    icon: BookOpen,
    title: 'Explore courses',
    body: 'Browse the catalog and start learning.',
    to: null,
  },
  { icon: Users, title: 'Find a mentor', body: 'Book 1:1 help from practitioners.', to: null },
  {
    icon: GraduationCap,
    title: 'Teach on SkillVerse',
    body: 'Share what you know and earn.',
    to: '/teach',
  },
  {
    icon: Settings,
    title: 'Complete your profile',
    body: 'Add a headline and bio.',
    to: '/settings',
  },
];

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold">Hi, {user.displayName.split(' ')[0]}</h1>
      <p className="mt-1 text-fg-muted">Here's what you can do next.</p>

      {!user.emailVerified && (
        <Alert className="mt-6">
          <p>
            <strong>Please confirm your email address.</strong> You'll need it to enroll, post and
            teach. We sent a link to <strong>{user.email}</strong>.
          </p>
          <Form method="post" action="/check-email" className="mt-2">
            <input type="hidden" name="email" value={user.email} />
            <SubmitButton variant="secondary" pendingText="Sending…">
              Resend the link
            </SubmitButton>
          </Form>
        </Alert>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {NEXT_STEPS.map(({ icon: Icon, title, body, to }) => {
          const content = (
            <>
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-fg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 flex items-center gap-2 text-base font-semibold">
                {title}
                {!to && <Badge>Soon</Badge>}
              </h2>
              <p className="mt-1 text-sm text-fg-muted">{body}</p>
            </>
          );
          return to ? (
            <Link
              key={title}
              to={to}
              className="block rounded-xl transition-transform hover:-translate-y-0.5"
            >
              <Card className="h-full p-5 sm:p-6">{content}</Card>
            </Link>
          ) : (
            <Card key={title} className="h-full p-5 sm:p-6">
              {content}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
