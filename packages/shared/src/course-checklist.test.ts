import { describe, expect, it } from 'vitest';
import { submissionChecklist, type ChecklistCourse } from './course-checklist';

const article = (title: string) => ({
  title,
  type: 'article',
  video: null,
  contentMarkdown: 'x'.repeat(60),
});

const ready: ChecklistCourse = {
  subtitle: 'Play your first songs',
  description: 'd'.repeat(200),
  categoryId: 'cat',
  learningOutcomes: ['a', 'b', 'c'],
  sections: [{ title: 'One', lessons: [article('A'), article('B'), article('C')] }],
};

describe('submissionChecklist', () => {
  it('passes a complete course', () => {
    expect(submissionChecklist(ready)).toEqual([]);
  });

  it('lists every missing piece', () => {
    const problems = submissionChecklist({
      subtitle: '',
      description: '',
      categoryId: null,
      learningOutcomes: [],
      sections: [
        { title: 'Empty', lessons: [] },
        {
          title: 'Two',
          lessons: [
            { title: 'Vid', type: 'video', video: null, contentMarkdown: '' },
            { ...article('Short'), contentMarkdown: 'too short' },
          ],
        },
      ],
    });
    expect(problems).toEqual([
      'Add a subtitle (at least 10 characters).',
      'Write a description of at least 200 characters.',
      'Choose a category.',
      'List at least 3 things learners will learn.',
      'Add at least 3 lessons.',
      'Section "Empty" has no lessons.',
      'Lesson "Vid" needs a video link.',
      'Lesson "Short" needs at least 50 characters of content.',
    ]);
  });

  it('ignores whitespace-only text', () => {
    expect(submissionChecklist({ ...ready, subtitle: '          ' })).toContain(
      'Add a subtitle (at least 10 characters).',
    );
  });
});
