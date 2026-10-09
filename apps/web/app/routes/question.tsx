/** A protected discussion thread with safe Markdown, answers and private reporting. */
import { data, Form, Link, redirect } from 'react-router';
import {
  replySchema,
  solutionSchema,
  type QuestionDetail,
  type ReplyView,
} from '@skillverse/shared';
import type { Route } from './+types/question';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { DiscussionAuthor, DiscussionPages, ReportLink } from '~/components/ui/discussion';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { SafeMarkdown } from '~/components/ui/safe-markdown';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireId, requireSlug } from '~/lib/params';
export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.discussion.question.title ?? 'Question'} | SkillVerse` },
    { name: 'robots', content: 'noindex' },
  ];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request),
    slug = requireSlug(params.slug),
    id = requireId(params.questionId),
    search = new URL(request.url).searchParams;
  const page = Number(search.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    throw data('Invalid page.', { status: 400 });
  const res = await api<QuestionDetail>(
    request,
    `/api/v1/community/courses/${slug}/questions/${id}?page=${page}`,
  );
  if (!res.ok) throw data(res.error.message, { status: res.status });
  return { discussion: res.data, user, reported: search.get('reported') === '1' };
}
export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const slug = requireSlug(params.slug),
    id = requireId(params.questionId),
    form = await request.formData();
  const path = `/api/v1/community/courses/${slug}/questions/${id}`,
    back = `/courses/${slug}/questions/${id}`;
  if (form.get('intent') === 'solution') {
    const parsed = validate(solutionSchema, { replyId: form.get('replyId') || null });
    if (!parsed.ok) return formError({ formError: 'Invalid answer.' });
    const res = await api(request, `${path}/solution`, { method: 'POST', body: parsed.data });
    if (!res.ok) return fromApiError(res.error, res.status);
    return redirect(back);
  }
  const values = { body: String(form.get('body') ?? '') },
    parsed = validate(replySchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api<{ id: string }>(request, `${path}/replies`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  const thread = await api<QuestionDetail>(request, path);
  const page = thread.ok ? Math.max(1, Math.ceil(thread.data.totalReplies / 20)) : 1;
  return redirect(`${back}?page=${page}#reply-${res.data.id}`);
}
export default function Question({ loaderData, actionData }: Route.ComponentProps) {
  const { discussion: d, user, reported } = loaderData,
    q = d.question,
    state = actionData as FormState | undefined;
  const back = `/courses/${d.course.slug}/questions/${q.id}`;
  function replyCard(r: ReplyView, accepted = false) {
    return (
      <article
        id={`reply-${r.id}`}
        key={r.id}
        className={`scroll-mt-6 rounded-xl border p-5 sm:p-6 ${accepted ? 'border-accent bg-bg-subtle' : 'border-border'}`}
      >
        {accepted && (
          <div className="mb-4">
            <Badge>Accepted answer</Badge>
          </div>
        )}
        <DiscussionAuthor author={r.author} createdAt={r.createdAt} />
        <div className="mt-4">
          <SafeMarkdown>{r.body}</SafeMarkdown>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {q.canResolve && user.emailVerified && (
            <Form method="post">
              <input name="intent" type="hidden" value="solution" />
              <input name="replyId" type="hidden" value={accepted ? '' : r.id} />
              <SubmitButton variant="secondary" pendingText="Saving…">
                {accepted ? 'Clear accepted answer' : 'Accept answer'}
              </SubmitButton>
            </Form>
          )}
          {user.emailVerified && (
            <ReportLink slug={d.course.slug} targetType="reply" targetId={r.id} returnTo={back} />
          )}
        </div>
      </article>
    );
  }
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        to={`/courses/${d.course.slug}/questions`}
        className="text-sm text-fg-muted hover:text-brand"
      >
        ← Course Q&A
      </Link>
      {reported && (
        <Alert tone="success" className="mt-6">
          Your report has been sent privately to the moderation team.
        </Alert>
      )}
      {state?.formError && (
        <Alert tone="danger" className="mt-6">
          {state.formError}
        </Alert>
      )}
      <h1 className="mt-6 text-3xl leading-tight font-bold">{q.title}</h1>
      <div className="mt-4">
        <DiscussionAuthor author={q.author} createdAt={q.createdAt} />
      </div>
      {q.lesson && (
        <p className="mt-4 text-sm">
          <Link
            className="text-brand underline"
            to={`/learn/${d.course.slug}/${q.lesson.id}${q.timestampSeconds !== null ? `?t=${q.timestampSeconds}` : ''}`}
          >
            {q.lesson.title}
            {q.timestampSeconds !== null
              ? ` · ${Math.floor(q.timestampSeconds / 60)}:${String(q.timestampSeconds % 60).padStart(2, '0')}`
              : ''}
          </Link>
        </p>
      )}
      <div className="mt-6">
        <SafeMarkdown>{q.body}</SafeMarkdown>
      </div>
      {user.emailVerified && (
        <div className="mt-4">
          <ReportLink slug={d.course.slug} targetType="question" targetId={q.id} returnTo={back} />
        </div>
      )}
      <div className="mt-8 space-y-5">
        {d.acceptedReply && replyCard(d.acceptedReply, true)}
        <h2 className="text-xl font-semibold">
          {d.totalReplies} {d.totalReplies === 1 ? 'reply' : 'replies'}
        </h2>
        {d.replies.filter((r) => r.id !== d.acceptedReply?.id).map((r) => replyCard(r))}
        {!d.totalReplies && (
          <p className="text-fg-muted">Be the first to help with this question.</p>
        )}
        <DiscussionPages page={d.page} totalPages={d.totalPages} />
      </div>
      {d.course.archived ? (
        <Alert className="mt-8">This archived discussion is read-only.</Alert>
      ) : !user.emailVerified ? (
        <Alert className="mt-8">
          <Link to="/check-email" className="text-brand underline">
            Verify your email
          </Link>{' '}
          to reply.
        </Alert>
      ) : (
        <Form
          method="post"
          className="mt-8 space-y-4 rounded-xl border border-border bg-bg-subtle p-5"
          noValidate
        >
          <Field
            name="body"
            label="Your reply"
            hint="Explain your approach. Markdown is supported."
            errors={state?.fieldErrors?.body}
          >
            {(p) => (
              <textarea
                {...p}
                className={inputClass}
                rows={5}
                minLength={10}
                maxLength={5000}
                required
                defaultValue={state?.values?.body}
              />
            )}
          </Field>
          <SubmitButton pendingText="Posting…">Post reply</SubmitButton>
        </Form>
      )}
    </section>
  );
}
