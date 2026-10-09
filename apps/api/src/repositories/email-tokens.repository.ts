/**
 * Data access for `email_tokens` (verify email, reset password, magic link).
 */
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';

const { emailTokens } = schema;

/** Conditional insert serializes a one-minute mailbox cooldown, including concurrent IPs. */
export function insertMagicLink(
  db: Db,
  values: { id: string; userId: string; expiresAt: Date; now: Date },
) {
  const { users } = schema;
  return db
    .insert(emailTokens)
    .select(
      sql`SELECT ${values.id}, ${values.userId}, 'magic_link',
    ${values.expiresAt.getTime()}, NULL, ${values.now.getTime()} FROM ${users}
    WHERE ${users.id} = ${values.userId} AND ${users.status} = 'active'
    AND NOT EXISTS (SELECT 1 FROM ${emailTokens} WHERE ${emailTokens.userId} = ${values.userId}
      AND ${emailTokens.purpose} = 'magic_link' AND ${emailTokens.createdAt} > ${values.now.getTime() - 60_000})`,
    )
    .returning({ id: emailTokens.id });
}

/** Invalidates older links only when the conditional insert in this batch won. */
export function deleteOlderMagicLinks(db: Db, userId: string, newTokenHash: string) {
  return db
    .delete(emailTokens)
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.purpose, 'magic_link'),
        isNull(emailTokens.usedAt),
        ne(emailTokens.id, newTokenHash),
        sql`EXISTS (SELECT 1 FROM email_tokens AS newest WHERE newest.id = ${newTokenHash})`,
      ),
    );
}
export type EmailTokenPurpose = (typeof emailTokens.$inferInsert)['purpose'];

export function insertEmailToken(
  db: Db,
  values: { id: string; userId: string; purpose: EmailTokenPurpose; expiresAt: Date },
) {
  return db.insert(emailTokens).values(values);
}

/** Removes a user's unused tokens of one purpose, so only the newest link works. */
export function deleteUnusedTokens(db: Db, userId: string, purpose: EmailTokenPurpose) {
  return db
    .delete(emailTokens)
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.usedAt),
      ),
    );
}

/**
 * Atomically redeems a token: marks it used only if it exists, has the right
 * purpose, is unused and unexpired, all in ONE statement. Two simultaneous
 * clicks can't both succeed. Returns the owner's user id, or undefined.
 */
export async function redeemToken(
  db: Db,
  tokenHash: string,
  purpose: EmailTokenPurpose,
  now = new Date(),
): Promise<string | undefined> {
  const rows = await db
    .update(emailTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailTokens.id, tokenHash),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, now),
      ),
    )
    .returning({ userId: emailTokens.userId });
  return rows[0]?.userId;
}
