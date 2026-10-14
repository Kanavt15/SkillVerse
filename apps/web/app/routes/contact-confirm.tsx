import { Form } from 'react-router';
import type { Route } from './+types/contact-confirm';
import { api } from '~/lib/api.server';
import { PageHeading } from '~/components/layout/page-heading';
import { Alert } from '~/components/ui/alert';
import { SubmitButton } from '~/components/ui/submit-button';
export function meta() {
  return [
    { title: 'Confirm private request | SkillVerse' },
    { name: 'robots', content: 'noindex' },
    { name: 'referrer', content: 'same-origin' },
  ];
}
export function loader({ request }: Route.LoaderArgs) {
  return { token: new URL(request.url).searchParams.get('token') ?? '' };
}
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const result = await api(request, '/api/v1/support/confirm', {
    method: 'POST',
    body: { token: form.get('token') },
  });
  return result.ok ? { confirmed: true as const } : { error: result.error.message };
}
export default function Confirm({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <div className="page-shell max-w-xl">
      <PageHeading
        title="Confirm your private request"
        description="This confirms ownership of the email address and places your request in the private staff inbox."
      />
      {actionData && 'confirmed' in actionData ? (
        <Alert>Your request is confirmed. Replies will be sent privately to your email.</Alert>
      ) : (
        <>
          <p className="mb-5 text-sm">
            Opening this page does not submit or consume your confirmation link.
          </p>
          {actionData?.error && <Alert tone="danger">{actionData.error}</Alert>}
          <Form method="post">
            <input type="hidden" name="token" value={loaderData.token} />
            <SubmitButton>Confirm Contact request</SubmitButton>
          </Form>
        </>
      )}
    </div>
  );
}
