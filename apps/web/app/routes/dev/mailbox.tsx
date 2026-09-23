/**
 * /dev/mailbox: local development only. Shows the emails the API "sent"
 * (verification, password reset…) so you can click their links without a
 * real email account. Returns 404 in every other environment.
 */
import { Fragment } from 'react';
import { useRevalidator } from 'react-router';
import type { Route } from './+types/mailbox';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { LocalTime } from '~/components/ui/local-time';
import { apiGet } from '~/lib/api.server';

interface Mail {
  id: string;
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

export function meta() {
  return [{ title: 'Dev mailbox | SkillVerse' }, { name: 'robots', content: 'noindex' }];
}

export async function loader() {
  try {
    return { mails: await apiGet<Mail[]>('/api/v1/dev/mailbox') };
  } catch {
    // The API answers 404 outside development; so do we.
    throw new Response('Not Found', { status: 404 });
  }
}

/** Renders plain email text, turning http(s) links into clickable anchors. Text stays text: no HTML is interpreted. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} className="break-all text-brand underline">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export default function DevMailbox({ loaderData }: Route.ComponentProps) {
  const { revalidate, state } = useRevalidator();
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dev mailbox</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Emails sent while running locally (kept in memory, newest first, cleared when the API
            restarts).
          </p>
        </div>
        <Button variant="secondary" onClick={() => revalidate()} disabled={state === 'loading'}>
          Refresh
        </Button>
      </div>
      <div className="mt-8 space-y-4">
        {loaderData.mails.length === 0 && (
          <p className="text-fg-muted">No emails yet. Sign up to trigger one.</p>
        )}
        {loaderData.mails.map((m) => (
          <Card key={m.id} className="p-5 sm:p-6">
            <p className="text-xs text-fg-subtle">
              To {m.to} · <LocalTime iso={m.sentAt} />
            </p>
            <h2 className="mt-1 font-semibold">{m.subject}</h2>
            <pre className="mt-3 font-sans text-sm whitespace-pre-wrap text-fg-muted">
              <Linkified text={m.text} />
            </pre>
          </Card>
        ))}
      </div>
    </section>
  );
}
