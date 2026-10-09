/** Connected steps form a compact skill-sharing mark. It inherits the current theme. */
import { Link } from 'react-router';
import { APP_NAME } from '@skillverse/shared';
export function Logo() {
  return (
    <Link
      to="/"
      className="inline-flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-tight sm:gap-2.5 sm:text-xl"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-fg">
        <svg viewBox="0 0 32 32" className="size-6" fill="none" aria-hidden="true">
          <path
            d="M24 8H13a5 5 0 0 0 0 10h6a4 4 0 0 1 0 8H8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="24" cy="8" r="3" fill="currentColor" />
          <circle cx="8" cy="26" r="3" fill="currentColor" />
        </svg>
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}
