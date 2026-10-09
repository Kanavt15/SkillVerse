import { LearnerWorkspace } from '~/components/layout/learner-workspace';
/** /account/certificates: issued credentials and explicit issuance for newly completed courses. */
import { Award } from 'lucide-react';
import { data, Form, redirect } from 'react-router';
import type { Certificate, LearningCourse } from '@skillverse/shared';
import type { Route } from './+types/certificates';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { SubmitButton } from '~/components/ui/submit-button';
import { LocalTime } from '~/components/ui/local-time';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { fromApiError, type FormState } from '~/lib/forms';
import { requireSlug } from '~/lib/params';

export function meta() {
  return [{ title: 'My certificates | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}
export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const [certificates, courses] = await Promise.all([
    api<Certificate[]>(request, '/api/v1/me/certificates'),
    api<LearningCourse[]>(request, '/api/v1/me/learning'),
  ]);
  if (!certificates.ok) throw data(certificates.error.message, { status: certificates.status });
  if (!courses.ok) throw data(courses.error.message, { status: courses.status });
  return {
    certificates: certificates.data,
    completed: courses.data.filter((c) => c.progressPercent === 100 && !c.certificateSerial),
  };
}
export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const slug = requireSlug(form.get('slug'));
  const res = await api<Certificate>(request, `/api/v1/learning/courses/${slug}/certificate`, {
    method: 'POST',
  });
  if (!res.ok) return fromApiError(res.error, res.status);
  return redirect(`/verify/${res.data.serial}`);
}
export default function Certificates({ loaderData, actionData }: Route.ComponentProps) {
  const state = actionData as FormState | undefined;
  return (
    <LearnerWorkspace>
      <h1 className="text-3xl font-bold">My certificates</h1>
      <p className="mt-2 text-fg-muted">
        A record of the courses you finished, with a link others can verify.
      </p>
      {state?.formError && (
        <Alert className="mt-5" tone="danger">
          {state.formError}
        </Alert>
      )}
      <div className="mt-8 space-y-4">
        {loaderData.completed.map((c) => (
          <article
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent-subtle p-6"
          >
            <div>
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-fg-muted">
                All {c.lessonCount} lessons completed. Ready to issue.
              </p>
            </div>
            <Form method="post">
              <input type="hidden" name="slug" value={c.slug} />
              <SubmitButton pendingText="Issuing…">Get certificate</SubmitButton>
            </Form>
          </article>
        ))}
        {loaderData.certificates.map((c) => (
          <article
            key={c.serial}
            className="flex flex-wrap items-center gap-5 rounded-xl border border-border p-6"
          >
            <Award className="size-9 shrink-0 text-brand" aria-hidden="true" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{c.courseTitle}</h2>
              <p className="mt-1 text-sm text-fg-muted">
                Issued <LocalTime iso={c.issuedAt} />
              </p>
            </div>
            <Button asLink to={`/verify/${c.serial}`} variant="secondary">
              View & share
            </Button>
          </article>
        ))}
      </div>
      {!loaderData.certificates.length && !loaderData.completed.length && (
        <div className="mt-8 rounded-xl border border-dashed border-border-strong p-10 text-center">
          <Award className="mx-auto size-10 text-brand" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">Finish a course. Show what you learned.</h2>
          <p className="mt-2 text-fg-muted">
            Mark every lesson complete to earn your first certificate.
          </p>
          <Button asLink to="/learning" className="mt-5">
            Go to my learning
          </Button>
        </div>
      )}
    </LearnerWorkspace>
  );
}
