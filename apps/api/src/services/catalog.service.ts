/** Public read models deliberately omit lesson bodies, private profiles and moderation data. */
import type { CatalogQuery, PublicCourse } from '@skillverse/shared';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import {
  CATALOG_PAGE_SIZE,
  findCatalogCourse,
  findPublicInstructor,
  listCatalog,
  type CatalogRow,
} from '../repositories/catalog.repository';
import { listCourseTagSlugs, listLessons, listSections } from '../repositories/courses.repository';
import { listReviews } from '../repositories/learning.repository';

export function publicCourse(row: CatalogRow): PublicCourse {
  const c = row.course;
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    category:
      row.categorySlug && row.categoryName
        ? { slug: row.categorySlug, name: row.categoryName }
        : null,
    level: c.level,
    language: c.language,
    priceInPaise: c.priceInPaise,
    lessonCount: c.lessonCount,
    durationMinutes: c.durationMinutes,
    enrollmentCount: c.enrollmentCount,
    ratingAverage: c.ratingCount ? Math.round((c.ratingSum / c.ratingCount) * 10) / 10 : null,
    ratingCount: c.ratingCount,
    instructor: {
      username: row.instructorUsername,
      displayName: row.instructorName,
      headline: row.instructorHeadline ?? '',
      bio: row.instructorBio ?? '',
    },
  };
}

export function stringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function catalog(d: RequestDeps, query: CatalogQuery, instructorId?: string) {
  const result = await listCatalog(d.db, query, instructorId);
  return {
    items: result.items.map(publicCourse),
    total: result.total,
    page: query.page,
    pageSize: CATALOG_PAGE_SIZE,
    totalPages: Math.ceil(result.total / CATALOG_PAGE_SIZE),
  };
}

export async function publishedCourse(d: RequestDeps, slug: string) {
  const row = await findCatalogCourse(d.db, slug);
  if (!row || row.course.status !== 'published' || row.instructorStatus !== 'active')
    throw new AppError('NOT_FOUND', 'Course not found.');
  return row;
}

export async function curriculum(d: RequestDeps, courseId: string) {
  const [sections, lessons] = await Promise.all([
    listSections(d.db, courseId),
    listLessons(d.db, courseId),
  ]);
  return sections.map((s) => ({
    id: s.id,
    title: s.title,
    lessons: lessons
      .filter((l) => l.sectionId === s.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        durationMinutes: l.durationMinutes,
        isPreview: l.isPreview,
      })),
  }));
}

export async function detail(d: RequestDeps, slug: string) {
  const row = await publishedCourse(d, slug);
  const [sections, tags] = await Promise.all([
    curriculum(d, row.course.id),
    listCourseTagSlugs(d.db, row.course.id),
  ]);
  return {
    ...publicCourse(row),
    description: row.course.description,
    learningOutcomes: stringArray(row.course.learningOutcomes),
    requirements: stringArray(row.course.requirements),
    tags: tags.map((t) => t.slug),
    sections,
    publishedAt: row.course.publishedAt?.toISOString() ?? null,
  };
}

export async function instructor(d: RequestDeps, username: string, query: CatalogQuery) {
  const row = await findPublicInstructor(d.db, username);
  if (!row) throw new AppError('NOT_FOUND', 'Instructor not found.');
  const { id, ...profile } = row;
  return {
    profile: { ...profile, headline: row.headline ?? '', bio: row.bio ?? '' },
    courses: await catalog(d, query, id),
  };
}

export async function reviews(d: RequestDeps, slug: string, page: number) {
  const row = await publishedCourse(d, slug);
  const items = await listReviews(d.db, row.course.id, page);
  return items.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}
