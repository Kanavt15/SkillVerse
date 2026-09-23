/**
 * Shapes returned by the teaching endpoints (see apps/api/src/routes/catalog-schemas.ts
 * and docs/architecture/teaching.md). Kept in one place for the Studio and admin pages.
 */
import type { COURSE_LEVELS, COURSE_STATUSES } from '@skillverse/shared';

export type CourseStatus = (typeof COURSE_STATUSES)[number];
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  parentId: string | null;
}

export interface EditorLesson {
  id: string;
  title: string;
  type: 'video' | 'article' | 'quiz' | 'code';
  position: number;
  isPreview: boolean;
  durationMinutes: number;
  contentMarkdown: string;
  video: { provider: 'youtube' | 'vimeo'; ref: string; url: string } | null;
}

export interface EditorSection {
  id: string;
  title: string;
  position: number;
  lessons: EditorLesson[];
}

export interface EditorCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  categoryId: string | null;
  level: CourseLevel;
  language: string;
  priceInPaise: number;
  currency: string;
  learningOutcomes: string[];
  requirements: string[];
  tags: string[];
  status: CourseStatus;
  reviewNotes: string | null;
  lessonCount: number;
  durationMinutes: number;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  sections: EditorSection[];
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  status: CourseStatus;
  priceInPaise: number;
  lessonCount: number;
  durationMinutes: number;
  enrollmentCount: number;
  reviewNotes: string | null;
  updatedAt: string;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface InstructorApplication {
  id: string;
  status: ApplicationStatus;
  headline: string;
  topics: string[];
  experience: string;
  sampleUrl: string | null;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ApplicationForReview extends Omit<InstructorApplication, 'reviewedAt'> {
  applicant: { id: string; displayName: string; username: string; email: string };
}

export interface ReviewQueueItem {
  id: string;
  title: string;
  slug: string;
  submittedAt: string | null;
  lessonCount: number;
  durationMinutes: number;
  priceInPaise: number;
  instructor: { id: string; displayName: string; username: string };
}

export interface CourseInspection {
  course: EditorCourse;
  instructor: { id: string; displayName: string; username: string } | null;
  checklist: string[];
  history: {
    event: 'submitted' | 'approved' | 'rejected' | 'archived';
    notes: string | null;
    createdAt: string;
    actorName: string | null;
  }[];
}
