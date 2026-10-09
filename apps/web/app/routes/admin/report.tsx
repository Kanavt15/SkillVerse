/** Inspect and moderate a report; optimistic versions stop stale staff decisions. */
import { Form, Link } from 'react-router';
import { moderationSchema, REPORT_REASON_LABELS, type ModerationDetail } from '@skillverse/shared';
import type { Route } from './+types/report';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { SafeMarkdown } from '~/components/ui/safe-markdown';
import { SubmitButton } from '~/components/ui/submit-button';
import { staffGet } from '~/features/admin/staff-api.server';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireId } from '~/lib/params';
export async function loader({ request, params }: Route.LoaderArgs) {
  return await staffGet<ModerationDetail>(
    request,
    `/api/v1/admin/reports/${requireId(params.reportId)}`,
  );
}
export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const values = formValues(await request.formData(), ['decision', 'notes', 'version']),
    parsed = validate(moderationSchema, { ...values, version: Number(values.version) });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api(request, `/api/v1/admin/reports/${requireId(params.reportId)}`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return { success: 'Decision saved.' };
}
export default function Report({
  loaderData: { report: r, content },
  actionData,
}: Route.ComponentProps) {
  const state = actionData as FormState | undefined;
  return (
    <div className="max-w-3xl">
      <Link className="text-sm text-fg-muted hover:text-brand" to="/admin/reports">
        ← Content reports
      </Link>
      <h1 className="mt-5 text-3xl font-bold">Review {r.targetType}</h1>
      <p className="mt-3 text-fg-muted">{r.course.title}</p>
      <div className="mt-5">
        <Badge>{r.status}</Badge>
      </div>
      {state?.success && (
        <Alert tone="success" className="mt-5">
          {state.success}
        </Alert>
      )}
      {state?.formError && (
        <Alert tone="danger" className="mt-5">
          {state.formError}
        </Alert>
      )}
      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="font-semibold">{REPORT_REASON_LABELS[r.reason]}</h2>
        <p className="mt-2 text-sm text-fg-muted">Reported by {r.reporter.displayName}</p>
        <p className="mt-4 whitespace-pre-wrap">{r.details}</p>
      </section>
      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="text-xl font-semibold">{content?.title ?? 'Content removed'}</h2>
        {content && (
          <>
            <p className="mt-2 text-sm text-fg-muted">
              Currently {content.hidden ? 'hidden' : 'visible'} to learners
            </p>
            <div className="mt-4">
              <SafeMarkdown>{content.body}</SafeMarkdown>
            </div>
          </>
        )}
      </section>
      {r.reviewNotes && (
        <p className="mt-5 text-sm whitespace-pre-wrap text-fg-muted">
          Previous feedback: {r.reviewNotes}
        </p>
      )}
      <Form method="post" className="mt-7 space-y-4" noValidate key={r.version}>
        <input type="hidden" name="version" value={r.version} />
        <Field
          name="notes"
          label="Decision feedback"
          hint="Explain the decision. Feedback may be sent to the content author."
          errors={state?.fieldErrors?.notes}
        >
          {(p) => (
            <textarea
              {...p}
              className={inputClass}
              rows={4}
              required
              minLength={10}
              maxLength={2000}
              defaultValue={state?.values?.notes}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-3">
          {content && (
            <SubmitButton
              variant={content.hidden ? 'primary' : 'danger'}
              name="decision"
              value={content.hidden ? 'restore' : 'hide'}
              pendingText="Saving…"
            >
              {content.hidden ? 'Restore content' : 'Hide content'}
            </SubmitButton>
          )}
          <SubmitButton name="decision" value="dismiss" variant="secondary" pendingText="Saving…">
            Dismiss report
          </SubmitButton>
        </div>
      </Form>
    </div>
  );
}
