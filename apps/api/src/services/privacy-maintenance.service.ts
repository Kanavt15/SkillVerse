import { revokePending as revokeTeacher } from './teacher-verification.service';
/** Runs on both Worker cron and Render's existing maintenance timer, regardless of telemetry setting. */
import { createDb, schema } from '@skillverse/db';
import { sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger';
import type { RequestDeps } from '../lib/deps';
import * as exports from './privacy-export.service';
import * as support from './support.service';
import { revokePending } from './setu.service';
export async function runPrivacyMaintenance(env: Env) {
  const d: RequestDeps = {
    db: createDb(env.DB),
    env,
    log: createLogger({ source: 'privacy-maintenance' }),
    requestId: crypto.randomUUID(),
    ip: '',
    userAgent: undefined,
    waitUntil: () => undefined,
  };
  try {
    await exports.maintain(d);
    await support.maintain(d);
    await revokePending(d);
    await revokeTeacher(d);
    const now = Date.now(),
      { guardianInvitations: i, sessions: s } = schema;
    await d.db.batch([
      d.db.delete(i).where(sql`${i.id} IN (SELECT id FROM ${i} WHERE expires_at<${now} LIMIT 100)`),
      d.db
        .update(s)
        .set({ privacyAccessUntil: null })
        .where(sql`${s.id} IN (SELECT id FROM ${s} WHERE privacy_access_until<${now} LIMIT 100)`),
    ]);
  } catch {
    d.log.error('privacy.maintenance_failed');
  }
}
