/** Staff operations contracts; account writes accept only explicitly supported decisions. */
import { z } from 'zod';
import { ROLES } from '../constants';
import { COURSE_STATUSES } from './catalog';
import { idSchema } from './common';

export const adminUserQuerySchema = z.strictObject({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'active', 'suspended', 'deleted']).default('all'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const adminUserDecisionSchema = z.strictObject({
  decision: z.enum(['suspend', 'reactivate', 'revoke_sessions']),
  version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  notes: z.string().trim().min(10, 'Explain the decision in at least 10 characters.').max(2000),
});
export const adminUserSchema = z.object({
  id: idSchema,
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  status: z.enum(['active', 'suspended', 'deleted']),
  emailVerified: z.boolean(),
  roles: z.array(z.enum(ROLES)),
  createdAt: z.string(),
  version: z.number().int(),
});
export const adminUserListSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number().int(),
  page: z.number().int(),
  totalPages: z.number().int(),
});
export const adminUserDetailSchema = z.object({
  user: adminUserSchema,
  canManage: z.boolean(),
  mfaEnabled: z.boolean(),
  activeSessions: z.number().int(),
  enrollments: z.number().int(),
  authoredCourses: z.number().int(),
  history: z.array(
    z.object({
      id: idSchema,
      action: z.string(),
      actorName: z.string().nullable(),
      createdAt: z.string(),
      notes: z.string(),
    }),
  ),
});
const queueSchema = z.object({ count: z.number().int(), oldestAt: z.string().nullable() });
export const adminOverviewSchema = z.object({
  measuredAt: z.string(),
  users: z.object({
    active: z.number().int(),
    suspended: z.number().int(),
    deleted: z.number().int(),
  }),
  activeInstructors: z.number().int(),
  publishedCourses: z.number().int(),
  enrollments: z.number().int(),
  completedEnrollments: z.number().int(),
  queues: z.object({ applications: queueSchema, courses: queueSchema, reports: queueSchema }),
});
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminUserDecision = z.infer<typeof adminUserDecisionSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUserList = z.infer<typeof adminUserListSchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

/** Staff catalog covers every lifecycle state; search has no wildcard syntax. */
export const adminCourseQuerySchema = z.strictObject({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['all', ...COURSE_STATUSES]).default('all'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export const adminCourseArchiveSchema = z.strictObject({
  notes: z.string().trim().min(10, 'Explain the decision in at least 10 characters.').max(2000),
});
export const adminCourseListSchema = z.object({
  items: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      status: z.enum(COURSE_STATUSES),
      enrollmentCount: z.number().int(),
      updatedAt: z.string(),
      instructor: z.object({ id: idSchema, displayName: z.string(), username: z.string() }),
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  totalPages: z.number().int(),
});
export type AdminCourseQuery = z.infer<typeof adminCourseQuerySchema>;
export type AdminCourseList = z.infer<typeof adminCourseListSchema>;
