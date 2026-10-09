/** Shareable catalog filters; empty optional selects are omitted, and changing filters resets paging. */
import { catalogQuerySchema, type CatalogQuery } from '@skillverse/shared';

export function parseCatalogFilters(url: URL, category?: string) {
  const input = Object.fromEntries(url.searchParams);
  for (const key of ['category', 'level', 'language']) if (input[key] === '') delete input[key];
  if (category) input.category = category;
  return catalogQuerySchema.safeParse(input);
}

export function catalogUrl(filters: CatalogQuery, patch: Partial<CatalogQuery> = {}): string {
  const query = { ...filters, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (
      value === undefined ||
      value === '' ||
      (key === 'page' && value === 1) ||
      (key === 'price' && value === 'all') ||
      (key === 'sort' && value === 'newest')
    )
      continue;
    params.set(key, String(value));
  }
  return `/courses${params.size ? `?${params}` : ''}`;
}
