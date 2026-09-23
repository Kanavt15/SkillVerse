/**
 * /teach: "Teach on SkillVerse". Public pitch + how it works; signed-in
 * visitors see their application (form, pending, approved or feedback).
 */
import {
  BadgeIndianRupee,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  PenLine,
  Users,
} from 'lucide-react';
import { Form, Link } from 'react-router';
import { instructorApplicationSchema } from '@skillverse/shared';
import type { Route } from './+types/teach';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Field } from '~/components/ui/field';
import { Input, inputClass } from '~/components/ui/input';
import { LocalTime } from '~/components/ui/local-time';
import { SubmitButton } from '~/components/ui/submit-button';
import type { Category, InstructorApplication } from '~/features/teaching/types';
import { api, apiGet } from '~/lib/api.server';
import { getUser, requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { isInstructor } from '~/lib/roles';

export function meta() {
  return [
    { title: 'Teach on SkillVerse | Share what you know and earn' },
    {
      name: 'description',
      content:
        'Create a course on SkillVerse, reach learners across India and keep up to 95% of what you earn.',
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const [user, categories] = await Promise.all([
    getUser(request).catch(() => null),
    apiGet<Category[]>('/api/v1/categories').catch(() => [] as Category[]),
  ]);
  let application: InstructorApplication | null = null;
  if (user && !isInstructor(user.roles)) {
    const res = await api<InstructorApplication | null>(
      request,
      '/api/v1/me/instructor-application',
    );
    application = res.ok ? res.data : null;
  }
  return {
    viewer: user
      ? { emailVerified: user.emailVerified, instructor: isInstructor(user.roles) }
      : null,
    application,
    categories,
  };
}

const FIELDS = ['headline', 'experience', 'sampleUrl'] as const;

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const values = formValues(formData, FIELDS);
  const topics = formData.getAll('topics').filter((t): t is string => typeof t === 'string');
  const echo = { ...values, topics: topics.join(',') };
  const parsed = validate(instructorApplicationSchema, { ...values, topics });
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values: echo });
  const res = await api(request, '/api/v1/me/instructor-application', {
    method: 'POST',
    body: parsed.data,
  });
  if (!res.ok) return fromApiError(res.error, res.status, echo);
  return { success: 'Application sent! We usually reply within 3 working days.' };
}

const PERKS = [
  {
    icon: BadgeIndianRupee,
    title: 'Keep up to 95%',
    body: 'Earn 95% on sales from your own links and coupons, and 70% when SkillVerse finds the learner.',
  },
  {
    icon: Users,
    title: 'Learners across India',
    body: 'Teach in English, Hindi or any of 9 other Indian languages, free or paid.',
  },
  {
    icon: PenLine,
    title: 'Simple course builder',
    body: 'Sections, video lessons (YouTube or Vimeo links) and articles. No upload limits to worry about.',
  },
  {
    icon: ClipboardCheck,
    title: 'Quality review',
    body: 'Every course is checked before it goes live, so learners trust what they buy.',
  },
];

const STEPS = [
  'Apply below. Tell us what you teach and show us a sample.',
  'We review your application, usually within 3 working days.',
  'Build your course in the Studio and submit it for review.',
  'Once approved, your course goes live in the catalog.',
];

export default function Teach({ loaderData, actionData }: Route.ComponentProps) {
  const { viewer, application, categories } = loaderData;
  const state = actionData as FormState | undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">
          Teach on SkillVerse
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
          Share what you know. Earn from it.
        </h1>
        <p className="mt-4 text-lg text-fg-muted">
          Turn your skills into courses that learners across India can take at their own pace.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PERKS.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-5 sm:p-6">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand-subtle-fg">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-fg-muted">{body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-2xl font-bold">
            How it works
          </h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-fg">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-fg-muted">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-fg-subtle">
            Paid enrollments open when payments launch. You can publish free courses and set prices
            now.
          </p>
        </section>

        <section aria-labelledby="apply">
          <ApplyPanel
            viewer={viewer}
            application={application}
            categories={categories}
            state={state}
          />
        </section>
      </div>
    </div>
  );
}

function ApplyPanel({
  viewer,
  application,
  categories,
  state,
}: {
  viewer: { emailVerified: boolean; instructor: boolean } | null;
  application: InstructorApplication | null;
  categories: Category[];
  state: FormState | undefined;
}) {
  if (!viewer) {
    return (
      <Card>
        <h2 id="apply" className="text-xl font-semibold">
          Ready to teach?
        </h2>
        <p className="mt-2 text-fg-muted">Create a free account, then apply in a few minutes.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asLink to="/signup">
            Create an account
          </Button>
          <Button asLink to="/login?redirectTo=%2Fteach" variant="secondary">
            Sign in to apply
          </Button>
        </div>
      </Card>
    );
  }

  if (viewer.instructor) {
    return (
      <Card>
        <h2 id="apply" className="flex items-center gap-2 text-xl font-semibold">
          <CheckCircle2 className="size-5 text-accent" aria-hidden="true" /> You're an instructor
        </h2>
        <p className="mt-2 text-fg-muted">Head to the Studio to create or edit your courses.</p>
        <Button asLink to="/studio" className="mt-6">
          Open the Studio
        </Button>
      </Card>
    );
  }

  if (!viewer.emailVerified) {
    return (
      <Card>
        <h2 id="apply" className="text-xl font-semibold">
          Confirm your email first
        </h2>
        <p className="mt-2 text-fg-muted">
          We need a confirmed email address before you can apply. Check your inbox, or{' '}
          <Link to="/dashboard" className="font-medium text-brand underline">
            resend the link from your dashboard
          </Link>
          .
        </p>
      </Card>
    );
  }

  if (state?.success || application?.status === 'pending') {
    return (
      <Card>
        <h2 id="apply" className="flex items-center gap-2 text-xl font-semibold">
          <Clock className="size-5 text-brand" aria-hidden="true" /> Application received
        </h2>
        <p className="mt-2 text-fg-muted">
          {state?.success ??
            "We're reviewing your application and will email you as soon as there's a decision."}
        </p>
        {application && (
          <p className="mt-4 text-sm text-fg-subtle">
            Sent <LocalTime iso={application.createdAt} />
          </p>
        )}
      </Card>
    );
  }

  const errors = state?.fieldErrors;
  const values = state?.values;
  const chosen = new Set(
    (values?.topics ?? application?.topics.join(',') ?? '').split(',').filter(Boolean),
  );

  return (
    <Card>
      <h2 id="apply" className="text-xl font-semibold">
        Apply to teach
      </h2>
      {application?.status === 'rejected' && (
        <Alert className="mt-4">
          <p className="font-medium">Your last application wasn't approved yet.</p>
          {application.reviewNotes && <p className="mt-1">Feedback: {application.reviewNotes}</p>}
          <p className="mt-1">You're welcome to update it and apply again.</p>
        </Alert>
      )}
      <Form method="post" className="mt-6 space-y-5" noValidate>
        {state?.formError && <Alert tone="danger">{state.formError}</Alert>}
        <Field
          label="Your headline"
          name="headline"
          hint="How learners will know you, e.g. “Data analyst at a fintech, 6 years”."
          errors={errors?.headline}
        >
          {(p) => (
            <Input
              {...p}
              maxLength={120}
              defaultValue={values?.headline ?? application?.headline ?? ''}
            />
          )}
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What will you teach? (up to 5)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
              >
                <input
                  type="checkbox"
                  name="topics"
                  value={c.slug}
                  defaultChecked={chosen.has(c.slug)}
                  className="accent-brand"
                />
                {c.name}
              </label>
            ))}
          </div>
          {errors?.topics && (
            <p className="text-xs text-danger" role="alert">
              {errors.topics.join(' ')}
            </p>
          )}
        </fieldset>

        <Field
          label="Your experience"
          name="experience"
          hint="What have you done, and who have you taught? At least 80 characters."
          errors={errors?.experience}
        >
          {(p) => (
            <textarea
              {...p}
              rows={6}
              maxLength={3000}
              className={inputClass}
              defaultValue={values?.experience ?? application?.experience ?? ''}
            />
          )}
        </Field>

        <Field
          label="Sample of your teaching (optional)"
          name="sampleUrl"
          hint="A link to a video, blog post or slides. Must start with https://"
          errors={errors?.sampleUrl}
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              defaultValue={values?.sampleUrl ?? application?.sampleUrl ?? ''}
            />
          )}
        </Field>

        <div className="flex justify-end">
          <SubmitButton pendingText="Sending…">Send application</SubmitButton>
        </div>
      </Form>
    </Card>
  );
}
