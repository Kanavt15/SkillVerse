/** Admin account operations: explicit projection, resource policy and explainable audited decisions. */
import {
  type AdminUser,
  type AdminUserDecision,
  type AdminUserQuery,
  type Role,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { canManageUser, canManageUsers, isStaff } from '../policies';
import * as repository from '../repositories/admin.repository';

function authorize(auth: AuthContext) {
  if (!canManageUsers(auth)) throw new AppError('FORBIDDEN', 'Only admins can manage accounts.');
}
type UserRow = NonNullable<Awaited<ReturnType<typeof repository.findUser>>>;
function userView(
  row: Pick<
    UserRow,
    | 'id'
    | 'email'
    | 'username'
    | 'displayName'
    | 'status'
    | 'emailVerifiedAt'
    | 'createdAt'
    | 'adminVersion'
    | 'rolesJson'
  >,
): AdminUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    status: row.status,
    emailVerified: row.emailVerifiedAt !== null,
    roles: [...new Set<Role>(['learner', ...(JSON.parse(row.rolesJson) as Role[])])],
    createdAt: row.createdAt.toISOString(),
    version: row.adminVersion,
  };
}
/** Admin-only bounded identity search with the same snapshot for rows and count. */
export async function listUsers(d: RequestDeps, auth: AuthContext, query: AdminUserQuery) {
  authorize(auth);
  const [rows, counts] = await repository.listUsers(d.db, query),
    total = counts[0]?.total ?? 0;
  return {
    items: rows.map(userView),
    total,
    page: query.page,
    totalPages: Math.max(1, Math.ceil(total / repository.ADMIN_USER_PAGE_SIZE)),
  };
}
/** Projects safe account fields and protected-action availability after an admin policy check. */
export async function inspectUser(d: RequestDeps, auth: AuthContext, userId: string) {
  authorize(auth);
  const row = await repository.findUser(d.db, userId, Date.now());
  if (!row) throw new AppError('NOT_FOUND', 'Account not found.');
  const user = userView(row),
    history = await repository.userHistory(d.db, userId);
  return {
    user,
    canManage: canManageUser(auth, user),
    mfaEnabled: Boolean(row.mfaEnabled),
    activeSessions: row.activeSessions,
    enrollments: row.enrollments,
    authoredCourses: row.authoredCourses,
    history: history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorName: entry.actorName,
      createdAt: entry.createdAt.toISOString(),
      notes: String(JSON.parse(entry.metadata).notes ?? ''),
    })),
  };
}
/** Authorizes the target, then delegates the concurrency/authority recheck to one atomic batch. */
export async function decideUser(
  d: RequestDeps,
  auth: AuthContext,
  userId: string,
  input: AdminUserDecision,
) {
  authorize(auth);
  const row = await repository.findUser(d.db, userId, Date.now());
  if (!row) throw new AppError('NOT_FOUND', 'Account not found.');
  if (!canManageUser(auth, userView(row)))
    throw new AppError('FORBIDDEN', 'Staff, your own account and deleted accounts are protected.');
  if (
    !(await repository.decideUser(d.db, auth.user.id, userId, d.requestId, input, {
      tokenHash: auth.session.tokenHash,
      requireMfa: d.env.ENFORCE_ADMIN_MFA !== 'off',
    }))
  )
    throw new AppError(
      'CONFLICT',
      'This account changed or the decision no longer applies. Refresh and review it again.',
    );
}
/** Staff-visible current totals; no account identities or estimated analytics. */
export async function overview(d: RequestDeps, auth: AuthContext) {
  if (!isStaff(auth)) throw new AppError('FORBIDDEN', 'Staff access required.');
  const [users, instructors, courses, learning, applications, review, reports] =
    await repository.overview(d.db);
  const count = (status: string) => users.find((row) => row.status === status)?.count ?? 0;
  const queue = (row: { count: number; oldestAt: number | null } | undefined) => ({
    count: row?.count ?? 0,
    oldestAt:
      row?.oldestAt === null || row?.oldestAt === undefined
        ? null
        : new Date(row.oldestAt).toISOString(),
  });
  return {
    measuredAt: new Date().toISOString(),
    users: { active: count('active'), suspended: count('suspended'), deleted: count('deleted') },
    activeInstructors: instructors[0]?.count ?? 0,
    publishedCourses: courses[0]?.count ?? 0,
    enrollments: learning[0]?.count ?? 0,
    completedEnrollments: learning[0]?.completed ?? 0,
    queues: {
      applications: queue(applications[0]),
      courses: queue(review[0]),
      reports: queue(reports[0]),
    },
  };
}
