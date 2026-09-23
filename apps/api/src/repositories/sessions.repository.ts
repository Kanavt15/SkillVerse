/**
 * Data access for `sessions`. Sessions are looked up by the SHA-256 of the
 * cookie token (`id`); the public `handle` is what the UI and revoke API use.
 */
import { and, desc, eq, ne } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';

const { sessions, users, userRoles } = schema;

export function insertSession(
  db: Db,
  values: {
    id: string;
    userId: string;
    expiresAt: Date;
    idleExpiresAt: Date;
    mfaVerified?: boolean;
    ipHash: string | null;
    userAgent: string | null;
  },
) {
  return db.insert(sessions).values(values).returning({ handle: sessions.handle });
}

/**
 * Loads a session, its user and the user's roles in ONE round trip (a D1 batch
 * of two reads). This runs on every authenticated request, so it must be cheap.
 *
 * ⚠️ Never select two columns with the same name in a join (e.g. sessions.id AND
 * users.id): D1 collapses duplicate names and every later column shifts by one.
 * See docs/guides/d1-database-primer.md → "Joins: duplicate column names".
 */
export async function findSessionWithUser(db: Db, tokenHash: string) {
  const [sessionRows, roleRows] = await db.batch([
    db
      .select({
        handle: sessions.handle,
        expiresAt: sessions.expiresAt,
        idleExpiresAt: sessions.idleExpiresAt,
        lastSeenAt: sessions.lastSeenAt,
        mfaVerified: sessions.mfaVerified,
        user: {
          id: users.id,
          email: users.email,
          username: users.username,
          displayName: users.displayName,
          emailVerifiedAt: users.emailVerifiedAt,
          avatarKey: users.avatarKey,
          status: users.status,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, tokenHash))
      .limit(1),
    db
      .select({ role: userRoles.role })
      .from(userRoles)
      .innerJoin(sessions, eq(sessions.userId, userRoles.userId))
      .where(eq(sessions.id, tokenHash)),
  ]);
  const session = sessionRows[0];
  if (!session) return null;
  return { ...session, roles: roleRows.map((r) => r.role) };
}

export function touchSession(db: Db, tokenHash: string, now: Date, idleExpiresAt: Date) {
  return db
    .update(sessions)
    .set({ lastSeenAt: now, idleExpiresAt })
    .where(eq(sessions.id, tokenHash));
}

export function deleteSession(db: Db, tokenHash: string) {
  return db.delete(sessions).where(eq(sessions.id, tokenHash));
}

export function deleteSessionByHandle(db: Db, userId: string, handle: string) {
  return db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.handle, handle)))
    .returning({ handle: sessions.handle });
}

/** Deletes every session of a user, optionally keeping one (the current device). */
export function deleteUserSessions(db: Db, userId: string, exceptTokenHash?: string) {
  return db
    .delete(sessions)
    .where(
      exceptTokenHash
        ? and(eq(sessions.userId, userId), ne(sessions.id, exceptTokenHash))
        : eq(sessions.userId, userId),
    );
}

export function listUserSessions(db: Db, userId: string) {
  return db
    .select({
      id: sessions.id,
      handle: sessions.handle,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(50);
}
