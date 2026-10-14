/** Owner-only NDJSON export, keyset-paged into bounded parts. No security material or other users' records. */
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import { newId, type ExportView } from '@skillverse/shared';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { randomToken } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { ownerProof, ownerAuthority } from './privacy-proof.service';
const { privacyExports: jobs, privacyExportParts: parts, users, sessions } = schema;
const LIMIT = 20 * 1024 * 1024;
// Static SQL allowlist. Values from the browser never become identifiers or SQL text.
const resources = [
  [
    'account',
    'users t',
    't.id,t.email,t.username,t.display_name,t.email_verified_at,t.created_at',
    't.id',
  ],
  ['profile', 'user_profiles t', 't.*', 't.user_id'],
  [
    'agreements',
    'account_privacy t',
    't.birth_date,t.terms_version,t.privacy_version,t.instructor_version,t.agreed_at,t.external_media',
    't.user_id',
  ],
  ['roles', 'user_roles t', 't.role,t.created_at', 't.user_id'],
  ['sign_in_methods', 'oauth_accounts t', 't.provider', 't.user_id'],
  [
    'devices',
    'sessions t',
    't.handle,t.user_agent,t.created_at,t.last_seen_at,t.expires_at',
    't.user_id',
  ],
  [
    'instructor_application',
    'instructor_applications t',
    't.id,t.headline,t.topics,t.experience,t.sample_url,t.status,t.review_notes,t.created_at,t.reviewed_at',
    't.user_id',
  ],
  ['courses', 'courses t', 't.*', 't.instructor_id'],
  ['sections', 'sections t JOIN courses c ON c.id=t.course_id', 't.*', 'c.instructor_id'],
  ['lessons', 'lessons t JOIN courses c ON c.id=t.course_id', 't.*', 'c.instructor_id'],
  [
    'quizzes',
    'lesson_quizzes t JOIN lessons l ON l.id=t.lesson_id JOIN courses c ON c.id=l.course_id',
    't.*',
    'c.instructor_id',
  ],
  ['enrollments', 'enrollments t', 't.*', 't.user_id'],
  ['progress', 'lesson_progress t JOIN enrollments e ON e.id=t.enrollment_id', 't.*', 'e.user_id'],
  ['notes', 'notes t JOIN enrollments e ON e.id=t.enrollment_id', 't.*', 'e.user_id'],
  [
    'quiz_attempts',
    'quiz_attempts t JOIN enrollments e ON e.id=t.enrollment_id',
    't.*',
    'e.user_id',
  ],
  [
    'reviews',
    'reviews t',
    't.id,t.course_id,t.rating,t.body,t.hidden_at,t.created_at,t.updated_at',
    't.user_id',
  ],
  [
    'certificates',
    'certificates t JOIN enrollments e ON e.id=t.enrollment_id JOIN courses c ON c.id=e.course_id JOIN users author ON author.id=c.instructor_id',
    "t.serial,t.course_title,t.course_slug,t.learner_name,CASE WHEN author.status='deleted' THEN 'Former member' ELSE t.instructor_name END AS instructor_name,t.lesson_count,t.issued_at",
    'e.user_id',
  ],
  [
    'questions',
    'discussion_questions t',
    't.id,t.course_id,t.lesson_id,t.title,t.body,t.timestamp_seconds,t.created_at,t.updated_at,t.hidden_at',
    't.author_user_id',
  ],
  [
    'replies',
    'discussion_replies t',
    't.id,t.question_id,t.body,t.created_at,t.updated_at,t.hidden_at',
    't.author_user_id',
  ],
  [
    'reports',
    'content_reports t',
    't.id,t.target_type,t.target_id,t.reason,t.details,t.status,t.created_at',
    't.reporter_user_id',
  ],
  [
    'notifications',
    'notifications t',
    't.id,t.kind,t.title,t.message,t.href,t.read_at,t.created_at',
    't.user_id',
  ],
  ['notification_preferences', 'notification_preferences t', 't.discussions', 't.user_id'],
  [
    'guardian_consents',
    'guardian_requests t',
    't.id,t.scope,t.status,t.consent_version,t.created_at,t.reviewed_at',
    't.guardian_user_id',
  ],
  [
    'support',
    'support_requests t',
    't.id,t.subject,t.message,t.category,t.status,t.created_at,t.updated_at',
    'COALESCE(t.user_id,(SELECT id FROM users WHERE email=t.email AND email_verified_at IS NOT NULL))',
  ],
  [
    'support_replies',
    'support_replies t JOIN support_requests r ON r.id=t.request_id',
    't.id,t.request_id,t.body,t.created_at',
    'COALESCE(r.user_id,(SELECT id FROM users WHERE email=r.email AND email_verified_at IS NOT NULL))',
  ],
] as const;
function view(row: typeof jobs.$inferSelect, permitted: boolean): ExportView {
  return {
    id: row.id,
    state: row.state,
    bytes: row.bytes,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    canDownload: row.state === 'ready' && row.expiresAt.getTime() > Date.now() && permitted,
  };
}
const downloadAuthority = (auth: AuthContext, now: number) =>
  sql`EXISTS (SELECT 1 FROM ${sessions} JOIN ${users} ON ${users.id}=${sessions.userId} WHERE ${sessions.id}=${auth.session.tokenHash} AND ${sessions.userId}=${auth.user.id} AND ${users.status}='active' AND ${users.emailVerifiedAt} IS NOT NULL AND ${sessions.expiresAt}>${now} AND ${sessions.idleExpiresAt}>${now} AND ${sessions.privacyAccessUntil}>${now})`;
export async function list(d: RequestDeps, auth: AuthContext) {
  const rows = await d.db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, auth.user.id))
    .orderBy(desc(jobs.createdAt))
    .limit(10);
  const permitted = Boolean(
    (
      await d.db.get<{ permitted: number }>(
        sql`SELECT ${downloadAuthority(auth, Date.now())} AS permitted`,
      )
    )?.permitted,
  );
  const active = rows.find((row) => row.state === 'queued' || row.state === 'building');
  if (active) d.waitUntil(process(d, active.id, 8));
  return rows.map((row) => view(row, permitted));
}
export async function unlock(
  d: RequestDeps,
  auth: AuthContext,
  input: { password?: string; code?: string },
) {
  await ownerProof(d, auth, input);
}
export async function create(
  d: RequestDeps,
  auth: AuthContext,
  input: { password?: string; code?: string },
) {
  const proof = await ownerProof(d, auth, input),
    now = Date.now(),
    id = newId();
  const saved = await d.db
    .insert(jobs)
    .select(
      sql`SELECT ${id},${auth.user.id},'queued',0,'',0,0,NULL,0,NULL,${now + 86400000},${now},${now} WHERE ${ownerAuthority(auth, proof, now)} AND NOT EXISTS (SELECT 1 FROM ${jobs} WHERE user_id=${auth.user.id} AND state IN ('queued','building','ready') AND expires_at>${now}) AND (SELECT count(*) FROM ${jobs} WHERE user_id=${auth.user.id} AND created_at>${now - 86400000})<3`,
    )
    .returning({ id: jobs.id });
  if (!saved.length)
    throw new AppError(
      'CONFLICT',
      'An export already exists, or your security state changed. Up to three requests per day are allowed.',
    );
  d.waitUntil(process(d, id, 8));
  return { id };
}
export async function process(d: RequestDeps, id: string, pages = 8) {
  const now = Date.now(),
    lease = randomToken();
  const saved = await d.db
    .update(jobs)
    .set({ state: 'building', leaseNonce: lease, leaseUntil: now + 120000 })
    .where(
      sql`${jobs.id}=${id} AND ${jobs.state} IN ('queued','building') AND ${jobs.leaseUntil}<${now} AND ${jobs.expiresAt}>${now} AND EXISTS (SELECT 1 FROM ${users} WHERE id=${jobs.userId} AND status='active')`,
    )
    .returning();
  if (!saved[0]) return;
  let job: typeof jobs.$inferSelect = saved[0];
  try {
    for (let page = 0; page < pages && job.resourceIndex < resources.length; page++) {
      const [resource, from, fields, owner] = resources[job.resourceIndex]!;
      const rows = await d.db.all<Record<string, unknown>>(
        // eslint-disable-next-line no-restricted-syntax -- Static resource allowlist identifiers only; owner and cursor values remain bound.
        sql`SELECT t.rowid AS export_cursor,${sql.raw(fields)} FROM ${sql.raw(from)} WHERE ${sql.raw(owner)}=${job.userId} AND t.rowid>${Number(job.cursor || 0)} ORDER BY t.rowid LIMIT 10`,
      );
      const nextCursor = rows.length ? String(rows[rows.length - 1]!.export_cursor) : '';
      const body =
        rows
          .map(({ export_cursor: _cursor, ...record }) => JSON.stringify({ resource, record }))
          .join('\n') + (rows.length ? '\n' : '');
      const size = new TextEncoder().encode(body).byteLength;
      const guard = sql`EXISTS (SELECT 1 FROM ${jobs} JOIN ${users} ON ${users.id}=${jobs.userId} WHERE ${jobs.id}=${id} AND lease_nonce=${lease} AND state='building' AND lease_until>${Date.now()} AND ${users.status}='active')`;
      if (job.bytes + size > LIMIT) {
        await d.db.batch([
          d.db.delete(parts).where(and(eq(parts.exportId, id), guard)),
          d.db
            .update(jobs)
            .set({
              state: 'failed',
              error:
                'This export exceeds the 20 MB limit. Use Contact for a securely delivered larger copy.',
              leaseNonce: null,
              leaseUntil: 0,
              updatedAt: new Date(),
            })
            .where(and(eq(jobs.id, id), guard)),
        ]);
        return;
      }
      const exhausted = rows.length < 10,
        nextIndex = exhausted ? job.resourceIndex + 1 : job.resourceIndex;
      const result: [unknown, (typeof jobs.$inferSelect)[]] = await d.db.batch([
        d.db
          .insert(parts)
          .select(sql`SELECT ${id},${job.part},${body} WHERE ${guard} AND ${size}>0`),
        d.db
          .update(jobs)
          .set({
            resourceIndex: nextIndex,
            cursor: exhausted ? '' : nextCursor,
            part: job.part + (size ? 1 : 0),
            bytes: job.bytes + size,
            state: nextIndex === resources.length ? 'ready' : 'building',
            updatedAt: new Date(),
          })
          .where(and(eq(jobs.id, id), guard))
          .returning(),
      ]);
      if (!result[1][0]) return;
      job = result[1][0];
    }
    await d.db
      .update(jobs)
      .set({ leaseNonce: null, leaseUntil: 0 })
      .where(and(eq(jobs.id, id), eq(jobs.leaseNonce, lease)));
  } catch {
    await d.db.batch([
      d.db
        .delete(parts)
        .where(
          sql`${parts.exportId}=${id} AND EXISTS (SELECT 1 FROM ${jobs} WHERE id=${id} AND lease_nonce=${lease})`,
        ),
      d.db
        .update(jobs)
        .set({
          state: 'failed',
          error: 'The export could not be built. Try again or use Contact.',
          leaseNonce: null,
          leaseUntil: 0,
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, id), eq(jobs.leaseNonce, lease))),
    ]);
    d.log.error('privacy.export_failed', { exportId: id });
  }
}
export async function download(d: RequestDeps, auth: AuthContext, id: string) {
  const job = await d.db
    .select()
    .from(jobs)
    .where(
      sql`${jobs.id}=${id} AND ${jobs.userId}=${auth.user.id} AND ${jobs.state}='ready' AND ${jobs.expiresAt}>${Date.now()} AND ${downloadAuthority(auth, Date.now())}`,
    )
    .get();
  if (!job)
    throw new AppError(
      'NOT_FOUND',
      'Export unavailable. Confirm your security details again if needed.',
    );
  let part = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (part >= job.part) {
          controller.close();
          return;
        }
        const row = await d.db
          .select({ body: parts.body })
          .from(parts)
          .where(
            sql`${parts.exportId}=${id} AND ${parts.part}=${part} AND EXISTS (SELECT 1 FROM ${jobs} WHERE id=${id} AND user_id=${auth.user.id} AND state='ready' AND expires_at>${Date.now()}) AND ${downloadAuthority(auth, Date.now())}`,
          )
          .get();
        if (!row) {
          controller.error(new Error('Export access expired.'));
          return;
        }
        controller.enqueue(new TextEncoder().encode(row.body));
        part++;
      } catch {
        controller.error(new Error('Export could not be downloaded.'));
      }
    },
  });
}
export async function maintain(d: RequestDeps) {
  const now = Date.now();
  await d.db.batch([
    d.db
      .delete(parts)
      .where(sql`${parts.exportId} IN (SELECT id FROM ${jobs} WHERE expires_at<=${now} LIMIT 50)`),
    d.db
      .update(jobs)
      .set({ state: 'expired', leaseNonce: null, leaseUntil: 0, updatedAt: new Date(now) })
      .where(
        sql`${jobs.id} IN (SELECT id FROM ${jobs} WHERE expires_at<=${now} AND state NOT IN ('expired','cancelled') LIMIT 50)`,
      ),
    d.db
      .delete(jobs)
      .where(
        sql`${jobs.id} IN (SELECT id FROM ${jobs} WHERE expires_at<${now - 7 * 86400000} LIMIT 50)`,
      ),
  ]);
  const queue = await d.db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      sql`${jobs.state} IN ('queued','building') AND ${jobs.leaseUntil}<${now} AND ${jobs.expiresAt}>${now}`,
    )
    .limit(1);
  for (const job of queue) await process(d, job.id, 2);
}
