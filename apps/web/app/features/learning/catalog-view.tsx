/** Search-first course discovery, rendered on the server and usable without JavaScript. */
import { Search } from 'lucide-react';
import { Form, Link } from 'react-router';
import {
  COURSE_LANGUAGES,
  LEVEL_LABELS,
  type CatalogQuery,
  type CatalogResult,
} from '@skillverse/shared';
import type { Category } from '~/features/teaching/types';
import { CourseCard } from '~/components/learning/course-card';
import { Button } from '~/components/ui/button';
import { Input, inputClass } from '~/components/ui/input';
import { catalogUrl } from './catalog-url';

export function CatalogView({
  result,
  filters,
  categories,
  category,
}: {
  result: CatalogResult;
  filters: CatalogQuery;
  categories: Category[];
  category: Category | null;
}) {
  return (
    <section className="page-shell">
      <div className="catalog-intro">
        <div className="max-w-2xl">
          {category && (
            <Link to="/courses" className="text-sm text-brand">
              All courses
            </Link>
          )}
          <h1 className="mt-2">{category?.name ?? 'What will you learn next?'}</h1>
          <p className="mt-3 text-fg-muted">
            {category?.description ||
              'Pick a skill. Find a teacher. Make something you can be proud of.'}
          </p>
        </div>
        <Form method="get" action="/courses" role="search" className="mt-7 flex gap-2">
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <Input
            id="course-search"
            name="q"
            type="search"
            placeholder="Search a skill, topic or course"
            defaultValue={filters.q}
            className="h-12 text-base"
            maxLength={100}
          />
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          {filters.level && <input type="hidden" name="level" value={filters.level} />}
          {filters.language && <input type="hidden" name="language" value={filters.language} />}
          <input type="hidden" name="price" value={filters.price} />
          <input type="hidden" name="sort" value={filters.sort} />
          <Button type="submit" size="lg">
            <Search aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <span className="sr-only sm:hidden">Search</span>
          </Button>
        </Form>
      </div>
      <nav aria-label="Course categories" className="mt-5 flex gap-2 overflow-x-auto pb-2">
        <Link
          to={catalogUrl(filters, { category: undefined, page: 1 })}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm ${!filters.category ? 'border-brand bg-brand-subtle text-brand-subtle-fg' : 'border-border text-fg-muted'}`}
        >
          All topics
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            to={catalogUrl(filters, { category: c.slug, page: 1 })}
            aria-current={filters.category === c.slug ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm ${filters.category === c.slug ? 'border-brand bg-brand-subtle text-brand-subtle-fg' : 'border-border text-fg-muted hover:border-border-strong'}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="catalog-filters">
          <Form
            method="get"
            action="/courses"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-1"
          >
            <input type="hidden" name="q" value={filters.q} />
            {filters.category && <input type="hidden" name="category" value={filters.category} />}
            <label className="space-y-2 text-sm font-medium">
              Level
              <select name="level" defaultValue={filters.level ?? ''} className={inputClass}>
                <option value="">Any level</option>
                {Object.entries(LEVEL_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Language
              <select name="language" defaultValue={filters.language ?? ''} className={inputClass}>
                <option value="">Any language</option>
                {Object.entries(COURSE_LANGUAGES).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Price
              <select name="price" defaultValue={filters.price} className={inputClass}>
                <option value="all">All courses</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              Sort by
              <select name="sort" defaultValue={filters.sort} className={inputClass}>
                <option value="newest">Newest</option>
                <option value="popular">Most learners</option>
                <option value="rating">Highest rated</option>
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
            <Link to="/courses" className="self-center text-sm text-fg-muted hover:text-brand">
              Clear filters
            </Link>
          </Form>
          <div className="mt-8 hidden border-t border-border pt-5 lg:block">
            <p className="font-display text-lg font-semibold">Know something worth sharing?</p>
            <Link to="/teach" className="mt-2 inline-block text-sm text-brand">
              Become an instructor
            </Link>
          </div>
        </aside>
        <div>
          <p className="mb-5 text-sm text-fg-muted" role="status">
            {result.total} {result.total === 1 ? 'course' : 'courses'}
            {filters.q ? ` for “${filters.q}”` : ''}
          </p>
          {result.items.length ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2 className="text-xl font-semibold">No courses match yet</h2>
              <p className="mt-2 text-fg-muted">
                Try a broader search or clear your filters to explore other skills.
              </p>
              <Button asLink to="/courses" variant="secondary" className="mt-5">
                Browse all courses
              </Button>
            </div>
          )}
          {result.totalPages > 1 && (
            <nav
              aria-label="Catalog pages"
              className="mt-8 flex items-center justify-between gap-3"
            >
              <div>
                {result.page > 1 && (
                  <Button
                    asLink
                    to={catalogUrl(filters, { page: result.page - 1 })}
                    variant="secondary"
                  >
                    Previous
                  </Button>
                )}
              </div>
              <span className="text-sm text-fg-muted">
                Page {result.page} of {result.totalPages}
              </span>
              <div>
                {result.page < result.totalPages && (
                  <Button
                    asLink
                    to={catalogUrl(filters, { page: result.page + 1 })}
                    variant="secondary"
                  >
                    Next
                  </Button>
                )}
              </div>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
