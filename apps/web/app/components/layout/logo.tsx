/** SkillVerse wordmark with its orbit mark. Pure SVG, so it inherits theme colours. */
import { Link } from 'react-router';
import { APP_NAME } from '@skillverse/shared';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <circle cx="16" cy="16" r="6" className="fill-brand" />
        <ellipse
          cx="16"
          cy="16"
          rx="14"
          ry="6"
          transform="rotate(-30 16 16)"
          className="fill-none stroke-accent"
          strokeWidth="2"
        />
        <circle cx="27" cy="9.5" r="2.2" className="fill-accent" />
      </svg>
      <span>{APP_NAME}</span>
    </Link>
  );
}
