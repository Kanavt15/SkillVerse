/** The learner's real progress and next unfinished lesson, shared by the dashboard and library. */
import { Award, BookOpen } from 'lucide-react';
import { Link } from 'react-router';
import type { LearningCourse } from '@skillverse/shared';
import { Button } from '~/components/ui/button';

export function LearningShelf({ courses }: { courses: LearningCourse[] }) {
  if (!courses.length)
    return (
      <div className="rounded-xl border border-dashed border-border-strong p-8 text-center">
        <BookOpen className="mx-auto size-9 text-brand" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Your next skill starts here</h2>
        <p className="mt-2 text-sm text-fg-muted">
          Enroll in a free course to keep your progress, notes and certificates together.
        </p>
        <Button asLink to="/courses?price=free" className="mt-5">
          Explore free courses
        </Button>
      </div>
    );
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {courses.map((course) => (
        <article key={course.id} className="rounded-xl border border-border bg-surface p-6">
          <p className="text-xs text-fg-muted">{course.category?.name ?? 'Learning'}</p>
          <h2 className="mt-2 text-xl font-semibold">{course.title}</h2>
          <p className="mt-2 text-sm text-fg-muted">{course.instructor.displayName}</p>
          {course.status === 'archived' && (
            <p className="mt-2 text-xs text-fg-muted">Archived · Your lesson access is preserved</p>
          )}
          <div className="mt-5 flex justify-between text-sm">
            <span>
              {course.completedLessons} of {course.lessonCount} lessons
            </span>
            <span className="font-medium text-accent">{course.progressPercent}%</span>
          </div>
          <progress
            value={course.completedLessons}
            max={course.lessonCount || 1}
            aria-label={`Progress in ${course.title}`}
            className="learning-progress mt-2 h-2 w-full"
          />
          <div className="mt-5 flex flex-wrap gap-3">
            {course.nextLessonId ? (
              <Button asLink to={`/learn/${course.slug}/${course.nextLessonId}`}>
                Continue learning
              </Button>
            ) : course.certificateSerial ? (
              <Button asLink to={`/verify/${course.certificateSerial}`} variant="secondary">
                <Award aria-hidden="true" />
                View certificate
              </Button>
            ) : (
              <Button asLink to="/account/certificates" variant="secondary">
                Get your certificate
              </Button>
            )}
            {course.status === 'published' && (
              <Link
                to={`/courses/${course.slug}`}
                className="self-center text-sm text-fg-muted hover:text-brand"
              >
                Course overview
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
