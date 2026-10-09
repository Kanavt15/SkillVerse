/** Bounded discussion reads and atomic, versioned content moderation. */
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import {
  newId,
  type ModerationInput,
  type QuestionInput,
  type QuestionQuery,
  type ReportInput,
  type ReportQuery,
} from '@skillverse/shared';

const {
  discussionQuestions: questions,
  discussionReplies: replies,
  contentReports: reports,
  courses,
  lessons,
  users,
  reviews,
  auditLogs,
} = schema;
export const PAGE_SIZE = 20;
const questionFields = {
  question: questions,
  displayName: users.displayName,
  username: users.username,
  lessonTitle: lessons.title,
  replyCount: sql<number>`(SELECT count(*) FROM ${replies} WHERE ${replies.questionId} = ${questions.id} AND ${replies.hiddenAt} IS NULL)`,
};
function questionFilter(courseId: string, query: QuestionQuery) {
  return and(
    eq(questions.courseId, courseId),
    isNull(questions.hiddenAt),
    query.lessonId ? eq(questions.lessonId, query.lessonId) : undefined,
    query.status === 'resolved' ? sql`${questions.acceptedReplyId} IS NOT NULL` : undefined,
    query.status === 'unanswered' ? isNull(questions.acceptedReplyId) : undefined,
  );
}
export function listQuestions(db: Db, courseId: string, query: QuestionQuery) {
  return db
    .select(questionFields)
    .from(questions)
    .leftJoin(users, eq(users.id, questions.authorUserId))
    .leftJoin(lessons, eq(lessons.id, questions.lessonId))
    .where(questionFilter(courseId, query))
    .orderBy(desc(questions.createdAt), desc(questions.id))
    .limit(PAGE_SIZE)
    .offset((query.page - 1) * PAGE_SIZE);
}
export function countQuestions(db: Db, courseId: string, query: QuestionQuery) {
  return db
    .select({ total: sql<number>`count(*)` })
    .from(questions)
    .where(questionFilter(courseId, query))
    .get();
}
export function findQuestion(db: Db, courseId: string, id: string) {
  return db
    .select(questionFields)
    .from(questions)
    .leftJoin(users, eq(users.id, questions.authorUserId))
    .leftJoin(lessons, eq(lessons.id, questions.lessonId))
    .where(and(eq(questions.id, id), eq(questions.courseId, courseId), isNull(questions.hiddenAt)))
    .get();
}
const replyFields = { reply: replies, displayName: users.displayName, username: users.username };
export function listReplies(db: Db, questionId: string, page: number) {
  return db
    .select(replyFields)
    .from(replies)
    .leftJoin(users, eq(users.id, replies.authorUserId))
    .where(and(eq(replies.questionId, questionId), isNull(replies.hiddenAt)))
    .orderBy(asc(replies.createdAt), asc(replies.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
}
export function findReply(db: Db, questionId: string, id: string) {
  return db
    .select(replyFields)
    .from(replies)
    .leftJoin(users, eq(users.id, replies.authorUserId))
    .where(and(eq(replies.id, id), eq(replies.questionId, questionId), isNull(replies.hiddenAt)))
    .get();
}
export async function addQuestion(
  db: Db,
  courseId: string,
  authorId: string,
  input: QuestionInput,
) {
  const id = newId(),
    now = Date.now();
  // Recheck publication and lesson membership at write time, including concurrent course edits.
  await db.insert(questions)
    .select(sql`SELECT ${id}, ${courseId}, ${input.lessonId}, ${authorId}, ${input.title}, ${input.body}, ${input.timestampSeconds}, NULL, NULL, NULL, NULL, ${now}, ${now}
    FROM ${courses} WHERE ${courses.id} = ${courseId} AND ${courses.status} = 'published'
    AND (${input.lessonId} IS NULL OR EXISTS (SELECT 1 FROM ${lessons} WHERE ${lessons.id} = ${input.lessonId} AND ${lessons.courseId} = ${courseId}))`);
  return findQuestion(db, courseId, id);
}
export async function addReply(
  db: Db,
  courseId: string,
  questionId: string,
  authorId: string,
  body: string,
) {
  const id = newId(),
    now = Date.now();
  await db.insert(replies)
    .select(sql`SELECT ${id}, ${questionId}, ${authorId}, ${body}, NULL, NULL, NULL, ${now}, ${now}
    FROM ${questions} INNER JOIN ${courses} ON ${courses.id} = ${questions.courseId}
    WHERE ${questions.id} = ${questionId} AND ${questions.courseId} = ${courseId} AND ${questions.hiddenAt} IS NULL AND ${courses.status} = 'published'`);
  return findReply(db, questionId, id);
}
export function setSolution(db: Db, courseId: string, questionId: string, replyId: string | null) {
  return db
    .update(questions)
    .set({ acceptedReplyId: replyId, updatedAt: new Date() })
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.courseId, courseId),
        isNull(questions.hiddenAt),
        sql`EXISTS (SELECT 1 FROM ${courses} WHERE ${courses.id} = ${courseId} AND ${courses.status} = 'published')`,
        replyId
          ? sql`EXISTS (SELECT 1 FROM ${replies} WHERE ${replies.id} = ${replyId} AND ${replies.questionId} = ${questionId} AND ${replies.hiddenAt} IS NULL)`
          : undefined,
      ),
    )
    .returning({ id: questions.id });
}

/** Internal inspection; caller must check membership or staff authorization before returning content. */
export async function targetContent(db: Db, type: ReportInput['targetType'], id: string) {
  if (type === 'question') {
    const row = await db.select().from(questions).where(eq(questions.id, id)).get();
    return row
      ? {
          courseId: row.courseId,
          title: row.title,
          body: row.body,
          hidden: Boolean(row.hiddenAt),
          authorId: row.authorUserId,
        }
      : null;
  }
  if (type === 'reply') {
    const row = await db
      .select({
        reply: replies,
        courseId: questions.courseId,
        title: questions.title,
        parentHidden: questions.hiddenAt,
      })
      .from(replies)
      .innerJoin(questions, eq(questions.id, replies.questionId))
      .where(eq(replies.id, id))
      .get();
    return row
      ? {
          courseId: row.courseId,
          title: `Reply: ${row.title}`,
          body: row.reply.body,
          hidden: Boolean(row.reply.hiddenAt),
          parentHidden: Boolean(row.parentHidden),
          authorId: row.reply.authorUserId,
        }
      : null;
  }
  const row = await db.select().from(reviews).where(eq(reviews.id, id)).get();
  return row
    ? {
        courseId: row.courseId,
        title: `${row.rating}-star review`,
        body: row.body,
        hidden: Boolean(row.hiddenAt),
        authorId: row.userId,
      }
    : null;
}
export function addReport(db: Db, courseId: string, reporterId: string, input: ReportInput) {
  return db
    .insert(reports)
    .values({ courseId, reporterUserId: reporterId, ...input })
    .onConflictDoNothing({
      target: [reports.reporterUserId, reports.targetType, reports.targetId],
    });
}
const reportFields = {
  report: reports,
  courseSlug: courses.slug,
  courseTitle: courses.title,
  reporterName: users.displayName,
};
export function listReports(db: Db, query: ReportQuery) {
  return db
    .select(reportFields)
    .from(reports)
    .innerJoin(courses, eq(courses.id, reports.courseId))
    .innerJoin(users, eq(users.id, reports.reporterUserId))
    .where(eq(reports.status, query.status))
    .orderBy(asc(reports.createdAt), asc(reports.id))
    .limit(PAGE_SIZE)
    .offset((query.page - 1) * PAGE_SIZE);
}
export function countReports(db: Db, query: ReportQuery) {
  return db
    .select({ total: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.status, query.status))
    .get();
}
export function findReport(db: Db, id: string) {
  return db
    .select(reportFields)
    .from(reports)
    .innerJoin(courses, eq(courses.id, reports.courseId))
    .innerJoin(users, eq(users.id, reports.reporterUserId))
    .where(eq(reports.id, id))
    .get();
}
type ReportRow = NonNullable<Awaited<ReturnType<typeof findReport>>>['report'];
export async function moderate(
  db: Db,
  actorId: string,
  requestId: string,
  report: ReportRow,
  input: ModerationInput,
) {
  const token = newId(),
    now = new Date();
  const guard = sql`EXISTS (SELECT 1 FROM ${reports} WHERE ${reports.id} = ${report.id} AND ${reports.decisionToken} = ${token})`;
  const table =
    report.targetType === 'question'
      ? questions
      : report.targetType === 'reply'
        ? replies
        : reviews;
  const decision = db
    .update(reports)
    .set({
      status: input.decision === 'dismiss' ? 'dismissed' : 'resolved',
      version: input.version + 1,
      decisionToken: token,
      reviewedBy: actorId,
      reviewedAt: now,
      reviewNotes: input.notes,
      updatedAt: now,
    })
    .where(and(eq(reports.id, report.id), eq(reports.version, input.version)));
  const audit = db.insert(auditLogs)
    .select(sql`SELECT ${newId()}, ${actorId}, ${`content.${input.decision}`}, ${report.targetType}, ${report.targetId},
    ${JSON.stringify({ reportId: report.id, notes: input.notes })}, NULL, ${requestId}, ${now.getTime()} WHERE ${guard}`);
  if (input.decision === 'dismiss') {
    await db.batch([decision, audit]);
  } else {
    const target = db
      .update(table)
      .set({
        hiddenAt: input.decision === 'hide' ? now : null,
        moderatedBy: actorId,
        moderationNotes: input.notes,
        updatedAt: now,
      })
      .where(and(eq(table.id, report.targetId), guard));
    const clearSolution = db
      .update(questions)
      .set({ acceptedReplyId: null, updatedAt: now })
      .where(and(eq(questions.acceptedReplyId, report.targetId), guard));
    const ratings = db
      .update(courses)
      .set({
        ratingSum: sql`(SELECT coalesce(sum(${reviews.rating}), 0) FROM ${reviews} WHERE ${reviews.courseId} = ${report.courseId} AND ${reviews.hiddenAt} IS NULL)`,
        ratingCount: sql`(SELECT count(*) FROM ${reviews} WHERE ${reviews.courseId} = ${report.courseId} AND ${reviews.hiddenAt} IS NULL)`,
      })
      .where(and(eq(courses.id, report.courseId), guard));
    if (report.targetType === 'reply' && input.decision === 'hide')
      await db.batch([decision, target, clearSolution, audit]);
    else if (report.targetType === 'review') await db.batch([decision, target, ratings, audit]);
    else await db.batch([decision, target, audit]);
  }
  return (await findReport(db, report.id))?.report.decisionToken === token;
}
