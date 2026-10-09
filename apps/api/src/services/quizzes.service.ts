/** Practice quiz grading: enrollment policy, versioned answer keys and retry-safe atomic completion. */
import {
  newId,
  quizDefinitionFromJson,
  quizResultSchema,
  type QuizResult,
  type QuizSubmission,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import * as repository from '../repositories/quizzes.repository';
import { enrolledLesson } from './learning.service';

/** The only grading path. Submitted score/pass values are never accepted from the client. */
export async function submit(
  d: RequestDeps,
  auth: AuthContext,
  slug: string,
  lessonId: string,
  input: QuizSubmission,
): Promise<QuizResult> {
  const { lesson, enrollment, row } = await enrolledLesson(d, auth, slug, lessonId);
  if (lesson.type !== 'quiz') throw new AppError('NOT_FOUND', 'Quiz not found.');
  const quiz = await repository.findQuiz(d.db, lessonId);
  const definition = quizDefinitionFromJson(quiz?.definition);
  if (!quiz || !definition)
    throw new AppError('CONFLICT', 'This quiz is not ready. Please try again later.');
  const answers = [...input.answers].sort((a, b) => a.questionId.localeCompare(b.questionId));
  const canonical = JSON.stringify(answers);
  const replay = await repository.findAttempt(d.db, input.attemptId);
  function replayResult(attempt: NonNullable<typeof replay>) {
    if (
      attempt.enrollmentId !== enrollment.id ||
      attempt.lessonId !== lessonId ||
      attempt.quizRevision !== input.revision ||
      attempt.answers !== canonical
    )
      throw new AppError(
        'CONFLICT',
        'This submission ID has already been used. Start a new attempt.',
      );
    return quizResultSchema.parse(JSON.parse(attempt.result));
  }
  if (replay) return replayResult(replay);
  if (quiz.revision !== input.revision)
    throw new AppError(
      'CONFLICT',
      'This quiz has changed. Refresh the lesson before trying again.',
    );
  const selected = new Map(answers.map((a) => [a.questionId, a.optionId]));
  if (
    answers.length !== definition.questions.length ||
    selected.size !== answers.length ||
    !definition.questions.every((q) => q.options.some((o) => o.id === selected.get(q.id)))
  )
    throw new AppError('VALIDATION_FAILED', 'Choose one answer for every question.');
  const feedback = definition.questions.map((q) => ({
    questionId: q.id,
    prompt: q.prompt,
    selectedText: q.options.find((o) => o.id === selected.get(q.id))!.text,
    correctText: q.options.find((o) => o.id === q.correctOptionId)!.text,
    correct: selected.get(q.id) === q.correctOptionId,
    explanation: q.explanation,
  }));
  const correctCount = feedback.filter((f) => f.correct).length;
  const result: QuizResult = {
    attemptId: input.attemptId,
    revision: input.revision,
    correctCount,
    questionCount: feedback.length,
    scorePercent: Math.floor((correctCount * 100) / feedback.length),
    passingPercent: definition.passingPercent,
    // Compare the exact ratio; rounding the displayed score must never create a false pass.
    passed: correctCount * 100 >= definition.passingPercent * feedback.length,
    submittedAt: new Date().toISOString(),
    feedback,
  };
  const recorded = await repository.recordAttempt(d.db, {
    enrollmentId: enrollment.id,
    lessonId,
    courseId: row.course.id,
    userId: auth.user.id,
    answers: canonical,
    result,
    receiptId: newId(),
  });
  if (recorded) return replayResult(recorded);
  if ((await repository.findQuiz(d.db, lessonId))?.revision !== input.revision)
    throw new AppError(
      'CONFLICT',
      'This quiz has changed. Refresh the lesson before trying again.',
    );
  // Recheck access too: a concurrent unpublish must not masquerade as an attempt limit.
  await enrolledLesson(d, auth, slug, lessonId);
  throw new AppError(
    'RATE_LIMITED',
    'You have made 20 attempts in the last hour. Take a break and try again later.',
  );
}
