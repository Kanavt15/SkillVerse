import { LearnerWorkspace } from '~/components/layout/learner-workspace';
/** Persistent notification inbox with read controls, preferences and event-driven refresh. */
import { useEffect } from 'react';
import { data, Form, Link, useRevalidator } from 'react-router';
import {
  idSchema,
  notificationPreferenceSchema,
  notificationQuerySchema,
  type NotificationInbox,
} from '@skillverse/shared';
import type { Route } from './+types/notifications';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { DiscussionPages } from '~/components/ui/discussion';
import { Field } from '~/components/ui/field';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, fromApiError, validate, type FormState } from '~/lib/forms';
export function meta() {
  return [{ title: 'Notifications | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const search = new URL(request.url).searchParams,
    parsed = notificationQuerySchema.safeParse({
      page: search.get('page') ?? 1,
      unreadOnly: search.get('unreadOnly') ?? 'false',
    });
  if (!parsed.success) throw data('Invalid inbox filters.', { status: 400 });
  const query = new URLSearchParams({
    page: String(parsed.data.page),
    unreadOnly: parsed.data.unreadOnly,
  });
  const res = await api<NotificationInbox>(request, `/api/v1/me/notifications?${query}`);
  if (!res.ok) throw data(res.error.message, { status: res.status });
  return { inbox: res.data, unreadOnly: parsed.data.unreadOnly };
}
export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData(),
    intent = form.get('intent'),
    base = '/api/v1/me/notifications';
  if (intent === 'preferences') {
    const parsed = validate(notificationPreferenceSchema, {
      discussions: form.get('discussions') === 'on',
    });
    if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors });
    const res = await api(request, `${base}/preferences`, { method: 'PATCH', body: parsed.data });
    return res.ok
      ? { success: 'Notification preferences saved.' }
      : fromApiError(res.error, res.status);
  }
  if (intent === 'read-all') {
    const res = await api(request, `${base}/read-all`, { method: 'POST' });
    return res.ok
      ? { success: 'All notifications marked read.' }
      : fromApiError(res.error, res.status);
  }
  if (intent === 'read') {
    const parsed = idSchema.safeParse(form.get('notificationId'));
    if (!parsed.success) return formError({ formError: 'Invalid notification.' });
    const res = await api(request, `${base}/${parsed.data}/read`, { method: 'POST' });
    return res.ok ? { success: 'Notification marked read.' } : fromApiError(res.error, res.status);
  }
  return formError({ formError: 'Unknown action.' });
}
export default function Notifications({
  loaderData: { inbox: d, unreadOnly },
  actionData,
}: Route.ComponentProps) {
  const state = actionData as FormState | undefined,
    revalidator = useRevalidator();
  useEffect(() => {
    const refresh = () => {
      if (revalidator.state === 'idle') void revalidator.revalidate();
    };
    window.addEventListener('skillverse:notifications', refresh);
    return () => window.removeEventListener('skillverse:notifications', refresh);
  }, [revalidator]);
  return (
    <LearnerWorkspace>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="mt-2 text-fg-muted">
            {d.unreadCount} unread · Keep up with your learning community.
          </p>
        </div>
        {d.unreadCount > 0 && (
          <Form method="post">
            <SubmitButton variant="secondary" name="intent" value="read-all" pendingText="Saving…">
              Mark all read
            </SubmitButton>
          </Form>
        )}
      </div>
      {state?.success && (
        <Alert className="mt-5" tone="success">
          {state.success}
        </Alert>
      )}
      {state?.formError && (
        <Alert className="mt-5" tone="danger">
          {state.formError}
        </Alert>
      )}
      <nav aria-label="Inbox filter" className="mt-7 flex gap-5 text-sm">
        <Link
          className={
            unreadOnly === 'false' ? 'font-semibold text-brand underline' : 'text-fg-muted'
          }
          aria-current={unreadOnly === 'false' ? 'page' : undefined}
          to="/notifications"
        >
          All notifications
        </Link>
        <Link
          className={unreadOnly === 'true' ? 'font-semibold text-brand underline' : 'text-fg-muted'}
          aria-current={unreadOnly === 'true' ? 'page' : undefined}
          to="?unreadOnly=true"
        >
          Unread
        </Link>
      </nav>
      <div className="mt-5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {!d.items.length && (
          <p className="p-6 text-fg-muted">
            {unreadOnly === 'true'
              ? 'You’re all caught up.'
              : 'Your inbox is quiet. Replies and course updates will appear here.'}
          </p>
        )}
        {d.items.map((n) => (
          <article key={n.id} className={`p-5 sm:p-6 ${n.readAt ? '' : 'bg-bg-subtle'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">
                <Link className="hover:text-brand" to={n.href}>
                  {n.title}
                </Link>
              </h2>
              {!n.readAt && <Badge>Unread</Badge>}
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap text-fg-muted">{n.message}</p>
            <p className="mt-3 text-xs text-fg-muted">
              <LocalTime iso={n.createdAt} />
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Link to={n.href} className="text-sm text-brand underline underline-offset-4">
                View {n.kind === 'moderation' ? 'course Q&A' : 'discussion'}
              </Link>
              {!n.readAt && (
                <Form method="post">
                  <input type="hidden" name="notificationId" value={n.id} />
                  <SubmitButton name="intent" value="read" variant="ghost" pendingText="Saving…">
                    Mark read
                  </SubmitButton>
                </Form>
              )}
            </div>
          </article>
        ))}
      </div>
      <DiscussionPages page={d.page} totalPages={d.totalPages} query={`unreadOnly=${unreadOnly}`} />
      <details className="community-panel mt-10">
        <summary className="cursor-pointer font-semibold">Notification preferences</summary>
        <Form method="post" className="mt-5 space-y-4" key={String(d.preferences.discussions)}>
          <input type="hidden" name="intent" value="preferences" />
          <Field
            name="discussions"
            label="Notify me about course discussions"
            hint="Questions, replies and accepted answers. Moderation decisions are always delivered."
          >
            {(p) => (
              <input
                {...p}
                className="size-5 accent-brand"
                type="checkbox"
                defaultChecked={d.preferences.discussions}
              />
            )}
          </Field>
          <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
        </Form>
      </details>
    </LearnerWorkspace>
  );
}
