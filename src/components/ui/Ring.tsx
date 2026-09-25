import { cn } from '@/lib/utils';

/**
 * A PROGRESS RING (docs/design/VISUAL_LANGUAGE.md, rule 2): the number sits
 * inside the picture of itself. `value` is 0..1. The arc draws with a CSS
 * transition on `stroke-dashoffset` (inside the reduced-motion guard in
 * globals.css: `.kf-ring-arc`), starting from the server-rendered final
 * state, so without JavaScript or motion it is simply full.
 *
 * `tone` picks the arc's colour: gold by default (the accent, for the
 * student's own allowance), or one of the supporting tints when several
 * rings sit side by side and should not read as four gold coins.
 */
export type RingTone = 'accent' | 'mint' | 'sky' | 'coral' | 'violet';

const TONE: Record<RingTone, string> = {
  accent: 'var(--accent)',
  mint: 'var(--mint)',
  sky: 'var(--sky)',
  coral: 'var(--coral)',
  violet: 'var(--violet)',
};

export function Ring({
  value,
  size = 72,
  stroke = 7,
  tone = 'accent',
  label,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: RingTone;
  /** Screen-reader text, e.g. "7 of 10 questions left". */
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--raised)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={TONE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="kf-ring-arc"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
