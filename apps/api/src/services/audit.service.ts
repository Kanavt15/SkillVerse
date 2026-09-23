/**
 * Writes to the append-only audit log (`audit_logs`).
 *
 * Record every security- or money-relevant event: sign-ins (success and
 * failure), password changes, role changes, refunds, payouts, admin edits.
 * `metadata` must never contain passwords, tokens or full payment details.
 */
import { schema, type Db } from '@skillverse/db';

export interface AuditEvent {
  action: string;
  actorUserId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
  requestId?: string;
}

/** Builds the insert without running it, so it can join a `db.batch([...])`. */
export function auditInsert(db: Db, event: AuditEvent) {
  return db.insert(schema.auditLogs).values({
    action: event.action,
    actorUserId: event.actorUserId ?? null,
    targetType: event.targetType ?? null,
    targetId: event.targetId ?? null,
    metadata: JSON.stringify(event.metadata ?? {}),
    ipHash: event.ipHash ?? null,
    requestId: event.requestId ?? null,
  });
}

export async function audit(db: Db, event: AuditEvent): Promise<void> {
  await auditInsert(db, event);
}
