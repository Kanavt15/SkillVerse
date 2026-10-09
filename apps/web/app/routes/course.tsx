/** /courses/:slug: course overview, public curriculum/previews, enrollment and learner reviews. */
import { BookOpen, Check, Clock3, Globe2, PlayCircle, Star } from 'lucide-react';
import { data, Form, Link, redirect } from 'react-router';
import {
  COURSE_LANGUAGES,
  LEVEL_LABELS,
  formatMoney,
  reviewSchema,
  type CourseDetail,
  type ReviewView,
  type EnrollmentStatus,
} from '@skillverse/shared';
import type { Route } from './+types/course';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { inputClass } from '~/components/ui/input';
import { SafeMarkdown } from '~/components/ui/safe-markdown';
import { SubmitButton } from '~/components/ui/submit-button';
import { ReportLink } from '~/components/ui/discussion';
import { api } from '~/lib/api.server';
import { getUser, requireUser } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate, type FormState } from '~/lib/forms';
import { requireSlug } from '~/lib/params';

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `${data?.course.title ?? 'Course'} | SkillVerse` },
    { name: 'description', content: data?.course.subtitle ?? 'Explore this course on SkillVerse.' },
    { property: 'og:title', content: data?.course.title ?? 'SkillVerse course' },
    { property: 'og:description', content: data?.course.subtitle ?? '' },
  ];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const slug = requireSlug(params.slug);
  const page = Number(new URL(request.url).searchParams.get('reviewPage') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    throw data('Invalid review page', { status: 400 });
  const [course, reviews, user] = await Promise.all([
    api<CourseDetail>(request, `/api/v1/courses/${slug}`),
    api<ReviewView[]>(request, `/api/v1/courses/${slug}/reviews?page=${page}`),
    getUser(request),
  ]);
  if (!course.ok) throw data(course.error.message, { status: course.status });
  if (!reviews.ok) throw data(reviews.error.message, { status: reviews.status });
  const status = user
    ? await api<EnrollmentStatus>(request, `/api/v1/learning/courses/${slug}/status`)
    : null;
  if (status && !status.ok) throw data(status.error.message, { status: status.status });
  return {
    course: course.data,
    reviews: reviews.data,
    reviewPage: page,
    user,
    enrollment: status?.ok ? status.data : { enrolled: false, review: null, nextLessonId: null },
    reported: new URL(request.url).searchParams.get('reported') === '1',
  };
}
export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const slug = requireSlug(params.slug);
  const form = await request.formData();
  if (form.get('intent') === 'enroll') {
    const res = await api<{ firstLessonId: string | null }>(
      request,
      `/api/v1/learning/courses/${slug}/enroll`,
      { method: 'POST' },
    );
    if (!res.ok) return fromApiError(res.error, res.status);
    return redirect(
      res.data.firstLessonId ? `/learn/${slug}/${res.data.firstLessonId}` : '/learning',
    );
  }
  if (form.get('intent') === 'review') {
    const values = formValues(form, ['rating', 'body']);
    const parsed = validate(reviewSchema, { rating: Number(values.rating), body: values.body });
    if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
    const res = await api(request, `/api/v1/learning/courses/${slug}/review`, {
      method: 'POST',
      body: parsed.data,
    });
    if (!res.ok) return fromApiError(res.error, res.status, values);
    return { success: 'Your review was saved.' };
  }
  return formError({ formError: 'Unknown action.' });
}

export default function Course({ loaderData, actionData }: Route.ComponentProps) {
  const { course, user, enrollment, reviews, reviewPage } = loaderData;
  const state = actionData as FormState | undefined;
  const first = course.sections.flatMap((s) => s.lessons)[0];
  return (
    <>
      <section className="course-overview">
        <div className="page-shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-fg-muted">
              <Link to="/courses" className="hover:text-brand">
                Courses
              </Link>
              {course.category && (
                <>
                  <span aria-hidden="true">/</span>
                  <Link to={`/categories/${course.category.slug}`} className="hover:text-brand">
                    {course.category.name}
                  </Link>
                </>
              )}
            </nav>
            <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">
              {course.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-fg-muted">{course.subtitle}</p>
            <p className="mt-5 text-sm">
              Taught by{' '}
              <Link
                to={`/instructors/${course.instructor.username}`}
                className="font-medium text-brand underline underline-offset-4"
              >
                {course.instructor.displayName}
              </Link>
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-fg-muted">
              <Badge>{LEVEL_LABELS[course.level]}</Badge>
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-4" aria-hidden="true" />
                {course.lessonCount} lessons
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="size-4" aria-hidden="true" />
                {course.durationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <Globe2 className="size-4" aria-hidden="true" />
                {COURSE_LANGUAGES[course.language as keyof typeof COURSE_LANGUAGES] ??
                  course.language}
              </span>
            </div>
            {course.ratingAverage !== null && (
              <p className="mt-4 flex items-center gap-2 text-sm">
                <Star className="size-4 text-warning" aria-hidden="true" />
                {course.ratingAverage.toFixed(1)} from {course.ratingCount}{' '}
                {course.ratingCount === 1 ? 'review' : 'reviews'}
              </p>
            )}
          </div>
          <aside className="course-enrollment self-start">
            <p className="font-display text-3xl font-bold">
              {course.priceInPaise === 0 ? 'Free' : formatMoney(course.priceInPaise)}
            </p>
            <p className="mt-2 text-sm text-fg-muted">
              Learn at your own pace. Keep your notes and earn a certificate of completion.
            </p>
            <div className="mt-5">
              {enrollment.enrolled && first ? (
                <Button
                  asLink
                  to={`/learn/${course.slug}/${enrollment.nextLessonId ?? first.id}`}
                  className="w-full"
                >
                  Continue learning
                </Button>
              ) : course.priceInPaise > 0 ? (
                <p className="rounded-md bg-surface-muted p-3 text-sm">Enrollment opens soon.</p>
              ) : !user ? (
                <Button
                  asLink
                  to={`/login?redirectTo=${encodeURIComponent(`/courses/${course.slug}`)}`}
                  className="w-full"
                >
                  Sign in to enroll
                </Button>
              ) : !user.emailVerified ? (
                <Button asLink to="/check-email" className="w-full">
                  Verify email to enroll
                </Button>
              ) : (
                <Form method="post">
                  <SubmitButton
                    name="intent"
                    value="enroll"
                    pendingText="Enrolling…"
                    className="w-full"
                  >
                    Enroll for free
                  </SubmitButton>
                </Form>
              )}
            </div>
            {user && (enrollment.enrolled || user.username === course.instructor.username) && (
              <Button
                asLink
                to={`/courses/${course.slug}/questions`}
                variant="secondary"
                className="mt-3 w-full"
              >
                Course Q&A
              </Button>
            )}
            {state?.formError && (
              <Alert tone="danger" className="mt-4">
                {state.formError}
              </Alert>
            )}
            <p className="mt-4 text-xs text-fg-subtle">
              {course.enrollmentCount}{' '}
              {course.enrollmentCount === 1 ? 'learner has' : 'learners have'} joined this course.
            </p>
          </aside>
        </div>
      </section>
      <div className="page-shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {course.learningOutcomes.length > 0 && (
            <section aria-labelledby="outcomes-title" className="community-panel">
              <h2 id="outcomes-title" className="text-xl font-semibold">
                What you’ll learn
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.learningOutcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    {outcome}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="curriculum-title">
            <h2 id="curriculum-title" className="text-2xl font-semibold">
              Course curriculum
            </h2>
            <div className="mt-5 overflow-hidden rounded-lg border border-border">
              {course.sections.map((s, i) => (
                <details key={s.id} open={i === 0} className="border-b border-border last:border-0">
                  <summary className="cursor-pointer bg-bg-subtle px-5 py-4 text-sm font-semibold">
                    {s.title}{' '}
                    <span className="ml-2 font-normal text-fg-muted">
                      {s.lessons.length} lessons
                    </span>
                  </summary>
                  <ol className="divide-y divide-border">
                    {s.lessons.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <PlayCircle
                            className="size-4 shrink-0 text-fg-muted"
                            aria-hidden="true"
                          />
                          {enrollment.enrolled || l.isPreview ? (
                            <Link to={`/learn/${course.slug}/${l.id}`} className="hover:text-brand">
                              {l.title}
                            </Link>
                          ) : (
                            <span>{l.title}</span>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-3">
                          {l.isPreview && (
                            <Link to={`/learn/${course.slug}/${l.id}`} className="text-brand">
                              Preview
                            </Link>
                          )}
                          <span className="text-fg-muted">{l.durationMinutes} min</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="mb-4 text-2xl font-semibold">
              About this course
            </h2>
            <SafeMarkdown>{course.description}</SafeMarkdown>
          </section>
          {course.requirements.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">Before you start</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-muted">
                {course.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="reviews-title" id="reviews">
            {loaderData.reported && (
              <Alert tone="success" className="mb-4">
                Your report has been sent privately to the moderation team.
              </Alert>
            )}
            <h2 id="reviews-title" className="text-2xl font-semibold">
              Learner reviews
            </h2>
            {state?.success && (
              <Alert tone="success" className="mt-4">
                {state.success}
              </Alert>
            )}
            {enrollment.enrolled && (
              <Form
                method="post"
                className="mt-5 space-y-4 rounded-lg border border-border p-5"
                noValidate
              >
                <input type="hidden" name="intent" value="review" />
                <p className="text-sm text-fg-muted">
                  Complete a lesson, then share what helped. You can edit your review at any time.
                </p>
                {enrollment.review?.hidden && (
                  <Alert>
                    Your review is hidden after moderation. Editing it keeps it hidden until staff
                    restore it.
                  </Alert>
                )}
                <Field name="rating" label="Your rating" errors={state?.fieldErrors?.rating}>
                  {(p) => (
                    <select
                      {...p}
                      className={inputClass}
                      defaultValue={state?.values?.rating ?? String(enrollment.review?.rating ?? 5)}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'star' : 'stars'}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field name="body" label="Your experience" errors={state?.fieldErrors?.body}>
                  {(p) => (
                    <textarea
                      {...p}
                      className={inputClass}
                      rows={3}
                      maxLength={2000}
                      defaultValue={state?.values?.body ?? enrollment.review?.body ?? ''}
                    />
                  )}
                </Field>
                <SubmitButton pendingText="Saving…">
                  {enrollment.review ? 'Update review' : 'Post review'}
                </SubmitButton>
              </Form>
            )}
            {!reviews.length && (
              <p className="mt-4 text-sm text-fg-muted">
                No reviews yet. Start learning and share your experience.
              </p>
            )}
            <div className="mt-5 divide-y divide-border">
              {reviews.map((r) => (
                <article key={r.id} className="py-5">
                  <p className="font-medium">
                    {r.author.displayName}{' '}
                    <span className="ml-2 text-sm text-fg-muted">{r.rating} / 5 stars</span>
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-fg-muted">{r.body}</p>
                  {enrollment.enrolled && user?.emailVerified && (
                    <ReportLink
                      slug={course.slug}
                      targetType="review"
                      targetId={r.id}
                      returnTo={`/courses/${course.slug}`}
                    />
                  )}
                </article>
              ))}
            </div>
            {course.ratingCount > 20 && (
              <nav aria-label="Review pages" className="flex justify-between text-sm text-brand">
                {reviewPage > 1 ? (
                  <Link to={`?reviewPage=${reviewPage - 1}#reviews`}>Previous reviews</Link>
                ) : (
                  <span />
                )}
                {reviewPage * 20 < course.ratingCount && (
                  <Link to={`?reviewPage=${reviewPage + 1}#reviews`}>Next reviews</Link>
                )}
              </nav>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <h2 className="text-lg font-semibold">Meet your instructor</h2>
          <Link
            to={`/instructors/${course.instructor.username}`}
            className="font-medium text-brand"
          >
            {course.instructor.displayName}
          </Link>
          <p className="text-sm text-fg-muted">{course.instructor.headline}</p>
          {course.instructor.bio && <SafeMarkdown>{course.instructor.bio}</SafeMarkdown>}
          {course.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {course.tags.map((t) => (
                <Badge key={t}>{t.replace(/-/g, ' ')}</Badge>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
