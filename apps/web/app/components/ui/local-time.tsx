/**
 * Shows a timestamp in the VIEWER's own timezone and locale.
 *
 * Why a component: the server (UTC, en-US) and the browser (e.g. IST, en-IN)
 * format dates differently, and rendering `toLocaleString()` directly causes a
 * hydration mismatch. We render a fixed UTC format on the server and on the
 * first client render (identical), then local time once hydrated.
 * The machine-readable value is always in the <time dateTime> attribute.
 */
import { useHydrated } from '~/lib/use-hydrated';

const serverFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

export function LocalTime({
  iso,
  options = DEFAULT_OPTIONS,
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const hydrated = useHydrated();
  const date = new Date(iso);
  const text = hydrated
    ? new Intl.DateTimeFormat(undefined, options).format(date)
    : `${serverFormat.format(date)} UTC`;
  return <time dateTime={iso}>{text}</time>;
}
