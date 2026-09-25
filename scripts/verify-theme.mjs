/**
 * Executable proof for the theme (register #46's toggle, and three items #101
 * held: `color-scheme`, the white 404 and the letter-spacing on Arabic text).
 *
 * 1. THE BOOT SCRIPT, RUN. `THEME_BOOT_SCRIPT` from `src/lib/theme.ts` is the
 *    exact string `[locale]/layout.tsx` inlines in <head>. It is executed here
 *    against a fake `document` and `location`: no cookie gives dark; a
 *    `kf-theme=light` cookie gives light; `?theme=light` gives light AND writes
 *    the cookie; a garbage cookie gives dark. Inline scripts have no other way
 *    to be tested, and this one runs before every paint of every page.
 * 2. THE SHELL DOES NOT PIN THE THEME. `DashboardShell` carries no hardcoded
 *    `data-theme`, and the layout puts the attribute on <html> with the
 *    script in <head>.
 * 3. `globals.css` sets `color-scheme` for the root and both themed blocks,
 *    and neutralises `tracking-wide` (and wider) under `[dir="rtl"]` the way
 *    it already did `tracking-tight`.
 * 4. `[locale]/not-found.tsx` exists and paints on the product's tokens.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-theme.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

let theme = null;
const themePath = resolvePath(ROOT, 'src/lib/theme.ts');
if (existsSync(themePath)) theme = await import(pathToFileURL(themePath).href);
check(theme && typeof theme.THEME_BOOT_SCRIPT === 'string', 'src/lib/theme.ts does not export THEME_BOOT_SCRIPT');

// 1. Run the boot script against a fake document.
function boot({ cookie = '', search = '' }) {
  const html = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const doc = { documentElement: html, cookie };
  const fn = new Function('document', 'location', theme.THEME_BOOT_SCRIPT);
  fn(doc, { search });
  return { theme: html.attrs['data-theme'], cookie: doc.cookie };
}
if (theme?.THEME_BOOT_SCRIPT) {
  const cases = [
    { name: 'no cookie', input: {}, want: 'dark' },
    { name: 'cookie light', input: { cookie: 'kf-locale=ar; kf-theme=light' }, want: 'light' },
    { name: 'cookie dark', input: { cookie: 'kf-theme=dark' }, want: 'dark' },
    { name: 'garbage cookie', input: { cookie: 'kf-theme=blue' }, want: 'dark' },
    { name: '?theme=light', input: { search: '?state=full&theme=light' }, want: 'light', writes: 'kf-theme=light' },
    { name: '?theme=dark over cookie light', input: { search: '?theme=dark', cookie: 'kf-theme=light' }, want: 'dark', writes: 'kf-theme=dark' },
  ];
  for (const c of cases) {
    const r = boot(c.input);
    console.error(`boot ${c.name}: data-theme=${r.theme}${c.writes ? ` cookie="${r.cookie}"` : ''}`);
    check(r.theme === c.want, `boot script: ${c.name} gave ${r.theme}, expected ${c.want}`);
    if (c.writes) check(r.cookie.startsWith(c.writes), `boot script: ${c.name} did not write ${c.writes}`);
  }
}

// 2. Where the attribute lives.
{
  const shell = existsSync(resolvePath(ROOT, 'src/components/layout/DashboardShell.tsx'))
    ? read('src/components/layout/DashboardShell.tsx')
    : read('src/app/[locale]/dashboard/layout.tsx');
  check(!/data-theme=["']dark["']/.test(shell), 'the dashboard shell still hardcodes data-theme="dark", which would pin the app dark whatever the student chose');
  const layout = read('src/app/[locale]/layout.tsx');
  // The <html> JSX must NOT render data-theme: on the 404's client-rendered
  // error shell React would set it back to the default after the boot script
  // chose light (witnessed on the preview). The script alone owns it.
  const htmlTag = layout.match(/<html[\s\S]*?>/)?.[0] ?? '';
  check(htmlTag !== '' && !/data-theme=/.test(htmlTag), '[locale]/layout.tsx renders data-theme on <html>, which resets the chosen theme on the 404');
  check(layout.includes('THEME_BOOT_SCRIPT'), '[locale]/layout.tsx does not inline THEME_BOOT_SCRIPT');
  // The 404's client-rendered shell loses the attribute the script set, so a
  // client component restores it after mount (witnessed on the preview).
  check(layout.includes('<ThemeSync />') && existsSync(resolvePath(ROOT, 'src/components/platform/ThemeSync.tsx')), '[locale]/layout.tsx does not mount ThemeSync, so the 404 falls back to dark whatever was chosen');
}

// 3. The stylesheet.
{
  const css = read('src/app/globals.css');
  const root = css.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const dark = css.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const light = css.match(/\[data-theme="light"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  check(/color-scheme:\s*dark/.test(root), ':root does not set color-scheme: dark');
  check(/color-scheme:\s*dark/.test(dark), '[data-theme="dark"] does not set color-scheme: dark');
  check(/color-scheme:\s*light/.test(light), '[data-theme="light"] does not set color-scheme: light');
  for (const u of ['tracking-wide', 'tracking-wider', 'tracking-widest']) {
    check(new RegExp(`\\[dir="rtl"\\] \\.${u}\\b`).test(css), `globals.css does not neutralise .${u} under [dir="rtl"]`);
  }
  // Every tracking utility used in src has a reset.
  const used = new Set();
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = resolvePath(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) for (const m of readFileSync(p, 'utf8').matchAll(/\btracking-(tight|tighter|wide|wider|widest)\b/g)) used.add(m[0]); } };
  walk(resolvePath(ROOT, 'src'));
  for (const u of used) check(new RegExp(`\\[dir="rtl"\\] \\.${u}\\b`).test(css), `${u} is used in src but not neutralised for Arabic`);
  console.error(`tracking utilities in src: ${[...used].join(', ') || '(none)'}`);
}

// 4. The 404: the page, AND the catch-all that routes an unmatched URL to it.
//    Witnessed on the PR preview: without the catch-all, /en/anything-missing
//    rendered Next's own black default, because a nested not-found.tsx only
//    answers a notFound() thrown inside its segment.
{
  const catchAll = resolvePath(ROOT, 'src/app/[locale]/[...missing]/page.tsx');
  check(existsSync(catchAll) && /notFound()/.test(readFileSync(catchAll, 'utf8')), 'src/app/[locale]/[...missing]/page.tsx must exist and call notFound(), or unmatched URLs get the default 404');
  const p = resolvePath(ROOT, 'src/app/[locale]/not-found.tsx');
  check(existsSync(p), 'src/app/[locale]/not-found.tsx does not exist: the 404 is Next\'s white default');
  if (existsSync(p)) {
    const src = readFileSync(p, 'utf8');
    check(/bg-background/.test(src) && /text-foreground/.test(src), 'the 404 does not paint on the product tokens');
    check(/lang="ar"/.test(src) && /lang="en"/.test(src), 'the 404 is not bilingual');
  }
}

if (failures.length === 0) {
  console.log('PASS: the theme boots from the cookie before paint, nothing pins it, color-scheme and Arabic tracking are set, and the 404 is the product\'s.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
