/** /settings: edit public profile details. */
import { Form, useRouteLoaderData } from 'react-router';
import { updateProfileSchema } from '@skillverse/shared';
import type { Route } from './+types/profile';
import { Alert } from '~/components/ui/alert';
import { Card } from '~/components/ui/card';
import { Field } from '~/components/ui/field';
import { Input, inputClass } from '~/components/ui/input';
import { SubmitButton } from '~/components/ui/submit-button';
import { api } from '~/lib/api.server';
import { requireUser, type User } from '~/lib/auth.server';
import { formError, formValues, fromApiError, validate } from '~/lib/forms';

export function meta() {
  return [{ title: 'Profile settings | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

const FIELDS = ['displayName', 'headline', 'bio', 'websiteUrl', 'location', 'timezone'] as const;

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const values = formValues(await request.formData(), FIELDS);
  const parsed = validate(updateProfileSchema, values);
  if (!parsed.ok) return formError({ fieldErrors: parsed.fieldErrors, values });
  const res = await api(request, '/api/v1/me/profile', { method: 'PATCH', body: parsed.data });
  if (!res.ok) return fromApiError(res.error, res.status, values);
  return { success: 'Profile saved.' };
}

export default function ProfileSettings({ actionData }: Route.ComponentProps) {
  const { user } = useRouteLoaderData('routes/settings/layout') as { user: User };
  const state = actionData as
    | {
        success?: string;
        formError?: string;
        fieldErrors?: Record<string, string[]>;
        values?: Record<string, string>;
      }
    | undefined;
  const errors = state?.fieldErrors;
  const v = (key: (typeof FIELDS)[number], fallback: string | null) =>
    state?.values?.[key] ?? fallback ?? '';

  return (
    <Card>
      <h2 className="text-xl font-semibold">Public profile</h2>
      <p className="mt-1 text-sm text-fg-muted">This is what other learners and instructors see.</p>
      <Form method="post" className="mt-6 space-y-5" noValidate>
        {state?.success && <Alert tone="success">{state.success}</Alert>}
        {state?.formError && <Alert tone="danger">{state.formError}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" name="displayName" errors={errors?.displayName}>
            {(p) => (
              <Input {...p} autoComplete="name" defaultValue={v('displayName', user.displayName)} />
            )}
          </Field>
          <Field label="Username" name="_username" hint="Usernames can't be changed yet.">
            {(p) => <Input {...p} value={user.username} disabled readOnly />}
          </Field>
        </div>
        <Field
          label="Headline"
          name="headline"
          hint="One line, e.g. “Frontend developer · Pune”"
          errors={errors?.headline}
        >
          {(p) => (
            <Input {...p} maxLength={120} defaultValue={v('headline', user.profile.headline)} />
          )}
        </Field>
        <Field label="About you" name="bio" hint="Up to 2,000 characters." errors={errors?.bio}>
          {(p) => (
            <textarea
              {...p}
              rows={5}
              maxLength={2000}
              className={inputClass}
              defaultValue={v('bio', user.profile.bio)}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Website"
            name="websiteUrl"
            hint="Must start with https://"
            errors={errors?.websiteUrl}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                defaultValue={v('websiteUrl', user.profile.websiteUrl)}
              />
            )}
          </Field>
          <Field label="Location" name="location" errors={errors?.location}>
            {(p) => <Input {...p} defaultValue={v('location', user.profile.location)} />}
          </Field>
        </div>
        <Field
          label="Timezone"
          name="timezone"
          hint="Used for streaks and reminders."
          errors={errors?.timezone}
        >
          {(p) => <Input {...p} defaultValue={v('timezone', user.profile.timezone)} />}
        </Field>
        <div className="flex justify-end">
          <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
        </div>
      </Form>
    </Card>
  );
}
