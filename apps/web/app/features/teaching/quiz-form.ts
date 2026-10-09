/** Quiz form structure is validated before reading named fields; existing quizzes also edit without JS. */
import { z } from 'zod';
import { idSchema, type QuizDefinition } from '@skillverse/shared';

const structureSchema = z
  .array(z.strictObject({ id: idSchema, options: z.array(idSchema).min(2).max(6) }))
  .max(20);
const draftSchema = z.strictObject({
  passingPercent: z.number(),
  questions: z
    .array(
      z.strictObject({
        id: idSchema,
        prompt: z.string(),
        correctOptionId: z.string(),
        explanation: z.string(),
        options: z
          .array(z.strictObject({ id: idSchema, text: z.string() }))
          .min(2)
          .max(6),
      }),
    )
    .max(20),
});
/** Restores even incomplete authored fields after server validation, without trusting arbitrary JSON shapes. */
export function parseQuizDraft(value: string | undefined): QuizDefinition | null {
  try {
    const result = draftSchema.safeParse(JSON.parse(value ?? 'null'));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function readQuizForm(form: FormData): QuizDefinition | null {
  try {
    const raw = String(form.get('quizStructure') ?? '');
    if (raw.length > 10_000) return null;
    const structure = structureSchema.parse(JSON.parse(raw));
    const str = (key: string) => (typeof form.get(key) === 'string' ? String(form.get(key)) : '');
    const passingPercent = Number(str('quizPassingPercent'));
    return {
      passingPercent: Number.isFinite(passingPercent) ? passingPercent : 0,
      questions: structure.map((q) => ({
        id: q.id,
        prompt: str(`prompt.${q.id}`),
        correctOptionId: str(`correct.${q.id}`),
        explanation: str(`explanation.${q.id}`),
        options: q.options.map((id) => ({ id, text: str(`choice.${q.id}.${id}`) })),
      })),
    };
  } catch {
    return null;
  }
}
