/** Converts progressive-enhancement friendly timeline text fields into validated lesson content. */
import {
  formatVideoTimestamp,
  parseVideoTimestamp,
  videoLearningSchema,
  type VideoLearning,
} from '@skillverse/shared';
import type { FieldErrors } from '~/lib/forms';

const fields = {
  chapters: 'videoChapters',
  transcript: 'videoTranscript',
  checkpoints: 'videoCheckpoints',
} as const;
export type VideoLearningFields = Record<(typeof fields)[keyof typeof fields], string>;

/** Reads one timestamped entry per line; mistakes return line-specific errors and preserve the form. */
export function readVideoLearning(
  values: VideoLearningFields,
): { ok: true; data: VideoLearning } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  const timeline: VideoLearning = { chapters: [], transcript: [], checkpoints: [] };
  for (const key of ['chapters', 'transcript', 'checkpoints'] as const) {
    const field = fields[key];
    const lines = values[field].split(/\r?\n/);
    const sourceLines: number[] = [];
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      const [time, ...parts] = line.split('|');
      const atSeconds = parseVideoTimestamp(time ?? '');
      const text = parts.shift()?.trim() ?? '';
      if (
        atSeconds === null ||
        !text ||
        (key !== 'checkpoints' && parts.length > 0) ||
        parts.length > 1
      ) {
        (errors[field] ??= []).push(
          `Line ${index + 1}: use a valid timestamp, then | and the text${key === 'checkpoints' ? ', optionally | and an explanation' : ''}.`,
        );
        return;
      }
      sourceLines.push(index + 1);
      if (key === 'chapters') timeline.chapters.push({ atSeconds, title: text });
      else if (key === 'transcript') timeline.transcript.push({ atSeconds, text });
      else
        timeline.checkpoints.push({ atSeconds, prompt: text, explanation: parts[0]?.trim() ?? '' });
    });
    const parsed = videoLearningSchema.safeParse({ [key]: timeline[key] });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const index = issue.path[1];
        const prefix = typeof index === 'number' ? `Line ${sourceLines[index]}: ` : '';
        (errors[field] ??= []).push(`${prefix}${issue.message}`);
      }
    }
  }
  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  const parsed = videoLearningSchema.safeParse(timeline);
  if (!parsed.success)
    return {
      ok: false,
      fieldErrors: { videoTranscript: parsed.error.issues.map((i) => i.message) },
    };
  return { ok: true, data: parsed.data };
}

/** Serialises stored, validated entries for editing; no placeholder lesson content is added. */
export function videoLearningFields(value: VideoLearning): VideoLearningFields {
  return {
    videoChapters: value.chapters
      .map((e) => `${formatVideoTimestamp(e.atSeconds)} | ${e.title}`)
      .join('\n'),
    videoTranscript: value.transcript
      .map((e) => `${formatVideoTimestamp(e.atSeconds)} | ${e.text}`)
      .join('\n'),
    videoCheckpoints: value.checkpoints
      .map(
        (e) =>
          `${formatVideoTimestamp(e.atSeconds)} | ${e.prompt}${e.explanation ? ` | ${e.explanation}` : ''}`,
      )
      .join('\n'),
  };
}
