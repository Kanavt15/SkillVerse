/** Durable in-app alerts; live sockets only tell clients to refresh this authenticated inbox. */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { id } from './_columns';
import { users } from './identity';

export const notifications = sqliteTable(
  'notifications',
  {
    id: id(),
    /** Only this user can read or mark the notification. Erasure removes their inbox. */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Server-created event kind and bounded copy; never supplied directly by the browser. */
    kind: text('kind', { enum: ['question', 'reply', 'answer', 'moderation'] }).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    /** Server-generated same-origin destination; no user-supplied URL. */
    href: text('href').notNull(),
    /** Stable per-event key deduplicates retries for each recipient. */
    eventKey: text('event_key').notNull(),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('notifications_event_user_idx').on(t.eventKey, t.userId),
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    index('notifications_user_unread_idx').on(t.userId, t.readAt),
  ],
);

export const notificationPreferences = sqliteTable('notification_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Disables future Q&A alerts; moderation decisions are always delivered. */
  discussions: integer('discussions', { mode: 'boolean' }).notNull().default(true),
});
