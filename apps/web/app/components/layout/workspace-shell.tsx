import { NavLink } from 'react-router';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface WorkspaceSection {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Responsive workspace navigation; authorization remains in each existing route loader. */
export function WorkspaceShell({
  title,
  label,
  sections,
  children,
}: {
  title: string;
  label: string;
  sections: WorkspaceSection[];
  children: ReactNode;
}) {
  return (
    <section className="page-shell workspace">
      <aside className="workspace-sidebar">
        <p>{title}</p>
        <nav aria-label={label} className="workspace-nav">
          {sections.map(({ to, label: text, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="workspace-link">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {text}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="workspace-content">{children}</div>
    </section>
  );
}
