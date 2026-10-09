/** Catalog card with real course/instructor data and a subject illustration; no invented metrics. */
import { BookOpen, Code2, Palette, Music2, Camera, ChartNoAxesCombined, Star } from 'lucide-react';
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
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <Link
        to={`/courses/${course.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative flex h-36 items-center justify-center overflow-hidden bg-brand-subtle"
      >
        <div className="absolute -right-8 -bottom-14 size-56 rounded-full border-[24px] border-brand/10" />
        <Icon className="size-14 text-brand-subtle-fg" strokeWidth={1.25} />
        <span className="absolute bottom-3 left-4 text-sm font-medium text-brand-subtle-fg">
          {course.category?.name ?? 'Explore a new skill'}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Badge className="self-start">{LEVEL_LABELS[course.level]}</Badge>
        <h2 className="mt-3 text-xl leading-snug font-semibold">
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
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <span>{course.lessonCount} lessons</span>
          <span>{course.durationMinutes} min</span>
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
