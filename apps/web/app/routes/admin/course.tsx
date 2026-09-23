/**
 * /admin/courses/:courseId: inspect a submission (details, full curriculum,
 * checklist, history) and publish it or send it back with feedback.
 *
 * Content written by instructors is shown as plain text (never as HTML), and
 * videos open on their own site, so nothing in a submission can run here.
 */
import { ChevronRight, ExternalLink, FileText, PlayCircle } from 'lucide-react';
import { data, Form, Link, redirect } from 'react-router';
import { approveSchema, COURSE_LANGUAGES, LEVEL_LABELS, rejectSchema } from '@skillverse/shared';
import type { Route } from './+types/course';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { inputClass } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { staffGet } from '~/features/admin/staff-api.server';
import { CourseStatusBadge, durationLabel, priceLabel } from '~/features/teaching/course-status';
import type { Category, CourseInspection, EditorLesson } from '~/features/teaching/types';
import { api, apiGet } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { validate } from '~/lib/forms';
import { requireId } from '~/lib/params';

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [
    { title: `Review: ${loaderData?.inspection.course.title ?? 'Course'} | SkillVerse` },
    { name: 'robots', content: 'noindex' },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const courseId = requireId(params.courseId);
  const [inspection, categories] = await Promise.all([
    staffGet<CourseInspection>(request, `/api/v1/admin/course-reviews/${courseId}`),
    apiGet<Category[]>('/api/v1/categories').catch(() => [] as Category[]),
  ]);
  const category = categories.find((c) => c.id === inspection.course.categoryId)?.name ?? null;
  return { inspection, category };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const courseId = requireId(params.courseId);
  const form = await request.formData();
  const decision = form.get('decision') === 'approve' ? 'approve' : 'reject';
  const parsed = validate(decision === 'approve' ? approveSchema : rejectSchema, {
    notes: String(form.get('notes') ?? ''),
  });
  if (!parsed.ok) {
    return data({ error: Object.values(parsed.fieldErrors).flat().join(' ') }, { status: 400 });
  }
  const res = await api(request, `/api/v1/admin/course-reviews/${courseId}/${decision}`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return data({ error: res.error.message }, { status: res.status });
  return redirect(`/admin/courses?decided=${decision === 'approve' ? 'published' : 'returned'}`);
}

const EVENT_LABELS = {
  submitted: 'Submitted',
  approved: 'Published',
  rejected: 'Changes requested',
  archived: 'Archived',
} as const;

function LessonContent({ lesson }: { lesson: EditorLesson }) {
  if (lesson.type !== 'video') {
    return (
      <pre className="max-h-96 overflow-auto rounded-md bg-surface-muted p-3 font-mono text-xs whitespace-pre-wrap">
        {lesson.contentMarkdown || '(empty)'}
      </pre>
    );
  }
  if (!lesson.video) return <span className="text-danger">No video link</span>;
  return (
    <a
      href={lesson.video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
    >
      Watch on {lesson.video.provider === 'youtube' ? 'YouTube' : 'Vimeo'}
      <ExternalLink className="size-3.5" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export default function ReviewCourse({ loaderData, actionData }: Route.ComponentProps) {
  const { inspection, category } = loaderData;
  const { course, instructor, checklist, history } = inspection;
  const error = (actionData as { error?: string } | undefined)?.error;
  const language =
    COURSE_LANGUAGES[course.language as keyof typeof COURSE_LANGUAGES] ?? course.language;

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-fg-muted">
        <Link to="/admin/courses" className="hover:text-fg">
          Course reviews
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="truncate text-fg">{course.title}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold break-words">{course.title}</h1>
        <CourseStatusBadge status={course.status} />
      </header>
      <p className="mt-1 text-fg-muted">{course.subtitle}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">About the course</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-fg-subtle">Instructor</dt>
                <dd>
                  {instructor ? `${instructor.displayName} (@${instructor.username})` : 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Category</dt>
                <dd>{category ?? 'None'}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Level · language</dt>
                <dd>
                  {LEVEL_LABELS[course.level]} · {language}
                </dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Price · length</dt>
                <dd>
                  {priceLabel(course.priceInPaise)} · {course.lessonCount} lessons ·{' '}
                  {durationLabel(course.durationMinutes)}
                </dd>
              </div>
            </dl>
            <h3 className="mt-6 text-sm font-semibold">Description</h3>
            <p className="mt-1 text-sm whitespace-pre-wrap text-fg-muted">{course.description}</p>
            <h3 className="mt-6 text-sm font-semibold">What learners will learn</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-fg-muted">
              {course.learningOutcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            {course.requirements.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">Requirements</h3>
                <ul className="mt-1 list-disc pl-5 text-sm text-fg-muted">
                  {course.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            {course.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {course.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Curriculum</h2>
            <div className="mt-4 space-y-4">
              {course.sections.map((section, i) => (
                <div key={section.id} className="rounded-lg border border-border">
                  <h3 className="border-b border-border bg-bg-subtle px-4 py-2 text-sm font-semibold">
                    {i + 1}. {section.title}
                  </h3>
                  <ul className="divide-y divide-border">
                    {section.lessons.map((lesson) => {
                      const Icon = lesson.type === 'video' ? PlayCircle : FileText;
                      return (
                        <li key={lesson.id} className="px-4 py-3">
                          <details>
                            <summary className="flex cursor-pointer items-center gap-2 text-sm">
                              <Icon className="size-4 text-fg-subtle" aria-hidden="true" />
                              <span className="flex-1 font-medium">{lesson.title}</span>
                              {lesson.isPreview && <Badge tone="brand">Free preview</Badge>}
                              <span className="text-xs text-fg-subtle">
                                {durationLabel(lesson.durationMinutes)}
                              </span>
                            </summary>
                            <div className="mt-3 pl-6 text-sm">
                              <LessonContent lesson={lesson} />
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          {course.status === 'in_review' ? (
            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-semibold">Decision</h2>
              <Form method="post" className="mt-3 space-y-3">
                {error && <Alert tone="danger">{error}</Alert>}
                <label htmlFor="notes" className="block text-sm font-medium">
                  Notes for the instructor
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={5}
                  maxLength={2000}
                  className={inputClass}
                  placeholder="Required when requesting changes: be specific and kind."
                />
                <div className="flex flex-col gap-2">
                  <SubmitButton name="decision" value="approve" pendingText="Publishing…">
                    Publish course
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="reject"
                    variant="secondary"
                    pendingText="Sending…"
                  >
                    Request changes
                  </SubmitButton>
                </div>
              </Form>
            </Card>
          ) : (
            <Alert>This course is not waiting for review.</Alert>
          )}

          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold">Automatic checks</h2>
            {checklist.length === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">All required parts are present.</p>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm text-danger">
                {checklist.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            <h3 className="mt-5 text-sm font-semibold">Please also check</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-fg-muted">
              <li>Content is original and matches the description</li>
              <li>Videos play and the audio is clear</li>
              <li>Nothing unsafe, hateful or misleading</li>
              <li>The price is fair for the amount of content</li>
            </ul>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold">History</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {history.map((h) => (
                <li key={`${h.event}-${h.createdAt}`}>
                  <p className="font-medium">{EVENT_LABELS[h.event]}</p>
                  <p className="text-xs text-fg-subtle">
                    <LocalTime iso={h.createdAt} />
                    {h.actorName ? ` · ${h.actorName}` : ''}
                  </p>
                  {h.notes && <p className="mt-1 text-fg-muted">{h.notes}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </>
  );
}
