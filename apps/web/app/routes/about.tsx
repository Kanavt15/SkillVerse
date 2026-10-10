/** Product description with current capabilities and clearly identified future work. */
import { BookOpen, MessagesSquare, Waypoints } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { PageHeading } from '~/components/layout/page-heading';

export function meta() {
  return [
    { title: 'About SkillVerse | A place to share skills' },
    {
      name: 'description',
      content:
        'SkillVerse connects people who want to learn with people who have skills to share, through courses, practice and community questions.',
    },
  ];
}

export default function About() {
  return (
    <div className="page-shell">
      <PageHeading
        eyebrow="About SkillVerse"
        title="A place to pass skills on."
        description="Everyone has something to learn and something to share. SkillVerse brings those two things into the same space."
      />
      <p className="max-w-3xl text-lg leading-8 text-fg-muted">
        Start with a lesson, give an idea a try, and ask a question when you get stuck. If you know
        a craft well, turn that experience into a course someone else can follow. The aim is
        practical learning that makes room for curiosity.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Card>
          <BookOpen aria-hidden="true" className="size-7 text-brand" />
          <h2 className="mt-4 text-xl font-semibold">Learn with context</h2>
          <p className="mt-3 text-sm leading-7 text-fg-muted">
            Video and article lessons, instructor-authored transcripts and chapters, and practice
            quizzes help you explore at your own pace.
          </p>
        </Card>
        <Card>
          <MessagesSquare aria-hidden="true" className="size-7 text-brand" />
          <h2 className="mt-4 text-xl font-semibold">Keep the conversation going</h2>
          <p className="mt-3 text-sm leading-7 text-fg-muted">
            Ask course questions, share useful replies, save private notes, and receive
            notifications about the conversations you take part in.
          </p>
        </Card>
        <Card>
          <Waypoints aria-hidden="true" className="size-7 text-brand" />
          <h2 className="mt-4 text-xl font-semibold">See your progress</h2>
          <p className="mt-3 text-sm leading-7 text-fg-muted">
            Resume unfinished lessons and earn a verifiable completion certificate when you've
            finished a course.
          </p>
        </Card>
      </div>
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-semibold">Room to grow</h2>
        <p className="mt-3 text-sm leading-7 text-fg-muted">
          SkillVerse is still growing. Mentoring, skill swaps and paid checkout are planned
          features. Today you can explore published courses, try previews, enroll in free courses,
          and apply to teach.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asLink to="/courses">
            Find a course
          </Button>
          <Button asLink to="/teach" variant="secondary">
            Share what you know
          </Button>
          <Button asLink to="/help" variant="ghost">
            Visit help
          </Button>
        </div>
      </section>
    </div>
  );
}
