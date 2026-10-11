/**
 * Becoming an instructor: apply → staff review → approval grants the
 * `instructor` role (or rejection with feedback; the person may apply again).
 */
import type { InstructorApplicationInput } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { instructorDecisionTemplate } from '../lib/email-templates';
import { AppError } from '../lib/errors';
import {
  insertApplication,
  transitionApplication,
  findApplication,
  latestApplication,
  listApplications,
  myApplications,
  type ApplicationStatus,
} from '../repositories/instructor-applications.repository';
import { findUserById } from '../repositories/users.repository';
import { isStaff } from '../policies';
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
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
  };
}

export async function getMyApplication(d: RequestDeps, auth: AuthContext) {
  const row = await latestApplication(d.db, auth.user.id);
  return row ? toDto(row) : null;
}

/** Only the signed-in applicant's most recent 20 submissions, including older decisions. */
export async function getMyHistory(d: RequestDeps, auth: AuthContext) {
  return (await myApplications(d.db, auth.user.id)).map(toDto);
}

/** An applicant can withdraw only their own pending submission; terminal decisions cannot be reopened. */
export async function withdraw(d: RequestDeps, auth: AuthContext, id: string) {
  const application = await findApplication(d.db, id);
  if (!application || application.userId !== auth.user.id)
    throw new AppError('NOT_FOUND', 'Application not found.');
  if (
    !(await transitionApplication(
      d.db,
      id,
      auth.user.id,
      auth.user.id,
      'withdrawn',
      null,
      d.requestId,
      { tokenHash: auth.session.tokenHash, requireMfa: false },
    ))
  ) {
    throw new AppError(
      'CONFLICT',
      'This application is no longer pending or your access changed. Refresh and check its status.',
    );
  }
  return toDto((await findApplication(d.db, id))!);
}

export async function apply(d: RequestDeps, auth: AuthContext, input: InstructorApplicationInput) {
  if (auth.roles.includes('instructor')) {
    throw new AppError('CONFLICT', 'You can already teach. Head to the Studio to create a course.');
  }
  const latest = await latestApplication(d.db, auth.user.id);
  if (latest?.status === 'pending') {
    throw new AppError('CONFLICT', 'Your application is already being reviewed.');
  }
  const row = await insertApplication(d.db, auth.user.id, input, d.requestId, {
    tokenHash: auth.session.tokenHash,
    requireMfa: false,
  });
  if (!row)
    throw new AppError(
      'CONFLICT',
      'Your application or account access changed. Refresh and check before submitting again.',
    );
  return toDto(row);
}

export async function listForReview(d: RequestDeps, status: ApplicationStatus) {
  const rows = await listApplications(d.db, status);
  return rows.map((r) => ({
    ...r,
    topics: parseTopics(r.topics),
    createdAt: r.createdAt.toISOString(),
    withdrawnAt: r.withdrawnAt?.toISOString() ?? null,
  }));
}

export async function decide(
  d: RequestDeps,
  reviewer: AuthContext,
  id: string,
  decision: 'approved' | 'rejected',
  notes: string | null,
) {
  if (!isStaff(reviewer)) throw new AppError('FORBIDDEN', 'Staff access required.');
  const application = await findApplication(d.db, id);
  if (!application) throw new AppError('NOT_FOUND', 'Application not found.');
  if (application.userId === reviewer.user.id) {
    // Separation of duties: nobody approves their own application.
    throw new AppError('FORBIDDEN', "You can't review your own application.");
  }

  const applicantId = application.userId;
  if (
    !(await transitionApplication(
      d.db,
      id,
      applicantId,
      reviewer.user.id,
      decision,
      notes,
      d.requestId,
      { tokenHash: reviewer.session.tokenHash, requireMfa: d.env.ENFORCE_ADMIN_MFA !== 'off' },
    ))
  ) {
    throw new AppError(
      'CONFLICT',
      'This application is no longer pending or account access changed. Refresh and review it again.',
    );
  }

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
