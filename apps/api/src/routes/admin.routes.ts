/**
 * /api/v1/admin/*: staff-only review queues (instructor applications, courses).
 *
 * Access: signed in + role admin/super_admin/moderator + 2FA (requireMfa;
 * relaxed only where ENFORCE_ADMIN_MFA="off", i.e. local development).
 * In production, Cloudflare Access additionally protects the /admin pages.
 */
import { createRoute, z } from '@hono/zod-openapi';
import {
  approveSchema,
  idSchema,
  rejectSchema,
  STAFF_ROLES,
  APPLICATION_STATUSES,
  adminOverviewSchema,
  adminUserQuerySchema,
  adminUserListSchema,
  adminUserDetailSchema,
  adminUserDecisionSchema,
  adminCourseQuerySchema,
  adminCourseListSchema,
  adminCourseArchiveSchema,
} from '@skillverse/shared';
import { depsFrom } from '../lib/deps';
import {
  createRouter,
  errors,
  jsonBody,
  jsonResponse,
  MessageSchema,
  sessionSecurity,
  success,
} from '../lib/openapi';
import { requireMfa, requireRole } from '../middleware/auth';
import * as reviews from '../services/course-review.service';
import * as instructor from '../services/instructor.service';
import * as operations from '../services/admin.service';
import * as moderation from '../services/course-moderation.service';
import {
  ApplicationForReviewSchema,
  CourseInspectionSchema,
  ReviewQueueItemSchema,
} from './catalog-schemas';

const tags = ['Admin'];
const security = sessionSecurity;
const r = <T extends Parameters<typeof createRoute>[0]>(def: T) =>
  createRoute({ tags, security, ...def });
const applicationParam = { params: z.object({ applicationId: idSchema }) };
const courseParam = { params: z.object({ courseId: idSchema }) };
const decisionResponses = {
  200: jsonResponse('Done', success(MessageSchema)),
  ...errors(400, 401, 403, 404, 409),
};

const listApplications = r({
  method: 'get',
  path: '/admin/instructor-applications',
  summary: 'Instructor applications by status (oldest first)',
  request: {
    query: z.object({ status: z.enum(APPLICATION_STATUSES).default('pending') }),
  },
  responses: {
    200: jsonResponse('OK', success(z.array(ApplicationForReviewSchema))),
    ...errors(401, 403),
  },
});
const overview = r({
  method: 'get',
  path: '/admin/overview',
  summary: 'Current database totals and oldest pending work (staff + MFA)',
  responses: { 200: jsonResponse('OK', success(adminOverviewSchema)), ...errors(401, 403) },
});
const userList = r({
  method: 'get',
  path: '/admin/users',
  summary: 'Search account identities, newest first, 20 per page (admins + MFA)',
  request: { query: adminUserQuerySchema },
  responses: { 200: jsonResponse('OK', success(adminUserListSchema)), ...errors(400, 401, 403) },
});
const userDetail = r({
  method: 'get',
  path: '/admin/users/{userId}',
  summary: 'Account status, security indicators and last 20 account decisions (admins + MFA)',
  request: { params: z.object({ userId: idSchema }) },
  responses: {
    200: jsonResponse('OK', success(adminUserDetailSchema)),
    ...errors(400, 401, 403, 404),
  },
});
const userDecision = r({
  method: 'post',
  path: '/admin/users/{userId}',
  summary:
    'Suspend, reactivate or revoke sessions with a reason and matching version; staff/self/deleted protected',
  request: { params: z.object({ userId: idSchema }), body: jsonBody(adminUserDecisionSchema) },
  responses: decisionResponses,
});
const approveApplication = r({
  method: 'post',
  path: '/admin/instructor-applications/{applicationId}/approve',
  summary: 'Approve: grants the instructor role and emails the applicant',
  request: { ...applicationParam, body: jsonBody(approveSchema) },
  responses: decisionResponses,
});
const rejectApplication = r({
  method: 'post',
  path: '/admin/instructor-applications/{applicationId}/reject',
  summary: 'Reject with feedback (the applicant may apply again)',
  request: { ...applicationParam, body: jsonBody(rejectSchema) },
  responses: decisionResponses,
});
const courseQueue = r({
  method: 'get',
  path: '/admin/course-reviews',
  summary: 'Courses waiting for review (oldest submission first)',
  responses: {
    200: jsonResponse('OK', success(z.array(ReviewQueueItemSchema))),
    ...errors(401, 403),
  },
});
const courseList = r({
  method: 'get',
  path: '/admin/courses',
  summary: 'Search all course states by title, slug or instructor, 20 per page (staff + MFA)',
  request: { query: adminCourseQuerySchema },
  responses: { 200: jsonResponse('OK', success(adminCourseListSchema)), ...errors(400, 401, 403) },
});
const archiveCourse = r({
  method: 'post',
  path: '/admin/courses/{courseId}/archive',
  summary:
    'Archive another instructor’s published course with a reason; existing learners keep access',
  request: { ...courseParam, body: jsonBody(adminCourseArchiveSchema) },
  responses: decisionResponses,
});
const inspectCourse = r({
  method: 'get',
  path: '/admin/course-reviews/{courseId}',
  summary: 'A submission with its curriculum, checklist and history',
  request: courseParam,
  responses: { 200: jsonResponse('OK', success(CourseInspectionSchema)), ...errors(401, 403, 404) },
});
const approveCourse = r({
  method: 'post',
  path: '/admin/course-reviews/{courseId}/approve',
  summary: 'Publish the course',
  request: { ...courseParam, body: jsonBody(approveSchema) },
  responses: decisionResponses,
});
const rejectCourse = r({
  method: 'post',
  path: '/admin/course-reviews/{courseId}/reject',
  summary: 'Send the course back with feedback',
  request: { ...courseParam, body: jsonBody(rejectSchema) },
  responses: decisionResponses,
});

const router = createRouter();
router.use('/admin/*', requireRole(...STAFF_ROLES), requireMfa);
router.use('/admin/users', requireRole('admin', 'super_admin'));
router.use('/admin/users/*', requireRole('admin', 'super_admin'));

const done = (message: string) => ({ ok: true as const, data: { message } });

export const adminRoutes = router
  .openapi(overview, async (c) =>
    c.json(
      { ok: true as const, data: await operations.overview(depsFrom(c), c.get('auth')!) },
      200,
    ),
  )
  .openapi(userList, async (c) =>
    c.json(
      {
        ok: true as const,
        data: await operations.listUsers(depsFrom(c), c.get('auth')!, c.req.valid('query')),
      },
      200,
    ),
  )
  .openapi(userDetail, async (c) =>
    c.json(
      {
        ok: true as const,
        data: await operations.inspectUser(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').userId,
        ),
      },
      200,
    ),
  )
  .openapi(userDecision, async (c) => {
    await operations.decideUser(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('param').userId,
      c.req.valid('json'),
    );
    return c.json(done('Account decision saved. All previous sessions were revoked.'), 200);
  })
  .openapi(listApplications, async (c) =>
    c.json(
      {
        ok: true as const,
        data: await instructor.listForReview(depsFrom(c), c.req.valid('query').status),
      },
      200,
    ),
  )
  .openapi(approveApplication, async (c) => {
    const { applicationId } = c.req.valid('param');
    await instructor.decide(
      depsFrom(c),
      c.get('auth')!,
      applicationId,
      'approved',
      c.req.valid('json').notes || null,
    );
    return c.json(done('Application approved.'), 200);
  })
  .openapi(rejectApplication, async (c) => {
    const { applicationId } = c.req.valid('param');
    await instructor.decide(
      depsFrom(c),
      c.get('auth')!,
      applicationId,
      'rejected',
      c.req.valid('json').notes,
    );
    return c.json(done('Application rejected.'), 200);
  })
  .openapi(courseQueue, async (c) =>
    c.json({ ok: true as const, data: await reviews.queue(depsFrom(c), c.get('auth')!) }, 200),
  )
  .openapi(courseList, async (c) =>
    c.json(
      {
        ok: true as const,
        data: await moderation.listCourses(depsFrom(c), c.get('auth')!, c.req.valid('query')),
      },
      200,
    ),
  )
  .openapi(archiveCourse, async (c) => {
    await moderation.archive(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('param').courseId,
      c.req.valid('json').notes,
    );
    return c.json(
      done('Course archived. Existing learners keep access; the instructor has been notified.'),
      200,
    );
  })
  .openapi(inspectCourse, async (c) =>
    c.json(
      {
        ok: true as const,
        data: await reviews.inspect(depsFrom(c), c.get('auth')!, c.req.valid('param').courseId),
      },
      200,
    ),
  )
  .openapi(approveCourse, async (c) => {
    await reviews.decide(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('param').courseId,
      'approved',
      c.req.valid('json').notes || null,
    );
    return c.json(done('Course published.'), 200);
  })
  .openapi(rejectCourse, async (c) => {
    await reviews.decide(
      depsFrom(c),
      c.get('auth')!,
      c.req.valid('param').courseId,
      'rejected',
      c.req.valid('json').notes,
    );
    return c.json(done('Course sent back to the instructor.'), 200);
  });
