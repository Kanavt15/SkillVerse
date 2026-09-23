/**
 * Cycles the theme: system → light → dark → system.
 * The initial value comes from the server (cookie), so there is no flash.
 */
import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { setTheme, type Theme } from '~/lib/theme';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setState] = useState<Theme>(initial);
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${LABEL[theme]}. Click to change.`}
      title={LABEL[theme]}
      onClick={() => {
        const next = NEXT[theme];
        setTheme(next);
        setState(next);
      }}
    >
      <Icon />
    </Button>
  );
}
