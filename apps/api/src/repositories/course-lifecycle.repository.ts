/** Atomic lifecycle receipts recheck the actor, session, MFA and reviewed version. */
import { and, eq, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { schema, type Db } from '@skillverse/db';
import { newId } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { findCourse, listLessons, listSections, refreshCourseStats } from './courses.repository';

const {
  courses,
  sections,
  lessons,
  lessonQuizzes,
  courseTags,
  auditLogs,
  courseReviewEvents,
  users,
  userRoles,
  sessions,
  mfaTotp,
  enrollments,
  lessonProgress,
} = schema;

export function currentAuthority(auth: AuthContext, requireMfa: boolean, staff: boolean) {
  const now = Date.now();
  return sql`EXISTS (SELECT 1 FROM ${users} AS actor
    JOIN ${userRoles} AS authority ON authority.user_id = actor.id
    JOIN ${sessions} AS credential ON credential.user_id = actor.id
    WHERE actor.id = ${auth.user.id} AND actor.status = 'active'
    AND credential.id = ${auth.session.tokenHash} AND credential.expires_at > ${now} AND credential.idle_expires_at > ${now}
    AND (NOT EXISTS (SELECT 1 FROM ${mfaTotp} WHERE user_id = actor.id AND enabled_at IS NOT NULL) OR credential.mfa_verified = 1)
    AND (${staff ? 1 : 0} = 0 AND actor.email_verified_at IS NOT NULL AND authority.role = 'instructor'
      OR ${staff ? 1 : 0} = 1 AND authority.role IN ('moderator', 'admin', 'super_admin')
      AND (${requireMfa ? 1 : 0} = 0 OR credential.mfa_verified = 1 AND EXISTS (SELECT 1 FROM ${mfaTotp} WHERE user_id = actor.id AND enabled_at IS NOT NULL))))`;
}

function receipt(
  db: Db,
  auth: AuthContext,
  courseId: string,
  action: string,
  notes: string | null,
  requestId: string,
  eligible: ReturnType<typeof sql>,
) {
  const receiptId = newId(),
    now = Date.now();
  const statement = db
    .insert(auditLogs)
    .select(
      sql`SELECT ${receiptId}, ${auth.user.id}, ${action}, 'course', ${courseId}, ${JSON.stringify({ notes })}, NULL, ${requestId}, ${now} FROM ${courses} WHERE ${eligible}`,
    )
    .returning({ id: auditLogs.id });
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receiptId})`;
  return { statement, guard, now };
}

export async function startRevision(
  db: Db,
  auth: AuthContext,
  sourceId: string,
  requestId: string,
) {
  const source = await findCourse(db, sourceId);
  if (
    !source ||
    source.instructorId !== auth.user.id ||
    source.status !== 'published' ||
    source.sourceCourseId
  )
    return null;
  const existing = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.sourceCourseId, sourceId),
        sql`${courses.status} IN ('draft', 'rejected', 'in_review')`,
      ),
    )
    .get();
  if (existing) return existing.id;
  const [sectionRows, lessonRows, quizRows, tagRows] = await Promise.all([
    listSections(db, sourceId),
    listLessons(db, sourceId),
    db
      .select()
      .from(lessonQuizzes)
      .innerJoin(lessons, eq(lessons.id, lessonQuizzes.lessonId))
      .where(eq(lessons.courseId, sourceId)),
    db.select().from(courseTags).where(eq(courseTags.courseId, sourceId)),
  ]);
  // Keep the complete copy and publication below D1's per-request statement budget.
  if (lessonRows.length > 150 || sectionRows.length > 50)
    throw new Error(
      'This course exceeds the revision curriculum limit (150 lessons, 50 sections).',
    );
  const revisionId = newId(),
    sectionIds = new Map(sectionRows.map((s) => [s.id, newId()])),
    lessonIds = new Map(lessonRows.map((l) => [l.id, newId()]));
  const r = receipt(
    db,
    auth,
    sourceId,
    'course.revision_created',
    null,
    requestId,
    and(
      eq(courses.id, sourceId),
      eq(courses.version, source.version),
      eq(courses.status, 'published'),
      currentAuthority(auth, false, false),
    )!,
  );
  const clone = db
    .insert(courses)
    .select(
      sql`SELECT ${revisionId}, instructor_id, ${`revision-${revisionId}`}, title, subtitle, description, category_id, level, language, price_in_paise, currency, learning_outcomes, requirements, thumbnail_key, 'draft', ${sourceId}, ${source.version}, 0, is_plus_eligible, lesson_count, duration_minutes, 0, 0, 0, NULL, NULL, NULL, ${r.now}, ${r.now} FROM ${courses} WHERE id = ${sourceId} AND ${r.guard}`,
    );
  const statements: BatchItem<'sqlite'>[] = [r.statement, clone];
  for (const s of sectionRows)
    statements.push(
      db
        .insert(sections)
        .select(
          sql`SELECT ${sectionIds.get(s.id)!}, ${revisionId}, ${s.title}, ${s.id}, NULL, ${s.position}, ${r.now}, ${r.now} WHERE ${r.guard}`,
        ),
    );
  for (const l of lessonRows)
    statements.push(
      db
        .insert(lessons)
        .select(
          sql`SELECT ${lessonIds.get(l.id)!}, ${revisionId}, ${sectionIds.get(l.sectionId)!}, ${l.title}, ${l.id}, NULL, ${l.type}, ${l.position}, ${l.isPreview ? 1 : 0}, ${l.durationMinutes}, ${l.contentMarkdown}, ${l.videoProvider}, ${l.videoRef}, ${l.videoLearning}, ${r.now}, ${r.now} WHERE ${r.guard}`,
        ),
    );
  for (const q of quizRows)
    statements.push(
      db
        .insert(lessonQuizzes)
        .select(
          sql`SELECT ${lessonIds.get(q.lessons.id)!}, ${q.lesson_quizzes.revision}, ${q.lesson_quizzes.definition}, ${r.now} WHERE ${r.guard}`,
        ),
    );
  for (const t of tagRows)
    statements.push(
      db.insert(courseTags).select(sql`SELECT ${revisionId}, ${t.tagId} WHERE ${r.guard}`),
    );
  try {
    const result = await db.batch([statements[0]!, ...statements.slice(1)]);
    return Array.isArray(result[0]) && result[0].length ? revisionId : null;
  } catch (error) {
    // The partial unique index makes concurrent "start revision" requests idempotent.
    const raced = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(
          eq(courses.sourceCourseId, sourceId),
          sql`${courses.status} IN ('draft', 'rejected', 'in_review')`,
        ),
      )
      .get();
    if (raced) return raced.id;
    throw error;
  }
}

/** Reviewed copy -> live rows. Existing lesson IDs are retained; removals are retired. */
export async function reviewDecision(
  db: Db,
  auth: AuthContext,
  courseId: string,
  version: number,
  decision: 'approved' | 'rejected',
  notes: string | null,
  requestId: string,
  requireMfa: boolean,
) {
  const draft = await findCourse(db, courseId);
  if (!draft) return false;
  const source = draft.sourceCourseId ? await findCourse(db, draft.sourceCourseId) : null;
  if (
    decision === 'approved' &&
    draft.sourceCourseId &&
    (!source || source.status !== 'published' || source.version !== draft.baseVersion)
  )
    return false;
  const [sectionRows, lessonRows, quizzes, tags] = await Promise.all([
    listSections(db, courseId),
    listLessons(db, courseId),
    db
      .select()
      .from(lessonQuizzes)
      .innerJoin(lessons, eq(lessons.id, lessonQuizzes.lessonId))
      .where(eq(lessons.courseId, courseId)),
    db.select().from(courseTags).where(eq(courseTags.courseId, courseId)),
  ]);
  const r = receipt(
    db,
    auth,
    courseId,
    `course.${decision}`,
    notes,
    requestId,
    and(
      eq(courses.id, courseId),
      eq(courses.version, version),
      eq(courses.status, 'in_review'),
      sql`${courses.instructorId} <> ${auth.user.id}`,
      currentAuthority(auth, requireMfa, true),
      source && decision === 'approved'
        ? sql`EXISTS (SELECT 1 FROM courses AS live WHERE live.id = ${source.id} AND live.status = 'published' AND live.version = ${draft.baseVersion})`
        : undefined,
    )!,
  );
  const statements: BatchItem<'sqlite'>[] = [r.statement];
  if (decision === 'approved' && source) {
    statements.push(
      db
        .update(courses)
        .set({
          title: draft.title,
          subtitle: draft.subtitle,
          description: draft.description,
          categoryId: draft.categoryId,
          level: draft.level,
          language: draft.language,
          priceInPaise: draft.priceInPaise,
          learningOutcomes: draft.learningOutcomes,
          requirements: draft.requirements,
          thumbnailKey: draft.thumbnailKey,
          reviewNotes: null,
        })
        .where(and(eq(courses.id, source.id), r.guard)),
    );
    // Retired rows keep foreign keys for notes, attempts, progress and discussion links.
    statements.push(
      db
        .update(lessons)
        .set({ retiredAt: new Date(r.now), isPreview: false })
        .where(and(eq(lessons.courseId, source.id), r.guard)),
    );
    statements.push(
      db
        .update(sections)
        .set({ retiredAt: new Date(r.now) })
        .where(and(eq(sections.courseId, source.id), r.guard)),
    );
    const sectionIds = new Map(sectionRows.map((s) => [s.id, s.sourceSectionId ?? newId()]));
    for (const s of sectionRows)
      statements.push(
        db
          .insert(sections)
          .select(
            sql`SELECT ${sectionIds.get(s.id)!}, ${source.id}, ${s.title}, NULL, NULL, ${s.position}, ${r.now}, ${r.now} WHERE ${r.guard}`,
          )
          .onConflictDoUpdate({
            target: sections.id,
            set: {
              title: s.title,
              position: s.position,
              retiredAt: null,
              updatedAt: new Date(r.now),
            },
          }),
      );
    for (const l of lessonRows) {
      const liveId = l.sourceLessonId ?? newId();
      statements.push(
        db
          .insert(lessons)
          .select(
            sql`SELECT ${liveId}, ${source.id}, ${sectionIds.get(l.sectionId)!}, ${l.title}, NULL, NULL, ${l.type}, ${l.position}, ${l.isPreview ? 1 : 0}, ${l.durationMinutes}, ${l.contentMarkdown}, ${l.videoProvider}, ${l.videoRef}, ${l.videoLearning}, ${r.now}, ${r.now} WHERE ${r.guard}`,
          )
          .onConflictDoUpdate({
            target: lessons.id,
            set: {
              sectionId: sectionIds.get(l.sectionId)!,
              title: l.title,
              position: l.position,
              isPreview: l.isPreview,
              durationMinutes: l.durationMinutes,
              contentMarkdown: l.contentMarkdown,
              videoProvider: l.videoProvider,
              videoRef: l.videoRef,
              videoLearning: l.videoLearning,
              retiredAt: null,
              updatedAt: new Date(r.now),
            },
          }),
      );
      const q = quizzes.find((q) => q.lessons.id === l.id)?.lesson_quizzes;
      if (q) {
        const changed = sql`EXISTS (SELECT 1 FROM ${lessonQuizzes} WHERE lesson_id = ${liveId} AND definition <> ${q.definition})`;
        statements.push(
          db
            .update(lessonProgress)
            .set({ completedAt: null, updatedAt: new Date(r.now) })
            .where(and(eq(lessonProgress.lessonId, liveId), changed, r.guard)),
        );
        statements.push(
          db
            .insert(lessonQuizzes)
            .select(
              sql`SELECT ${liveId}, ${q.revision}, ${q.definition}, ${r.now} WHERE ${r.guard}`,
            )
            .onConflictDoUpdate({
              target: lessonQuizzes.lessonId,
              set: {
                revision: sql`CASE WHEN ${lessonQuizzes.definition} <> ${q.definition} THEN ${q.revision} ELSE ${lessonQuizzes.revision} END`,
                definition: q.definition,
                updatedAt: new Date(r.now),
              },
            }),
        );
      }
    }
    statements.push(db.delete(courseTags).where(and(eq(courseTags.courseId, source.id), r.guard)));
    for (const t of tags)
      statements.push(
        db.insert(courseTags).select(sql`SELECT ${source.id}, ${t.tagId} WHERE ${r.guard}`),
      );
    statements.push(refreshCourseStats(db, source.id, r.guard));
    statements.push(
      db
        .update(enrollments)
        .set({
          completedAt: sql`CASE WHEN NOT EXISTS (SELECT 1 FROM ${lessons} WHERE ${lessons.courseId} = ${source.id} AND ${lessons.retiredAt} IS NULL AND NOT EXISTS (SELECT 1 FROM ${lessonProgress} WHERE ${lessonProgress.enrollmentId} = ${enrollments.id} AND ${lessonProgress.lessonId} = ${lessons.id} AND ${lessonProgress.completedAt} IS NOT NULL)) THEN coalesce(${enrollments.completedAt}, ${r.now}) ELSE NULL END`,
          updatedAt: new Date(r.now),
        })
        .where(and(eq(enrollments.courseId, source.id), r.guard)),
    );
    statements.push(
      db
        .insert(courseReviewEvents)
        .select(
          sql`SELECT ${newId()}, ${source.id}, 'revision_approved', ${auth.user.id}, ${notes}, ${r.now} WHERE ${r.guard}`,
        ),
    );
  }
  statements.push(
    db
      .update(courses)
      .set({
        status: decision === 'rejected' ? 'rejected' : source ? 'archived' : 'published',
        publishedAt:
          decision === 'approved' && !source
            ? (draft.publishedAt ?? new Date(r.now))
            : draft.publishedAt,
        reviewNotes: notes,
      })
      .where(and(eq(courses.id, courseId), r.guard)),
  );
  statements.push(
    db
      .insert(courseReviewEvents)
      .select(
        sql`SELECT ${newId()}, ${courseId}, ${decision}, ${auth.user.id}, ${notes}, ${r.now} WHERE ${r.guard}`,
      ),
  );
  const result = await db.batch([statements[0]!, ...statements.slice(1)]);
  return Array.isArray(result[0]) && result[0].length === 1;
}

export async function ownerTransition(
  db: Db,
  auth: AuthContext,
  courseId: string,
  version: number,
  decision: 'submit' | 'withdraw' | 'archive',
  requestId: string,
) {
  const allowed =
    decision === 'submit'
      ? ['draft', 'rejected']
      : decision === 'withdraw'
        ? ['in_review']
        : ['draft', 'rejected', 'published'];
  const status =
    decision === 'submit' ? 'in_review' : decision === 'withdraw' ? 'draft' : 'archived';
  const r = receipt(
    db,
    auth,
    courseId,
    `course.${decision}`,
    null,
    requestId,
    and(
      eq(courses.id, courseId),
      eq(courses.instructorId, auth.user.id),
      eq(courses.version, version),
      sql`${courses.status} IN ${allowed}`,
      currentAuthority(auth, false, false),
    )!,
  );
  const statements: BatchItem<'sqlite'>[] = [
    r.statement,
    db
      .update(courses)
      .set({ status, submittedAt: decision === 'submit' ? new Date(r.now) : null })
      .where(and(eq(courses.id, courseId), r.guard)),
  ];
  if (decision !== 'withdraw')
    statements.push(
      db
        .insert(courseReviewEvents)
        .select(
          sql`SELECT ${newId()}, ${courseId}, ${decision === 'submit' ? 'submitted' : 'archived'}, ${auth.user.id}, NULL, ${r.now} WHERE ${r.guard}`,
        ),
    );
  const result = await db.batch([statements[0]!, ...statements.slice(1)]);
  return Array.isArray(result[0]) && result[0].length === 1;
}

export async function moderate(
  db: Db,
  auth: AuthContext,
  courseId: string,
  version: number,
  decision: 'archive' | 'restore' | 'takedown',
  notes: string,
  requestId: string,
  requireMfa: boolean,
) {
  const course = await findCourse(db, courseId);
  if (!course || course.sourceCourseId) return false;
  const from = decision === 'archive' ? 'published' : decision === 'restore' ? 'archived' : null;
  const status =
    decision === 'archive'
      ? 'archived'
      : decision === 'takedown'
        ? 'taken_down'
        : course.publishedAt
          ? 'published'
          : 'draft';
  const r = receipt(
    db,
    auth,
    courseId,
    `admin.course_${decision === 'archive' ? 'archived' : decision === 'restore' ? 'restored' : 'taken_down'}`,
    notes,
    requestId,
    and(
      eq(courses.id, courseId),
      eq(courses.version, version),
      from ? eq(courses.status, from) : sql`${courses.status} IN ('published', 'archived')`,
      sql`${courses.instructorId} <> ${auth.user.id}`,
      currentAuthority(auth, requireMfa, true),
    )!,
  );
  const result = await db.batch([
    r.statement,
    db
      .update(courses)
      .set({ status, reviewNotes: notes })
      .where(and(eq(courses.id, courseId), r.guard)),
    db
      .insert(courseReviewEvents)
      .select(
        sql`SELECT ${newId()}, ${courseId}, ${decision === 'archive' ? 'archived' : decision === 'restore' ? 'restored' : 'taken_down'}, ${auth.user.id}, ${notes}, ${r.now} WHERE ${r.guard}`,
      ),
  ]);
  return result[0].length === 1;
}
