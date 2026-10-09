import { Award, Bell, BookOpen, LayoutDashboard } from 'lucide-react';
import type { ReactNode } from 'react';
import { WorkspaceShell } from './workspace-shell';

const SECTIONS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/learning', label: 'My learning', icon: BookOpen },
  { to: '/account/certificates', label: 'Certificates', icon: Award },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];
export function LearnerWorkspace({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell title="Your learning space" label="Learning sections" sections={SECTIONS}>
      {children}
    </WorkspaceShell>
  );
}
