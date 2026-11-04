/**
 * THE CLAY ICONS OF DESIGN "C" (owner-approved 2026-11-03).
 *
 * Small filled glyphs with a soft radial gradient and a catchlight, drawn
 * from the approved mockups (home-light/home-dark .dc.html): the shapes and
 * gradient stops are theirs, the components are ours. Decorative: every one
 * is `aria-hidden`, and the control around it carries the name.
 *
 * ONE SHARED <defs>. The gradients live once per page in <ClayDefs/>, which
 * DashboardShell renders, and every icon points at them by id (`kf-c-*`), so
 * a screen with forty icons does not ship forty copies of eight gradients and
 * no two instances can collide on an id. The two stops that differ by theme
 * (the idle taupe and the ink-or-cream `line`) read CSS variables
 * (globals.css), so the same markup is right in light and dark. (`line` drew
 * the greeting's menu glyph, which the clay avatar replaced; it is kept for
 * the next glyph that needs a theme-following ink.)
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const G = (id: string) => `url(#kf-c-${id})`;

export function ClayDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <radialGradient id="kf-c-gold" cx="35%" cy="28%" r="80%"><stop offset="0" stopColor="#FFE7A6" /><stop offset="0.55" stopColor="#EBAE35" /><stop offset="1" stopColor="#B57A12" /></radialGradient>
        <radialGradient id="kf-c-cream" cx="35%" cy="25%" r="85%"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.7" stopColor="#F3EBDD" /><stop offset="1" stopColor="#D9CDB8" /></radialGradient>
        <radialGradient id="kf-c-flame" cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#FFC98A" /><stop offset="0.6" stopColor="#F0782E" /><stop offset="1" stopColor="#C24E18" /></radialGradient>
        <radialGradient id="kf-c-green" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#D3F0CC" /><stop offset="0.6" stopColor="#7DBE85" /><stop offset="1" stopColor="#4C8F5C" /></radialGradient>
        <radialGradient id="kf-c-blue" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#E6F0FF" /><stop offset="0.6" stopColor="#8DB4E8" /><stop offset="1" stopColor="#5A83BE" /></radialGradient>
        <radialGradient id="kf-c-peach" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#FFE6D8" /><stop offset="0.6" stopColor="#F2A585" /><stop offset="1" stopColor="#D37552" /></radialGradient>
        <radialGradient id="kf-c-violet" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#EDE4FF" /><stop offset="0.6" stopColor="#A893E0" /><stop offset="1" stopColor="#6F58B4" /></radialGradient>
        <radialGradient id="kf-c-ink"cx="35%" cy="25%" r="85%"><stop offset="0" stopColor="#5A4E42" /><stop offset="1" stopColor="#1A1611" /></radialGradient>
        <radialGradient id="kf-c-taupe" cx="35%" cy="25%" r="85%"><stop offset="0" style={{ stopColor: 'var(--g-taupe-0)' }} /><stop offset="1" style={{ stopColor: 'var(--g-taupe-1)' }} /></radialGradient>
        <radialGradient id="kf-c-line" cx="35%" cy="25%" r="85%"><stop offset="0" style={{ stopColor: 'var(--g-line-0)' }} /><stop offset="1" style={{ stopColor: 'var(--g-line-1)' }} /></radialGradient>
      </defs>
    </svg>
  );
}

const base = (p: P, w: number, h: number, vb: string) => ({ width: w, height: h, viewBox: vb, 'aria-hidden': true as const, focusable: 'false' as const, ...p });

/* ── The home's small icons (the owner's review of PR #299, 2026-11-04: the
   stats, "what KnowFlow does", Continue, recent activity and the path were
   still outline glyphs). Same recipe as the rest: a filled shape on a
   gradient, a catchlight, ink or gold details. 26 x 26 unless sized. ── */

/**
 * A file: a cream page with a darker green tab down its spine and a green
 * folded corner, a soft drop under it, a gold title line and two text lines.
 * The tab and the drop are what separate it from a pale mint tile in light
 * (the owner's review, 2026-11-04: the all-cream page read faint there).
 */
export const ClayFile = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <path d="M7.6 3.6h8.5L21.6 9v13.5a2 2 0 0 1-2 2H7.6a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2z" fill="#4C8F5C" fillOpacity="0.28" />
    <path d="M7 2.5h8.5L21 8v13.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2z" fill={G('cream')} />
    <path d="M7 2.5h2.6v21H7a2 2 0 0 1-2-2v-17a2 2 0 0 1 2-2z" fill={G('green')} />
    <path d="M15.5 2.5V7a1 1 0 0 0 1 1H21z" fill={G('green')} />
    <rect x="11" y="11" width="7" height="2.6" rx="1.3" fill={G('gold')} />
    <rect x="11" y="15.2" width="8" height="2.2" rx="1.1" fill="#9A8D79" />
    <rect x="11" y="19" width="5.5" height="2.2" rx="1.1" fill="#9A8D79" />
  </svg>
);

/**
 * The three-step card's picture: an open clay book (two blue pages on a
 * gold spine) with a gold spark above it. Replaces the outline SparkBook on
 * the home only; the landing, sign-up and subject header keep theirs.
 */
export const ClaySparkBook = (p: P) => (
  <svg {...base(p, 64, 64, '0 0 64 64')}>
    <ellipse cx="31" cy="56" rx="21" ry="3" fill="#5A83BE" fillOpacity="0.22" />
    <path d="M8 22c8-3 16-2 23 2v28c-7-4-15-5-23-2z" fill={G('blue')} />
    <path d="M54 22c-8-3-16-2-23 2v28c7-4 15-5 23-2z" fill={G('blue')} />
    <path d="M31 24v28" stroke={G('gold')} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M13 30c4-1 8-.6 12 1M13 36c4-1 8-.6 12 1M37 31c4-1.6 8-2 12-1M37 37c4-1.6 8-2 12-1" fill="none" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M47 4l2.3 5.6L55 12l-5.7 2.3L47 20l-2.3-5.7L39 12l5.7-2.4z" fill={G('gold')} />
    <circle cx="16" cy="11" r="3" fill={G('peach')} />
    <ellipse cx="12.5" cy="24.5" rx="3.4" ry="1.1" transform="rotate(-12 12.5 24.5)" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/**
 * The empty subjects picture: a clay shelf, one peach book on it, and a
 * pressed-in slot for the next one with the gold plus coin. No outlines.
 * `title` names it when it stands alone (the empty state), as EmptyShelf did.
 */
export const ClayEmptyShelf = ({ title, ...p }: P & { title?: string }) => (
  <svg {...base(p, 88, 88, '0 0 96 96')} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
    {title ? <title>{title}</title> : null}
    <ellipse cx="48" cy="80" rx="36" ry="4" fill="#7E7262" fillOpacity="0.18" />
    <rect x="10" y="68" width="76" height="9" rx="4.5" fill={G('taupe')} />
    <rect x="22" y="30" width="24" height="38" rx="6" fill={G('peach')} />
    <rect x="40" y="33" width="4" height="32" rx="2" fill={G('cream')} />
    <rect x="26" y="38" width="10" height="3.6" rx="1.8" fill="#FFFFFF" fillOpacity="0.75" />
    <ellipse cx="28" cy="33.5" rx="4" ry="1.3" fill="#FFFFFF" fillOpacity="0.6" />
    <rect x="52" y="30" width="24" height="38" rx="6" fill="#7E7262" fillOpacity="0.16" />
    <rect x="54" y="32" width="20" height="5" rx="2.5" fill="#7E7262" fillOpacity="0.14" />
    <circle cx="64" cy="49" r="10" fill={G('gold')} />
    <path d="M64 44v10M59 49h10" stroke="#1A1611" strokeWidth="2.6" strokeLinecap="round" />
    <ellipse cx="60.5" cy="44" rx="3.2" ry="1.3" fill="#FFFFFF" fillOpacity="0.6" />
  </svg>
);

/** A conversation: a violet bubble, three cream dots, a catchlight. */
export const ClayChat = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <path d="M5 4h16a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill={G('violet')} />
    <circle cx="8.5" cy="11.5" r="1.7" fill="#FFFFFF" fillOpacity="0.9" />
    <circle cx="13" cy="11.5" r="1.7" fill="#FFFFFF" fillOpacity="0.9" />
    <circle cx="17.5" cy="11.5" r="1.7" fill="#FFFFFF" fillOpacity="0.9" />
    <ellipse cx="8" cy="6.4" rx="3.2" ry="1.1" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** Summaries and quizzes: a peach card with a gold tick coin. */
export const ClayQuiz = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <rect x="3" y="3" width="16" height="19" rx="4" fill={G('peach')} />
    <rect x="6" y="7.5" width="9" height="2.4" rx="1.2" fill="#FFFFFF" fillOpacity="0.8" />
    <rect x="6" y="12" width="6.5" height="2.2" rx="1.1" fill="#FFFFFF" fillOpacity="0.55" />
    <ellipse cx="7.5" cy="4.9" rx="3" ry="1" fill="#FFFFFF" fillOpacity="0.55" />
    <circle cx="18" cy="18" r="6" fill={G('gold')} />
    <path d="M15.4 18.1l1.8 1.8 3.4-3.6" fill="none" stroke="#1A1611" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** An answer from your files: a blue bubble with the question mark. */
export const ClayAnswer = ({ mark = '؟', ...p }: P & { mark?: string }) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <path d="M6 3.5h14a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-6.5l-5 4v-4H6a4 4 0 0 1-4-4v-7a4 4 0 0 1 4-4z" fill={G('blue')} />
    <ellipse cx="8" cy="6" rx="3.2" ry="1.1" fill="#FFFFFF" fillOpacity="0.55" />
    <text x="13" y="15.6" textAnchor="middle" fontFamily="inherit" fontSize="11" fontWeight="800" fill="#1A1611">{mark}</text>
  </svg>
);

/** Recent: a cream clock face, ink hands, a gold centre. */
export const ClayClock = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <circle cx="13" cy="13" r="10.5" fill={G('peach')} />
    <circle cx="13" cy="13" r="7.6" fill={G('cream')} />
    <path d="M13 8.6V13l3 2" fill="none" stroke="#1A1611" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="13" cy="13" r="1.4" fill={G('gold')} />
    <ellipse cx="9" cy="6.2" rx="3" ry="1" transform="rotate(-25 9 6.2)" fill="#FFFFFF" fillOpacity="0.6" />
  </svg>
);

/** A done step: the gold coin with an ink tick (the path). */
export const ClayCheck = (p: P) => (
  <svg {...base(p, 22, 22, '0 0 22 22')}>
    <circle cx="11" cy="11" r="10" fill={G('gold')} />
    <path d="M6.6 11.3l3 3 5.8-6" fill="none" stroke="#1A1611" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="7.6" cy="5.6" rx="3" ry="1.2" fill="#FFFFFF" fillOpacity="0.55" />
  </svg>
);

/** The ask card's picture: a gold ring, a page, a gold speech bubble with a question mark. */
export const ClayAskArt = ({ mark = '؟', ...p }: P & { mark?: string }) => (
  <svg {...base(p, 104, 104, '0 0 104 104')}>
    <circle cx="50" cy="50" r="38" fill="none" stroke={G('gold')} strokeWidth="11" />
    <path d="M22 30 A38 38 0 0 1 40 14" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
    <rect x="33" y="27" width="32" height="42" rx="9" fill={G('cream')} />
    <rect x="40" y="37" width="15" height="4.5" rx="2.25" fill={G('gold')} />
    <rect x="40" y="45" width="18" height="4" rx="2" fill="#BFB29D" />
    <rect x="40" y="52" width="18" height="4" rx="2" fill="#BFB29D" />
    <rect x="40" y="59" width="11" height="4" rx="2" fill="#BFB29D" />
    <path d="M60 58h26a8 8 0 0 1 8 8v10a8 8 0 0 1-8 8h-12l-8 7v-7h-6a8 8 0 0 1-8-8V66a8 8 0 0 1 8-8z" fill={G('gold')} />
    <ellipse cx="66" cy="62" rx="6" ry="2.2" fill="#FFFFFF" fillOpacity="0.55" />
    <text x="73" y="80" textAnchor="middle" fontFamily="inherit" fontSize="19" fontWeight="800" fill="#1A1611">{mark}</text>
  </svg>
);

/** The streak flame: lit (flame and gold core), or unlit (taupe, no breath). */
export const ClayFlame = ({ lit, className, ...p }: P & { lit: boolean }) => (
  <svg {...base(p, 56, 52, '-6 -2 56 52')} className={[className, lit ? 'kf-flame' : ''].filter(Boolean).join(' ') || undefined}>
    <ellipse cx="22" cy="44" rx="13" ry="3" fill="#000000" fillOpacity="0.18" />
    <path d="M22 3c3 8 15 12 15 25a15 15 0 0 1-30 0c0-8 5-12 7-17 1.6 4.5 4.4 6.5 4.4 6.5S16 10 22 3z" fill={G(lit ? 'flame' : 'taupe')} />
    <path d="M22 23c2 5 7 7 7 12a7 7 0 0 1-14 0c0-4 4-7 7-12z" fill={G(lit ? 'gold' : 'cream')} />
    <ellipse cx="15.5" cy="22" rx="2.6" ry="5" transform="rotate(-20 15.5 22)" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** "New subject": a green book with a gold plus. */
export const ClayNewSubject = (p: P) => (
  <svg {...base(p, 56, 52, '0 0 56 52')}>
    <ellipse cx="26" cy="48" rx="18" ry="3" fill="#4C8F5C" fillOpacity="0.2" />
    <rect x="9" y="6" width="30" height="36" rx="7" fill={G('green')} />
    <rect x="31" y="9" width="5" height="30" rx="2.5" fill={G('cream')} />
    <rect x="15" y="14" width="12" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.7" />
    <ellipse cx="16" cy="10.5" rx="5" ry="1.8" fill="#FFFFFF" fillOpacity="0.5" />
    <circle cx="42" cy="36" r="11" fill={G('gold')} />
    <path d="M42 31v10M37 36h10" stroke="#1A1611" strokeWidth="2.6" strokeLinecap="round" />
    <ellipse cx="38.5" cy="31" rx="3.2" ry="1.4" fill="#FFFFFF" fillOpacity="0.6" />
  </svg>
);

/** Inside the questions ring: a gold bubble with a question mark. */
export const ClayQuestionGlyph = ({ mark = '؟', ...p }: P & { mark?: string }) => (
  <svg {...base(p, 30, 30, '17 17 30 30')}>
    <path d="M24 23h16a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-7l-5 4v-4h-4a5 5 0 0 1-5-5v-6a5 5 0 0 1 5-5z" fill={G('gold')} />
    <text x="32" y="36.5" textAnchor="middle" fontFamily="inherit" fontSize="12" fontWeight="800" fill="#1A1611">{mark}</text>
  </svg>
);

/** Inside the uploads ring: a green cloud with an arrow up. */
export const ClayUploadGlyph = (p: P) => (
  <svg {...base(p, 30, 30, '17 17 30 30')}>
    <path d="M25 27a7 7 0 0 1 13-3 5.5 5.5 0 0 1 2 10.5H25.5A4.5 4.5 0 0 1 25 27z" fill={G('green')} />
    <path d="M32 40v-9M28.5 34l3.5-3.5 3.5 3.5" fill="none" stroke="#1A1611" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Inside the subjects ring: a small stack of books. */
export const ClayBooksGlyph = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <rect x="3" y="17" width="20" height="6" rx="2.5" fill={G('blue')} />
    <rect x="5" y="10" width="17" height="6" rx="2.5" fill={G('gold')} />
    <rect x="4" y="3" width="18" height="6" rx="2.5" fill={G('peach')} />
  </svg>
);

/** The gold plus coin (the header's "new subject" pill). */
export const ClayPlus = (p: P) => (
  <svg {...base(p, 22, 22, '0 0 22 22')}>
    <circle cx="11" cy="11" r="10" fill={G('gold')} />
    <path d="M11 6.5v9M6.5 11h9" stroke="#1A1611" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const BOOK_TONES = ['peach', 'green', 'blue'] as const;
/** A subject's book: the default subject icon, tinted by its index. */
export const ClayBook = ({ index = 0, ...p }: P & { index?: number }) => {
  const tone = BOOK_TONES[index % BOOK_TONES.length];
  return (
    <svg {...base(p, 34, 34, '0 0 34 34')}>
      <rect x="6" y="4" width="22" height="26" rx="5" fill={G(tone)} />
      <rect x="22" y="6.5" width="4" height="21" rx="2" fill={G('cream')} />
      <rect x="10" y="10" width="9" height="3.2" rx="1.6" fill="#FFFFFF" fillOpacity="0.75" />
      <rect x="10" y="15.5" width="7" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.5" />
      <circle cx="13" cy="24" r="3" fill={G('gold')} />
      <ellipse cx="11" cy="7" rx="3.5" ry="1.2" fill="#FFFFFF" fillOpacity="0.6" />
    </svg>
  );
};

/** A forward chevron; mirrored under RTL by the caller's `rtl:` class. */
export const ClayChevron = (p: P) => (
  <svg {...base(p, 18, 18, '0 0 24 24')} fill="none" stroke="var(--chevron)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** A forward arrow (the ask pill); mirrored under RTL by the caller. */
export const ClayArrow = (p: P) => (
  <svg {...base(p, 18, 18, '0 0 24 24')} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

/* ── The four tabs (spec: filled clay icons; the active one sits on gold). ── */
type T = P & { active?: boolean };
export const TabHome = ({ active, ...p }: T) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <path d="M3 12.5L13 4l10 8.5V22a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={G(active ? 'ink' : 'taupe')} />
    <rect x="10" y="15" width="6" height="9" rx="2" fill={active ? G('cream') : 'var(--surface)'} />
    <ellipse cx="9" cy="10" rx="3" ry="1.1" transform="rotate(-38 9 10)" fill="#FFFFFF" fillOpacity="0.35" />
  </svg>
);
export const TabBooks = ({ active, ...p }: T) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <rect x="3" y="17" width="20" height="6" rx="2.5" fill={G(active ? 'ink' : 'taupe')} />
    <rect x="5" y="10" width="17" height="6" rx="2.5" fill={G(active ? 'cream' : 'gold')} />
    <rect x="4" y="3" width="18" height="6" rx="2.5" fill={G(active ? 'ink' : 'taupe')} />
  </svg>
);
export const TabChat = ({ active, ...p }: T) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <path d="M5 4h16a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9l-5 4v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill={G(active ? 'ink' : 'taupe')} />
    <circle cx="8.5" cy="11.5" r="1.7" fill={active ? '#EBAE35' : 'var(--surface)'} />
    <circle cx="13" cy="11.5" r="1.7" fill={active ? '#EBAE35' : 'var(--surface)'} />
    <circle cx="17.5" cy="11.5" r="1.7" fill={active ? '#EBAE35' : 'var(--surface)'} />
  </svg>
);
export const TabGear = ({ active, ...p }: T) => (
  <svg {...base(p, 26, 26, '0 0 24 24')}>
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill={G(active ? 'ink' : 'taupe')} />
    <circle cx="12" cy="12" r="3.3" fill={active ? '#EBAE35' : 'var(--surface)'} />
  </svg>
);
