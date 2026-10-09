/** Public catalog/preview routes and authenticated enrollment, progress, notes and credentials. */
import { createRoute, z } from '@hono/zod-openapi';
import {
  catalogQuerySchema,
  catalogResultSchema,
  certificateSchema,
  courseDetailSchema,
  courseSlugParams,
  enrollmentStatusSchema,
  idSchema,
  instructorParams,
  learnerLessonParams,
  learningCourseSchema,
  noteSchema,
  noteViewSchema,
  playerSchema,
  progressSchema,
  publicInstructorSchema,
  quizSubmissionSchema,
  quizResultSchema,
  reviewSchema,
  reviewViewSchema,
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
import { requireAuth } from '../middleware/auth';
import * as catalog from '../services/catalog.service';
import * as learning from '../services/learning.service';
import * as quizzes from '../services/quizzes.service';

const router = createRouter();
router.use('/learning/*', requireAuth);
router.use('/me/learning', requireAuth);
router.use('/me/certificates', requireAuth);
const ok = <T>(data: T) => ({ ok: true as const, data });
const message = () => ok({ message: 'Saved.' });
const slugRequest = { params: courseSlugParams };
const lessonRequest = { params: learnerLessonParams };
const writeResponses = {
  200: jsonResponse('Saved', success(MessageSchema)),
  ...errors(400, 401, 403, 404, 409),
};
const pageQuery = z.strictObject({ page: z.coerce.number().int().min(1).max(1000).default(1) });

export const learningRoutes = router
  .openapi(
    createRoute({
      method: 'post',
      path: '/learning/courses/{slug}/lessons/{lessonId}/quiz-attempts',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'Submit a practice quiz (server graded, retry-safe; 20 attempts/hour/lesson)',
      request: { ...lessonRequest, body: jsonBody(quizSubmissionSchema) },
      responses: {
        200: jsonResponse('Graded quiz', success(quizResultSchema)),
        ...errors(400, 401, 403, 404, 409, 429),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await quizzes.submit(
            depsFrom(c),
            c.get('auth')!,
            c.req.valid('param').slug,
            c.req.valid('param').lessonId,
            c.req.valid('json'),
          ),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/courses',
      tags: ['Catalog'],
      summary: 'Search published courses',
      request: { query: catalogQuerySchema },
      responses: { 200: jsonResponse('Catalog', success(catalogResultSchema)), ...errors(400) },
    }),
    async (c) => c.json(ok(await catalog.catalog(depsFrom(c), c.req.valid('query'))), 200),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/courses/{slug}',
      tags: ['Catalog'],
      summary: 'Published course and curriculum (no lesson bodies)',
      request: slugRequest,
      responses: { 200: jsonResponse('Course', success(courseDetailSchema)), ...errors(400, 404) },
    }),
    async (c) => c.json(ok(await catalog.detail(depsFrom(c), c.req.valid('param').slug)), 200),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/courses/{slug}/reviews',
      tags: ['Catalog'],
      summary: 'Learner reviews, 20 per page',
      request: { ...slugRequest, query: pageQuery },
      responses: {
        200: jsonResponse('Reviews', success(z.array(reviewViewSchema))),
        ...errors(400, 404),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await catalog.reviews(depsFrom(c), c.req.valid('param').slug, c.req.valid('query').page),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/instructors/{username}',
      tags: ['Catalog'],
      summary: 'Public instructor bio and published courses',
      request: { params: instructorParams, query: catalogQuerySchema },
      responses: {
        200: jsonResponse(
          'Instructor',
          success(z.object({ profile: publicInstructorSchema, courses: catalogResultSchema })),
        ),
        ...errors(400, 404),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await catalog.instructor(
            depsFrom(c),
            c.req.valid('param').username,
            c.req.valid('query'),
          ),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/courses/{slug}/lessons/{lessonId}',
      tags: ['Learning'],
      summary: 'Lesson player (preview or owned enrollment)',
      request: lessonRequest,
      responses: { 200: jsonResponse('Player', success(playerSchema)), ...errors(400, 404) },
    }),
    async (c) =>
      c.json(
        ok(
          await learning.player(
            depsFrom(c),
            c.get('auth'),
            c.req.valid('param').slug,
            c.req.valid('param').lessonId,
          ),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/me/learning',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'My learning shelf and progress',
      responses: {
        200: jsonResponse('Learning', success(z.array(learningCourseSchema))),
        ...errors(401),
      },
    }),
    async (c) => c.json(ok(await learning.myLearning(depsFrom(c), c.get('auth')!)), 200),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/learning/courses/{slug}/status',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'My enrollment and review for a published course',
      request: slugRequest,
      responses: {
        200: jsonResponse('Status', success(enrollmentStatusSchema)),
        ...errors(400, 401, 404),
      },
    }),
    async (c) =>
      c.json(
        ok(await learning.enrollmentStatus(depsFrom(c), c.get('auth')!, c.req.valid('param').slug)),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/learning/courses/{slug}/enroll',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'Enroll in a free published course (retry-safe)',
      request: slugRequest,
      responses: {
        200: jsonResponse('Enrolled', success(z.object({ firstLessonId: z.string().nullable() }))),
        ...errors(400, 401, 403, 404, 409),
      },
    }),
    async (c) =>
      c.json(
        ok(await learning.enroll(depsFrom(c), c.get('auth')!, c.req.valid('param').slug)),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/learning/courses/{slug}/lessons/{lessonId}/progress',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'Mark a lesson complete or incomplete',
      request: { ...lessonRequest, body: jsonBody(progressSchema) },
      responses: writeResponses,
    }),
    async (c) => {
      const { slug, lessonId } = c.req.valid('param');
      await learning.progress(
        depsFrom(c),
        c.get('auth')!,
        slug,
        lessonId,
        c.req.valid('json').completed,
      );
      return c.json(message(), 200);
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/learning/courses/{slug}/lessons/{lessonId}/notes',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'Add a private timestamped note',
      request: { ...lessonRequest, body: jsonBody(noteSchema) },
      responses: { 201: jsonResponse('Note', success(noteViewSchema)), ...errors(400, 401, 404) },
    }),
    async (c) => {
      const { slug, lessonId } = c.req.valid('param');
      return c.json(
        ok(
          await learning.addNote(depsFrom(c), c.get('auth')!, slug, lessonId, c.req.valid('json')),
        ),
        201,
      );
    },
  )
  .openapi(
    createRoute({
      method: 'delete',
      path: '/learning/courses/{slug}/lessons/{lessonId}/notes/{noteId}',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'Delete my private note',
      request: { params: learnerLessonParams.extend({ noteId: idSchema }) },
      responses: writeResponses,
    }),
    async (c) => {
      const { slug, lessonId, noteId } = c.req.valid('param');
      await learning.deleteNote(depsFrom(c), c.get('auth')!, slug, lessonId, noteId);
      return c.json(message(), 200);
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/learning/courses/{slug}/review',
      tags: ['Learning'],
      security: sessionSecurity,
      summary: 'Write or edit one review after starting the course',
      request: { ...slugRequest, body: jsonBody(reviewSchema) },
      responses: writeResponses,
    }),
    async (c) => {
      await learning.review(
        depsFrom(c),
        c.get('auth')!,
        c.req.valid('param').slug,
        c.req.valid('json'),
      );
      return c.json(message(), 200);
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/learning/courses/{slug}/certificate',
      tags: ['Credentials'],
      security: sessionSecurity,
      summary: 'Issue a signed completion certificate after all lessons are done',
      request: slugRequest,
      responses: {
        200: jsonResponse('Certificate', success(certificateSchema)),
        ...errors(400, 401, 403, 404, 409, 503),
      },
    }),
    async (c) =>
      c.json(
        ok(await learning.issueCertificate(depsFrom(c), c.get('auth')!, c.req.valid('param').slug)),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/me/certificates',
      tags: ['Credentials'],
      security: sessionSecurity,
      summary: 'My issued completion certificates',
      responses: {
        200: jsonResponse('Certificates', success(z.array(certificateSchema))),
        ...errors(401),
      },
    }),
    async (c) => c.json(ok(await learning.myCertificates(depsFrom(c), c.get('auth')!)), 200),
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/certificates/{serial}',
      tags: ['Credentials'],
      summary: 'Verify an immutable signed completion credential',
      request: { params: z.object({ serial: idSchema }) },
      responses: {
        200: jsonResponse('Verified certificate', success(certificateSchema)),
        ...errors(400, 404, 503),
      },
    }),
    async (c) =>
      c.json(ok(await learning.verifyCertificate(depsFrom(c), c.req.valid('param').serial)), 200),
  );
