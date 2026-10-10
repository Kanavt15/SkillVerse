/** Public footer connects discovery, teaching and factual product/help pages. */
import { APP_NAME } from '@skillverse/shared';
import { Link } from 'react-router';
import { Logo } from './logo';

export function SiteFooter({ environment }: { environment: string | null }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="grid gap-10 sm:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-fg-muted">
              A space to learn a skill, share your experience, and keep moving forward. Made in
              India, for learners everywhere.
            </p>
          </div>
          <nav className="footer-links" aria-label="Explore">
            <h2 className="text-sm font-semibold">Keep exploring</h2>
            <Link to="/courses">Course catalog</Link>
            <Link to="/courses?price=free">Free courses</Link>
            <Link to="/#how-it-works">How it works</Link>
            <Link to="/help">Help with learning</Link>
          </nav>
          <nav className="footer-links" aria-label="Community">
            <h2 className="text-sm font-semibold">Find your place</h2>
            <Link to="/teach">Become an instructor</Link>
            <Link to="/learning">My learning</Link>
            <Link to="/account/certificates">My certificates</Link>
            <Link to="/about">About SkillVerse</Link>
          </nav>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-fg-subtle">
          <span>
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </span>
          <span>Learn at your pace. Share what you know.</span>
          {environment && environment !== 'production' && <span>Environment: {environment}</span>}
        </div>
      </div>
    </footer>
  );
}
