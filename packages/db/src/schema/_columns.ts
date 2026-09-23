/**
 * Column helpers reused by every table, so conventions stay identical everywhere:
 *   - Primary keys are UUIDv7 text (see @skillverse/shared → ids.ts).
 *   - Timestamps are INTEGER milliseconds since the Unix epoch (UTC). Integers
 *     sort and compare correctly in SQLite and avoid timezone string parsing.
 */
import { integer, text } from 'drizzle-orm/sqlite-core';
import { newId } from '@skillverse/shared';

/** `id TEXT PRIMARY KEY`, generated in application code as a UUIDv7. */
export const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => newId());

/** `created_at` / `updated_at` in epoch milliseconds. `updated_at` refreshes on every Drizzle update. */
export const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});
