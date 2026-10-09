/** Shared authentication layout. Forms, errors and security controls remain supplied by each route. */
import type { ReactNode } from 'react';
import { Award, BookOpen, MessagesSquare } from 'lucide-react';
import { Card } from '~/components/ui/card';
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="auth-layout">
      <aside className="auth-story" aria-label="Learning on SkillVerse">
        <h2>A little curiosity goes a long way.</h2>
        <p>
          Find a course, keep your notes, ask a question. Your next skill starts with a single
          lesson.
        </p>
        <div className="auth-track" aria-hidden="true">
          <span>
            <BookOpen className="size-5" />
          </span>
          <i />
          <span>
            <MessagesSquare className="size-5" />
          </span>
          <i />
          <span>
            <Award className="size-5" />
          </span>
        </div>
      </aside>
      <div className="auth-panel">
        <Card>
          <h1>{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-fg-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </Card>
        {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
      </div>
    </section>
  );
}
