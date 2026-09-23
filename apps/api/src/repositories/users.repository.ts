/**
 * Data access for `users`, `user_profiles` and `user_roles`.
 *
 * `password_hash` is selected ONLY by `findUserForLogin`. Every other query
 * leaves it out, so it can't leak into a response by accident.
 */
import { eq, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import type { Role } from '@skillverse/shared';

const { users, userProfiles, userRoles } = schema;

/** Columns that are safe to use anywhere (no secrets). */
const publicUserColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  emailVerifiedAt: users.emailVerifiedAt,
  avatarKey: users.avatarKey,
  status: users.status,
  createdAt: users.createdAt,
};

export function findUserForLogin(db: Db, email: string) {
  return db
    .select({
      ...publicUserColumns,
      passwordHash: users.passwordHash,
      failedLoginCount: users.failedLoginCount,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();
}

export function findUserById(db: Db, id: string) {
  return db.select(publicUserColumns).from(users).where(eq(users.id, id)).get();
}

export function findUserByEmail(db: Db, email: string) {
  return db.select(publicUserColumns).from(users).where(eq(users.email, email)).get();
}

export async function usernameTaken(db: Db, username: string): Promise<boolean> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get();
  return Boolean(row);
}

export function findProfile(db: Db, userId: string) {
  return db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
}

export async function listRoles(db: Db, userId: string): Promise<Role[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

/** Statements (not yet run) that create a user and their empty profile. */
export function insertUserStatements(
  db: Db,
  values: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    passwordHash: string | null;
    emailVerifiedAt?: Date | null;
  },
) {
  return [
    db.insert(users).values({ ...values, emailVerifiedAt: values.emailVerifiedAt ?? null }),
    db.insert(userProfiles).values({ userId: values.id }),
  ] as const;
}

/** Records a failed password attempt; locks sign-in for `lockMs` after `maxFailures`. */
export function recordFailedLogin(db: Db, userId: string, maxFailures: number, lockMs: number) {
  const now = Date.now();
  return db
    .update(users)
    .set({
      failedLoginCount: sql`${users.failedLoginCount} + 1`,
      lockedUntil: sql`CASE WHEN ${users.failedLoginCount} + 1 >= ${maxFailures} THEN ${now + lockMs} ELSE ${users.lockedUntil} END`,
    })
    .where(eq(users.id, userId));
}

export function clearFailedLogins(db: Db, userId: string) {
  return db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, userId));
}

export function setPasswordHash(db: Db, userId: string, passwordHash: string) {
  return db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
