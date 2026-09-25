'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyTheme, currentTheme, type Theme } from '@/lib/theme';

export interface ThemeToggleLabels {
  /** The control's name for a screen reader, e.g. "Appearance". */
  appearance: string;
  dark: string;
  light: string;
}

/**
 * THE THEME TOGGLE (register #46). Two forms of one control:
 *
 * - `segmented`: a two-option control with words, for Settings, where a
 *   student is choosing deliberately and should read what they chose.
 * - `icon`: one 44px button that flips to the other theme, for the sidebar
 *   and the mobile top bar, where there is no room for words and the icon
 *   shows the theme you would GET (a sun on dark, a moon on light), which is
 *   the convention every phone OS uses.
 *
 * WHY THE STATE STARTS UNKNOWN. The document's theme is set by the boot script
 * from a cookie before React runs, and the server render cannot know a cookie
 * the marketing pages never read. Rendering "dark" on the server and reading
 * the real value after mount would flash the wrong option for one frame and
 * warn about hydration. So the control renders in an indeterminate state until
 * `useEffect` reads `<html data-theme>`, which is the truth, and then settles.
 */
export function ThemeToggle({
  labels,
  variant = 'segmented',
  className,
}: {
  labels: ThemeToggleLabels;
  variant?: 'segmented' | 'icon';
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(currentTheme()), []);

  const choose = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };

  if (variant === 'icon') {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    const label = `${labels.appearance}: ${next === 'light' ? labels.light : labels.dark}`;
    return (
      <button
        type="button"
        onClick={() => choose(next)}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>
    );
  }

  const options: { key: Theme; label: string; Icon: typeof Sun }[] = [
    { key: 'dark', label: labels.dark, Icon: Moon },
    { key: 'light', label: labels.light, Icon: Sun },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={labels.appearance}
      className={cn('inline-flex rounded-xl border border-border bg-raised p-1', className)}
    >
      {options.map(({ key, label, Icon }) => {
        const selected = theme === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(key)}
            className={cn(
              'inline-flex h-10 min-w-[6rem] items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected ? 'bg-surface text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
