import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
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

  // 2. Supabase session update second
  const response = await updateSession(request);

  // 3. Remember the language of the page being opened. Every page carries its
  //    locale in the path, so the switcher needs no client code and no route of
  //    its own: following its link is the choice, and this line is the memory.
  //    Written only when it changes, so an ordinary page view sets no cookie.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
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
