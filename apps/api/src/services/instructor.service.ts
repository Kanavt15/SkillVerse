/**
 * Becoming an instructor: apply → staff review → approval grants the
 * `instructor` role (or rejection with feedback; the person may apply again).
 */
import { schema } from '@skillverse/db';
import type { InstructorApplicationInput } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { instructorDecisionTemplate } from '../lib/email-templates';
import { AppError } from '../lib/errors';
import {
  decideApplication,
  findApplication,
  latestApplication,
  listApplications,
  type ApplicationStatus,
} from '../repositories/instructor-applications.repository';
import { findUserById } from '../repositories/users.repository';
import { auditInsert } from './audit.service';
import { sendEmail } from './email.service';

function parseTopics(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function toDto(row: NonNullable<Awaited<ReturnType<typeof latestApplication>>>) {
  return {
    id: row.id,
    status: row.status,
    headline: row.headline,
    topics: parseTopics(row.topics),
    experience: row.experience,
    sampleUrl: row.sampleUrl,
    reviewNotes: row.reviewNotes,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function getMyApplication(d: RequestDeps, auth: AuthContext) {
  const row = await latestApplication(d.db, auth.user.id);
  return row ? toDto(row) : null;
}

export async function apply(d: RequestDeps, auth: AuthContext, input: InstructorApplicationInput) {
  if (auth.roles.includes('instructor')) {
    throw new AppError('CONFLICT', 'You can already teach. Head to the Studio to create a course.');
  }
  const latest = await latestApplication(d.db, auth.user.id);
  if (latest?.status === 'pending') {
    throw new AppError('CONFLICT', 'Your application is already being reviewed.');
  }
  const [row] = await d.db
    .insert(schema.instructorApplications)
    .values({
      userId: auth.user.id,
      headline: input.headline,
      topics: JSON.stringify([...new Set(input.topics)]),
      experience: input.experience,
      sampleUrl: input.sampleUrl || null,
    })
    .returning();
  await auditInsert(d.db, {
    action: 'instructor.applied',
    actorUserId: auth.user.id,
    targetType: 'instructor_application',
    targetId: row!.id,
    requestId: d.requestId,
  });
  return toDto(row!);
}

export async function listForReview(d: RequestDeps, status: ApplicationStatus) {
  const rows = await listApplications(d.db, status);
  return rows.map((r) => ({
    ...r,
    topics: parseTopics(r.topics),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function decide(
  d: RequestDeps,
  reviewer: AuthContext,
  id: string,
  decision: 'approved' | 'rejected',
  notes: string | null,
) {
  const application = await findApplication(d.db, id);
  if (!application) throw new AppError('NOT_FOUND', 'Application not found.');
  if (application.userId === reviewer.user.id) {
    // Separation of duties: nobody approves their own application.
    throw new AppError('FORBIDDEN', "You can't review your own application.");
  }

  const updated = await decideApplication(d.db, id, {
    status: decision,
    reviewerId: reviewer.user.id,
    reviewNotes: notes,
  });
  if (updated.length === 0)
    throw new AppError('CONFLICT', 'This application was already reviewed.');

  const applicantId = application.userId;
  await d.db.batch([
    auditInsert(d.db, {
      action: decision === 'approved' ? 'instructor.approved' : 'instructor.rejected',
      actorUserId: reviewer.user.id,
      targetType: 'user',
      targetId: applicantId,
      metadata: { applicationId: id },
      requestId: d.requestId,
    }),
    ...(decision === 'approved'
      ? [
          d.db
            .insert(schema.userRoles)
            .values({ userId: applicantId, role: 'instructor', grantedBy: reviewer.user.id })
            .onConflictDoNothing(),
        ]
      : []),
  ]);

  const applicant = await findUserById(d.db, applicantId);
  if (applicant) {
    d.waitUntil(
      sendEmail(
        d.env,
        d.log,
        instructorDecisionTemplate(
          applicant.email,
          applicant.displayName,
          decision === 'approved',
          notes,
          `${appBaseUrl(d.env)}/studio`,
        ),
      ),
    );
  }
}
