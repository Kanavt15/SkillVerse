/** Instructor-authored video navigation and reflection content, protected like the lesson body. */
import { z } from 'zod';

const moment = z.number().int().min(0).max(36_000);
const line = (max: number, required = true) =>
  z
    .string()
    .trim()
    .min(required ? 1 : 0)
    .max(max)
    .regex(/^[^|\r\n]*$/, 'Use a single line without the | character.');
export const videoLearningSchema = z
  .strictObject({
    chapters: z
      .array(z.strictObject({ atSeconds: moment, title: line(120) }))
      .max(60)
      .default([]),
    transcript: z
      .array(z.strictObject({ atSeconds: moment, text: line(2000) }))
      .max(400)
      .default([]),
    checkpoints: z
      .array(
        z.strictObject({
          atSeconds: moment,
          prompt: line(1000),
          explanation: line(2000, false).default(''),
        }),
      )
      .max(30)
      .default([]),
  })
  .superRefine((value, context) => {
    for (const key of ['chapters', 'transcript', 'checkpoints'] as const) {
      value[key].forEach((entry, index) => {
        if (index && entry.atSeconds <= value[key][index - 1]!.atSeconds)
          context.addIssue({
            code: 'custom',
            path: [key, index, 'atSeconds'],
            message: 'Use increasing timestamps without duplicates.',
          });
      });
    }
    // Leave room for other lesson fields within the API's existing 64 KB request limit.
    if (new TextEncoder().encode(JSON.stringify(value)).length > 48_000)
      context.addIssue({
        code: 'custom',
        path: [],
        message: 'Keep video learning content under 48 KB. Split longer videos into lessons.',
      });
  });

export type VideoLearning = z.infer<typeof videoLearningSchema>;

/** Safely reads a saved timeline; old lessons and invalid legacy JSON have no invented content. */
export function videoLearningFromJson(value: string): VideoLearning {
  try {
    const parsed = videoLearningSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    /* An empty timeline keeps legacy lessons playable. */
  }
  return { chapters: [], transcript: [], checkpoints: [] };
}

/** Parses whole seconds, MM:SS or HH:MM:SS, bounded to the maximum lesson length. */
export function parseVideoTimestamp(value: string): number | null {
  if (!/^\d{1,5}(?::\d{2}){0,2}$/.test(value.trim())) return null;
  const parts = value.trim().split(':').map(Number);
  if (parts.slice(1).some((part) => part > 59)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds <= 36_000 ? seconds : null;
}

/** Formats a validated timestamp as minutes and seconds, including long lessons. */
export function formatVideoTimestamp(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
