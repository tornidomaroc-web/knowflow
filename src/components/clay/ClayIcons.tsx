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
        <radialGradient id="kf-c-red" cx="35%" cy="28%" r="85%"><stop offset="0" stopColor="#FFD9D2" /><stop offset="0.6" stopColor="#E0675A" /><stop offset="1" stopColor="#B23A2E" /></radialGradient>
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
 * the home (PR 1) and the subject header (PR 2).
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

/* ── Design "C", PR 2: the landing, the sign-in pages and Settings, drawn from
   the owner-approved artboards (Landing.dc.html, Login.dc.html,
   Prefs.dc.html, 2026-11-04): their shapes and stops, our components. The
   theme-following pieces read `line` (ink in light, cream in dark). ── */

/** Step 1, upload: a green cloud with an ink arrow up, on its soft shadow. */
export const ClayStepUpload = (p: P) => (
  <svg {...base(p, 56, 52, '0 0 56 52')}>
    <ellipse cx="28" cy="48" rx="18" ry="3" fill="#4C8F5C" fillOpacity="0.2" />
    <path d="M14 36a10 10 0 0 1 2-19.8A13 13 0 0 1 41 14a9 9 0 0 1 1 22z" fill={G('green')} />
    <path d="M28 40V22M21.5 28.5L28 22l6.5 6.5" fill="none" stroke="#1A1611" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Step 2, ask: a gold speech bubble with the question mark of the page's language. */
export const ClayStepAsk = ({ mark = '؟', ...p }: P & { mark?: string }) => (
  <svg {...base(p, 56, 52, '0 0 56 52')}>
    <ellipse cx="28" cy="48" rx="18" ry="3" fill="#B57A12" fillOpacity="0.2" />
    <path d="M10 8h30a7 7 0 0 1 7 7v15a7 7 0 0 1-7 7H24l-9 8v-8h-5a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7z" fill={G('gold')} />
    <ellipse cx="16" cy="13" rx="6" ry="2" fill="#FFFFFF" fillOpacity="0.55" />
    <text x="25" y="29" textAnchor="middle" fontFamily="inherit" fontSize="17" fontWeight="800" fill="#1A1611">{mark}</text>
  </svg>
);

/** Step 3, the answer: a cream page with a gold title line and a blue tick coin. */
export const ClayStepAnswer = (p: P) => (
  <svg {...base(p, 56, 52, '0 0 56 52')}>
    <ellipse cx="28" cy="48" rx="18" ry="3" fill="#5A83BE" fillOpacity="0.2" />
    <rect x="11" y="5" width="30" height="38" rx="8" fill={G('cream')} />
    <rect x="17" y="14" width="14" height="4" rx="2" fill={G('gold')} />
    <rect x="17" y="22" width="18" height="3.5" rx="1.75" fill="#BFB29D" />
    <rect x="17" y="29" width="12" height="3.5" rx="1.75" fill="#BFB29D" />
    <circle cx="41" cy="36" r="10" fill={G('blue')} />
    <path d="M36.5 36.2l3 3 5.8-6" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** "A summary to read on a break": a peach page with white lines. */
export const ClayFeatureSummary = (p: P) => (
  <svg {...base(p, 48, 46, '0 0 48 46')}>
    <rect x="8" y="4" width="30" height="36" rx="8" fill={G('peach')} />
    <rect x="14" y="13" width="18" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.85" />
    <rect x="14" y="21" width="14" height="3.5" rx="1.75" fill="#FFFFFF" fillOpacity="0.6" />
    <rect x="14" y="28" width="10" height="3.5" rx="1.75" fill="#FFFFFF" fillOpacity="0.6" />
    <ellipse cx="14" cy="8" rx="4" ry="1.4" fill="#FFFFFF" fillOpacity="0.55" />
  </svg>
);

/** "Quizzes that review you": a green checklist with a gold tick coin. */
export const ClayFeatureQuiz = (p: P) => (
  <svg {...base(p, 48, 46, '0 0 48 46')}>
    <rect x="7" y="4" width="32" height="36" rx="8" fill={G('green')} />
    <circle cx="16" cy="15" r="3.5" fill="#FFFFFF" />
    <rect x="22" y="13" width="12" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.85" />
    <circle cx="16" cy="27" r="3.5" fill="#FFFFFF" fillOpacity="0.6" />
    <rect x="22" y="25" width="12" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.6" />
    <circle cx="38" cy="36" r="8" fill={G('gold')} />
    <path d="M34.5 36l2.5 2.5 4.5-5" fill="none" stroke="#1A1611" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** "Answers with their source": a cream page and a blue bubble that talks. */
export const ClayFeatureAnswers = (p: P) => (
  <svg {...base(p, 48, 46, '0 0 48 46')}>
    <rect x="5" y="6" width="24" height="31" rx="7" fill={G('cream')} />
    <rect x="10" y="14" width="12" height="3.5" rx="1.75" fill={G('gold')} />
    <rect x="10" y="21" width="14" height="3" rx="1.5" fill="#BFB29D" />
    <path d="M26 18h14a6 6 0 0 1 6 6v7a6 6 0 0 1-6 6h-5l-5 4v-4h-4a6 6 0 0 1-6-6v-7a6 6 0 0 1 6-6z" fill={G('blue')} />
    <circle cx="29" cy="27.5" r="1.6" fill="#FFFFFF" />
    <circle cx="34" cy="27.5" r="1.6" fill="#FFFFFF" />
    <circle cx="39" cy="27.5" r="1.6" fill="#FFFFFF" />
  </svg>
);

/** "A streak that keeps you going": the lit flame with its gold core. */
export const ClayFeatureStreak = (p: P) => (
  <svg {...base(p, 48, 46, '-4 -2 48 46')}>
    <path d="M20 2c3 7 13 11 13 22a13 13 0 0 1-26 0c0-7 4-10 6-15 1.4 4 3.8 5.6 3.8 5.6S15 8 20 2z" fill={G('flame')} />
    <path d="M20 20c2 4 6 6 6 10.5a6 6 0 0 1-12 0c0-3.5 3.5-6 6-10.5z" fill={G('gold')} />
    <ellipse cx="14" cy="19" rx="2.2" ry="4.4" transform="rotate(-20 14 19)" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** The landing's last card: the brand's ring and page, drawn (the header and
 *  the sign-in pages show the real icon file instead). */
export const ClayBrandMark = (p: P) => (
  <svg {...base(p, 72, 72, '0 0 72 72')}>
    <circle cx="36" cy="36" r="27" fill="none" stroke={G('gold')} strokeWidth="9" />
    <rect x="24" y="20" width="24" height="31" rx="7" fill={G('cream')} />
    <rect x="29" y="27" width="11" height="3.5" rx="1.75" fill="#EBAE35" />
    <rect x="29" y="34" width="14" height="3" rx="1.5" fill="#BFB29D" />
    <rect x="29" y="40" width="9" height="3" rx="1.5" fill="#BFB29D" />
  </svg>
);

/** A source chip's file: a small clay page, peach or blue. */
export const ClayChipFile = ({ tone = 'peach', ...p }: P & { tone?: 'peach' | 'blue' }) => (
  <svg {...base(p, 14, 14, '0 0 14 14')}>
    <rect x="2" y="1" width="10" height="12" rx="2.5" fill={G(tone)} />
  </svg>
);

/** The site header's menu: two ink bars and a short gold one. */
export const ClayMenu = (p: P) => (
  <svg {...base(p, 22, 22, '0 0 26 26')}>
    <rect x="3" y="6" width="20" height="3.6" rx="1.8" fill={G('line')} />
    <rect x="3" y="11.2" width="20" height="3.6" rx="1.8" fill={G('line')} />
    <rect x="3" y="16.4" width="12" height="3.6" rx="1.8" fill={G('gold')} />
  </svg>
);

/** The site header's close: the menu's two bars crossed. */
export const ClayClose = (p: P) => (
  <svg {...base(p, 22, 22, '0 0 26 26')}>
    <rect x="3" y="11.2" width="20" height="3.6" rx="1.8" transform="rotate(45 13 13)" fill={G('line')} />
    <rect x="3" y="11.2" width="20" height="3.6" rx="1.8" transform="rotate(-45 13 13)" fill={G('gold')} />
  </svg>
);

/** Dark: a filled moon. `fill` defaults to the theme-following ink. */
export const ClayMoon = ({ fill, ...p }: P & { fill?: string }) => (
  <svg {...base(p, 22, 22, '0 0 24 24')}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill={fill ?? G('line')} />
  </svg>
);

/** Light: a cream sun, its rim and rays in the text colour around it. */
export const ClaySun = (p: P) => (
  <svg {...base(p, 22, 22, '0 0 24 24')}>
    <circle cx="12" cy="12" r="5" fill="#FFF4DC" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Settings' preferences: a violet tile with three sliders and two gold knobs. */
export const ClaySliders = (p: P) => (
  <svg {...base(p, 36, 36, '0 0 36 36')}>
    <rect x="3" y="3" width="30" height="30" rx="10" fill={G('violet')} />
    <rect x="9" y="11" width="18" height="3.5" rx="1.75" fill="#FFFFFF" />
    <rect x="9" y="17" width="18" height="3.5" rx="1.75" fill="#FFFFFF" fillOpacity="0.75" />
    <rect x="9" y="23" width="18" height="3.5" rx="1.75" fill="#FFFFFF" fillOpacity="0.55" />
    <circle cx="22" cy="12.75" r="3.2" fill={G('gold')} />
    <circle cx="13" cy="18.75" r="3.2" fill={G('gold')} />
  </svg>
);

/** A subject's summaries: a blue page with white lines (the subject header). */
export const ClaySummary = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <rect x="4" y="2.5" width="18" height="21" rx="4.5" fill={G('blue')} />
    <rect x="8" y="7.5" width="10" height="2.6" rx="1.3" fill="#FFFFFF" fillOpacity="0.85" />
    <rect x="8" y="12" width="8" height="2.2" rx="1.1" fill="#FFFFFF" fillOpacity="0.6" />
    <rect x="8" y="16.2" width="6" height="2.2" rx="1.1" fill="#FFFFFF" fillOpacity="0.6" />
    <ellipse cx="8.5" cy="4.6" rx="3" ry="1" fill="#FFFFFF" fillOpacity="0.55" />
  </svg>
);

/* ── Design "C", PR 3: Settings' other sections, the upload tile and the
   subjects' small stats. Same recipe as ClaySliders (a 36 pt tinted tile, a
   white or gold glyph on it, a catchlight) so every Settings section starts
   with one picture of one size. ── */

/** Account: a blue tile, a cream person with a gold collar. */
export const ClayAccount = (p: P) => (
  <svg {...base(p, 36, 36, '0 0 36 36')}>
    <rect x="3" y="3" width="30" height="30" rx="10" fill={G('blue')} />
    <circle cx="18" cy="14" r="5.2" fill={G('cream')} />
    <path d="M8.5 28.5c1.2-5.2 5-8 9.5-8s8.3 2.8 9.5 8z" fill={G('cream')} />
    <path d="M14.5 21.4l3.5 3 3.5-3" fill="none" stroke={G('gold')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="10" cy="7.2" rx="4" ry="1.3" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** The study reminder: a peach tile and a gold bell with an ink clapper. */
export const ClayBell = (p: P) => (
  <svg {...base(p, 36, 36, '0 0 36 36')}>
    <rect x="3" y="3" width="30" height="30" rx="10" fill={G('peach')} />
    <path d="M18 8.5a7 7 0 0 1 7 7v4.6l2.2 3.4H8.8l2.2-3.4v-4.6a7 7 0 0 1 7-7z" fill={G('gold')} />
    <circle cx="18" cy="26.6" r="2.4" fill="#1A1611" />
    <ellipse cx="14.6" cy="12.4" rx="2.2" ry="1" transform="rotate(-35 14.6 12.4)" fill="#FFFFFF" fillOpacity="0.6" />
    <ellipse cx="10" cy="7.2" rx="4" ry="1.3" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** The AI permission: a blue tile with a gold four-point spark and a small one. */
export const ClaySpark = (p: P) => (
  <svg {...base(p, 36, 36, '0 0 36 36')}>
    <rect x="3" y="3" width="30" height="30" rx="10" fill={G('violet')} />
    <path d="M16 8.5l2.4 6.1 6.1 2.4-6.1 2.4L16 25.5l-2.4-6.1L7.5 17l6.1-2.4z" fill={G('gold')} />
    <path d="M25 21l1.1 2.4 2.4 1.1-2.4 1.1L25 28l-1.1-2.4-2.4-1.1 2.4-1.1z" fill="#FFFFFF" fillOpacity="0.85" />
    <ellipse cx="10" cy="7.2" rx="4" ry="1.3" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** The plan (web, or a Pro student): a gold tile with a cream star. */
export const ClayStar = (p: P) => (
  <svg {...base(p, 36, 36, '0 0 36 36')}>
    <rect x="3" y="3" width="30" height="30" rx="10" fill={G('gold')} />
    <path d="M18 8.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill={G('cream')} />
    <ellipse cx="10" cy="7.2" rx="4" ry="1.3" fill="#FFFFFF" fillOpacity="0.55" />
  </svg>
);

/** Help and legal: a green tile, a cream coin with the page's question mark. */
export const ClayHelp = ({ mark = '؟', ...p }: P & { mark?: string }) => (
  <svg {...base(p, 36, 36, '0 0 36 36')}>
    <rect x="3" y="3" width="30" height="30" rx="10" fill={G('green')} />
    <circle cx="18" cy="18" r="9.5" fill={G('cream')} />
    <text x="18" y="23.2" textAnchor="middle" fontFamily="inherit" fontSize="15" fontWeight="800" fill="#1A1611">{mark}</text>
    <ellipse cx="10" cy="7.2" rx="4" ry="1.3" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** Deleting the account: a red tile, a cream bin with its lid lifted. */
export const ClayBin = (p: P) => (
  <svg {...base(p, 36, 36, '0 0 36 36')}>
    <rect x="3" y="3" width="30" height="30" rx="10" fill={G('red')} />
    <rect x="10" y="10.4" width="16" height="3.2" rx="1.6" transform="rotate(-8 18 12)" fill={G('cream')} />
    <rect x="15.6" y="7.6" width="4.8" height="2.6" rx="1.3" transform="rotate(-8 18 12)" fill={G('cream')} />
    <path d="M11.6 15.6h12.8l-1.1 10.2a2.4 2.4 0 0 1-2.4 2.2h-5.8a2.4 2.4 0 0 1-2.4-2.2z" fill={G('cream')} />
    <path d="M16 18.6v6M20 18.6v6" stroke="#B23A2E" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
    <ellipse cx="10" cy="7.2" rx="4" ry="1.3" fill="#FFFFFF" fillOpacity="0.5" />
  </svg>
);

/** A Help and legal row's privacy policy: a blue shield with a gold tick. */
export const ClayShield = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <path d="M13 2.5l8.5 3.2v6.4c0 5.4-3.6 9.6-8.5 11.4-4.9-1.8-8.5-6-8.5-11.4V5.7z" fill={G('blue')} />
    <path d="M9 12.8l2.8 2.8 5.2-5.4" fill="none" stroke={G('gold')} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="9" cy="6.4" rx="3" ry="1" fill="#FFFFFF" fillOpacity="0.55" />
  </svg>
);

/** A Help and legal row's support address: a cream envelope with a gold flap. */
export const ClayMail = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <rect x="2.5" y="5.5" width="21" height="15" rx="4" fill={G('cream')} />
    <path d="M3.6 7.4L13 14l9.4-6.6" fill="none" stroke={G('gold')} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.5 9.5v7a4 4 0 0 0 4 4h13a4 4 0 0 0 4-4v-7" fill="#7E7262" fillOpacity="0.12" />
  </svg>
);

/**
 * The upload tile's picture (upload-sheet.dc.html, its "a file from your
 * device" choice): a cream page with a gold title line and text lines, and
 * a gold coin with an ink arrow up, on its soft shadow.
 */
export const ClayUploadFile = (p: P) => (
  <svg {...base(p, 48, 48, '0 0 48 48')}>
    <ellipse cx="24" cy="45" rx="14" ry="2.5" fill="#B57A12" fillOpacity="0.22" />
    <path d="M12 4h17l9 9v26a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V9a5 5 0 0 1 5-5z" fill={G('cream')} />
    <path d="M29 4v7a2 2 0 0 0 2 2h7z" fill="#D9CDB8" />
    <rect x="13" y="19" width="14" height="4" rx="2" fill={G('gold')} />
    <rect x="13" y="26" width="18" height="3.5" rx="1.75" fill="#BFB29D" />
    <rect x="13" y="32" width="12" height="3.5" rx="1.75" fill="#BFB29D" />
    <circle cx="36" cy="35" r="9" fill={G('gold')} />
    <path d="M36 39.5v-8M32.5 34.5l3.5-3.5 3.5 3.5" fill="none" stroke="#1A1611" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * A material's type tile: a page in its type's tone (peach a PDF, blue a
 * Word file, violet slides, green a sheet, gold the rest), its corner folded,
 * two white lines, a catchlight. The caller sets the size.
 */
export const ClayDoc = ({ tone = 'gold', ...p }: P & { tone?: 'peach' | 'blue' | 'violet' | 'green' | 'gold' }) => (
  <svg {...base(p, 22, 22, '0 0 22 22')}>
    <path d="M5.5 1.5h7l5 5v12a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z" fill={G(tone)} />
    <path d="M12.5 1.5v4a1 1 0 0 0 1 1h4z" fill="#FFFFFF" fillOpacity="0.55" />
    <rect x="6.5" y="10" width="8" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.85" />
    <rect x="6.5" y="14" width="6" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.6" />
    <ellipse cx="7" cy="3.6" rx="2.2" ry="0.8" fill="#FFFFFF" fillOpacity="0.55" />
  </svg>
);

/** A to-do mark of the study kit: a small pressed-in ring (the done one is ClayCheck). */
export const ClayTodo = (p: P) => (
  <svg {...base(p, 14, 14, '0 0 22 22')}>
    <circle cx="11" cy="11" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
  </svg>
);

/** A subject's empty card: a pressed-in slot with the gold plus coin (add a file). */
export const ClayAddFile = (p: P) => (
  <svg {...base(p, 26, 26, '0 0 26 26')}>
    <rect x="4" y="2.5" width="15" height="19" rx="4" fill={G('cream')} />
    <rect x="7.5" y="7" width="7" height="2.4" rx="1.2" fill={G('gold')} />
    <rect x="7.5" y="11.4" width="8" height="2.1" rx="1.05" fill="#BFB29D" />
    <circle cx="18.5" cy="18.5" r="5.5" fill={G('gold')} />
    <path d="M18.5 16v5M16 18.5h5" stroke="#1A1611" strokeWidth="2" strokeLinecap="round" />
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
