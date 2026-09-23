/**
 * /studio/courses/:courseId/lessons/:lessonId: edit one lesson (title, video
 * link or article text, duration, free preview, section).
 */
import { ChevronRight } from 'lucide-react';
import { data, Form, Link } from 'react-router';
import { updateLessonSchema, videoEmbedUrl } from '@skillverse/shared';
import type { Route } from './+types/lesson';
import { Alert } from '~/components/ui/alert';
import { Card } from '~/components/ui/card';
import { Field } from '~/components/ui/field';
import { Input, inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import type { EditorCourse } from '~/features/teaching/types';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireId } from '~/lib/params';

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.lesson.title ?? 'Lesson';
  return [{ title: `${title} · Studio | SkillVerse` }, { name: 'robots', content: 'noindex' }];
}

async function loadCourse(request: Request, courseId: string) {
  const res = await api<EditorCourse>(request, `/api/v1/studio/courses/${courseId}`);
  if (!res.ok) throw data(res.error.message, { status: res.status });
  return res.data;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const courseId = requireId(params.courseId);
  const lessonId = requireId(params.lessonId);
  const course = await loadCourse(request, courseId);
  for (const section of course.sections) {
    const lesson = section.lessons.find((l) => l.id === lessonId);
    if (lesson) {
      return {
        course: {
          id: course.id,
          title: course.title,
          status: course.status,
          sections: course.sections.map((s) => ({ id: s.id, title: s.title })),
        },
        sectionId: section.id,
        lesson,
      };
    }
  }
  throw data('Lesson not found', { status: 404 });
}

const FIELDS = ['title', 'durationMinutes', 'contentMarkdown', 'videoUrl', 'sectionId'] as const;

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const lessonId = requireId(params.lessonId);
  const form = await request.formData();
  const values = formValues(form, FIELDS);
  const type = form.get('type');

  const duration = values.durationMinutes.trim() === '' ? 0 : Number(values.durationMinutes);
  const parsed = validate(updateLessonSchema, {
    title: values.title,
    durationMinutes: Number.isInteger(duration) ? duration : -1,
    isPreview: form.get('isPreview') === 'on',
    sectionId: values.sectionId,
    // Only send the field that belongs to this lesson type.
    ...(type === 'video'
      ? { videoUrl: values.videoUrl }
      : { contentMarkdown: values.contentMarkdown }),
  });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api(request, `/api/v1/studio/lessons/${lessonId}`, {
    method: 'PATCH',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return { success: 'Lesson saved.' };
}

export default function LessonEditor({ loaderData, actionData }: Route.ComponentProps) {
  const { course, sectionId, lesson } = loaderData;
  const state = actionData as FormState | undefined;
  const errors = state?.fieldErrors;
  const v = (key: (typeof FIELDS)[number], fallback: string) => state?.values?.[key] ?? fallback;
  const locked = course.status === 'in_review' || course.status === 'archived';
  const embed = lesson.video ? videoEmbedUrl(lesson.video.provider, lesson.video.ref) : null;

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-sm text-fg-muted"
      >
        <Link to="/studio" className="hover:text-fg">
          Studio
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <Link to={`/studio/courses/${course.id}`} className="max-w-[16rem] truncate hover:text-fg">
          {course.title}
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="truncate text-fg">{lesson.title}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold">
        {lesson.type === 'video' ? 'Video lesson' : 'Article lesson'}
      </h1>

      <Card className="mt-6">
        <Form method="post" noValidate>
          <input type="hidden" name="type" value={lesson.type} />
          <fieldset disabled={locked} className="space-y-5">
            {locked && (
              <Alert>
                This course is in review or archived, so lessons can't be changed right now.
              </Alert>
            )}
            {state?.success && <Alert tone="success">{state.success}</Alert>}
            {state?.formError && <Alert tone="danger">{state.formError}</Alert>}

            <Field label="Title" name="title" errors={errors?.title}>
              {(p) => <Input {...p} maxLength={160} defaultValue={v('title', lesson.title)} />}
            </Field>

            {lesson.type === 'video' ? (
              <>
                <Field
                  label="Video link"
                  name="videoUrl"
                  hint="Paste a YouTube or Vimeo link. Unlisted videos work, private ones don't. Leave empty to remove."
                  errors={errors?.videoUrl}
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="url"
                      inputMode="url"
                      placeholder="https://www.youtube.com/watch?v=…"
                      defaultValue={v('videoUrl', lesson.video?.url ?? '')}
                    />
                  )}
                </Field>
                {embed && (
                  <div className="aspect-video overflow-hidden rounded-lg border border-border bg-black">
                    <iframe
                      src={embed}
                      title={`Preview: ${lesson.title}`}
                      className="size-full"
                      allow="encrypted-media; picture-in-picture; fullscreen"
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="lazy"
                    />
                  </div>
                )}
              </>
            ) : (
              <Field
                label="Lesson text"
                name="contentMarkdown"
                hint="Markdown is supported: # headings, **bold**, lists, `code` and links. At least 50 characters."
                errors={errors?.contentMarkdown}
              >
                {(p) => (
                  <textarea
                    {...p}
                    rows={16}
                    maxLength={50000}
                    className={`${inputClass} font-mono`}
                    defaultValue={v('contentMarkdown', lesson.contentMarkdown)}
                  />
                )}
              </Field>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Length (minutes)"
                name="durationMinutes"
                hint="Roughly how long it takes to watch or read."
                errors={errors?.durationMinutes}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={0}
                    max={600}
                    inputMode="numeric"
                    defaultValue={v('durationMinutes', String(lesson.durationMinutes))}
                  />
                )}
              </Field>
              <Field label="Section" name="sectionId" errors={errors?.sectionId}>
                {(p) => (
                  <select {...p} className={inputClass} defaultValue={v('sectionId', sectionId)}>
                    {course.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-border p-3">
              <input
                type="checkbox"
                name="isPreview"
                defaultChecked={lesson.isPreview}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="block text-sm font-medium">Free preview</span>
                <span className="block text-xs text-fg-muted">
                  Anyone can watch or read this lesson before enrolling. One or two previews help
                  learners decide.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to={`/studio/courses/${course.id}`}
                className="text-sm font-medium text-fg-muted hover:text-fg"
              >
                ← Back to curriculum
              </Link>
              <SubmitButton pendingText="Saving…">Save lesson</SubmitButton>
            </div>
          </fieldset>
        </Form>
      </Card>
    </>
  );
}
