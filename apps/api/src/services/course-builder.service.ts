/**
 * The course builder behind the Studio: create and edit courses, arrange
 * sections and lessons, and submit for review.
 *
 * Every operation loads the course and checks the policy first:
 *   - not the owner (or not an instructor) → NOT_FOUND, so ids of other people's
 *     drafts can't be discovered;
 *   - owner but not editable right now (in review / archived) → CONFLICT with a reason.
 */
import { eq } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import {
  parseVideoUrl,
  videoWatchUrl,
  type UpdateCourseInput,
  type UpdateLessonInput,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import { randomToken } from '../lib/crypto';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { canEditCourse, canTeach, ownsCourse } from '../policies';
import {
  categoryExists,
  findCourse,
  findLesson,
  findSection,
  insertReviewEvent,
  listCourseTagSlugs,
  listCoursesByInstructor,
  listLessons,
  listSections,
  nextLessonPosition,
  nextSectionPosition,
  refreshCourseStats,
  replaceCourseTagsStatements,
  setCourseStatus,
  slugTaken,
  upsertTags,
  type CourseRow,
} from '../repositories/courses.repository';
import { auditInsert } from './audit.service';

const { courses, sections, lessons } = schema;

function jsonArray(value: string): string[] {
  try {
    const v: unknown = JSON.parse(value);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** "Intro to Python!" → "intro-to-python-k3f9" (ASCII, hyphenated, random suffix keeps it unique). */
export function makeSlug(title: string): string {
  const base =
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents: "é" → "e"
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '') || 'course';
  const suffix = randomToken(6)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, '0');
  return `${base}-${suffix}`;
}

// ─── Loading with authorization ──────────────────────────────────────────────

/** Owner-only load. Anyone else gets NOT_FOUND. */
async function loadOwned(d: RequestDeps, auth: AuthContext, courseId: string): Promise<CourseRow> {
  const course = await findCourse(d.db, courseId);
  if (!course || !canTeach(auth) || !ownsCourse(auth, course)) {
    throw new AppError('NOT_FOUND', 'Course not found.');
  }
  return course;
}

async function loadEditable(
  d: RequestDeps,
  auth: AuthContext,
  courseId: string,
): Promise<CourseRow> {
  const course = await loadOwned(d, auth, courseId);
  if (!canEditCourse(auth, course)) {
    throw new AppError(
      'CONFLICT',
      course.status === 'in_review'
        ? 'This course is being reviewed. Withdraw it from review to make changes.'
        : 'This course is archived and can no longer be edited.',
    );
  }
  return course;
}

async function loadSectionEditable(d: RequestDeps, auth: AuthContext, sectionId: string) {
  const section = await findSection(d.db, sectionId);
  if (!section) throw new AppError('NOT_FOUND', 'Section not found.');
  const course = await loadEditable(d, auth, section.courseId);
  return { section, course };
}

async function loadLessonEditable(d: RequestDeps, auth: AuthContext, lessonId: string) {
  const lesson = await findLesson(d.db, lessonId);
  if (!lesson) throw new AppError('NOT_FOUND', 'Lesson not found.');
  const course = await loadEditable(d, auth, lesson.courseId);
  return { lesson, course };
}

// ─── Read models ─────────────────────────────────────────────────────────────

export async function listMine(d: RequestDeps, auth: AuthContext) {
  if (!canTeach(auth))
    throw new AppError('FORBIDDEN', 'Only approved instructors can create courses.');
  const rows = await listCoursesByInstructor(d.db, auth.user.id);
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

/** Everything the editor needs: course fields, tags and the full curriculum. */
export async function buildEditorView(d: RequestDeps, course: CourseRow) {
  const [sectionRows, lessonRows, tagRows] = await Promise.all([
    listSections(d.db, course.id),
    listLessons(d.db, course.id),
    listCourseTagSlugs(d.db, course.id),
  ]);
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    categoryId: course.categoryId,
    level: course.level,
    language: course.language,
    priceInPaise: course.priceInPaise,
    currency: course.currency,
    learningOutcomes: jsonArray(course.learningOutcomes),
    requirements: jsonArray(course.requirements),
    tags: tagRows.map((t) => t.slug),
    status: course.status,
    reviewNotes: course.reviewNotes,
    // Derived from the rows just loaded: `course` may predate the write this view follows.
    lessonCount: lessonRows.length,
    durationMinutes: lessonRows.reduce((sum, l) => sum + l.durationMinutes, 0),
    submittedAt: course.submittedAt?.toISOString() ?? null,
    publishedAt: course.publishedAt?.toISOString() ?? null,
    updatedAt: course.updatedAt.toISOString(),
    sections: sectionRows.map((s) => ({
      id: s.id,
      title: s.title,
      position: s.position,
      lessons: lessonRows
        .filter((l) => l.sectionId === s.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          position: l.position,
          isPreview: l.isPreview,
          durationMinutes: l.durationMinutes,
          contentMarkdown: l.contentMarkdown,
          video:
            l.videoProvider && l.videoRef && l.videoProvider !== 'r2'
              ? {
                  provider: l.videoProvider,
                  ref: l.videoRef,
                  url: videoWatchUrl(l.videoProvider, l.videoRef),
                }
              : null,
        })),
    })),
  };
}

export type CourseEditorView = Awaited<ReturnType<typeof buildEditorView>>;

export async function getForEditing(d: RequestDeps, auth: AuthContext, courseId: string) {
  return buildEditorView(d, await loadOwned(d, auth, courseId));
}

// ─── Course ──────────────────────────────────────────────────────────────────

export async function create(
  d: RequestDeps,
  auth: AuthContext,
  input: { title: string; categoryId?: string },
) {
  if (!canTeach(auth))
    throw new AppError('FORBIDDEN', 'Only approved instructors can create courses.');
  if (input.categoryId && !(await categoryExists(d.db, input.categoryId))) {
    throw new AppError('VALIDATION_FAILED', 'Unknown category.', {
      categoryId: ['Pick a category from the list.'],
    });
  }
  let slug = makeSlug(input.title);
  for (let i = 0; i < 3 && (await slugTaken(d.db, slug)); i++) slug = makeSlug(input.title);

  const [row] = await d.db
    .insert(courses)
    .values({
      instructorId: auth.user.id,
      slug,
      title: input.title,
      categoryId: input.categoryId ?? null,
    })
    .returning();
  await auditInsert(d.db, {
    action: 'course.created',
    actorUserId: auth.user.id,
    targetType: 'course',
    targetId: row!.id,
    requestId: d.requestId,
  });
  return buildEditorView(d, row!);
}

export async function update(
  d: RequestDeps,
  auth: AuthContext,
  courseId: string,
  input: UpdateCourseInput,
) {
  const course = await loadEditable(d, auth, courseId);
  if (input.categoryId && !(await categoryExists(d.db, input.categoryId))) {
    throw new AppError('VALIDATION_FAILED', 'Unknown category.', {
      categoryId: ['Pick a category from the list.'],
    });
  }

  const patch: Partial<typeof courses.$inferInsert> = {};
  for (const key of [
    'title',
    'subtitle',
    'description',
    'categoryId',
    'level',
    'language',
    'priceInPaise',
  ] as const) {
    if (input[key] !== undefined) (patch as Record<string, unknown>)[key] = input[key];
  }
  if (input.learningOutcomes) patch.learningOutcomes = JSON.stringify(input.learningOutcomes);
  if (input.requirements) patch.requirements = JSON.stringify(input.requirements);

  const statements = [];
  if (Object.keys(patch).length)
    statements.push(d.db.update(courses).set(patch).where(eq(courses.id, course.id)));
  if (input.tags) {
    const tagIds = await upsertTags(d.db, [...new Set(input.tags)]);
    statements.push(...replaceCourseTagsStatements(d.db, course.id, tagIds));
  }
  if (statements.length)
    await d.db.batch(statements as [(typeof statements)[0], ...typeof statements]);
  return buildEditorView(d, (await findCourse(d.db, course.id))!);
}

// ─── Sections ────────────────────────────────────────────────────────────────

export async function addSection(
  d: RequestDeps,
  auth: AuthContext,
  courseId: string,
  title: string,
) {
  const course = await loadEditable(d, auth, courseId);
  await d.db
    .insert(sections)
    .values({ courseId: course.id, title, position: await nextSectionPosition(d.db, course.id) });
  return buildEditorView(d, course);
}

export async function renameSection(
  d: RequestDeps,
  auth: AuthContext,
  sectionId: string,
  title: string,
) {
  const { section, course } = await loadSectionEditable(d, auth, sectionId);
  await d.db.update(sections).set({ title }).where(eq(sections.id, section.id));
  return buildEditorView(d, course);
}

export async function deleteSection(d: RequestDeps, auth: AuthContext, sectionId: string) {
  const { section, course } = await loadSectionEditable(d, auth, sectionId);
  // Lessons in the section are removed by ON DELETE CASCADE; then counters are refreshed.
  await d.db.batch([
    d.db.delete(sections).where(eq(sections.id, section.id)),
    refreshCourseStats(d.db, course.id),
  ]);
  return buildEditorView(d, course);
}

/**
 * New section order. `ids` must be EXACTLY this course's sections (no missing,
 * extra or foreign ids), which stops one course's rows being moved via another.
 */
export async function reorderSections(
  d: RequestDeps,
  auth: AuthContext,
  courseId: string,
  ids: string[],
) {
  const course = await loadEditable(d, auth, courseId);
  const current = await listSections(d.db, course.id);
  assertSameSet(
    ids,
    current.map((s) => s.id),
  );
  // assertSameSet guarantees ids is non-empty and matches the current rows.
  const [first, ...rest] = ids.map((id, position) =>
    d.db.update(sections).set({ position }).where(eq(sections.id, id)),
  );
  await d.db.batch([first!, ...rest]);
  return buildEditorView(d, course);
}

function assertSameSet(given: string[], actual: string[]) {
  const a = new Set(given);
  if (a.size !== given.length || a.size !== actual.length || actual.some((id) => !a.has(id))) {
    throw new AppError('VALIDATION_FAILED', 'The new order must list every item exactly once.', {
      ids: ['Refresh the page and try again.'],
    });
  }
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

export async function addLesson(
  d: RequestDeps,
  auth: AuthContext,
  sectionId: string,
  input: { title: string; type: 'video' | 'article' },
) {
  const { section, course } = await loadSectionEditable(d, auth, sectionId);
  await d.db.batch([
    d.db.insert(lessons).values({
      courseId: course.id,
      sectionId: section.id,
      title: input.title,
      type: input.type,
      position: await nextLessonPosition(d.db, section.id),
    }),
    refreshCourseStats(d.db, course.id),
  ]);
  return buildEditorView(d, course);
}

export async function updateLesson(
  d: RequestDeps,
  auth: AuthContext,
  lessonId: string,
  input: UpdateLessonInput,
) {
  const { lesson, course } = await loadLessonEditable(d, auth, lessonId);
  const patch: Partial<typeof lessons.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.isPreview !== undefined) patch.isPreview = input.isPreview;
  if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes;
  if (input.contentMarkdown !== undefined) patch.contentMarkdown = input.contentMarkdown;

  if (input.videoUrl !== undefined) {
    if (input.videoUrl === '') {
      patch.videoProvider = null;
      patch.videoRef = null;
    } else {
      const parsed = parseVideoUrl(input.videoUrl);
      if (!parsed) {
        throw new AppError('VALIDATION_FAILED', 'Unsupported video link.', {
          videoUrl: ['Paste a YouTube or Vimeo link (for example https://youtu.be/…).'],
        });
      }
      patch.videoProvider = parsed.provider;
      patch.videoRef = parsed.ref;
    }
  }

  if (input.sectionId !== undefined && input.sectionId !== lesson.sectionId) {
    const target = await findSection(d.db, input.sectionId);
    if (!target || target.courseId !== course.id) {
      throw new AppError('VALIDATION_FAILED', 'Unknown section.', {
        sectionId: ['Pick a section of this course.'],
      });
    }
    patch.sectionId = target.id;
    patch.position = await nextLessonPosition(d.db, target.id);
  }

  if (Object.keys(patch).length) {
    await d.db.batch([
      d.db.update(lessons).set(patch).where(eq(lessons.id, lesson.id)),
      refreshCourseStats(d.db, course.id),
    ]);
  }
  return buildEditorView(d, course);
}

export async function deleteLesson(d: RequestDeps, auth: AuthContext, lessonId: string) {
  const { lesson, course } = await loadLessonEditable(d, auth, lessonId);
  await d.db.batch([
    d.db.delete(lessons).where(eq(lessons.id, lesson.id)),
    refreshCourseStats(d.db, course.id),
  ]);
  return buildEditorView(d, course);
}

export async function reorderLessons(
  d: RequestDeps,
  auth: AuthContext,
  sectionId: string,
  ids: string[],
) {
  const { section, course } = await loadSectionEditable(d, auth, sectionId);
  const current = (await listLessons(d.db, course.id)).filter((l) => l.sectionId === section.id);
  assertSameSet(
    ids,
    current.map((l) => l.id),
  );
  // assertSameSet guarantees ids is non-empty and matches the current rows.
  const [first, ...rest] = ids.map((id, position) =>
    d.db.update(lessons).set({ position }).where(eq(lessons.id, id)),
  );
  await d.db.batch([first!, ...rest]);
  return buildEditorView(d, course);
}

// ─── Review workflow (instructor side) ───────────────────────────────────────

/** What still needs doing before a course can be submitted. Empty = ready. */
export function submissionChecklist(view: CourseEditorView): string[] {
  const problems: string[] = [];
  if (view.subtitle.trim().length < 10) problems.push('Add a subtitle (at least 10 characters).');
  if (view.description.trim().length < 200)
    problems.push('Write a description of at least 200 characters.');
  if (!view.categoryId) problems.push('Choose a category.');
  if (view.learningOutcomes.length < 3)
    problems.push('List at least 3 things learners will learn.');
  const allLessons = view.sections.flatMap((s) => s.lessons);
  if (view.sections.length === 0) problems.push('Add at least one section.');
  if (allLessons.length < 3) problems.push('Add at least 3 lessons.');
  for (const s of view.sections) {
    if (s.lessons.length === 0) problems.push(`Section "${s.title}" has no lessons.`);
  }
  for (const l of allLessons) {
    if (l.type === 'video' && !l.video) problems.push(`Lesson "${l.title}" needs a video link.`);
    if (l.type === 'article' && l.contentMarkdown.trim().length < 50) {
      problems.push(`Lesson "${l.title}" needs at least 50 characters of content.`);
    }
  }
  return problems;
}

export async function submitForReview(d: RequestDeps, auth: AuthContext, courseId: string) {
  const course = await loadOwned(d, auth, courseId);
  if (!['draft', 'rejected'].includes(course.status)) {
    throw new AppError(
      'CONFLICT',
      `A ${course.status.replace('_', ' ')} course can't be submitted.`,
    );
  }
  const view = await buildEditorView(d, course);
  const problems = submissionChecklist(view);
  if (problems.length) {
    throw new AppError('VALIDATION_FAILED', 'The course is not ready for review yet.', {
      checklist: problems,
    });
  }
  const moved = await setCourseStatus(d.db, course.id, ['draft', 'rejected'], {
    status: 'in_review',
    submittedAt: new Date(),
  });
  if (moved.length === 0)
    throw new AppError('CONFLICT', 'The course changed meanwhile. Refresh and try again.');
  await d.db.batch([
    insertReviewEvent(d.db, { courseId: course.id, event: 'submitted', actorId: auth.user.id }),
    auditInsert(d.db, {
      action: 'course.submitted',
      actorUserId: auth.user.id,
      targetType: 'course',
      targetId: course.id,
      requestId: d.requestId,
    }),
  ]);
  return buildEditorView(d, (await findCourse(d.db, course.id))!);
}

/** Pulls a course back out of the review queue to keep editing. */
export async function withdraw(d: RequestDeps, auth: AuthContext, courseId: string) {
  const course = await loadOwned(d, auth, courseId);
  const moved = await setCourseStatus(d.db, course.id, ['in_review'], {
    status: 'draft',
    submittedAt: null,
  });
  if (moved.length === 0) throw new AppError('CONFLICT', 'This course is not in review.');
  return buildEditorView(d, (await findCourse(d.db, course.id))!);
}

/** Stops a published course from appearing in the catalog. Enrolled learners keep access. */
export async function archive(d: RequestDeps, auth: AuthContext, courseId: string) {
  const course = await loadOwned(d, auth, courseId);
  const moved = await setCourseStatus(d.db, course.id, ['draft', 'rejected', 'published'], {
    status: 'archived',
  });
  if (moved.length === 0)
    throw new AppError('CONFLICT', 'This course cannot be archived right now.');
  await d.db.batch([
    insertReviewEvent(d.db, { courseId: course.id, event: 'archived', actorId: auth.user.id }),
    auditInsert(d.db, {
      action: 'course.archived',
      actorUserId: auth.user.id,
      targetType: 'course',
      targetId: course.id,
      requestId: d.requestId,
    }),
  ]);
  return buildEditorView(d, (await findCourse(d.db, course.id))!);
}
