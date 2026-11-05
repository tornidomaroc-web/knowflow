'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyTheme, currentTheme, type Theme } from '@/lib/theme';
import { ClayMoon, ClaySun } from '@/components/clay/ClayIcons';

export interface ThemeToggleLabels {
  /** The control's name for a screen reader, e.g. "Appearance". */
  appearance: string;
  dark: string;
  light: string;
}

/**
 * THE THEME TOGGLE (register #46). Three forms of one control:
 *
 * - `segmented`: a two-option control with words, for Settings, where a
 *   student is choosing deliberately and should read what they chose. Design
 *   "C", PR 2 (Prefs.dc.html): two equal options in a pressed-in well, light
 *   first (the default), the chosen one a gold clay pill, a clay sun and moon,
 *   each option 48 pt tall (`.kf-seg`, globals.css).
 * - `icon`: one 44px button that flips to the other theme, for the sidebar
 *   and the mobile top bar, where there is no room for words and the icon
 *   shows the theme you would GET (a sun on dark, a moon on light), which is
 *   the convention every phone OS uses.
 * - `clay`: the same button as a clay tile with the clay sun and moon, for the
 *   public site's header (PR 2, Landing.dc.html).
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
  variant?: 'segmented' | 'icon' | 'clay';
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(currentTheme()), []);

  const choose = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };

  if (variant === 'clay') {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    const label = `${labels.appearance}: ${next === 'light' ? labels.light : labels.dark}`;
    return (
      <button
        type="button"
        onClick={() => choose(next)}
        aria-label={label}
        title={label}
        className={cn(
          'kf-pill inline-flex h-11 w-11 items-center justify-center rounded-[0.875rem] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        {theme === 'light' ? <ClayMoon /> : <ClaySun />}
      </button>
    );
  }

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

  // Light first: it is the default since design "C" (Prefs.dc.html).
  const options: { key: Theme; label: string }[] = [
    { key: 'light', label: labels.light },
    { key: 'dark', label: labels.dark },
  ];
  // A radio group takes ONE tab stop and moves with the arrow keys (WAI-ARIA
  // radio group); before the theme is read, the first option holds the stop.
  const focusIndex = Math.max(0, options.findIndex((o) => o.key === theme));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const next = options[(focusIndex + 1) % options.length].key;
    choose(next);
    (e.currentTarget.querySelector(`[data-theme-option="${next}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={labels.appearance}
      onKeyDown={onKeyDown}
      className={cn('kf-seg grid grid-cols-2 gap-1.5 rounded-[1.375rem] p-1.5', className)}
    >
      {options.map(({ key, label }, i) => {
        const selected = theme === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === focusIndex ? 0 : -1}
            data-theme-option={key}
            onClick={() => choose(key)}
            className="kf-seg-opt inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-[1.0625rem] px-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {key === 'light' ? <ClaySun /> : <ClayMoon fill={selected ? 'url(#kf-c-ink)' : undefined} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
