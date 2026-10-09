/** /verify/:serial: server-verified immutable completion credential, QR link and browser PDF printing. */
import { Award, CheckCircle2, Copy, Printer } from 'lucide-react';
import { useState } from 'react';
import { data } from 'react-router';
import { renderSVG } from 'uqr';
import type { Certificate } from '@skillverse/shared';
import type { Route } from './+types/verify';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api.server';
import { requireId } from '~/lib/params';

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: `${data?.certificate.learnerName ?? 'Certificate'} · Completion certificate | SkillVerse`,
    },
    { name: 'robots', content: 'noindex' },
  ];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const serial = requireId(params.serial);
  const res = await api<Certificate>(request, `/api/v1/certificates/${serial}`);
  if (!res.ok) throw data(res.error.message, { status: res.status });
  const url = new URL(`/verify/${serial}`, request.url).href;
  return {
    certificate: res.data,
    url,
    qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(url, { border: 4 }))}`,
  };
}
export default function VerifyCertificate({ loaderData }: Route.ComponentProps) {
  const { certificate: c, url, qr } = loaderData;
  const [copyState, setCopyState] = useState('Copy verification link');
  const issued = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(c.issuedAt),
  );
  return (
    <section className="page-shell max-w-5xl">
      <div className="certificate-controls mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Completion certificate</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Verified by SkillVerse. Share the link to show your achievement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopyState('Link copied');
              } catch {
                setCopyState('Copy the link below');
              }
            }}
          >
            <Copy aria-hidden="true" />
            {copyState}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print or save PDF
          </Button>
        </div>
      </div>
      <article className="completion-certificate rounded-xl border border-border bg-surface p-8 sm:p-12">
        <div className="flex items-center justify-between gap-4">
          <span className="font-display text-2xl font-bold">SkillVerse</span>
          <Badge tone="accent">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Verified completion
          </Badge>
        </div>
        <div className="py-10 text-center">
          <Award className="mx-auto size-12 text-brand" strokeWidth={1.2} aria-hidden="true" />
          <p className="mt-5 text-lg text-fg-muted">This certifies that</p>
          <p className="mt-4 font-display text-4xl font-bold sm:text-5xl">{c.learnerName}</p>
          <p className="mt-5 text-fg-muted">completed all {c.lessonCount} lessons in</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-2xl font-semibold sm:text-3xl">
            {c.courseTitle}
          </h2>
          <p className="mt-4 text-sm text-fg-muted">Taught by {c.instructorName}</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 border-t border-border pt-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm">Issued on {issued}</p>
            <p className="mt-2 text-xs break-all text-fg-muted">Certificate ID: {c.serial}</p>
            <a href={url} className="mt-2 block text-xs break-all text-brand">
              {url}
            </a>
            <p className="mt-3 max-w-md text-xs text-fg-subtle">
              A certificate of course completion. It records finished lessons and is separate from a
              proctored skill exam.
            </p>
          </div>
          <img
            src={qr}
            width={96}
            height={96}
            alt="QR code to verify this certificate"
            className="shrink-0 rounded-md bg-white p-1"
          />
        </div>
      </article>
    </section>
  );
}
