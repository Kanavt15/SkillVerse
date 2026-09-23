/**
 * /admin/applications?status=pending|approved|rejected: review applications
 * to teach. Approve (optional note) or reject (feedback required).
 */
import { ExternalLink } from 'lucide-react';
import { data, Form, NavLink } from 'react-router';
import { approveSchema, rejectSchema } from '@skillverse/shared';
import type { Route } from './+types/applications';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { inputClass } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import { staffGet } from '~/features/admin/staff-api.server';
import type { ApplicationForReview, ApplicationStatus, Category } from '~/features/teaching/types';
import { api, apiGet } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { cn } from '~/lib/cn';
import { validate } from '~/lib/forms';
import { requireId } from '~/lib/params';

const STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function statusFrom(url: URL): ApplicationStatus {
  const s = url.searchParams.get('status');
  return s === 'approved' || s === 'rejected' ? s : 'pending';
}

export async function loader({ request }: Route.LoaderArgs) {
  const status = statusFrom(new URL(request.url));
  const [applications, categories] = await Promise.all([
    staffGet<ApplicationForReview[]>(
      request,
      `/api/v1/admin/instructor-applications?status=${status}`,
    ),
    apiGet<Category[]>('/api/v1/categories').catch(() => [] as Category[]),
  ]);
  const topicNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  return { status, applications, topicNames };
}

interface ActionState {
  applicationId?: string;
  success?: string;
  error?: string;
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const applicationId = requireId(form.get('applicationId'));
  const decision = form.get('decision') === 'approve' ? 'approve' : 'reject';
  const notes = String(form.get('notes') ?? '');
  const parsed = validate(decision === 'approve' ? approveSchema : rejectSchema, { notes });
  if (!parsed.ok) {
    return data<ActionState>(
      { applicationId, error: Object.values(parsed.fieldErrors).flat().join(' ') },
      { status: 400 },
    );
  }
  const res = await api(
    request,
    `/api/v1/admin/instructor-applications/${applicationId}/${decision}`,
    {
      method: 'POST',
      body: parsed.data,
    },
  );
  if (!res.ok)
    return data<ActionState>({ applicationId, error: res.error.message }, { status: res.status });
  return {
    success:
      decision === 'approve'
        ? 'Approved. They can now use the Studio.'
        : 'Rejected. Feedback sent.',
  } satisfies ActionState;
}

export default function Applications({ loaderData, actionData }: Route.ComponentProps) {
  const { status, applications, topicNames } = loaderData;
  const state = actionData as ActionState | undefined;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Instructor applications</h1>
        <nav aria-label="Filter by status" className="flex gap-1 rounded-lg bg-surface-muted p-1">
          {STATUSES.map((s) => (
            <NavLink
              key={s.value}
              to={`?status=${s.value}`}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                s.value === status
                  ? 'bg-surface text-fg shadow-card'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {state?.success && (
        <Alert tone="success" className="mt-6">
          {state.success}
        </Alert>
      )}

      {applications.length === 0 ? (
        <Card className="mt-6 text-center text-fg-muted">Nothing here right now.</Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {applications.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{a.applicant.displayName}</h2>
                    <p className="text-sm text-fg-muted">
                      @{a.applicant.username} · {a.applicant.email}
                    </p>
                  </div>
                  <p className="text-sm text-fg-subtle">
                    Applied <LocalTime iso={a.createdAt} />
                  </p>
                </div>
                <p className="mt-4 font-medium">{a.headline}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.topics.map((t) => (
                    <Badge key={t} tone="brand">
                      {topicNames[t] ?? t}
                    </Badge>
                  ))}
                </div>
                <p className="mt-4 text-sm whitespace-pre-wrap text-fg-muted">{a.experience}</p>
                {a.sampleUrl && (
                  <a
                    href={a.sampleUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                  >
                    Teaching sample <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
                {a.reviewNotes && (
                  <p className="mt-4 text-sm">
                    <span className="font-medium">Reviewer note:</span> {a.reviewNotes}
                  </p>
                )}

                {a.status === 'pending' && (
                  <Form method="post" className="mt-6 space-y-3 border-t border-border pt-4">
                    <input type="hidden" name="applicationId" value={a.id} />
                    {state?.applicationId === a.id && state.error && (
                      <Alert tone="danger">{state.error}</Alert>
                    )}
                    <label htmlFor={`notes-${a.id}`} className="block text-sm font-medium">
                      Note to the applicant
                    </label>
                    <textarea
                      id={`notes-${a.id}`}
                      name="notes"
                      rows={2}
                      maxLength={2000}
                      className={inputClass}
                      placeholder="Optional when approving; required when rejecting (what should they improve?)"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <SubmitButton
                        name="decision"
                        value="reject"
                        variant="secondary"
                        pendingText="Rejecting…"
                      >
                        Reject
                      </SubmitButton>
                      <SubmitButton name="decision" value="approve" pendingText="Approving…">
                        Approve
                      </SubmitButton>
                    </div>
                  </Form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
