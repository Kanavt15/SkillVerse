/**
 * /onboarding: first-run questions (goal, interests, timezone). The answers
 * drive recommendations and streak/reminder timing. Shown once, after the
 * first sign-in; skippable.
 */
import { Form, redirect } from 'react-router';
import { GOAL_OPTIONS, INTEREST_OPTIONS, updateProfileSchema } from '@skillverse/shared';
import type { Route } from './+types/onboarding';
import { Alert } from '~/components/ui/alert';
import { Card } from '~/components/ui/card';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser } from '~/lib/auth.server';
import { formError, fromApiError, validate } from '~/lib/forms';
import { cn } from '~/lib/cn';
import { useHydrated } from '~/lib/use-hydrated';

export function meta() {
  return [{ title: 'Welcome | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  if (user.profile.onboarded) throw redirect('/dashboard');
  return { name: user.displayName.split(' ')[0] };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const skip = formData.get('intent') === 'skip';
  const input = skip
    ? { completeOnboarding: true }
    : {
        goal: formData.get('goal') || undefined,
        interests: formData.getAll('interests').filter((v) => typeof v === 'string'),
        timezone: formData.get('timezone') || undefined,
        completeOnboarding: true,
      };
  const parsed = validate(updateProfileSchema, input);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors });

  const res = await api(request, '/api/v1/me/profile', { method: 'PATCH', body: parsed.data });
  if (!res.ok) return fromApiError(res.error, res.status);
  return redirect('/dashboard');
}

/** The browser knows the visitor's timezone; the server doesn't. Filled in after hydration. */
function useBrowserTimezone(fallback: string) {
  const hydrated = useHydrated();
  return hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone || fallback : fallback;
}

export default function Onboarding({ loaderData, actionData }: Route.ComponentProps) {
  const timezone = useBrowserTimezone('Asia/Kolkata');
  const errors = actionData?.fieldErrors;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">Welcome, {loaderData.name} 👋</h1>
      <p className="mt-2 text-fg-muted">Two quick questions so we can suggest the right things.</p>

      <Form method="post" className="mt-8 space-y-8">
        {actionData?.formError && <Alert tone="danger">{actionData.formError}</Alert>}
        <input type="hidden" name="timezone" value={timezone} />

        <Card>
          <fieldset>
            <legend className="text-lg font-semibold">What brings you to SkillVerse?</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {GOAL_OPTIONS.map((g) => (
                <label
                  key={g.value}
                  className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
                >
                  <input
                    type="radio"
                    name="goal"
                    value={g.value}
                    className="mt-1 accent-[var(--brand)]"
                  />
                  <span>
                    <span className="block font-medium">{g.label}</span>
                    <span className="block text-sm text-fg-muted">{g.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors?.goal && <p className="mt-2 text-xs text-danger">{errors.goal[0]}</p>}
          </fieldset>
        </Card>

        <Card>
          <fieldset>
            <legend className="text-lg font-semibold">What are you interested in?</legend>
            <p className="mt-1 text-sm text-fg-muted">Pick as many as you like.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((i) => (
                <label
                  key={i.slug}
                  className={cn(
                    'cursor-pointer rounded-full border border-border-strong px-4 py-2 text-sm select-none',
                    'hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-brand-fg',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  )}
                >
                  <input type="checkbox" name="interests" value={i.slug} className="sr-only" />
                  {i.label}
                </label>
              ))}
            </div>
            {errors?.interests && <p className="mt-2 text-xs text-danger">{errors.interests[0]}</p>}
          </fieldset>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SubmitButton variant="ghost" name="intent" value="skip">
            Skip for now
          </SubmitButton>
          <SubmitButton name="intent" value="save" pendingText="Saving…">
            Continue
          </SubmitButton>
        </div>
      </Form>
    </section>
  );
}
