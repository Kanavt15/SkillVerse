import { describe, expect, it } from 'vitest';
import { catalogUrl, parseCatalogFilters } from './catalog-url';

describe('catalog navigation', () => {
  it('accepts empty optional HTML selects and preserves a search across pagination', () => {
    const parsed = parseCatalogFilters(
      new URL('https://skillverse.test/courses?q=web+design&level=&language=&category=&price=free'),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const next = catalogUrl(parsed.data, { page: 2 });
    expect(next).toBe('/courses?q=web+design&price=free&page=2');
    expect(parseCatalogFilters(new URL(next, 'https://skillverse.test')).data).toEqual({
      ...parsed.data,
      page: 2,
    });
  });

  it('keeps category paths authoritative and rejects unbounded or unknown filters', () => {
    const parsed = parseCatalogFilters(
      new URL('https://skillverse.test/categories/design?category=music'),
      'design',
    );
    expect(parsed.data?.category).toBe('design');
    for (const query of ['page=0', 'page=1001', 'level=expert', 'surprise=value']) {
      expect(parseCatalogFilters(new URL(`https://skillverse.test/courses?${query}`)).success).toBe(
        false,
      );
    }
  });

  it('encodes user search text and omits default filters when resetting', () => {
    const parsed = parseCatalogFilters(new URL('https://skillverse.test/courses'));
    if (!parsed.success) throw new Error('Defaults should parse');
    expect(catalogUrl(parsed.data)).toBe('/courses');
    expect(
      new URL(
        catalogUrl(parsed.data, { q: 'C++ & SQL' }),
        'https://skillverse.test',
      ).searchParams.get('q'),
    ).toBe('C++ & SQL');
  });
});
