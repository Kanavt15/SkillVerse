/**
 * Factory for route groups. Every router is an OpenAPIHono instance, so each
 * route's Zod schemas both VALIDATE input and DOCUMENT the endpoint in
 * /api/openapi.json. Docs and code can't drift apart.
 *
 * `defaultHook` turns Zod validation failures into our standard
 * VALIDATION_FAILED error with per-field messages.
 */
import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '../env';
import { AppError } from './errors';

export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        const fields: Record<string, string[]> = {};
        for (const issue of result.error.issues) {
          const key = issue.path.join('.') || '_';
          (fields[key] ??= []).push(issue.message);
        }
        throw new AppError('VALIDATION_FAILED', 'Some fields are invalid.', fields);
      }
    },
  });
}

/** OpenAPI schema of the standard error body, for documenting error responses. */
export const ErrorBodySchema = z
  .object({
    ok: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'NOT_FOUND' }),
      message: z.string(),
      fields: z.record(z.string(), z.array(z.string())).optional(),
      requestId: z.string().optional(),
    }),
  })
  .openapi('ErrorBody');

/** Wraps a data schema in the standard success envelope `{ ok: true, data }`. */
export function success<T extends z.ZodType>(data: T) {
  return z.object({ ok: z.literal(true), data });
}
