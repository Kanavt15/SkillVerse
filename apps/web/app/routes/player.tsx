/** /learn/:slug/:lessonId: protected video/article player, curriculum, progress and private notes. */
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  LockKeyhole,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { data, Form, Link, redirect } from 'react-router';
import { noteSchema, videoEmbedUrl, type Certificate, type Player } from '@skillverse/shared';
import type { Route } from './+types/player';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input, inputClass } from '~/components/ui/input';
import { SafeMarkdown } from '~/components/ui/safe-markdown';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireId, requireSlug } from '~/lib/params';

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.lesson.title ?? 'Lesson'} | SkillVerse` },
    { name: 'robots', content: 'noindex' },
  ];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const slug = requireSlug(params.slug);
  const lessonId = requireId(params.lessonId);
  const res = await api<Player>(request, `/api/v1/courses/${slug}/lessons/${lessonId}`);
  if (!res.ok) throw data(res.error.message, { status: res.status });
  const value = new URL(request.url).searchParams.get('t');
  const start = value === null ? null : Number(value);
  if (start !== null && (!Number.isInteger(start) || start < 0 || start > 36000))
    throw data('Invalid video timestamp.', { status: 400 });
  return { ...res.data, start };
}
export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const slug = requireSlug(params.slug);
  const lessonId = requireId(params.lessonId);
  const path = `/api/v1/learning/courses/${slug}`;
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent === 'complete' || intent === 'incomplete' || intent === 'complete-next') {
    const res = await api(request, `${path}/lessons/${lessonId}/progress`, {
      method: 'POST',
      body: { completed: intent !== 'incomplete' },
    });
    if (!res.ok) return fromApiError(res.error, res.status);
    if (intent === 'complete-next') {
      // Next comes from the fresh API curriculum, not a hidden client-controlled URL.
      const player = await api<Player>(request, `/api/v1/courses/${slug}/lessons/${lessonId}`);
      if (!player.ok) return fromApiError(player.error, player.status);
      if (player.data.nextLessonId) return redirect(`/learn/${slug}/${player.data.nextLessonId}`);
    }
    return { success: intent === 'incomplete' ? 'Lesson marked incomplete.' : 'Lesson completed.' };
  }
  if (intent === 'note') {
    const values = formValues(form, ['body', 'timestampSeconds']);
    const parsed = validate(noteSchema, {
      body: values.body,
      timestampSeconds: values.timestampSeconds.trim() ? Number(values.timestampSeconds) : null,
    });
    if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
    const res = await api(request, `${path}/lessons/${lessonId}/notes`, {
      method: 'POST',
      body: parsed.data,
    });
    if (!res.ok) return fromApiError(res.error, res.status, values);
    return { success: 'Note saved.' };
  }
  if (intent === 'delete-note') {
    const noteId = requireId(form.get('noteId'));
    const res = await api(request, `${path}/lessons/${lessonId}/notes/${noteId}`, {
      method: 'DELETE',
    });
    if (!res.ok) return fromApiError(res.error, res.status);
    return { success: 'Note deleted.' };
  }
  if (intent === 'certificate') {
    const res = await api<Certificate>(request, `${path}/certificate`, { method: 'POST' });
    if (!res.ok) return fromApiError(res.error, res.status);
    return redirect(`/verify/${res.data.serial}`);
  }
  return formError({ formError: 'Unknown action.' });
}
function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function PlayerScreen({
  player,
  state,
  start,
}: {
  player: Player;
  state: FormState | undefined;
  start: number | null;
}) {
  const [moment, setMoment] = useState<number | null>(start);
  const lessons = player.sections.flatMap((s) => s.lessons);
  const done = new Set(player.completedLessonIds);
  const completed = done.has(player.lesson.id);
  const allDone = lessons.length > 0 && lessons.every((l) => done.has(l.id));
  const allowed = (id: string | null) =>
    id && (player.enrolled || lessons.find((l) => l.id === id)?.isPreview);
  const baseEmbed = player.lesson.video
    ? videoEmbedUrl(player.lesson.video.provider, player.lesson.video.ref)
    : null;
  const embed =
    baseEmbed && moment !== null
      ? player.lesson.video?.provider === 'youtube'
        ? `${baseEmbed}&start=${moment}&autoplay=1`
        : `${baseEmbed}#t=${moment}s`
      : baseEmbed;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        to={player.enrolled ? '/learning' : `/courses/${player.course.slug}`}
        className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {player.enrolled ? 'My learning' : 'Course overview'}
      </Link>
      <p className="mt-5 text-sm text-fg-muted">{player.course.title}</p>
      <h1 className="mt-2 text-3xl font-bold">{player.lesson.title}</h1>
      {player.enrolled && (
        <Button
          asLink
          variant="secondary"
          className="mt-4"
          to={`/courses/${player.course.slug}/questions?lessonId=${player.lesson.id}`}
        >
          Lesson Q&A
        </Button>
      )}
      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {embed && (
            <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
              <iframe
                key={embed}
                src={embed}
                title={player.lesson.title}
                className="size-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}
          {player.lesson.type === 'video' && !embed && (
            <Alert>
              The video for this lesson isn’t available. Try the next lesson or check back later.
            </Alert>
          )}
          {player.lesson.contentMarkdown && (
            <div className="mt-6 rounded-lg border border-border p-5 sm:p-8">
              <SafeMarkdown>{player.lesson.contentMarkdown}</SafeMarkdown>
            </div>
          )}
          {!player.enrolled && (
            <Alert className="mt-5">
              <p>
                <strong>You’re watching a free preview.</strong> Enroll to unlock the course, save
                notes and track your progress.
              </p>
              <Link
                to={`/courses/${player.course.slug}`}
                className="mt-2 inline-block font-medium text-brand"
              >
                Go to course and enroll
              </Link>
            </Alert>
          )}
          {state?.formError && (
            <Alert tone="danger" className="mt-5">
              {state.formError}
            </Alert>
          )}
          {state?.success && (
            <Alert tone="success" className="mt-5">
              {state.success}
            </Alert>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
            {allowed(player.previousLessonId) ? (
              <Button
                asLink
                to={`/learn/${player.course.slug}/${player.previousLessonId}`}
                variant="secondary"
              >
                <ArrowLeft aria-hidden="true" />
                Previous
              </Button>
            ) : (
              <span />
            )}
            {player.enrolled && (
              <Form method="post" className="flex flex-wrap gap-2">
                <SubmitButton
                  name="intent"
                  value={completed ? 'incomplete' : 'complete'}
                  variant={completed ? 'secondary' : 'primary'}
                  pendingText="Saving…"
                >
                  {completed ? 'Mark incomplete' : 'Mark complete'}
                </SubmitButton>
                {player.nextLessonId && (
                  <SubmitButton
                    name="intent"
                    value="complete-next"
                    variant="secondary"
                    pendingText="Saving…"
                  >
                    Complete & next <ArrowRight aria-hidden="true" />
                  </SubmitButton>
                )}
              </Form>
            )}
            {!player.enrolled && allowed(player.nextLessonId) && (
              <Button
                asLink
                to={`/learn/${player.course.slug}/${player.nextLessonId}`}
                variant="secondary"
              >
                Next preview
              </Button>
            )}
          </div>
          {player.enrolled && allDone && (
            <div className="mt-6 rounded-xl border border-accent/30 bg-accent-subtle p-5">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Award className="size-5 text-accent" aria-hidden="true" />
                Course completed
              </h2>
              <p className="mt-2 text-sm text-fg-muted">
                You’ve finished every lesson. Your certificate records this achievement and can be
                verified with a shareable link.
              </p>
              <div className="mt-4">
                {player.certificateSerial ? (
                  <Button asLink to={`/verify/${player.certificateSerial}`}>
                    View certificate
                  </Button>
                ) : (
                  <Form method="post">
                    <SubmitButton name="intent" value="certificate" pendingText="Issuing…">
                      Get completion certificate
                    </SubmitButton>
                  </Form>
                )}
              </div>
            </div>
          )}
          {player.enrolled && (
            <section className="mt-8" aria-labelledby="notes-title">
              <h2 id="notes-title" className="text-xl font-semibold">
                My private notes
              </h2>
              <p className="mt-2 text-sm text-fg-muted">
                Capture an idea or a question to come back to. Only you can see these notes.
              </p>
              <Form
                method="post"
                key={player.notes.map((n) => n.id).join(',')}
                className="mt-4 space-y-4"
                noValidate
              >
                <input type="hidden" name="intent" value="note" />
                <Field name="body" label="Note" errors={state?.fieldErrors?.body}>
                  {(p) => (
                    <textarea
                      {...p}
                      className={inputClass}
                      rows={3}
                      maxLength={5000}
                      placeholder="What clicked? What will you try next?"
                      defaultValue={state?.values?.body ?? ''}
                    />
                  )}
                </Field>
                {player.lesson.type === 'video' && (
                  <Field
                    name="timestampSeconds"
                    label="Video moment (seconds, optional)"
                    hint="Example: 90 means 1:30. A saved timestamp lets you jump back to that moment."
                    errors={state?.fieldErrors?.timestampSeconds}
                  >
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        min={0}
                        max={36000}
                        inputMode="numeric"
                        className="max-w-48"
                        defaultValue={state?.values?.timestampSeconds ?? ''}
                      />
                    )}
                  </Field>
                )}
                <SubmitButton pendingText="Saving…">Save note</SubmitButton>
              </Form>
              <ul className="mt-6 space-y-4">
                {player.notes.map((note) => (
                  <li key={note.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      {note.timestampSeconds !== null ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setMoment(note.timestampSeconds)}
                        >
                          Jump to {timestamp(note.timestampSeconds)}
                        </Button>
                      ) : (
                        <span className="text-xs text-fg-subtle">Lesson note</span>
                      )}
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete-note" />
                        <input type="hidden" name="noteId" value={note.id} />
                        <button
                          type="submit"
                          aria-label="Delete note"
                          className="rounded-md p-2 text-fg-muted hover:bg-danger-subtle hover:text-danger"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </Form>
                    </div>
                    <SafeMarkdown>{note.body}</SafeMarkdown>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside
          className="overflow-hidden rounded-xl border border-border lg:sticky lg:top-24"
          aria-label="Course curriculum"
        >
          <div className="border-b border-border bg-bg-subtle p-5">
            <h2 className="font-semibold">Course curriculum</h2>
            {player.enrolled && (
              <>
                <p className="mt-2 text-sm text-fg-muted">
                  {lessons.filter((l) => done.has(l.id)).length} of {lessons.length} completed
                </p>
                <progress
                  className="learning-progress mt-3 h-2 w-full"
                  max={lessons.length || 1}
                  value={lessons.filter((l) => done.has(l.id)).length}
                  aria-label="Course progress"
                />
              </>
            )}
          </div>
          {player.sections.map((s) => (
            <section key={s.id} className="border-b border-border last:border-0">
              <h3 className="bg-bg-subtle px-5 py-3 text-sm font-semibold">{s.title}</h3>
              <ol>
                {s.lessons.map((l) => {
                  const Icon = done.has(l.id)
                    ? CheckCircle2
                    : player.enrolled || l.isPreview
                      ? Circle
                      : LockKeyhole;
                  const content = (
                    <>
                      <Icon
                        className={`mt-0.5 size-4 shrink-0 ${done.has(l.id) ? 'text-accent' : 'text-fg-subtle'}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        {l.title}
                        {done.has(l.id) && <span className="sr-only"> (completed)</span>}
                        <span className="mt-1 block text-xs text-fg-subtle">
                          {l.durationMinutes} min{l.isPreview && ' · Preview'}
                        </span>
                      </span>
                      {player.lesson.id === l.id && <Badge tone="brand">Now</Badge>}
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {allowed(l.id) ? (
                        <Link
                          to={`/learn/${player.course.slug}/${l.id}`}
                          aria-current={player.lesson.id === l.id ? 'page' : undefined}
                          className={`flex items-start gap-3 px-5 py-4 text-sm hover:bg-surface-muted ${player.lesson.id === l.id ? 'bg-brand-subtle' : ''}`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex gap-3 px-5 py-4 text-sm text-fg-muted">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
export default function LessonPlayer({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <PlayerScreen
      key={`${loaderData.lesson.id}:${loaderData.start}`}
      player={loaderData}
      state={actionData as FormState | undefined}
      start={loaderData.start}
    />
  );
}
