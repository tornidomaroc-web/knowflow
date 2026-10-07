import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { platformFromHeaders } from '@/lib/platform';
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  defaultLocale,
  locales,
  type Locale,
} from '@/lib/i18n';

/**
 * WHERE A VISIT WITHOUT A LOCALE GOES (register #83 (a) and (c)).
 *
 * 1. The cookie the student's last visit wrote, because a language they chose
 *    outranks one the browser guesses.
 * 2. `Accept-Language`, first tag, for a first visit.
 * 3. `defaultLocale`, which is Arabic and is read from `@/lib/i18n` rather than
 *    restated here: this file and that one said different things for a year.
 */
function getLocale(request: NextRequest): Locale {
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  if (locales.includes(remembered as Locale)) return remembered as Locale;
  const acceptLang = request.headers.get('accept-language') ?? '';
  const preferred = acceptLang.split(',')[0].trim().substring(0, 2).toLowerCase();
  return locales.includes(preferred as Locale) ? (preferred as Locale) : defaultLocale;
}

/**
 * WHETHER THIS REQUEST IS A PAGE THE STUDENT OPENED (register #136).
 *
 * Only a GET that loads a document may write `kf-locale`. Everything else that
 * reaches a locale path is the browser or the router acting on its own:
 *
 * - Next's router. Every `<Link>` in the viewport is prefetched, so an Arabic
 *   page holding a link to `/en` answered that prefetch with `kf-locale=en`
 *   (measured on production, 2026-09-29). Client navigations are not a reliable
 *   signal either way: a static page's payload is prerendered, the router keeps
 *   it for five minutes (`X-Nextjs-Stale-Time: 300`) and a click inside that
 *   window sends no request at all. That is why every link that crosses
 *   languages is a plain `<a>` (a document load) and not a `<Link>`.
 *   THE ROUTER'S OWN HEADERS ARE INVISIBLE HERE. Next's middleware adapter
 *   deletes `RSC`, `Next-Router-Prefetch`, `Next-Router-State-Tree` and
 *   `Next-Router-Segment-Prefetch` (its `FLIGHT_HEADERS`) and the `_rsc` query
 *   before this file runs (`next/dist/server/web/adapter.js`). The first #136
 *   guard tested them and was dead on production. What survives is what the
 *   BROWSER sets: the router's `fetch` goes out as `Sec-Fetch-Dest: empty` with
 *   no `text/html` in its `Accept`; a page load is `Sec-Fetch-Dest: document` with an `Accept`
 *   that names `text/html`. A page cannot forge `Sec-Fetch-*`. Browsers older
 *   than the header (Safari before 16.4) are judged by `Accept` alone.
 * - `Sec-Purpose` / `Purpose` / `X-Purpose` / `X-Moz`: the browser's own
 *   prefetch, prerender and link-preview requests, which are documents too.
 * - Anything but GET: a server action posts to the page it is on and chooses
 *   nothing.
 */
function isPageLoad(request: NextRequest): boolean {
  if (request.method !== 'GET') return false;
  const h = request.headers;
  const dest = h.get('sec-fetch-dest');
  const isDocument = dest ? dest === 'document' : /\btext\/html\b/i.test(h.get('accept') ?? '');
  if (!isDocument) return false;
  const purpose = ['sec-purpose', 'purpose', 'x-purpose', 'x-moz'].map((n) => h.get(n) ?? '').join(' ');
  return !/prefetch|prerender|preview/i.test(purpose);
}

/** The locale a path carries, or null. */
function pathLocale(pathname: string): Locale | null {
  return locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const locale = pathLocale(pathname);

  // 1. i18n redirect first if no locale
  if (!locale) {
    const target = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? `/${target}` : `/${target}${pathname}`;
    return NextResponse.redirect(url, 307);
  }

  // 2. The app never shows the marketing root or the pricing page: both are
  //    calls to action toward a purchase outside in-app purchase (Apple
  //    3.1.1(a); docs/store/STORE_PATH.md step a). A request carrying the
  //    app's marker (src/lib/platform.ts) is sent to the dashboard, which
  //    `updateSession` below bounces to /login when there is no session; so
  //    this grants nothing, it only takes a page away. A forged marker in a
  //    normal browser costs that browser the landing and /pricing, nothing
  //    else. Every other page (privacy, terms, the app itself) is served as
  //    it is, with its own gated surfaces hidden.
  if (platformFromHeaders((name) => request.headers.get(name)) === 'native') {
    const rest = pathname.slice(`/${locale}`.length);
    if (rest === '' || rest === '/' || rest === '/pricing' || rest === '/pricing/') {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/dashboard`;
      url.search = '';
      return NextResponse.redirect(url, 307);
    }
  }

  // 3. Supabase session update
  const response = await updateSession(request);

  // 4. Remember the language of the page being opened. Every page carries its
  //    locale in the path, so the switcher needs no client code and no route of
  //    its own: following its link is the choice, and this line is the memory.
  //    Written only when it changes, so an ordinary page view sets no cookie,
  //    and only on a page load, so a prefetch never chooses for the student.
  if (isPageLoad(request) && request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
  }
  return response;
}

/**
 * `icon` AND `apple-icon` ARE IN THIS LIST BECAUSE WITHOUT THEM THE FAVICON IS A
 * 404, AND THE BUILD CANNOT TELL YOU THAT.
 *
 * Next serves the generated metadata images at the ROOT — `/icon` and
 * `/apple-icon` — and emits `<link rel="icon" href="/icon?…">` into every page.
 * Neither path contains a dot, so the `.*\..*` escape hatch below does not catch
 * them, and the i18n redirect above rewrote them to `/en/icon` and
 * `/en/apple-icon`, which do not exist. Measured on the PR preview: `/icon`
 * returned a 307 to `/en/icon` and then a 404, while `/en/opengraph-image`
 * returned a real 1200x630 PNG — because that one already carried a locale
 * prefix. The build output was clean and every meta tag was correct; the icons
 * still did not load. This is the one defect in the change that only a deployed
 * request could find.
 *
 * They belong in exactly this group: `favicon.ico`, `robots.txt` and
 * `sitemap.xml` are already here, and these are the same thing — root-level
 * metadata files that are not localised and must never be redirected.
 *
 * KNOWN AND ACCEPTED, since the next reader will spot it: these are prefix
 * alternatives, so a future `/icons/…` route would also skip the middleware.
 * Every other entry in this list has the same looseness (`api` already excludes
 * `/apifoo`), and tightening one while leaving the rest would be misleading.
 */
export const config = {
  matcher: [
    '/',
    '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
