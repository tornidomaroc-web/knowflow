/**
 * Executable proof for the landing showpiece (Part C, 2026-09-25).
 *
 * The REAL landing page is rendered with react-dom/server for both locales,
 * and the stylesheet is read:
 *   1. Five sections, each with an illustration; at least eight Reveal
 *      wrappers; three parallax shapes; the hero demo with its four beats
 *      (type, sweep, fade, pop); no <img>, no external script.
 *   2. Arabic first: the Arabic page carries dir="rtl" on its copy and the
 *      hero card, the RTL rule for the typed question exists, and the
 *      bilingual section shows both scripts on both locales.
 *   3. Every start state sits inside `prefers-reduced-motion: no-preference`
 *      (.reveal, hero-type, hero-pop, hero-float), and #49's sweep keeps
 *      its reduce rule.
 *   4. Fast: Reveal and Parallax are each under 3 KB of source, the page
 *      HTML is under 60 KB, and the parallax is off below 768px and with
 *      reduced motion (read from source).
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-landing.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');

const { default: LandingPage } = await load('src/app/[locale]/(site)/page.tsx');
const pages = {};
for (const locale of ['ar', 'en']) {
  const el = await LandingPage({ params: Promise.resolve({ locale }) });
  pages[locale] = renderToStaticMarkup(el);
}

// 1. Structure.
for (const [locale, html] of Object.entries(pages)) {
  const sections = html.match(/<section/g)?.length ?? 0;
  const svgs = html.match(/<svg/g)?.length ?? 0;
  const reveals = html.match(/class="reveal/g)?.length ?? 0;
  const depths = html.match(/data-depth="/g)?.length ?? 0;
  console.error(`${locale}: sections=${sections} svgs=${svgs} reveals=${reveals} shapes=${depths} bytes=${html.length}`);
  check(sections === 5, `${locale}: expected 5 sections, got ${sections}`);
  check(svgs >= 10, `${locale}: expected at least 10 illustrations/icons, got ${svgs}`);
  check(reveals >= 8, `${locale}: expected at least 8 Reveal wrappers, got ${reveals}`);
  check(depths >= 3, `${locale}: expected 3 parallax shapes, got ${depths}`);
  for (const c of ['hero-type', 'landing-sweep', 'landing-fade', 'hero-pop']) check(html.includes(c), `${locale}: the hero demo lacks its ${c} beat`);
  check(!/<img/.test(html) && !/<script src=/.test(html), `${locale}: the landing carries an image or an external script`);
  check(html.length < 60000, `${locale}: the landing HTML is ${html.length} bytes, over 60 KB`);
  check(/lang="ar"/.test(html) && /lang="en"/.test(html), `${locale}: the bilingual section does not show both scripts`);
}

// 2. Arabic first.
check(/dir="rtl"/.test(pages.ar) && /lg:text-right/.test(pages.ar), 'the Arabic hero copy is not RTL');
check(!/lg:text-right/.test(pages.en), 'the English hero copy is set RTL');
check(pages.ar.includes('العربية أولًا'), 'the Arabic page lacks its own bilingual heading');

// 3. Motion behind the guard.
{
  const css = read('src/app/globals.css');
  const guards = [...css.matchAll(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g)].map((m) => m[0]).join('\n');
  for (const k of ['.reveal {', '@keyframes hero-type', '@keyframes hero-type-rtl', '@keyframes hero-pop', '@keyframes hero-float', '[dir="rtl"] .hero-type']) {
    check(guards.includes(k), `${k} is not inside the no-preference guard`);
  }
  const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g, '');
  check(!/\.reveal \{/.test(outside), 'a .reveal start state exists outside the guard');
  check(/prefers-reduced-motion: reduce\) \{[\s\S]*landing-sweep/.test(css), '#49\'s sweep lost its reduce rule');
}

// 4. Fast.
{
  for (const f of ['src/components/landing/Reveal.tsx', 'src/components/landing/Parallax.tsx']) {
    const size = statSync(resolvePath(ROOT, f)).size;
    check(size < 3072, `${f} is ${size} bytes of source, over 3 KB`);
  }
  const par = read('src/components/landing/Parallax.tsx');
  check(/prefers-reduced-motion: reduce/.test(par) && /max-width: 767px/.test(par) && /passive: true/.test(par) && /requestAnimationFrame/.test(par), 'the parallax is not gated and throttled');
  const rev = read('src/components/landing/Reveal.tsx');
  check(/IntersectionObserver/.test(rev) && /io\.disconnect\(\)/.test(rev) && /prefers-reduced-motion: reduce/.test(rev), 'the reveal does not observe once, or ignores reduced motion');
}

if (failures.length === 0) {
  console.log('PASS: the landing shows the product working, rises on scroll, is Arabic-first, and is still there with motion off.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
