import type { SVGProps } from 'react';

/**
 * ORIGINAL SPOT ILLUSTRATIONS (docs/design/VISUAL_LANGUAGE.md, rule 1 and 8).
 *
 * Geometric compositions built from circles, rounded rectangles and strokes,
 * coloured with the app's own tokens: gold for the accent, the four
 * supporting tints for warmth. Each is inline SVG under 2 KB, so they cost
 * no request and re-colour with the theme. They are pictures of ideas (a
 * book that sparks, pages that talk, a flame, a cloud that lifts), never
 * characters, and never the app's logo, which the owner designs elsewhere.
 *
 * `title` is optional: an illustration beside a heading is decoration and
 * stays `aria-hidden`; one that stands alone (an empty state) gets a title.
 */
type Props = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Svg({ size = 96, title, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** A book with a spark above it: a subject, what there is to learn. */
export function SparkBook(p: Props) {
  return (
    <Svg {...p}>
      <rect x="18" y="30" width="60" height="46" rx="8" fill="var(--sky-subtle)" stroke="var(--sky)" strokeWidth="2.5" />
      <path d="M48 34v40" stroke="var(--sky)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 44h14M26 52h14M56 44h14M56 52h14" stroke="var(--sky)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M66 10l2.6 6.4L75 19l-6.4 2.6L66 28l-2.6-6.4L57 19l6.4-2.6L66 10z" fill="var(--accent)" />
      <circle cx="30" cy="18" r="3" fill="var(--coral)" />
    </Svg>
  );
}

/** Two pages and a speech bubble: asking your materials. `onAccent` is the
 *  version for a gold ground, where the gold bubble would vanish: the bubble
 *  takes the accent's own foreground and the pages a translucent white. */
export function ChatPages({ onAccent = false, ...p }: Props & { onAccent?: boolean }) {
  const page = onAccent ? 'rgba(255,255,255,0.18)' : 'var(--violet-subtle)';
  const pageStroke = onAccent ? 'var(--accent-foreground)' : 'var(--violet)';
  const bubble = onAccent ? 'var(--accent-foreground)' : 'var(--accent)';
  const dots = onAccent ? 'var(--accent)' : 'var(--accent-foreground)';
  return (
    <Svg {...p}>
      <rect x="14" y="26" width="34" height="44" rx="6" fill={page} stroke={pageStroke} strokeWidth="2.5" />
      <path d="M22 38h18M22 46h18M22 54h12" stroke={pageStroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M50 18h30a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H62l-8 8v-8h-4a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z" fill={bubble} />
      <circle cx="60" cy="33" r="2.5" fill={dots} />
      <circle cx="68" cy="33" r="2.5" fill={dots} />
      <circle cx="76" cy="33" r="2.5" fill={dots} />
    </Svg>
  );
}

/** A flame, lit (gold, with a mint core) or resting (faint). */
export function Flame({ lit = true, ...p }: Props & { lit?: boolean }) {
  return (
    <Svg {...p}>
      <path
        d="M48 14c4 12 16 18 16 34a16 16 0 0 1-32 0c0-8 4-12 6-16 2 6 6 8 6 8s0-16 4-26z"
        fill={lit ? 'var(--accent)' : 'var(--faint)'}
        className={lit ? 'kf-flame' : undefined}
      />
      <path d="M48 44c3 6 8 9 8 16a8 8 0 0 1-16 0c0-6 5-9 8-16z" fill={lit ? 'var(--mint)' : 'var(--muted)'} />
    </Svg>
  );
}

/** A cloud with an arrow rising into it: upload. */
export function UploadCloud(p: Props) {
  return (
    <Svg {...p}>
      <path d="M30 70a14 14 0 0 1-2-27.9A20 20 0 0 1 66 38a12 12 0 0 1 4 32H30z" fill="var(--sky-subtle)" stroke="var(--sky)" strokeWidth="2.5" />
      <path d="M48 76V50m0 0l-9 9m9-9l9 9" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A checklist with one tick lit: a quiz, a study kit. */
export function QuizCheck(p: Props) {
  return (
    <Svg {...p}>
      <rect x="20" y="16" width="56" height="64" rx="8" fill="var(--mint-subtle)" stroke="var(--mint)" strokeWidth="2.5" />
      <path d="M30 34l5 5 9-10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 34h16M50 50h16M50 66h16" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="36" cy="50" r="5" stroke="var(--mint)" strokeWidth="2.5" />
      <circle cx="36" cy="66" r="5" stroke="var(--mint)" strokeWidth="2.5" />
    </Svg>
  );
}

/** An empty shelf with a dotted card: nothing here yet, room for something. */
export function EmptyShelf(p: Props) {
  return (
    <Svg {...p}>
      <path d="M14 70h68" stroke="var(--faint)" strokeWidth="3" strokeLinecap="round" />
      <rect x="22" y="34" width="24" height="34" rx="5" fill="var(--coral-subtle)" stroke="var(--coral)" strokeWidth="2.5" />
      <rect x="52" y="34" width="24" height="34" rx="5" stroke="var(--faint)" strokeWidth="2.5" strokeDasharray="4 4" />
      <path d="M64 44v14m-7-7h14" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

/** A cup with a star: a finished thing, a good moment. */
export function Trophy(p: Props) {
  return (
    <Svg {...p}>
      <path d="M32 20h32v22a16 16 0 0 1-32 0V20z" fill="var(--accent)" />
      <path d="M32 26h-8a8 8 0 0 0 8 16M64 26h8a8 8 0 0 1-8 16" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M42 62h12v8H42zM36 74h24" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M48 26l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8 2.4-5z" fill="var(--accent-foreground)" />
      <circle cx="20" cy="18" r="3" fill="var(--mint)" />
      <circle cx="78" cy="14" r="2.5" fill="var(--coral)" />
      <circle cx="74" cy="60" r="2" fill="var(--violet)" />
    </Svg>
  );
}

/** A compass: settings, where things are set. */
export function Compass(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="48" cy="48" r="30" fill="var(--violet-subtle)" stroke="var(--violet)" strokeWidth="2.5" />
      <path d="M60 36L52 52l-16 8 8-16 16-8z" fill="var(--accent)" />
      <circle cx="48" cy="48" r="3" fill="var(--accent-foreground)" />
    </Svg>
  );
}
