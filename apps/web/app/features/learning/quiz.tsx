/** Learner practice quiz, post-submission explanations and a private recent-attempt history. */
import { Form } from 'react-router';
import type { LearnerQuiz } from '@skillverse/shared';
import { Alert } from '~/components/ui/alert';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';

export function Quiz({
  quiz,
  enrolled,
  attemptId,
  values,
}: {
  quiz: LearnerQuiz;
  enrolled: boolean;
  attemptId: string;
  values?: Record<string, string>;
}) {
  const result = quiz.lastAttempt;
  return (
    <section aria-labelledby="quiz-title" className="mt-6 space-y-6">
      <div className="border-b border-border pb-4">
        <h2 id="quiz-title" className="text-xl font-semibold">
          Test what you’ve learned
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'} ·{' '}
          {quiz.passingPercent}% to pass. Choose one answer for each question. You can try again
          after reviewing your feedback.
        </p>
      </div>
      {result && (
        <div className="space-y-4">
          <Alert tone={result.passed ? 'success' : 'info'}>
            <strong>
              {result.passed ? 'Quiz passed' : 'Keep practicing'} · {result.scorePercent}%
            </strong>
            <p className="mt-1">
              {result.correctCount} of {result.questionCount} correct.
              {result.passed
                ? ' This lesson is complete.'
                : ` You need ${result.passingPercent}% to pass. Review the explanations and try again.`}
            </p>
          </Alert>
          <details className="rounded-lg border border-border p-4" open={!result.passed}>
            <summary className="cursor-pointer text-sm font-semibold">Review your answers</summary>
            <ol className="mt-4 space-y-5">
              {result.feedback.map((item, index) => (
                <li
                  key={item.questionId}
                  className="border-t border-border pt-4 first:border-0 first:pt-0"
                >
                  <h3 className="text-sm font-semibold">
                    {index + 1}. {item.prompt}
                  </h3>
                  <p className={`mt-2 text-sm ${item.correct ? 'text-accent' : 'text-fg-muted'}`}>
                    {item.correct ? 'Correct' : 'Your answer'}: {item.selectedText}
                  </p>
                  {!item.correct && (
                    <p className="mt-1 text-sm font-medium">Correct answer: {item.correctText}</p>
                  )}
                  {item.explanation && (
                    <p className="mt-2 text-sm text-fg-muted whitespace-pre-wrap">
                      {item.explanation}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
      <Form method="post" key={attemptId} className="space-y-6">
        <input type="hidden" name="intent" value="quiz" />
        <input type="hidden" name="attemptId" value={attemptId} />
        <input type="hidden" name="revision" value={quiz.revision} />
        {result && <h3 className="text-lg font-semibold">Try the quiz again</h3>}
        <fieldset disabled={!enrolled} className="space-y-6">
          {quiz.questions.map((question, index) => (
            <fieldset key={question.id} className="space-y-2">
              <legend className="mb-3 text-base font-semibold">
                {index + 1}. {question.prompt}
              </legend>
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm hover:bg-surface-muted has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
                >
                  <input
                    type="radio"
                    name={`answer.${question.id}`}
                    value={option.id}
                    defaultChecked={values?.[`answer.${question.id}`] === option.id}
                    className="mt-0.5 size-4 shrink-0 accent-brand"
                    required
                  />
                  <span className="min-w-0 break-words">{option.text}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {enrolled ? (
            <SubmitButton name="intent" value="quiz" pendingText="Checking answers…">
              Submit answers
            </SubmitButton>
          ) : (
            <p className="text-sm text-fg-muted">
              Enroll in this course to submit answers and track your progress.
            </p>
          )}
        </fieldset>
      </Form>
      {quiz.recentAttempts.length > 0 && (
        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer text-sm font-medium">Your recent attempts</summary>
          <ul className="mt-3 space-y-2 text-sm text-fg-muted">
            {quiz.recentAttempts.map((attempt) => (
              <li key={attempt.attemptId} className="flex flex-wrap justify-between gap-2">
                <LocalTime iso={attempt.submittedAt} />
                <span>
                  {attempt.scorePercent}% · {attempt.passed ? 'Passed' : 'Try again'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
