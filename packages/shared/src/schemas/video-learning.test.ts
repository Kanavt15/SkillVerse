/** Video timeline boundary tests: time parsing, ordering, payload bounds and safe legacy defaults. */
import { describe, expect, it } from 'vitest';
import {
  formatVideoTimestamp,
  parseVideoTimestamp,
  videoLearningFromJson,
  videoLearningSchema,
} from './video-learning';

describe('video timeline validation', () => {
  it('parses valid timestamps and refuses ambiguous or out-of-range times', () => {
    for (const [input, seconds] of [
      ['0:00', 0],
      ['90', 90],
      [' 2:30 ', 150],
      ['1:02:03', 3723],
      ['600:00', 36000],
    ] as const)
      expect(parseVideoTimestamp(input)).toBe(seconds);
    for (const value of [
      '-1',
      '1.5',
      '1:60',
      '0:99:00',
      '10:00:01',
      '36001',
      '1:2',
      '',
      'https://evil.test',
    ])
      expect(parseVideoTimestamp(value)).toBeNull();
    expect(formatVideoTimestamp(150)).toBe('2:30');
  });

  it('rejects duplicate/decreasing moments and non-integer timestamps in every collection', () => {
    for (const key of ['chapters', 'transcript', 'checkpoints'] as const) {
      const entry = (atSeconds: number) => ({
        atSeconds,
        ...(key === 'chapters'
          ? { title: 'A chapter' }
          : key === 'transcript'
            ? { text: 'Spoken words' }
            : { prompt: 'Try an exercise' }),
      });
      for (const times of [[10, 10], [20, 10], [0.5], [-1], [36001]])
        expect(videoLearningSchema.safeParse({ [key]: times.map(entry) }).success).toBe(false);
      expect(videoLearningSchema.safeParse({ [key]: [entry(0), entry(10)] }).success).toBe(true);
    }
  });

  it('bounds text, lists and UTF-8 bytes without silently truncating instructor content', () => {
    expect(
      videoLearningSchema.safeParse({
        chapters: Array.from({ length: 61 }, (_, atSeconds) => ({ atSeconds, title: 'Chapter' })),
      }).success,
    ).toBe(false);
    expect(
      videoLearningSchema.safeParse({
        transcript: Array.from({ length: 20 }, (_, atSeconds) => ({
          atSeconds,
          text: '界'.repeat(1000),
        })),
      }).success,
    ).toBe(false);
    for (const title of ['', 'x'.repeat(121), 'Chapter\ntext', 'Chapter | text'])
      expect(videoLearningSchema.safeParse({ chapters: [{ atSeconds: 0, title }] }).success).toBe(
        false,
      );
    expect(videoLearningSchema.safeParse({ unknown: 'anything' }).success).toBe(false);
  });

  it('keeps old or invalid saved lessons empty, and preserves authored text as text', () => {
    for (const raw of ['{}', 'null', '{broken', '{"chapters":"wrong"}'])
      expect(videoLearningFromJson(raw)).toEqual({ chapters: [], transcript: [], checkpoints: [] });
    const value = {
      chapters: [],
      checkpoints: [],
      transcript: [{ atSeconds: 0, text: '<script>alert(1)</script>' }],
    };
    expect(videoLearningFromJson(JSON.stringify(value))).toEqual(value);
  });
});
