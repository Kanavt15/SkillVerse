/** /studio: my courses + create a new one. */
import { BookOpen, Plus } from 'lucide-react';
import { Form, Link, redirect } from 'react-router';
import { createCourseSchema } from '@skillverse/shared';
import type { Route } from './+types/index';
import { Alert } from '~/components/ui/alert';
import { Card } from '~/components/ui/card';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { CourseStatusBadge, durationLabel, priceLabel } from '~/features/teaching/course-status';
import type { CourseSummary, EditorCourse } from '~/features/teaching/types';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';

export function meta() {
  return [{ title: 'Instructor Studio | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const res = await api<CourseSummary[]>(request, '/api/v1/studio/courses');
  if (!res.ok) throw new Response(res.error.message, { status: res.status });
  return { courses: res.data };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const values = formValues(await request.formData(), ['title'] as const);
  const parsed = validate(createCourseSchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api<EditorCourse>(request, '/api/v1/studio/courses', {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return redirect(`/studio/courses/${res.data.id}`);
}

export default function StudioHome({ loaderData, actionData }: Route.ComponentProps) {
  const { courses } = loaderData;
  const state = actionData as FormState | undefined;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Instructor Studio</h1>
          <p className="mt-1 text-fg-muted">Build your courses and send them for review.</p>
        </div>
      </div>

      <Card className="mt-8">
        <h2 className="text-lg font-semibold">Start a new course</h2>
        <Form
          method="post"
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
          noValidate
        >
          <div className="flex-1">
            <Field
              label="Working title"
              name="title"
              hint="You can change it any time before publishing."
              errors={state?.fieldErrors?.title}
            >
              {(p) => (
                <Input
                  {...p}
                  maxLength={120}
                  placeholder="e.g. Excel for everyday work"
                  defaultValue={state?.values?.title ?? ''}
                />
              )}
            </Field>
          </div>
          <SubmitButton pendingText="Creating…" className="sm:mt-7">
            <Plus aria-hidden="true" /> Create course
          </SubmitButton>
        </Form>
        {state?.formError && (
          <Alert tone="danger" className="mt-4">
            {state.formError}
          </Alert>
        )}
      </Card>

      <h2 className="mt-10 text-xl font-semibold">Your courses</h2>
      {courses.length === 0 ? (
        <Card className="mt-4 text-center">
          <BookOpen className="mx-auto size-8 text-fg-subtle" aria-hidden="true" />
          <p className="mt-3 font-medium">No courses yet</p>
          <p className="mt-1 text-sm text-fg-muted">
            Create your first one above. It starts as a private draft.
          </p>
        </Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                to={`/studio/courses/${c.id}`}
                className="block rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{c.title}</h3>
                  <CourseStatusBadge status={c.status} />
                </div>
                <p className="mt-2 text-sm text-fg-muted">
                  {c.lessonCount} {c.lessonCount === 1 ? 'lesson' : 'lessons'} ·{' '}
                  {durationLabel(c.durationMinutes)} · {priceLabel(c.priceInPaise)} ·{' '}
                  {c.enrollmentCount} learners · updated{' '}
                  <LocalTime iso={c.updatedAt} options={{ dateStyle: 'medium' }} />
                </p>
                {c.status === 'rejected' && c.reviewNotes && (
                  <p className="mt-2 text-sm text-danger">Reviewer feedback: {c.reviewNotes}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
