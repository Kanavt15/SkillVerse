/** Shared loaders for the all-courses and category pages. Unknown categories receive a real 404. */
import { data } from 'react-router';
import type { CatalogResult } from '@skillverse/shared';
import type { Category } from '~/features/teaching/types';
import { api } from '~/lib/api.server';
import { catalogUrl, parseCatalogFilters } from './catalog-url';

export async function loadCatalog(request: Request, categorySlug?: string) {
  const parsed = parseCatalogFilters(new URL(request.url), categorySlug);
  if (!parsed.success) throw data('Invalid search filters', { status: 400 });
  const query = catalogUrl(parsed.data).replace('/courses', '/api/v1/courses');
  const [result, categories] = await Promise.all([
    api<CatalogResult>(request, query),
    api<Category[]>(request, '/api/v1/categories'),
  ]);
  if (!result.ok) throw data(result.error.message, { status: result.status });
  if (!categories.ok) throw data(categories.error.message, { status: categories.status });
  const category =
    categories.data.find((c) => c.slug === (categorySlug ?? parsed.data.category)) ?? null;
  if (categorySlug && !category) throw data('Category not found', { status: 404 });
  return { result: result.data, categories: categories.data, filters: parsed.data, category };
}
