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

function request(pathname, { acceptLanguage = '', cookie = {} } = {}) {
  const url = new URL('https://tryknowflow.com' + pathname);
  return {
    nextUrl: Object.assign(url, { clone: () => new URL(url.href) }),
    headers: new Headers(acceptLanguage ? { 'accept-language': acceptLanguage } : {}),
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

// No fallback restates 'en' anywhere a locale is resolved.
{
  const { execSync } = await import('node:child_process');
  let hits = '';
  try { hits = execSync(`git grep -n "locales.includes(.*) ? .* : 'en'" -- src`, { cwd: ROOT }).toString(); } catch { hits = ''; }
  check(hits.trim() === '', `hand-written 'en' fallbacks remain:\n${hits}`);
}

if (failures.length === 0) {
  console.log('PASS: register #83 (a), (b) and (c) hold against the real middleware and the real i18n module.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
