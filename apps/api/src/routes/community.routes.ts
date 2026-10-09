/** Authenticated course discussions and separately gated staff moderation endpoints. */
import { createRoute, z } from '@hono/zod-openapi';
import {
  courseSlugParams,
  idSchema,
  moderationDetailSchema,
  moderationListSchema,
  moderationSchema,
  questionDetailSchema,
  questionListSchema,
  questionParams,
  questionQuerySchema,
  questionSchema,
  replySchema,
  reportQuerySchema,
  reportSchema,
  solutionSchema,
  STAFF_ROLES,
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
import { requireAuth, requireMfa, requireRole } from '../middleware/auth';
import * as community from '../services/community.service';

const router = createRouter();
router.use('/community/*', requireAuth);
router.use('/admin/reports', requireRole(...STAFF_ROLES), requireMfa);
router.use('/admin/reports/*', requireRole(...STAFF_ROLES), requireMfa);
const ok = <T>(data: T) => ({ ok: true as const, data });
const done = () => ok({ message: 'Saved.' });
const r = <T extends Parameters<typeof createRoute>[0]>(def: T) =>
  createRoute({ tags: ['Community'], security: sessionSecurity, ...def });
const writeResponses = {
  200: jsonResponse('Saved', success(MessageSchema)),
  ...errors(400, 401, 403, 404, 409),
};
const pageQuery = z.strictObject({ page: z.coerce.number().int().min(1).max(1000).default(1) });
const reportParams = z.object({ reportId: idSchema });
export const communityRoutes = router
  .openapi(
    r({
      method: 'get',
      path: '/community/courses/{slug}/questions',
      summary: 'Course and lesson questions, members only',
      request: { params: courseSlugParams, query: questionQuerySchema },
      responses: {
        200: jsonResponse('Questions', success(questionListSchema)),
        ...errors(400, 401, 403, 404),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await community.list(
            depsFrom(c),
            c.get('auth')!,
            c.req.valid('param').slug,
            c.req.valid('query'),
          ),
        ),
        200,
      ),
  )
  .openapi(
    r({
      method: 'post',
      path: '/community/courses/{slug}/questions',
      summary: 'Ask a course or timestamped lesson question',
      request: { params: courseSlugParams, body: jsonBody(questionSchema) },
      responses: {
        201: jsonResponse('Question', success(z.object({ id: idSchema }))),
        ...errors(400, 401, 403, 404, 409),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await community.ask(
            depsFrom(c),
            c.get('auth')!,
            c.req.valid('param').slug,
            c.req.valid('json'),
          ),
        ),
        201,
      ),
  )
  .openapi(
    r({
      method: 'get',
      path: '/community/courses/{slug}/questions/{questionId}',
      summary: 'Question and visible replies',
      request: { params: questionParams, query: pageQuery },
      responses: {
        200: jsonResponse('Discussion', success(questionDetailSchema)),
        ...errors(400, 401, 403, 404),
      },
    }),
    async (c) => {
      const { slug, questionId } = c.req.valid('param');
      return c.json(
        ok(
          await community.detail(
            depsFrom(c),
            c.get('auth')!,
            slug,
            questionId,
            c.req.valid('query').page,
          ),
        ),
        200,
      );
    },
  )
  .openapi(
    r({
      method: 'post',
      path: '/community/courses/{slug}/questions/{questionId}/replies',
      summary: 'Reply to a visible question',
      request: { params: questionParams, body: jsonBody(replySchema) },
      responses: {
        201: jsonResponse('Reply', success(z.object({ id: idSchema }))),
        ...errors(400, 401, 403, 404, 409),
      },
    }),
    async (c) => {
      const { slug, questionId } = c.req.valid('param');
      return c.json(
        ok(
          await community.reply(
            depsFrom(c),
            c.get('auth')!,
            slug,
            questionId,
            c.req.valid('json').body,
          ),
        ),
        201,
      );
    },
  )
  .openapi(
    r({
      method: 'post',
      path: '/community/courses/{slug}/questions/{questionId}/solution',
      summary: 'Choose or clear the accepted answer',
      request: { params: questionParams, body: jsonBody(solutionSchema) },
      responses: writeResponses,
    }),
    async (c) => {
      const { slug, questionId } = c.req.valid('param');
      await community.solution(
        depsFrom(c),
        c.get('auth')!,
        slug,
        questionId,
        c.req.valid('json').replyId,
      );
      return c.json(done(), 200);
    },
  )
  .openapi(
    r({
      method: 'post',
      path: '/community/courses/{slug}/reports',
      summary: 'Privately report a question, reply or review (retry-safe)',
      request: { params: courseSlugParams, body: jsonBody(reportSchema) },
      responses: writeResponses,
    }),
    async (c) => {
      await community.report(
        depsFrom(c),
        c.get('auth')!,
        c.req.valid('param').slug,
        c.req.valid('json'),
      );
      return c.json(done(), 200);
    },
  )
  .openapi(
    r({
      method: 'get',
      path: '/admin/reports',
      summary: 'Staff moderation queue',
      request: { query: reportQuerySchema },
      responses: {
        200: jsonResponse('Reports', success(moderationListSchema)),
        ...errors(400, 401, 403),
      },
    }),
    async (c) => c.json(ok(await community.reports(depsFrom(c), c.req.valid('query'))), 200),
  )
  .openapi(
    r({
      method: 'get',
      path: '/admin/reports/{reportId}',
      summary: 'Inspect reported content, including hidden content',
      request: { params: reportParams },
      responses: {
        200: jsonResponse('Report', success(moderationDetailSchema)),
        ...errors(400, 401, 403, 404),
      },
    }),
    async (c) =>
      c.json(ok(await community.inspect(depsFrom(c), c.req.valid('param').reportId)), 200),
  )
  .openapi(
    r({
      method: 'post',
      path: '/admin/reports/{reportId}',
      summary: 'Hide, restore or dismiss with an audited, versioned decision',
      request: { params: reportParams, body: jsonBody(moderationSchema) },
      responses: writeResponses,
    }),
    async (c) => {
      await community.decide(
        depsFrom(c),
        c.get('auth')!,
        c.req.valid('param').reportId,
        c.req.valid('json'),
      );
      return c.json(done(), 200);
    },
  );
