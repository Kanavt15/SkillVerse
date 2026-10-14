/** Private tickets, verified guest email, versioned staff decisions and durable bounded mail delivery. */
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import {
  newId,
  type SupportRequest,
  type SupportReply,
  type SupportView,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { randomToken, sha256Hex } from '../lib/crypto';
import { sendEmail } from './email.service';
const {
  supportRequests: tickets,
  supportReplies: replies,
  auditLogs,
  users,
  userRoles,
  sessions,
} = schema;
function staff(auth: AuthContext) {
  if (!auth.roles.some((role) => role === 'admin' || role === 'super_admin'))
    throw new AppError('FORBIDDEN', 'Administrator access required.');
}
const live = (auth: AuthContext, now: number) =>
  sql`EXISTS (SELECT 1 FROM ${sessions} JOIN ${users} ON ${users.id}=${sessions.userId} WHERE ${sessions.id}=${auth.session.tokenHash} AND ${sessions.userId}=${auth.user.id} AND ${users.status}='active' AND ${sessions.expiresAt}>${now} AND ${sessions.idleExpiresAt}>${now})`;
export async function create(d: RequestDeps, auth: AuthContext | null, input: SupportRequest) {
  if (input.website) return;
  if (!auth && !input.adultOrGuardian)
    throw new AppError(
      'VALIDATION_FAILED',
      'A parent or guardian must submit the Contact form for a visitor under 18.',
    );
  if (auth && !auth.user.emailVerified)
    throw new AppError(
      'EMAIL_NOT_VERIFIED',
      'Verify your account email before sending a private request.',
    );
  const email = auth?.user.email ?? input.email,
    now = Date.now(),
    id = newId(),
    token = randomToken();
  const saved = await d.db
    .insert(tickets)
    .select(
      sql`SELECT ${id},${auth?.user.id ?? null},${email},${input.subject},${input.message},${input.category},${auth ? 'open' : 'unverified'},${auth ? null : await sha256Hex(token)},${auth ? null : now + 72 * 3600000},${auth ? now : null},0,NULL,${now},${now} WHERE NOT EXISTS (SELECT 1 FROM ${tickets} WHERE email=${email} AND created_at>${now - 60000}) AND (SELECT count(*) FROM ${tickets} WHERE email=${email} AND created_at>${now - 86400000})<5 AND ${auth ? live(auth, now) : sql`1=1`}`,
    )
    .returning({ id: tickets.id });
  // Generic receipt prevents email enumeration. Only verified tickets enter the staff queue.
  if (!saved.length) return;
  if (!auth)
    d.waitUntil(
      sendEmail(d.env, d.log, {
        to: email,
        subject: 'Confirm your SkillVerse Contact request',
        text: `Confirm this private request within 72 hours:\n${appBaseUrl(d.env)}/contact/confirm?token=${token}\n\nIf you did not request this, ignore this email. Please do not send identity documents or passwords through Contact.`,
      }),
    );
}
export async function confirm(d: RequestDeps, token: string) {
  const now = Date.now();
  const saved = await d.db
    .update(tickets)
    .set({
      status: 'open',
      verifiedAt: new Date(now),
      verificationHash: null,
      verificationExpiresAt: null,
      version: sql`${tickets.version}+1`,
      updatedAt: new Date(now),
    })
    .where(
      and(
        eq(tickets.verificationHash, await sha256Hex(token)),
        eq(tickets.status, 'unverified'),
        sql`${tickets.verificationExpiresAt}>${now}`,
      ),
    )
    .returning({ id: tickets.id });
  if (!saved.length)
    throw new AppError(
      'VALIDATION_FAILED',
      'That confirmation link is invalid, expired or already used.',
    );
}
export async function list(
  d: RequestDeps,
  auth: AuthContext,
  admin = false,
  page = 1,
): Promise<SupportView[]> {
  if (admin) staff(auth);
  const rows = await d.db
    .select()
    .from(tickets)
    .where(
      admin
        ? sql`${tickets.status} IN ('open','resolved')`
        : sql`(${tickets.userId}=${auth.user.id} OR (${auth.user.emailVerified ? 1 : 0}=1 AND ${tickets.email}=${auth.user.email})) AND ${tickets.status} IN ('open','resolved')`,
    )
    .orderBy(desc(tickets.createdAt), desc(tickets.id))
    .limit(20)
    .offset((page - 1) * 20);
  const result: SupportView[] = [];
  for (const row of rows) {
    const thread = await d.db
      .select()
      .from(replies)
      .where(eq(replies.requestId, row.id))
      .orderBy(desc(replies.createdAt))
      .limit(20);
    result.push({
      id: row.id,
      email: row.email,
      subject: row.subject,
      message: row.message,
      category: row.category,
      status: row.status,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      replies: thread.map((reply) => ({
        id: reply.id,
        body: reply.body,
        deliveryState: reply.deliveryState,
        attempts: reply.attempts,
        createdAt: reply.createdAt.toISOString(),
      })),
    });
  }
  return result;
}
export async function reply(d: RequestDeps, auth: AuthContext, id: string, input: SupportReply) {
  staff(auth);
  const now = Date.now(),
    receipt = newId(),
    replyId = newId(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id=${receipt})`;
  const result = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt},${auth.user.id},'admin.support_replied','support',${id},${JSON.stringify({ resolved: input.resolve })},NULL,${d.requestId},${now} FROM ${tickets} WHERE id=${id} AND version=${input.version} AND status IN ('open','resolved') AND ${live(auth, now)} AND EXISTS (SELECT 1 FROM ${userRoles} WHERE user_id=${auth.user.id} AND role IN ('admin','super_admin')) AND (SELECT count(*) FROM ${replies} WHERE request_id=${id})<20`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .insert(replies)
      .select(
        sql`SELECT ${replyId},${id},${auth.user.id},${input.reply},'pending',0,${now},${now},${now} WHERE ${guard}`,
      ),
    d.db
      .update(tickets)
      .set({
        status: input.resolve ? 'resolved' : 'open',
        resolvedAt: input.resolve ? new Date(now) : null,
        version: sql`${tickets.version}+1`,
        updatedAt: new Date(now),
      })
      .where(and(eq(tickets.id, id), guard)),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'The ticket or your staff authority changed. Refresh before replying. A thread allows up to 20 staff replies.',
    );
  d.waitUntil(deliver(d));
}
export async function deliver(d: RequestDeps) {
  const now = Date.now();
  const queue = await d.db
    .select({ reply: replies, email: tickets.email, status: tickets.status })
    .from(replies)
    .innerJoin(tickets, eq(tickets.id, replies.requestId))
    .where(
      sql`${replies.deliveryState} IN ('pending','delivering') AND ${replies.attempts}<3 AND ${replies.nextAttemptAt}<=${now} AND ${tickets.status} IN ('open','resolved')`,
    )
    .limit(3);
  for (const { reply, email } of queue) {
    const saved = await d.db
      .update(replies)
      .set({
        deliveryState: 'delivering',
        attempts: reply.attempts + 1,
        nextAttemptAt: now + 120000,
        updatedAt: new Date(now),
      })
      .where(
        and(
          eq(replies.id, reply.id),
          eq(replies.attempts, reply.attempts),
          sql`${replies.nextAttemptAt}<=${now} AND ${replies.deliveryState} IN ('pending','delivering') AND EXISTS (SELECT 1 FROM ${tickets} WHERE id=${reply.requestId} AND status IN ('open','resolved') AND email=${email})`,
        ),
      )
      .returning({ id: replies.id });
    if (!saved.length) continue;
    const delivered = await sendEmail(d.env, d.log, {
      to: email,
      subject: 'Reply to your SkillVerse Contact request',
      text: `Private request ${reply.requestId}\n\n${reply.body}\n\nFor a follow-up, submit Contact and include this request reference. Do not send passwords or identity documents.`,
      idempotencyKey: `support-${reply.id}`,
    });
    await d.db
      .update(replies)
      .set({
        deliveryState: delivered ? 'delivered' : reply.attempts + 1 >= 3 ? 'failed' : 'pending',
        nextAttemptAt: Date.now() + 60000 * (reply.attempts + 1),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(replies.id, reply.id),
          eq(replies.attempts, reply.attempts + 1),
          eq(replies.deliveryState, 'delivering'),
        ),
      );
  }
  await d.db
    .update(replies)
    .set({ deliveryState: 'failed', updatedAt: new Date() })
    .where(
      sql`${replies.deliveryState}='delivering' AND ${replies.attempts}>=3 AND ${replies.nextAttemptAt}<${Date.now()}`,
    );
}
export async function maintain(d: RequestDeps) {
  const now = Date.now();
  const expired = sql`SELECT id FROM ${tickets} WHERE (status='unverified' AND verification_expires_at<${now}) OR (status='resolved' AND resolved_at<${now - 90 * 86400000}) LIMIT 50`;
  await d.db.batch([
    d.db.delete(replies).where(sql`${replies.requestId} IN (${expired})`),
    d.db.delete(tickets).where(sql`${tickets.id} IN (${expired})`),
  ]);
  await deliver(d);
}
