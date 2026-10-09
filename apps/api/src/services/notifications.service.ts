/** Persistent inbox operations and best-effort, content-free live refresh hints. */
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import type { NotificationQuery } from '@skillverse/shared';
import * as repository from '../repositories/notifications.repository';
export async function inbox(d: RequestDeps, auth: AuthContext, query: NotificationQuery) {
  const [rows, total, unread, preferences] = await Promise.all([
    repository.list(d.db, auth.user.id, query),
    repository.count(d.db, auth.user.id, query.unreadOnly),
    repository.count(d.db, auth.user.id, 'true'),
    repository.preference(d.db, auth.user.id),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      message: r.message,
      href: r.href,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: total?.total ?? 0,
    unreadCount: unread?.total ?? 0,
    page: query.page,
    totalPages: Math.max(1, Math.ceil((total?.total ?? 0) / 20)),
    preferences: preferences ?? { discussions: true },
  };
}
export async function unread(d: RequestDeps, auth: AuthContext) {
  return { unreadCount: (await repository.count(d.db, auth.user.id, 'true'))?.total ?? 0 };
}
export function publish(d: RequestDeps, recipients: (string | null)[]) {
  d.waitUntil(
    Promise.all(
      [...new Set(recipients)]
        .filter((id): id is string => Boolean(id))
        .map(async (id) => {
          try {
            const response = await d.env.NOTIFICATIONS.getByName(id).fetch(
              'https://notifications.internal/publish',
              { method: 'POST' },
            );
            if (!response.ok) throw new Error(`Live delivery returned ${response.status}`);
          } catch (error) {
            d.log.warn('notifications.live_unavailable', { error: String(error) });
          }
        }),
    ),
  );
}
export async function read(d: RequestDeps, auth: AuthContext, id: string) {
  if (!(await repository.markRead(d.db, auth.user.id, id)).length)
    throw new AppError('NOT_FOUND', 'Notification not found.');
  publish(d, [auth.user.id]);
}
export async function readAll(d: RequestDeps, auth: AuthContext) {
  await repository.markAllRead(d.db, auth.user.id);
  publish(d, [auth.user.id]);
}
export async function preferences(d: RequestDeps, auth: AuthContext, discussions: boolean) {
  await repository.setPreference(d.db, auth.user.id, discussions);
}
