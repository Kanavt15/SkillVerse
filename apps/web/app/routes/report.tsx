/** A private abuse report form; the API verifies target visibility and course membership. */
import { data, Form, Link, redirect } from 'react-router';
import { REPORT_REASONS, REPORT_REASON_LABELS, reportSchema } from '@skillverse/shared';
import type { Route } from './+types/report';
import { Alert } from '~/components/ui/alert';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireSlug } from '~/lib/params';
export function meta() {
  return [{ title: 'Report content | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}
function destination(slug: string, value: string | null) {
  // Only return to this course or one of its UUID-keyed discussion threads.
  const base = `/courses/${slug}`;
  if (value === base || value === `${base}/questions`) return value;
  if (
    value?.startsWith(`${base}/questions/`) &&
    /^[-a-f0-9]{36}$/.test(value.slice(`${base}/questions/`.length))
  )
    return value;
  return base;
}
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const slug = requireSlug(params.slug),
    search = new URL(request.url).searchParams;
  const parsed = reportSchema
    .pick({ targetType: true, targetId: true })
    .safeParse({ targetType: search.get('targetType'), targetId: search.get('targetId') });
  if (!parsed.success) throw data('Invalid report target.', { status: 400 });
  return { slug, ...parsed.data, returnTo: destination(slug, search.get('returnTo')) };
}
export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const slug = requireSlug(params.slug),
    form = await request.formData(),
    values = formValues(form, ['targetType', 'targetId', 'reason', 'details']);
  const parsed = validate(reportSchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api(request, `/api/v1/community/courses/${slug}/reports`, {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return redirect(`${destination(slug, String(form.get('returnTo') ?? ''))}?reported=1`);
}
export default function Report({ loaderData: d, actionData }: Route.ComponentProps) {
  const state = actionData as FormState | undefined;
  return (
    <section className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link className="text-sm text-fg-muted hover:text-brand" to={d.returnTo}>
        ← Back to course
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Report {d.targetType}</h1>
      <p className="mt-3 text-fg-muted">
        Tell us what concerns you. Your report is visible only to the moderation team.
      </p>
      <Form method="post" className="mt-7 space-y-5" noValidate>
        <input type="hidden" name="targetType" value={d.targetType} />
        <input type="hidden" name="targetId" value={d.targetId} />
        <input type="hidden" name="returnTo" value={d.returnTo} />
        {state?.formError && <Alert tone="danger">{state.formError}</Alert>}
        <Field name="reason" label="Reason" errors={state?.fieldErrors?.reason}>
          {(p) => (
            <select {...p} className={inputClass} defaultValue={state?.values?.reason ?? 'spam'}>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          name="details"
          label="What happened?"
          hint="Include enough detail to help us review this content."
          errors={state?.fieldErrors?.details}
        >
          {(p) => (
            <textarea
              {...p}
              className={inputClass}
              rows={5}
              required
              minLength={10}
              maxLength={2000}
              defaultValue={state?.values?.details}
            />
          )}
        </Field>
        <SubmitButton pendingText="Sending…">Send report</SubmitButton>
      </Form>
    </section>
  );
}
