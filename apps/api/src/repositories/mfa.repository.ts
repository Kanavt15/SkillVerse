/**
 * Data access for `mfa_totp` and `mfa_recovery_codes`.
 */
import { and, count, eq, isNull, lt } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';

const { mfaTotp, mfaRecoveryCodes } = schema;

export function findTotp(db: Db, userId: string) {
  return db.select().from(mfaTotp).where(eq(mfaTotp.userId, userId)).get();
}

/** Starts (or restarts) setup: stores a new secret, not yet enabled. */
export function upsertPendingTotp(db: Db, userId: string, secretEncrypted: string) {
  return db
    .insert(mfaTotp)
    .values({ userId, secretEncrypted, enabledAt: null, lastUsedStep: 0 })
    .onConflictDoUpdate({
      target: mfaTotp.userId,
      set: { secretEncrypted, enabledAt: null, lastUsedStep: 0, createdAt: new Date() },
    });
}

export function markTotpEnabled(db: Db, userId: string, step: number) {
  return db
    .update(mfaTotp)
    .set({ enabledAt: new Date(), lastUsedStep: step })
    .where(eq(mfaTotp.userId, userId));
}

/**
 * Records that the code for `step` was used, only if no later-or-equal step was
 * used before. Atomic, so the same code can't be accepted twice even by two
 * simultaneous requests. Returns true if this caller "won" the step.
 */
export async function claimTotpStep(db: Db, userId: string, step: number): Promise<boolean> {
  const rows = await db
    .update(mfaTotp)
    .set({ lastUsedStep: step })
    .where(and(eq(mfaTotp.userId, userId), lt(mfaTotp.lastUsedStep, step)))
    .returning({ userId: mfaTotp.userId });
  return rows.length === 1;
}

export function deleteTotp(db: Db, userId: string) {
  return db.delete(mfaTotp).where(eq(mfaTotp.userId, userId));
}

export function insertRecoveryCodes(db: Db, userId: string, codeHashes: string[]) {
  return db.insert(mfaRecoveryCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
}

export function deleteRecoveryCodes(db: Db, userId: string) {
  return db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
}

/** Atomically marks one unused recovery code as used. Returns true on success. */
export async function redeemRecoveryCode(
  db: Db,
  userId: string,
  codeHash: string,
): Promise<boolean> {
  const rows = await db
    .update(mfaRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(mfaRecoveryCodes.userId, userId),
        eq(mfaRecoveryCodes.codeHash, codeHash),
        isNull(mfaRecoveryCodes.usedAt),
      ),
    )
    .returning({ id: mfaRecoveryCodes.id });
  return rows.length === 1;
}

export async function countUnusedRecoveryCodes(db: Db, userId: string): Promise<number> {
  const row = await db
    .select({ n: count() })
    .from(mfaRecoveryCodes)
    .where(and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)))
    .get();
  return row?.n ?? 0;
}

export async function isMfaEnabled(db: Db, userId: string): Promise<boolean> {
  const row = await db
    .select({ enabledAt: mfaTotp.enabledAt })
    .from(mfaTotp)
    .where(eq(mfaTotp.userId, userId))
    .get();
  return Boolean(row?.enabledAt);
}
