/** Catalog card with real course/instructor data and a subject illustration; no invented metrics. */
import {
  BookOpen,
  Code2,
  Palette,
  Music2,
  Camera,
  ChartNoAxesCombined,
  Clock3,
  Star,
} from 'lucide-react';
import { Link } from 'react-router';
import { formatMoney, LEVEL_LABELS, type PublicCourse } from '@skillverse/shared';
import { Badge } from '~/components/ui/badge';

const ICONS = {
  'web-development': Code2,
  design: Palette,
  music: Music2,
  photography: Camera,
  'data-science': ChartNoAxesCombined,
};
export function CourseCard({ course }: { course: PublicCourse }) {
  const Icon = ICONS[course.category?.slug as keyof typeof ICONS] ?? BookOpen;
  return (
    <article className="course-card">
      <Link to={`/courses/${course.slug}`} tabIndex={-1} aria-hidden="true" className="course-art">
        <Icon strokeWidth={1.25} />
        <span>{course.category?.name ?? 'Explore a new skill'}</span>
      </Link>
      <div className="course-card-body">
        <Badge className="self-start">{LEVEL_LABELS[course.level]}</Badge>
        <h2>
          <Link to={`/courses/${course.slug}`} className="hover:text-brand">
            {course.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-2 text-sm text-fg-muted">{course.subtitle}</p>
        <Link
          to={`/instructors/${course.instructor.username}`}
          className="mt-3 text-sm text-fg-muted hover:text-brand"
        >
          {course.instructor.displayName}
        </Link>
        <div className="course-card-meta">
          <span>
            <BookOpen aria-hidden="true" />
            {course.lessonCount} lessons
          </span>
          <span>
            <Clock3 aria-hidden="true" />
            {course.durationMinutes} min
          </span>
          {course.ratingAverage !== null && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 text-warning" aria-hidden="true" />
              {course.ratingAverage.toFixed(1)} ({course.ratingCount})
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="font-semibold">
            {course.priceInPaise === 0 ? 'Free' : formatMoney(course.priceInPaise)}
          </span>
          {course.priceInPaise === 0 ? (
            <span className="text-accent">Start at your own pace</span>
          ) : (
            <span className="text-fg-muted">Enrollment opens soon</span>
          )}
        </div>
      </div>
    </article>
  );
}
