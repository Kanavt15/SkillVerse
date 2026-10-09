/** Accessible single-answer question authoring with stable IDs and explicit correct-choice controls. */
import { useState } from 'react';
import { newId, type QuizDefinition } from '@skillverse/shared';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input, inputClass } from '~/components/ui/input';
import { Alert } from '~/components/ui/alert';

export function QuizEditor({
  initial,
  errors,
}: {
  initial: QuizDefinition | null;
  errors?: Record<string, string[]>;
}) {
  const [quiz, setQuiz] = useState<QuizDefinition>(
    initial ?? { passingPercent: 70, questions: [] },
  );
  const patch = (id: string, values: Partial<QuizDefinition['questions'][number]>) =>
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((question) =>
        question.id === id ? { ...question, ...values } : question,
      ),
    }));
  const move = (index: number, offset: number) =>
    setQuiz((q) => {
      const questions = [...q.questions];
      [questions[index], questions[index + offset]] = [
        questions[index + offset]!,
        questions[index]!,
      ];
      return { ...q, questions };
    });
  return (
    <section aria-label="Quiz questions" className="space-y-5">
      <input
        type="hidden"
        name="quizStructure"
        value={JSON.stringify(
          quiz.questions.map((q) => ({ id: q.id, options: q.options.map((o) => o.id) })),
        )}
      />
      <div>
        <h2 className="text-lg font-semibold">Check their understanding</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Choose one correct answer per question. Learners see explanations after submitting and can
          try again.
        </p>
      </div>
      {errors && Object.keys(errors).some((k) => k.startsWith('quiz')) && (
        <Alert tone="danger">
          <ul>
            {Object.entries(errors)
              .filter(([k]) => k.startsWith('quiz'))
              .flatMap(([k, messages]) =>
                messages.map((message, i) => <li key={`${k}:${i}`}>{message}</li>),
              )}
          </ul>
        </Alert>
      )}
      <Field
        label="Passing score (%)"
        name="quizPassingPercent"
        hint="A passing attempt completes this lesson. Editing questions resets current learner completion; issued certificates stay valid."
      >
        {(p) => (
          <Input
            {...p}
            type="number"
            min={1}
            max={100}
            defaultValue={quiz.passingPercent}
            className="max-w-32"
          />
        )}
      </Field>
      {quiz.questions.map((question, index) => (
        <div key={question.id} className="space-y-4 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Question {index + 1}</h3>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move question ${index + 1} up`}
              >
                Move up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => move(index, 1)}
                disabled={index === quiz.questions.length - 1}
                aria-label={`Move question ${index + 1} down`}
              >
                Move down
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setQuiz((q) => ({
                    ...q,
                    questions: q.questions.filter((item) => item.id !== question.id),
                  }))
                }
                aria-label={`Remove question ${index + 1}`}
                className="text-danger"
              >
                Remove
              </Button>
            </div>
          </div>
          <Field label={`Question ${index + 1} text`} name={`prompt.${question.id}`}>
            {(p) => (
              <textarea
                {...p}
                className={inputClass}
                rows={2}
                maxLength={600}
                value={question.prompt}
                onChange={(e) => patch(question.id, { prompt: e.target.value })}
              />
            )}
          </Field>
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">
              Answer choices · select the correct one
            </legend>
            {question.options.map((option, optionIndex) => (
              <div key={option.id} className="flex items-center gap-3">
                <label className="flex shrink-0 items-center">
                  <input
                    type="radio"
                    name={`correct.${question.id}`}
                    value={option.id}
                    checked={question.correctOptionId === option.id}
                    onChange={() => patch(question.id, { correctOptionId: option.id })}
                    className="size-4 accent-brand"
                  />
                  <span className="sr-only">
                    Choice {optionIndex + 1} is correct for question {index + 1}
                  </span>
                </label>
                <div className="min-w-0 flex-1">
                  <Field
                    label={`Choice ${optionIndex + 1} for question ${index + 1}`}
                    name={`choice.${question.id}.${option.id}`}
                  >
                    {(p) => (
                      <Input
                        {...p}
                        maxLength={300}
                        value={option.text}
                        onChange={(e) =>
                          patch(question.id, {
                            options: question.options.map((o) =>
                              o.id === option.id ? { ...o, text: e.target.value } : o,
                            ),
                          })
                        }
                      />
                    )}
                  </Field>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={question.options.length <= 2}
                  aria-label={`Remove choice ${optionIndex + 1} from question ${index + 1}`}
                  onClick={() =>
                    patch(question.id, {
                      options: question.options.filter((o) => o.id !== option.id),
                      correctOptionId:
                        question.correctOptionId === option.id ? '' : question.correctOptionId,
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </fieldset>
          <Button
            variant="secondary"
            size="sm"
            disabled={question.options.length >= 6}
            onClick={() =>
              patch(question.id, { options: [...question.options, { id: newId(), text: '' }] })
            }
          >
            Add choice to question {index + 1}
          </Button>
          <Field
            label={`Explanation for question ${index + 1}`}
            name={`explanation.${question.id}`}
            hint="Help learners understand why the answer is correct."
          >
            {(p) => (
              <textarea
                {...p}
                rows={3}
                maxLength={1200}
                className={inputClass}
                value={question.explanation}
                onChange={(e) => patch(question.id, { explanation: e.target.value })}
              />
            )}
          </Field>
        </div>
      ))}
      {quiz.questions.length === 0 && (
        <p className="text-sm text-fg-muted">
          Add your first question to get started. Adding and arranging questions needs JavaScript.
        </p>
      )}
      <Button
        variant="secondary"
        disabled={quiz.questions.length >= 20}
        onClick={() =>
          setQuiz((q) => ({
            ...q,
            questions: [
              ...q.questions,
              {
                id: newId(),
                prompt: '',
                options: [
                  { id: newId(), text: '' },
                  { id: newId(), text: '' },
                ],
                correctOptionId: '',
                explanation: '',
              },
            ],
          }))
        }
      >
        Add question
      </Button>
      <p className="text-xs text-fg-subtle">
        {quiz.questions.length} of 20 questions · 2–6 choices each
      </p>
    </section>
  );
}
