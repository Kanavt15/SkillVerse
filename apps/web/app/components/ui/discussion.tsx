/** Shared discussion attribution, report links and bounded pagination. */
import { Link } from 'react-router';
import type { QuestionView } from '@skillverse/shared';
import { Badge } from './badge';
import { LocalTime } from './local-time';

export function DiscussionAuthor({
  author,
  createdAt,
}: {
  author: QuestionView['author'];
  createdAt: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
      <span className="font-medium text-fg">{author.displayName}</span>
      {author.instructor && <Badge>Instructor</Badge>}
      <span aria-hidden="true">·</span>
      <LocalTime iso={createdAt} />
    </p>
  );
}
export function ReportLink({
  slug,
  targetType,
  targetId,
  returnTo,
}: {
  slug: string;
  targetType: 'question' | 'reply' | 'review';
  targetId: string;
  returnTo: string;
}) {
  const query = new URLSearchParams({ targetType, targetId, returnTo });
  return (
    <Link
      to={`/courses/${slug}/report?${query}`}
      className="inline-block py-2 text-xs text-fg-muted underline underline-offset-4 hover:text-brand"
    >
      Report {targetType}
    </Link>
  );
}
export function DiscussionPages({
  page,
  totalPages,
  query = '',
}: {
  page: number;
  totalPages: number;
  query?: string;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams(query);
    params.set('page', String(p));
    return `?${params}`;
  };
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link className="text-brand underline" to={href(page - 1)}>
          Previous page
        </Link>
      ) : (
        <span />
      )}
      <span className="text-fg-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link className="text-brand underline" to={href(page + 1)}>
          Next page
        </Link>
      )}
    </nav>
  );
}
