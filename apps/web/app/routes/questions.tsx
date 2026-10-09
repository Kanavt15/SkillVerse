/** Enrollment-scoped course Q&A with lesson filters and a progressive-enhancement question form. */
import { data, Form, Link, redirect } from 'react-router';
import { questionQuerySchema, questionSchema, type QuestionList } from '@skillverse/shared';
import type { Route } from './+types/questions';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { DiscussionAuthor, DiscussionPages } from '~/components/ui/discussion';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireSlug } from '~/lib/params';

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `Q&A: ${data?.discussion.course.title ?? 'Course'} | SkillVerse` },
    { name: 'robots', content: 'noindex' },
  ];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request),
    slug = requireSlug(params.slug),
    search = new URL(request.url).searchParams;
  const parsed = questionQuerySchema.safeParse({
    page: search.get('page') ?? 1,
    status: search.get('status') ?? 'all',
    ...(search.get('lessonId') ? { lessonId: search.get('lessonId') } : {}),
  });
  if (!parsed.success) throw data('Invalid discussion filters.', { status: 400 });
  const query = new URLSearchParams({
    page: String(parsed.data.page),
    status: parsed.data.status,
    ...(parsed.data.lessonId ? { lessonId: parsed.data.lessonId } : {}),
  });
  const res = await api<QuestionList>(
    request,
    `/api/v1/community/courses/${slug}/questions?${query}`,
  );
  if (!res.ok) throw data(res.error.message, { status: res.status });
  return { discussion: res.data, filters: parsed.data, query: query.toString(), user };
}
export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const slug = requireSlug(params.slug),
    values = formValues(await request.formData(), [
      'title',
      'body',
      'lessonId',
      'timestampSeconds',
    ]);
  const parsed = validate(questionSchema, {
    ...values,
    lessonId: values.lessonId || null,
    timestampSeconds: values.timestampSeconds ? Number(values.timestampSeconds) : null,
  });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api<{ id: string }>(request, `/api/v1/community/courses/${slug}/questions`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return redirect(`/courses/${slug}/questions/${res.data.id}`);
}
export default function Questions({ loaderData, actionData }: Route.ComponentProps) {
  const { discussion: d, filters, query, user } = loaderData,
    state = actionData as FormState | undefined;
  const base = `/courses/${d.course.slug}/questions`;
  return (
    <section className="page-shell">
      <Link
        to={d.course.archived ? '/learning' : `/courses/${d.course.slug}`}
        className="text-sm text-fg-muted hover:text-brand"
      >
        ← {d.course.archived ? 'My learning' : d.course.title}
      </Link>
      <p className="mt-6 text-sm font-semibold text-brand">Learn together</p>
      <h1 className="mt-2 text-3xl font-bold">Course Q&A</h1>
      <p className="mt-3 text-fg-muted">
        Ask a question, share what worked, and help someone get unstuck.
      </p>
      {d.course.archived ? (
        <Alert className="mt-6">This course is archived. You can still read its discussions.</Alert>
      ) : !user.emailVerified ? (
        <Alert className="mt-6">
          <Link className="text-brand underline" to="/check-email">
            Verify your email
          </Link>{' '}
          to ask or reply.
        </Alert>
      ) : (
        <details open={Boolean(state)} className="community-panel mt-6">
          <summary className="cursor-pointer font-semibold">Ask a question</summary>
          <Form
            method="post"
            className="mt-5 space-y-4"
            noValidate
            key={state?.values?.title ?? 'ask'}
          >
            {state?.formError && <Alert tone="danger">{state.formError}</Alert>}
            <Field name="title" label="Question title" errors={state?.fieldErrors?.title}>
              {(p) => (
                <input
                  {...p}
                  className={inputClass}
                  required
                  minLength={5}
                  maxLength={160}
                  defaultValue={state?.values?.title}
                  placeholder="What are you trying to understand?"
                />
              )}
            </Field>
            <Field
              name="body"
              label="Question details"
              hint="Share what you tried. Markdown is supported."
              errors={state?.fieldErrors?.body}
            >
              {(p) => (
                <textarea
                  {...p}
                  className={inputClass}
                  rows={5}
                  required
                  minLength={10}
                  maxLength={5000}
                  defaultValue={state?.values?.body}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="lessonId" label="Related lesson" errors={state?.fieldErrors?.lessonId}>
                {(p) => (
                  <select
                    {...p}
                    className={inputClass}
                    defaultValue={state?.values?.lessonId ?? filters.lessonId ?? ''}
                  >
                    <option value="">Entire course</option>
                    {d.lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                name="timestampSeconds"
                label="Video moment (optional)"
                hint="Seconds from the start; choose a video lesson."
                errors={state?.fieldErrors?.timestampSeconds}
              >
                {(p) => (
                  <input
                    {...p}
                    className={inputClass}
                    type="number"
                    min={0}
                    max={36000}
                    step={1}
                    defaultValue={state?.values?.timestampSeconds}
                  />
                )}
              </Field>
            </div>
            <SubmitButton pendingText="Posting…">Post question</SubmitButton>
          </Form>
        </details>
      )}
      <Form method="get" className="my-8 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <Field name="lessonId" label="Filter by lesson">
          {(p) => (
            <select {...p} className={inputClass} defaultValue={filters.lessonId ?? ''}>
              <option value="">All lessons</option>
              {d.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field name="status" label="Answer status">
          {(p) => (
            <select {...p} className={inputClass} defaultValue={filters.status}>
              <option value="all">All questions</option>
              <option value="unanswered">Awaiting an accepted answer</option>
              <option value="resolved">Answered</option>
            </select>
          )}
        </Field>
        <SubmitButton variant="secondary" pendingText="Filtering…">
          Apply filters
        </SubmitButton>
      </Form>
      <p className="mb-3 text-sm text-fg-muted">
        {d.total} {d.total === 1 ? 'question' : 'questions'}
      </p>
      <div className="divide-y divide-border rounded-xl border border-border">
        {!d.items.length && (
          <p className="p-6 text-fg-muted">
            No questions here yet. Start a conversation about what you’re learning.
          </p>
        )}
        {d.items.map((q) => (
          <article key={q.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">
                <Link to={`${base}/${q.id}`} className="hover:text-brand">
                  {q.title}
                </Link>
              </h2>
              {q.acceptedReplyId && <Badge>Answered</Badge>}
            </div>
            <div className="mt-3">
              <DiscussionAuthor author={q.author} createdAt={q.createdAt} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-fg-muted">{q.body}</p>
            <p className="mt-3 text-xs text-fg-muted">
              {q.lesson?.title ?? 'Course-wide'} · {q.replyCount}{' '}
              {q.replyCount === 1 ? 'reply' : 'replies'}
            </p>
          </article>
        ))}
      </div>
      <DiscussionPages page={d.page} totalPages={d.totalPages} query={query} />
    </section>
  );
}
