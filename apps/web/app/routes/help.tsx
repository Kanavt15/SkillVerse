/** Public help for working learning, teaching and account features; every destination is a real route. */
import { BookOpen, GraduationCap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { PageHeading } from '~/components/layout/page-heading';

export function meta() {
  return [
    { title: 'Help with learning and teaching | SkillVerse' },
    {
      name: 'description',
      content:
        'Get started, use lesson chapters and notes, manage your account, and share your skills on SkillVerse.',
    },
  ];
}

export default function Help() {
  return (
    <div className="page-shell">
      <PageHeading
        eyebrow="A little guidance"
        title="Keep your learning moving."
        description="Find a starting point, pick up where you left off, or make your first course easier to follow."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <BookOpen className="size-7 text-brand" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">Start learning</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-7 text-fg-muted">
            <li>Browse courses and try lessons marked Preview.</li>
            <li>Create an account and verify your email to enroll in a free course.</li>
            <li>Open My learning to resume your next unfinished lesson.</li>
          </ol>
          <Button asLink to="/courses" variant="secondary" className="mt-5">
            Explore courses
          </Button>
        </Card>
        <Card>
          <GraduationCap className="size-7 text-brand" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">Share a skill</h2>
          <p className="mt-3 text-sm leading-7 text-fg-muted">
            Apply to become an instructor with your experience and a teaching sample. Once approved,
            use Studio to create sections, lessons and practice quizzes, then submit your course for
            review.
          </p>
          <Button asLink to="/teach" variant="secondary" className="mt-5">
            Teaching guide
          </Button>
        </Card>
        <Card>
          <ShieldCheck className="size-7 text-brand" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">Look after your account</h2>
          <p className="mt-3 text-sm leading-7 text-fg-muted">
            Manage your password, two-factor authentication and signed-in devices from Security
            settings. If you forget your password, request a reset link from the sign-in page.
          </p>
          <Button asLink to="/settings/security" variant="secondary" className="mt-5">
            Security settings
          </Button>
        </Card>
      </div>
      <section className="mt-12 max-w-3xl" aria-labelledby="help-questions">
        <h2 id="help-questions" className="text-2xl font-semibold">
          While you're learning
        </h2>
        <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-surface px-5">
          <details className="py-5">
            <summary className="cursor-pointer font-semibold">
              How do chapters and transcripts work?
            </summary>
            <p className="mt-3 text-sm leading-7 text-fg-muted">
              When an instructor adds them, chapter links and transcript timestamps open a specific
              video moment. Open Read transcript to search for a word or idea. To use keyboard
              chapter navigation, focus the navigation bar above the chapters and press the left or
              right arrow. Shift with an arrow opens an accessible adjacent lesson.
            </p>
          </details>
          <details className="py-5">
            <summary className="cursor-pointer font-semibold">
              Where do my notes and reflections go?
            </summary>
            <p className="mt-3 text-sm leading-7 text-fg-muted">
              They are private to your account and appear under their lesson. Add a video timestamp
              to revisit that moment later. A practice checkpoint can save your reflection there
              too. Checkpoints are optional practice; quiz lessons record graded results separately.
            </p>
          </details>
          <details className="py-5">
            <summary className="cursor-pointer font-semibold">
              How do I earn a completion certificate?
            </summary>
            <p className="mt-3 text-sm leading-7 text-fg-muted">
              Complete every lesson, including passing any quiz lessons. The last completed lesson
              offers a completion certificate. Find your issued certificates under{' '}
              <Link to="/account/certificates" className="text-brand underline underline-offset-4">
                My certificates
              </Link>
              , then share the verification link or print to PDF. This records course completion; it
              is not a proctored certification.
            </p>
          </details>
          <details className="py-5">
            <summary className="cursor-pointer font-semibold">
              How can I ask a question or report content?
            </summary>
            <p className="mt-3 text-sm leading-7 text-fg-muted">
              After enrolling, open Lesson Q&amp;A to ask a course question and include a video
              timestamp if useful. Use Report on a question, reply or review to send a private
              content report to staff. Avoid posting personal information or account credentials.
            </p>
          </details>
          <details className="py-5">
            <summary className="cursor-pointer font-semibold">Why won't my video play?</summary>
            <p className="mt-3 text-sm leading-7 text-fg-muted">
              Videos are hosted on YouTube or Vimeo. Check your connection and whether your browser
              blocks the provider. A private, deleted or embedding-disabled video may be
              unavailable. If you're enrolled, use Lesson Q&amp;A to tell the instructor which
              lesson is affected; articles and other accessible lessons remain available.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
