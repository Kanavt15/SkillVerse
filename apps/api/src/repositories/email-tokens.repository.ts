/**
 * Data access for `email_tokens` (verify email, reset password, magic link).
 */
import { and, eq, gt, isNull } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';

const { emailTokens } = schema;
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
