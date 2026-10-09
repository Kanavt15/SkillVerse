/** Practice-quiz authoring, answer-free learner views and server grading contracts. */
import { z } from 'zod';
import { idSchema } from './common';

export const quizOptionSchema = z.strictObject({
  id: idSchema,
  text: z.string().trim().min(1).max(300),
});
export const quizQuestionSchema = z
  .strictObject({
    id: idSchema,
    prompt: z.string().trim().min(5, 'Write a question of at least 5 characters').max(600),
    options: z.array(quizOptionSchema).min(2).max(6),
    correctOptionId: z.string().min(1, 'Choose the correct answer').pipe(idSchema),
    explanation: z.string().trim().max(1200).default(''),
  })
  .superRefine((question, ctx) => {
    if (new Set(question.options.map((o) => o.id)).size !== question.options.length)
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Each choice needs a unique ID' });
    if (!question.options.some((o) => o.id === question.correctOptionId))
      ctx.addIssue({
        code: 'custom',
        path: ['correctOptionId'],
        message: 'Choose the correct answer',
      });
  });
export const quizDefinitionSchema = z
  .strictObject({
    passingPercent: z.number().int().min(1).max(100),
    questions: z.array(quizQuestionSchema).min(1, 'Add at least one question').max(20),
  })
  .superRefine((quiz, ctx) => {
    if (new Set(quiz.questions.map((q) => q.id)).size !== quiz.questions.length)
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'Each question needs a unique ID',
      });
  });
export type QuizDefinition = z.infer<typeof quizDefinitionSchema>;

/** Fail closed for missing or malformed persisted definitions, including legacy imports. */
export function quizDefinitionFromJson(value: string | null | undefined): QuizDefinition | null {
  try {
    const parsed = quizDefinitionSchema.safeParse(JSON.parse(value ?? 'null'));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const quizSubmissionSchema = z.strictObject({
  attemptId: idSchema,
  revision: idSchema,
  answers: z
    .array(z.strictObject({ questionId: idSchema, optionId: idSchema }))
    .min(1)
    .max(20),
});
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;

export const quizResultSchema = z.object({
  attemptId: z.string(),
  revision: z.string(),
  correctCount: z.number().int(),
  questionCount: z.number().int(),
  scorePercent: z.number().int(),
  passingPercent: z.number().int(),
  passed: z.boolean(),
  submittedAt: z.string(),
  feedback: z.array(
    z.object({
      questionId: z.string(),
      prompt: z.string(),
      selectedText: z.string(),
      correctText: z.string(),
      correct: z.boolean(),
      explanation: z.string(),
    }),
  ),
});
export type QuizResult = z.infer<typeof quizResultSchema>;

/** Deliberately excludes answer keys and explanations until the learner has submitted. */
export const learnerQuizSchema = z.object({
  revision: z.string(),
  passingPercent: z.number().int(),
  questions: z.array(
    z.object({ id: z.string(), prompt: z.string(), options: z.array(quizOptionSchema) }),
  ),
  lastAttempt: quizResultSchema.nullable(),
  recentAttempts: z.array(quizResultSchema.omit({ feedback: true })),
});
export type LearnerQuiz = z.infer<typeof learnerQuizSchema>;
