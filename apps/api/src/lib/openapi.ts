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

/** A JSON request body entry for `createRoute({ request: { body } })`. */
export function jsonBody<T extends z.ZodType>(schema: T) {
  return { required: true, content: { 'application/json': { schema } } };
}

/** A JSON response entry. */
export function jsonResponse<T extends z.ZodType>(description: string, schema: T) {
  return { description, content: { 'application/json': { schema } } };
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed',
  401: 'Not signed in',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Conflict',
  429: 'Rate limited',
};

/** Standard error responses for documentation, e.g. `...errors(400, 401)`. */
export function errors(...statuses: (keyof typeof ERROR_DESCRIPTIONS)[]) {
  return Object.fromEntries(
    statuses.map((s) => [s, jsonResponse(ERROR_DESCRIPTIONS[s]!, ErrorBodySchema)]),
  );
}

/** Marks a route as requiring the session cookie in the OpenAPI docs. */
export const sessionSecurity = [{ session: [] as string[] }];

/** The data envelope used by endpoints that only confirm success. */
export const MessageSchema = z.object({ message: z.string() }).openapi('Message');
