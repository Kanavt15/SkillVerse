/** Authoring tests cover line feedback, value round trips and the shared validation boundary. */
import { describe, expect, it } from 'vitest';
import { readVideoLearning, videoLearningFields } from './video-learning-form';

describe('video learning authoring form', () => {
  it('round trips chapter, transcript and checkpoint text including Unicode', () => {
    const values = {
      videoChapters: '0:00 | Introduction\n2:30 | अभ्यास',
      videoTranscript: '0:00 | Welcome to the lesson\n1:00 | Try it for yourself',
      videoCheckpoints: '2:30 | What will you try? | Start with one small change',
    };
    const result = readVideoLearning(values);
    expect(result.ok).toBe(true);
    if (result.ok) expect(videoLearningFields(result.data)).toEqual(values);
  });
  it('reports the original line when blanks, ordering or malformed timestamps appear', () => {
    const result = readVideoLearning({
      videoChapters: '\n0:00 | Intro\n\n0:00 | Duplicate',
      videoTranscript: '1:90 | Wrong time',
      videoCheckpoints: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.videoChapters?.[0]).toContain('Line 4:');
      expect(result.fieldErrors.videoTranscript?.[0]).toContain('Line 1:');
    }
  });
  it('saves empty optional fields as an empty timeline and rejects missing text', () => {
    expect(
      readVideoLearning({ videoChapters: '', videoTranscript: '', videoCheckpoints: '' }),
    ).toEqual({ ok: true, data: { chapters: [], transcript: [], checkpoints: [] } });
    expect(
      readVideoLearning({ videoChapters: '0:00 |', videoTranscript: '', videoCheckpoints: '' }).ok,
    ).toBe(false);
  });
});
