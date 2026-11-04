/**
 * DESIGN "C": THE CONTRAST TABLE OF EVERY TEXT / GROUND TOKEN PAIR, MEASURED.
 *
 * Reads the two palettes out of src/app/globals.css (`:root`, which is the
 * light default and must equal [data-theme="light"], and [data-theme="dark"]),
 * composites the translucent fills over the ground they sit on, and measures
 * WCAG 2.x contrast for every pair the app uses. Nothing is typed twice: a
 * token changed in the stylesheet changes the table.
 *
 * The bar per pair: 4.5:1 for text (WCAG 1.4.3 AA, body size), 3:1 for an
 * icon, a control's edge or the focus ring (1.4.11). Any used pair under its
 * bar fails the run. The FULL matrix (every text token on every ground, used
 * or not) is printed too, so a pair nobody uses yet is visible before someone
 * does.
 *
 * Usage: node scripts/design-c/contrast.mjs [--md OUT.md]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(resolve(ROOT, 'src/app/globals.css'), 'utf8').split('\r\n').join('\n');
const block = (sel) => css.match(new RegExp(sel.replace(/[[\]"]/g, (c) => '\\' + c) + '\\s*\\{[\\s\\S]*?\\n\\}'))?.[0] ?? '';
const tokens = (b) => Object.fromEntries([...b.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, k, v]) => [k, v.trim()]));

const parse = (v) => {
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) { const p = m[1].split(/[\s,/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; }
  return null;
};
const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };
const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

const THEMES = { light: tokens(block(':root')), dark: tokens(block('[data-theme="dark"]')) };
const lightBlock = tokens(block('[data-theme="light"]'));
const failures = [];
for (const [k, v] of Object.entries(THEMES.light)) if (k !== '--radius' && lightBlock[k] !== v) failures.push(`:root ${k} ${v} differs from [data-theme="light"] (${lightBlock[k]})`);

// Grounds: [name, token, the ground a translucent token sits on].
const GROUNDS = [
  ['page', '--background'], ['card', '--surface'], ['raised tile', '--raised'], ['muted fill', '--muted'], ['field', '--input'],
  ['ask card', '--clay-ask'], ['streak card', '--clay-streak'], ['gold fill', '--accent'], ['danger fill', '--danger'],
  ['gold tint on card', '--accent-subtle', '--surface'], ['gold tint on page', '--accent-subtle', '--background'], ['gold tint on a well', '--primary-subtle', '--clay-well'],
  ['danger tint', '--danger-subtle'], ['well', '--clay-well'],
  ...['mint', 'sky', 'coral', 'violet'].flatMap((t) => [[t + ' tint on page', '--' + t + '-subtle', '--background'], [t + ' tint on card', '--' + t + '-subtle', '--surface']]),
];
// Foregrounds: [name, token, bar].
const TEXT = [
  ['ink', '--foreground'], ['muted text', '--muted-foreground'], ['faint text', '--faint'], ['gold text', '--accent-text'], ['gold text (primary)', '--primary-text'],
  ['success', '--success'], ['danger', '--danger'], ['warning', '--warning'],
  ['ink on gold', '--accent-foreground'], ['ink on gold (primary)', '--primary-foreground'], ['on danger fill', '--danger-foreground'],
  ['ask card text', '--clay-ask-fg'], ['ask card line', '--clay-ask-muted'], ['streak card line', '--clay-streak-muted'],
];
const NONTEXT = [['gold edge', '--accent-edge'], ['control edge', '--control-border'], ['focus ring', '--ring'], ['mint icon', '--mint'], ['sky icon', '--sky'], ['coral icon', '--coral'], ['violet icon', '--violet'], ['chevron', '--chevron']];

// The pairs the app uses, each with its bar.
const ORDINARY = ['--background', '--surface', '--raised', '--muted', '--input'];
const USED = [];
for (const t of ['--foreground', '--muted-foreground', '--faint', '--accent-text', '--primary-text', '--success', '--danger', '--warning']) for (const g of ORDINARY) USED.push([t, g, null, 4.5]);
for (const t of ['--accent-text', '--foreground']) { USED.push([t, '--accent-subtle', '--surface', 4.5]); USED.push([t, '--accent-subtle', '--background', 4.5]); }
USED.push(['--primary-text', '--primary-subtle', '--clay-well', 4.5]);
USED.push(['--danger', '--danger-subtle', null, 4.5]);
for (const t of ['--accent-foreground', '--primary-foreground']) USED.push([t, '--accent', null, 4.5]);
USED.push(['--danger-foreground', '--danger', null, 4.5]);
for (const t of ['--clay-ask-fg', '--clay-ask-muted']) USED.push([t, '--clay-ask', null, 4.5]);
for (const t of ['--foreground', '--clay-streak-muted']) USED.push([t, '--clay-streak', null, 4.5]);
for (const t of ['--accent-edge', '--control-border', '--ring']) for (const g of ORDINARY) USED.push([t, g, null, 3]);
for (const t of ['--mint', '--sky', '--coral', '--violet', '--chevron']) for (const g of ['--surface', '--raised']) USED.push([t, g, null, 3]);
USED.push(['--muted-foreground', '--clay-well', null, 3]); // the switch's off bead on its well
// The supporting tints carry TEXT too (the landing's numbered steps, step badges): each on its own tint, over the page and a card.
for (const t of ['mint', 'sky', 'coral', 'violet']) for (const g of ['--background', '--surface']) USED.push(['--' + t, '--' + t + '-subtle', g, 4.5]);

const resolveGround = (T, tok, base) => {
  const c = parse(T[tok]);
  if (!c) return null;
  if (c.a >= 1) return c;
  const under = parse(T[base || '--background']);
  return over(c, under);
};
const measure = (T, fg, g, base) => {
  const ground = resolveGround(T, g, base);
  const f = parse(T[fg]);
  if (!ground || !f) return null;
  return { r: ratio(over(f, ground), ground), fg: hex(f), bg: hex(ground) };
};

const lines = [];
lines.push('# Design "C": contrast of every text and ground token pair', '');
lines.push('Generated by `node scripts/design-c/contrast.mjs` from `src/app/globals.css`; do not edit by hand.', '');
lines.push('Bars: 4.5:1 for text (WCAG 1.4.3 AA), 3:1 for an icon, a control edge or the focus ring (1.4.11). Translucent tokens are composited over the ground named in brackets.', '');
lines.push('## The pairs the app uses', '');
lines.push('| Foreground | Ground | Light | Dark | Bar |', '|---|---|---|---|---|');
const nameOf = (tok) => [...TEXT, ...NONTEXT].find(([, t]) => t === tok)?.[0] || tok;
const gName = (tok, base) => (GROUNDS.find(([, t, b]) => t === tok && (b || null) === (base || null))?.[0] || tok) + (base ? '' : '');
for (const [fg, g, base, bar] of USED) {
  const cells = ['light', 'dark'].map((th) => {
    const m = measure(THEMES[th], fg, g, base);
    if (!m) { failures.push(`${th}: ${fg} on ${g} could not be measured`); return 'n/a'; }
    const ok = m.r >= bar;
    if (!ok) failures.push(`${th}: ${nameOf(fg)} ${fg} ${m.fg} on ${gName(g, base)} ${m.bg} is ${m.r.toFixed(2)}:1, under ${bar}:1`);
    return `${m.r.toFixed(2)} ${ok ? '' : '**FAIL** '}(${m.fg} on ${m.bg})`;
  });
  lines.push(`| ${nameOf(fg)} \`${fg}\` | ${gName(g, base)} \`${g}\`${base ? ` over \`${base}\`` : ''} | ${cells[0]} | ${cells[1]} | ${bar}:1 |`);
}
lines.push('', '## The full matrix (every text token on every ground, used or not)', '');
for (const th of ['light', 'dark']) {
  lines.push(`### ${th}`, '', '| | ' + GROUNDS.map(([n]) => n).join(' | ') + ' |', '|---|' + GROUNDS.map(() => '---').join('|') + '|');
  for (const [n, t] of [...TEXT, ...NONTEXT]) {
    lines.push(`| ${n} \`${t}\` | ` + GROUNDS.map(([, g, b]) => { const m = measure(THEMES[th], t, g, b); return m ? m.r.toFixed(2) : 'n/a'; }).join(' | ') + ' |');
  }
  lines.push('');
}
lines.push(failures.length ? `**${failures.length} failure(s).**` : '**0 failures.**', '');

const args = process.argv.slice(2);
const md = args.includes('--md') ? resolve(args[args.indexOf('--md') + 1]) : null;
if (md) { mkdirSync(dirname(md), { recursive: true }); writeFileSync(md, lines.join('\n')); }
for (const f of failures) console.log(`FAIL ${f}`);
console.log(`${USED.length} used pairs x 2 themes measured, ${failures.length} failure(s)${md ? `; table written to ${md}` : ''}`);
process.exit(failures.length ? 1 : 0);
