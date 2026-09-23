/**
 * Entry point of @skillverse/db.
 *
 *   import { createDb, schema } from '@skillverse/db';
 *   const db = createDb(env.DB); // env.DB is the D1 binding from wrangler.jsonc
 */
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export { schema };

/** Wraps a Cloudflare D1 binding in a typed Drizzle client. Cheap: call it per request. */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Row types, e.g. `User` for reads and `NewUser` for inserts. */
export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type Session = typeof schema.sessions.$inferSelect;
export type AuditLog = typeof schema.auditLogs.$inferSelect;

/**
 * Minimal structural type for the D1 binding, so this package doesn't depend on
 * @cloudflare/workers-types. The real type from the Worker satisfies it.
 */
type D1Database = Parameters<typeof drizzle>[0];
