/** Status badge and helpers shared by the Studio and admin pages. */
import { formatMoney } from '@skillverse/shared';
import { Badge } from '~/components/ui/badge';
import type { CourseStatus } from './types';

const STATUS: Record<
  CourseStatus,
  { label: string; tone: 'neutral' | 'brand' | 'accent' | 'danger' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'brand' },
  published: { label: 'Published', tone: 'accent' },
  rejected: { label: 'Changes requested', tone: 'danger' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** "Free" or "₹499". */
export function priceLabel(paise: number): string {
  return paise === 0 ? 'Free' : formatMoney(paise, 'INR');
}

/** "1 h 25 min" / "12 min". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
