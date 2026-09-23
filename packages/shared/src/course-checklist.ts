/**
 * The "ready for review" rules for a course, shared so the Studio can show a
 * live to-do list and the API enforces exactly the same thing on submit.
 *
 * Exports: ChecklistCourse, submissionChecklist.
 */

/** The parts of a course the checklist looks at (the editor view satisfies this). */
export interface ChecklistCourse {
  subtitle: string;
  description: string;
  categoryId: string | null;
  learningOutcomes: string[];
  sections: {
    title: string;
    lessons: { title: string; type: string; video: unknown; contentMarkdown: string }[];
  }[];
}

/** What still needs doing before a course can be submitted. Empty = ready. */
export function submissionChecklist(course: ChecklistCourse): string[] {
  const problems: string[] = [];
  if (course.subtitle.trim().length < 10) problems.push('Add a subtitle (at least 10 characters).');
  if (course.description.trim().length < 200) {
    problems.push('Write a description of at least 200 characters.');
  }
  if (!course.categoryId) problems.push('Choose a category.');
  if (course.learningOutcomes.length < 3) {
    problems.push('List at least 3 things learners will learn.');
  }
  const allLessons = course.sections.flatMap((s) => s.lessons);
  if (course.sections.length === 0) problems.push('Add at least one section.');
  if (allLessons.length < 3) problems.push('Add at least 3 lessons.');
  for (const s of course.sections) {
    if (s.lessons.length === 0) problems.push(`Section "${s.title}" has no lessons.`);
  }
  for (const l of allLessons) {
    if (l.type === 'video' && !l.video) problems.push(`Lesson "${l.title}" needs a video link.`);
    if (l.type === 'article' && l.contentMarkdown.trim().length < 50) {
      problems.push(`Lesson "${l.title}" needs at least 50 characters of content.`);
    }
  }
  return problems;
}
