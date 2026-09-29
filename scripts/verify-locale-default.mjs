/**
 * Executable proof for register #83, all three parts, against the REAL
 * middleware and the REAL `@/lib/i18n`.
 *
 * (c) ONE DEFAULT. `middleware.ts` said `'ar'`; `src/lib/i18n/index.ts` and
 *     every client and server fallback said `'en'`. The ruling of 2026-09-25 is
 *     Arabic everywhere. Held here: `defaultLocale` is `'ar'`, `resolveLocale`
 *     collapses anything unknown to it, and a first visit advertising French
 *     lands on `/ar`.
 * (a) PERSISTENCE. Opening `/en/pricing` writes the `kf-locale` cookie, and a
 *     visit to `/` carrying `kf-locale=en` goes to `/en` even when the browser
 *     asks for Arabic.
 * (b) THE SWITCH INSIDE THE APP. The sidebar and the mobile nav build their
 *     link from the same `switchLocaleHref` the marketing header uses, and it
 *     keeps the page.
 *
 * And register #136: ONLY A PAGE LOAD CHOOSES. A prefetch of `/en` carrying
 * `kf-locale=ar` answered `Set-Cookie: kf-locale=en` on production, because
 * every Arabic page holds a `<Link>` to `/en` (the switch) and Next prefetches
 * it. Held here: no router, browser-prefetch or non-GET request writes the
 * cookie; every page load still writes exactly what it wrote before; no request
 * writes where the old rule did not; and every link that crosses languages is a
 * plain `<a>`, because a `<Link>` to a prerendered page is served from the
 * router's cache for five minutes and would never reach the middleware at all.
 *
 * What is stubbed: `next/server` (a redirect reads as a URL, a pass-through
 * response reads as a cookie jar) and `@/lib/supabase/middleware`, whose
 * `updateSession` here returns that jar and touches no session. The request is
 * a literal with the three things the middleware reads: `nextUrl`, `headers`
 * and `cookies`.
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-locale-default.mjs
 */
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

const NEXT_SERVER = `
export class NextResponse {
  constructor() { this.kind = 'next'; this.jar = new Map(); this.cookies = { set: (n, v, o) => this.jar.set(n, { value: v, ...o }) }; }
  static redirect(url, status) { return { kind: 'redirect', location: String(url), status }; }
  static next() { return new NextResponse(); }
}`;
const SUPABASE_MW = `
import { NextResponse } from 'next/server';
export async function updateSession() { return NextResponse.next(); }`;

const inline = (src) => 'data:text/javascript,' + encodeURIComponent(src);
const withTs = (base) => {
  if (/\.[a-z]+$/i.test(base)) return base;
  if (existsSync(base + '.ts')) return base + '.ts';
  return resolvePath(base, 'index.ts');
};
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/server') return { url: inline(NEXT_SERVER), shortCircuit: true };
    if (spec === '@/lib/supabase/middleware') return { url: inline(SUPABASE_MW), shortCircuit: true };
    if (spec.startsWith('@/')) return { url: pathToFileURL(withTs(resolvePath(ROOT, 'src', spec.slice(2)))).href, shortCircuit: true };
    if (spec.startsWith('.') && ctx.parentURL && ctx.parentURL.startsWith('file:')) {
      return { url: pathToFileURL(withTs(resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec))).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const i18n = await import(pathToFileURL(resolvePath(ROOT, 'src/lib/i18n/index.ts')).href);
const { middleware } = await import(pathToFileURL(resolvePath(ROOT, 'src/middleware.ts')).href);

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

function request(pathname, { acceptLanguage = '', cookie = {}, method = 'GET', headers = {} } = {}) {
  const url = new URL('https://tryknowflow.com' + pathname);
  return {
    method,
    nextUrl: Object.assign(url, { clone: () => new URL(url.href) }),
    headers: new Headers({ ...(acceptLanguage ? { 'accept-language': acceptLanguage } : {}), ...headers }),
    cookies: { get: (n) => (n in cookie ? { name: n, value: cookie[n] } : undefined) },
  };
}

// (c) the default, read from the module, not from a middleware side effect.
console.error(`defaultLocale = ${i18n.defaultLocale}`);
check(i18n.defaultLocale === 'ar', `defaultLocale is ${i18n.defaultLocale}, expected ar`);
check(typeof i18n.resolveLocale === 'function' && i18n.resolveLocale('fr') === 'ar', 'resolveLocale("fr") should be ar');
check(typeof i18n.resolveLocale === 'function' && i18n.resolveLocale('en') === 'en', 'resolveLocale("en") should be en');

// A first visit from a French browser.
{
  const r = await middleware(request('/', { acceptLanguage: 'fr-FR,fr;q=0.9' }));
  console.error(`/ + fr -> ${r.location}`);
  check(r.kind === 'redirect' && new URL(r.location).pathname === '/ar', `French first visit went to ${r.location}, expected /ar`);
}
// A first visit from an English browser is still English (control).
{
  const r = await middleware(request('/pricing', { acceptLanguage: 'en-GB,en;q=0.9' }));
  console.error(`/pricing + en -> ${r.location}`);
  check(r.kind === 'redirect' && new URL(r.location).pathname === '/en/pricing', `English first visit went to ${r.location}, expected /en/pricing`);
}
// (a) a remembered English outranks a browser asking for Arabic.
{
  const r = await middleware(request('/', { acceptLanguage: 'ar-MA,ar;q=0.9', cookie: { [i18n.LOCALE_COOKIE ?? 'kf-locale']: 'en' } }));
  console.error(`/ + ar + cookie en -> ${r.location}`);
  check(r.kind === 'redirect' && new URL(r.location).pathname === '/en', `remembered English was ignored: went to ${r.location}`);
}
// (a) opening a page writes the memory.
{
  const r = await middleware(request('/en/pricing', { acceptLanguage: 'ar' }));
  const c = r.jar?.get(i18n.LOCALE_COOKIE ?? 'kf-locale');
  console.error(`/en/pricing -> cookie ${c ? JSON.stringify(c) : '(none)'}`);
  check(c?.value === 'en', 'opening /en/pricing did not write kf-locale=en');
  check(c && c.maxAge >= 60 * 60 * 24 * 30, 'the locale cookie should outlive a month');
}
// (a) an unchanged memory is not rewritten.
{
  const r = await middleware(request('/ar/pricing', { cookie: { [i18n.LOCALE_COOKIE ?? 'kf-locale']: 'ar' } }));
  check(r.kind === 'next' && !r.jar.has('kf-locale'), 'a matching cookie was rewritten');
}

// (b) the switch keeps the page, and the app chrome uses it.
{
  check(typeof i18n.switchLocaleHref === 'function', 'switchLocaleHref is not exported');
  if (typeof i18n.switchLocaleHref === 'function') {
    check(i18n.switchLocaleHref('en', '/en/dashboard/settings') === '/ar/dashboard/settings', 'switch from /en/dashboard/settings');
    check(i18n.switchLocaleHref('ar', '/ar') === '/en', 'switch from /ar');
  }
  for (const f of ['src/components/layout/Sidebar.tsx', 'src/components/layout/MobileNav.tsx']) {
    const src = readFileSync(resolvePath(ROOT, f), 'utf8');
    check(src.includes('switchLocaleHref(') && src.includes('ENDONYM['), `${f} does not render the language switch`);
  }
}

// #136: only a page load chooses the language.
const COOKIE = i18n.LOCALE_COOKIE ?? 'kf-locale';
// What a browser sends when the student opens a page (Safari and Chrome).
const PAGE_LOAD = { accept: 'text/html,application/xhtml+xml', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' };
// Everything that reaches a locale path without the student opening it.
const NOT_A_CHOICE = {
  'Next prefetch (the production measurement)': { headers: { rsc: '1', 'next-router-prefetch': '1', 'next-router-state-tree': '%5B%22%22%5D' } },
  'Next segment prefetch': { headers: { rsc: '1', 'next-router-prefetch': '1', 'next-router-segment-prefetch': '/_tree' } },
  'Next prefetch header alone': { headers: { 'next-router-prefetch': '1' } },
  'router payload (RSC, served from cache or not)': { headers: { rsc: '1' } },
  'browser prefetch (Sec-Purpose)': { headers: { ...PAGE_LOAD, 'sec-purpose': 'prefetch' } },
  'browser prerender (Sec-Purpose)': { headers: { ...PAGE_LOAD, 'sec-purpose': 'prefetch;prerender' } },
  'legacy prefetch (Purpose)': { headers: { purpose: 'prefetch' } },
  'Safari preview (X-Purpose)': { headers: { 'x-purpose': 'preview' } },
  'Firefox prefetch (X-Moz)': { headers: { 'x-moz': 'prefetch' } },
  'server action (POST)': { method: 'POST', headers: { 'next-action': 'x', accept: 'text/x-component' } },
};
const written = (r) => (r.kind === 'next' ? r.jar.get(COOKIE)?.value ?? null : r.kind === 'redirect' ? 'redirect' : null);
{
  for (const [name, init] of Object.entries(NOT_A_CHOICE)) {
    for (const [path, have] of [['/en', 'ar'], ['/ar', 'en'], ['/en/pricing', 'ar'], ['/en/dashboard', 'ar'], ['/ar', null]]) {
      const r = await middleware(request(path, { ...init, cookie: have ? { [COOKIE]: have } : {} }));
      const w = written(r);
      if (path === '/en' && name.startsWith('Next prefetch (')) console.error(`#136 ${name}: GET /en + kf-locale=ar -> ${w ?? '(no cookie)'}`);
      check(r.kind === 'next' && w === null, `#136 ${name} to ${path} with kf-locale=${have ?? '(none)'} wrote kf-locale=${w}`);
    }
  }
}
// A page load still chooses, both ways, and with no cookie at all.
for (const [path, have, want] of [['/en', 'ar', 'en'], ['/ar', 'en', 'ar'], ['/en/pricing', 'ar', 'en'], ['/ar/dashboard', 'en', 'ar'], ['/en', null, 'en'], ['/ar/login', null, 'ar']]) {
  const r = await middleware(request(path, { headers: PAGE_LOAD, cookie: have ? { [COOKIE]: have } : {} }));
  console.error(`#136 page load ${path} + kf-locale=${have ?? '(none)'} -> ${written(r) ?? '(no cookie)'}`);
  check(r.kind === 'next' && written(r) === want, `#136 opening ${path} with kf-locale=${have ?? '(none)'} wrote ${written(r)}, expected ${want}`);
}
// No request writes where the rule before #136 did not, and every page load
// writes exactly what it wrote before. The old rule, restated: a locale path
// whose cookie differs gets that locale; a path without one is redirected.
{
  const oldRule = (path, have) => {
    const l = ['en', 'ar'].find((x) => path === `/${x}` || path.startsWith(`/${x}/`));
    return l ? (have === l ? null : l) : 'redirect';
  };
  let cases = 0;
  const kinds = { 'page load': { headers: PAGE_LOAD }, 'bare GET': {}, ...NOT_A_CHOICE };
  for (const path of ['/', '/pricing', '/en', '/ar', '/en/pricing', '/ar/dashboard', '/en/login', '/ar/reset-password', '/en/no-such-page']) {
    for (const have of [null, 'en', 'ar', 'fr']) {
      for (const [kind, init] of Object.entries(kinds)) {
        cases++;
        const r = await middleware(request(path, { ...init, cookie: have ? { [COOKIE]: have } : {} }));
        const now = written(r);
        const before = oldRule(path, have);
        const label = `${kind} ${path} kf-locale=${have ?? '(none)'}`;
        if (before === 'redirect') check(now === 'redirect', `#136 ${label}: the redirect changed`);
        else check(now === null || now === before, `#136 ${label}: wrote ${now} where the old rule wrote ${before ?? 'nothing'}`);
        if (kind === 'page load' || kind === 'bare GET') check(now === before, `#136 ${label}: a page load wrote ${now}, before it wrote ${before ?? 'nothing'}`);
      }
    }
  }
  console.error(`#136 matrix: ${cases} requests compared with the old rule`);
}
// Every link that crosses languages is a plain <a>. Each element that takes
// its href from the switch rule, or points at a bare locale root, is found and
// its tag read. The design previews 404 on production and are exempt.
{
  const { execSync } = await import('node:child_process');
  const files = execSync('git ls-files -- "src/*.tsx"', { cwd: ROOT }).toString().split('\n').filter((f) => f && !f.includes('/preview/'));
  const re = /<([A-Za-z][\w.]*)\s((?:[^<>{}]|\{[^{}]*\})*?)\bhref=\{?(switchHref|selected \? pathname : switchLocaleHref\([^)]*\)|switchLocaleHref\([^)]*\)|["'`]\/(?:en|ar)["'`])/g;
  let crossings = 0;
  for (const f of files) {
    const src = readFileSync(resolvePath(ROOT, f), 'utf8');
    for (const m of src.matchAll(re)) {
      crossings++;
      check(m[1] === 'a', `#136 ${f}: a language-crossing link is <${m[1]}>, not <a> (${m[3]})`);
    }
  }
  console.error(`#136 language-crossing links found: ${crossings}`);
  check(crossings >= 7, `#136 expected at least 7 language-crossing links (header x2, sidebar, mobile nav, settings, 404 x2), found ${crossings}`);
}

// No fallback restates 'en' anywhere a locale is resolved.
{
  const { execSync } = await import('node:child_process');
  let hits = '';
  try { hits = execSync(`git grep -n "locales.includes(.*) ? .* : 'en'" -- src`, { cwd: ROOT }).toString(); } catch { hits = ''; }
  check(hits.trim() === '', `hand-written 'en' fallbacks remain:\n${hits}`);
}

if (failures.length === 0) {
  console.log('PASS: register #83 (a), (b) and (c) and #136 hold against the real middleware and the real i18n module.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
