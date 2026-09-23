/**
 * GET /api/v1/categories: public list of course categories (for menus,
 * filters, onboarding and the course builder). Changes rarely → cacheable.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { asc } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import { createRouter, jsonResponse, success } from '../lib/openapi';

export const CategorySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    parentId: z.string().nullable(),
  })
  .openapi('Category');

const list = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Catalog'],
  summary: 'All course categories, in menu order',
  responses: { 200: jsonResponse('OK', success(z.array(CategorySchema))) },
});

export const categoryRoutes = createRouter().openapi(list, async (c) => {
  const { categories } = schema;
  const rows = await c
    .get('db')
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      icon: categories.icon,
      parentId: categories.parentId,
    })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name))
    .limit(500);
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ ok: true as const, data: rows }, 200);
});
