/** Recipient-scoped inbox reads and conditional inserts that join the originating event's D1 batch. */
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import { newId, type NotificationQuery, type NotificationView } from '@skillverse/shared';
const { notifications, notificationPreferences: preferences, users } = schema;
export interface NotificationEvent {
  userId: string;
  kind: NotificationView['kind'];
  title: string;
  message: string;
  href: string | SQL;
  eventKey: string;
}
/** Lazy builder: guard checks that the associated event succeeded within the same batch. */
export function notificationInsert(db: Db, event: NotificationEvent, guard: SQL) {
  return db
    .insert(notifications)
    .select(
      sql`SELECT ${newId()}, ${event.userId}, ${event.kind}, ${event.title}, ${event.message}, ${event.href}, ${event.eventKey}, NULL, ${Date.now()}
    FROM ${users} WHERE ${users.id} = ${event.userId} AND ${guard}
    AND (${event.kind} = 'moderation' OR coalesce((SELECT ${preferences.discussions} FROM ${preferences} WHERE ${preferences.userId} = ${event.userId}), 1) = 1)`,
    )
    .onConflictDoNothing({ target: [notifications.eventKey, notifications.userId] });
}
export function discussionEvents(
  actorId: string,
  recipients: (string | null)[],
  event: Omit<NotificationEvent, 'userId'>,
): NotificationEvent[] {
  return [...new Set(recipients)]
    .filter((id): id is string => Boolean(id) && id !== actorId)
    .map((userId) => ({ ...event, userId }));
}
function filter(userId: string, unreadOnly: string) {
  return and(
    eq(notifications.userId, userId),
    unreadOnly === 'true' ? isNull(notifications.readAt) : undefined,
  );
}
export function list(db: Db, userId: string, query: NotificationQuery) {
  return db
    .select()
    .from(notifications)
    .where(filter(userId, query.unreadOnly))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(20)
    .offset((query.page - 1) * 20);
}
export function count(db: Db, userId: string, unreadOnly: string) {
  return db
    .select({ total: sql<number>`count(*)` })
    .from(notifications)
    .where(filter(userId, unreadOnly))
    .get();
}
export function preference(db: Db, userId: string) {
  return db
    .select({ discussions: preferences.discussions })
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .get();
}
export function setPreference(db: Db, userId: string, discussions: boolean) {
  return db
    .insert(preferences)
    .values({ userId, discussions })
    .onConflictDoUpdate({ target: preferences.userId, set: { discussions } });
}
export function markRead(db: Db, userId: string, id: string) {
  return db
    .update(notifications)
    .set({ readAt: sql`coalesce(${notifications.readAt}, ${Date.now()})` })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
}
export function markAllRead(db: Db, userId: string) {
  return db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
