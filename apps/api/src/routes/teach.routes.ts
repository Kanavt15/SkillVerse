/**
 * Teaching endpoints for signed-in users:
 *   /api/v1/me/instructor-application   apply to teach / see my application
 *   /api/v1/studio/*                    the course builder (approved instructors)
 *
 * Coarse access is enforced here (signed in, verified email, instructor role);
 * ownership and status rules are enforced by the services via ../policies.
 */
import { createRoute, z } from '@hono/zod-openapi';
import {
  createCourseSchema,
  createLessonSchema,
  idSchema,
  instructorApplicationSchema,
  reorderSchema,
  sectionSchema,
  updateCourseSchema,
  updateLessonSchema,
} from '@skillverse/shared';
import { depsFrom } from '../lib/deps';
import { AppError } from '../lib/errors';
import {
  createRouter,
  errors,
  jsonBody,
  jsonResponse,
  sessionSecurity,
  success,
} from '../lib/openapi';
import { requireAuth, requireRole, requireVerified } from '../middleware/auth';
import * as builder from '../services/course-builder.service';
import * as instructor from '../services/instructor.service';
import { ApplicationSchema, CourseEditorSchema, CourseSummarySchema } from './catalog-schemas';

const security = sessionSecurity;
const courseParam = { params: z.object({ courseId: idSchema }) };
const sectionParam = { params: z.object({ sectionId: idSchema }) };
const lessonParam = { params: z.object({ lessonId: idSchema }) };
const editorResponse = {
  200: jsonResponse('Updated course', success(CourseEditorSchema)),
  ...errors(400, 401, 403, 404, 409),
};

// ─── Applications ────────────────────────────────────────────────────────────

const getApplication = createRoute({
  method: 'get',
  path: '/me/instructor-application',
  tags: ['Teaching'],
  security,
  summary: 'My latest application to teach (or null)',
  responses: { 200: jsonResponse('OK', success(ApplicationSchema.nullable())), ...errors(401) },
});

const postApplication = createRoute({
  method: 'post',
  path: '/me/instructor-application',
  tags: ['Teaching'],
  security,
  summary: 'Apply to teach',
  request: { body: jsonBody(instructorApplicationSchema) },
  responses: {
    201: jsonResponse('Submitted', success(ApplicationSchema)),
    ...errors(400, 401, 403, 409),
  },
});

// ─── Studio: courses ─────────────────────────────────────────────────────────

const tags = ['Studio'];
const r = <T extends Parameters<typeof createRoute>[0]>(def: T) =>
  createRoute({ tags, security, ...def });

const listCourses = r({
  method: 'get',
  path: '/studio/courses',
  summary: 'My courses',
  responses: {
    200: jsonResponse('OK', success(z.array(CourseSummarySchema))),
    ...errors(401, 403),
  },
});
const createCourse = r({
  method: 'post',
  path: '/studio/courses',
  summary: 'Create a draft course',
  request: { body: jsonBody(createCourseSchema) },
  responses: {
    201: jsonResponse('Created', success(CourseEditorSchema)),
    ...errors(400, 401, 403),
  },
});
const getCourse = r({
  method: 'get',
  path: '/studio/courses/{courseId}',
  summary: 'A course with its full curriculum, for editing',
  request: courseParam,
  responses: { 200: jsonResponse('OK', success(CourseEditorSchema)), ...errors(401, 403, 404) },
});
const patchCourse = r({
  method: 'patch',
  path: '/studio/courses/{courseId}',
  summary: 'Edit course details',
  request: { ...courseParam, body: jsonBody(updateCourseSchema) },
  responses: editorResponse,
});
const submitCourse = r({
  method: 'post',
  path: '/studio/courses/{courseId}/submit',
  summary: 'Submit for review (fails with a checklist if incomplete)',
  request: courseParam,
  responses: editorResponse,
});
const withdrawCourse = r({
  method: 'post',
  path: '/studio/courses/{courseId}/withdraw',
  summary: 'Take a course back out of the review queue',
  request: courseParam,
  responses: editorResponse,
});
const archiveCourse = r({
  method: 'post',
  path: '/studio/courses/{courseId}/archive',
  summary: 'Archive (hide from the catalog; enrolled learners keep access)',
  request: courseParam,
  responses: editorResponse,
});

// ─── Studio: sections & lessons ──────────────────────────────────────────────

const addSection = r({
  method: 'post',
  path: '/studio/courses/{courseId}/sections',
  summary: 'Add a section',
  request: { ...courseParam, body: jsonBody(sectionSchema) },
  responses: editorResponse,
});
const reorderSections = r({
  method: 'post',
  path: '/studio/courses/{courseId}/sections/reorder',
  summary: 'Set the order of all sections',
  request: { ...courseParam, body: jsonBody(reorderSchema) },
  responses: editorResponse,
});
const renameSection = r({
  method: 'patch',
  path: '/studio/sections/{sectionId}',
  summary: 'Rename a section',
  request: { ...sectionParam, body: jsonBody(sectionSchema) },
  responses: editorResponse,
});
const deleteSection = r({
  method: 'delete',
  path: '/studio/sections/{sectionId}',
  summary: 'Delete a section and its lessons',
  request: sectionParam,
  responses: editorResponse,
});
const addLesson = r({
  method: 'post',
  path: '/studio/sections/{sectionId}/lessons',
  summary: 'Add a lesson to a section',
  request: { ...sectionParam, body: jsonBody(createLessonSchema) },
  responses: editorResponse,
});
const reorderLessons = r({
  method: 'post',
  path: '/studio/sections/{sectionId}/lessons/reorder',
  summary: 'Set the order of all lessons in a section',
  request: { ...sectionParam, body: jsonBody(reorderSchema) },
  responses: editorResponse,
});
const patchLesson = r({
  method: 'patch',
  path: '/studio/lessons/{lessonId}',
  summary: 'Edit a lesson (content, video link, preview, move to another section)',
  request: { ...lessonParam, body: jsonBody(updateLessonSchema) },
  responses: editorResponse,
});
const deleteLesson = r({
  method: 'delete',
  path: '/studio/lessons/{lessonId}',
  summary: 'Delete a lesson',
  request: lessonParam,
  responses: editorResponse,
});

const router = createRouter();
router.use('/me/instructor-application', requireAuth);
router.use('/studio/*', requireVerified, requireRole('instructor'));

const ok = <T>(data: T) => ({ ok: true as const, data });

export const teachRoutes = router
  .openapi(getApplication, async (c) =>
    c.json(ok(await instructor.getMyApplication(depsFrom(c), c.get('auth')!)), 200),
  )
  .openapi(postApplication, async (c) => {
    const auth = c.get('auth')!;
    if (!auth.user.emailVerified)
      throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address first.');
    return c.json(ok(await instructor.apply(depsFrom(c), auth, c.req.valid('json'))), 201);
  })
  .openapi(listCourses, async (c) =>
    c.json(ok(await builder.listMine(depsFrom(c), c.get('auth')!)), 200),
  )
  .openapi(createCourse, async (c) =>
    c.json(ok(await builder.create(depsFrom(c), c.get('auth')!, c.req.valid('json'))), 201),
  )
  .openapi(getCourse, async (c) =>
    c.json(
      ok(await builder.getForEditing(depsFrom(c), c.get('auth')!, c.req.valid('param').courseId)),
      200,
    ),
  )
  .openapi(patchCourse, async (c) =>
    c.json(
      ok(
        await builder.update(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').courseId,
          c.req.valid('json'),
        ),
      ),
      200,
    ),
  )
  .openapi(submitCourse, async (c) =>
    c.json(
      ok(await builder.submitForReview(depsFrom(c), c.get('auth')!, c.req.valid('param').courseId)),
      200,
    ),
  )
  .openapi(withdrawCourse, async (c) =>
    c.json(
      ok(await builder.withdraw(depsFrom(c), c.get('auth')!, c.req.valid('param').courseId)),
      200,
    ),
  )
  .openapi(archiveCourse, async (c) =>
    c.json(
      ok(await builder.archive(depsFrom(c), c.get('auth')!, c.req.valid('param').courseId)),
      200,
    ),
  )
  .openapi(addSection, async (c) =>
    c.json(
      ok(
        await builder.addSection(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').courseId,
          c.req.valid('json').title,
        ),
      ),
      200,
    ),
  )
  .openapi(reorderSections, async (c) =>
    c.json(
      ok(
        await builder.reorderSections(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').courseId,
          c.req.valid('json').ids,
        ),
      ),
      200,
    ),
  )
  .openapi(renameSection, async (c) =>
    c.json(
      ok(
        await builder.renameSection(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').sectionId,
          c.req.valid('json').title,
        ),
      ),
      200,
    ),
  )
  .openapi(deleteSection, async (c) =>
    c.json(
      ok(await builder.deleteSection(depsFrom(c), c.get('auth')!, c.req.valid('param').sectionId)),
      200,
    ),
  )
  .openapi(addLesson, async (c) =>
    c.json(
      ok(
        await builder.addLesson(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').sectionId,
          c.req.valid('json'),
        ),
      ),
      200,
    ),
  )
  .openapi(reorderLessons, async (c) =>
    c.json(
      ok(
        await builder.reorderLessons(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').sectionId,
          c.req.valid('json').ids,
        ),
      ),
      200,
    ),
  )
  .openapi(patchLesson, async (c) =>
    c.json(
      ok(
        await builder.updateLesson(
          depsFrom(c),
          c.get('auth')!,
          c.req.valid('param').lessonId,
          c.req.valid('json'),
        ),
      ),
      200,
    ),
  )
  .openapi(deleteLesson, async (c) =>
    c.json(
      ok(await builder.deleteLesson(depsFrom(c), c.get('auth')!, c.req.valid('param').lessonId)),
      200,
    ),
  );
