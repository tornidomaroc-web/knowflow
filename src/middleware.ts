import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const locales = ['en', 'ar'] as const;
const defaultLocale = 'ar';

function getLocale(request: NextRequest): string {
  const acceptLang = request.headers.get('accept-language') ?? '';
  const preferred = acceptLang.split(',')[0].trim().substring(0, 2).toLowerCase();
  return locales.includes(preferred as 'en' | 'ar') ? preferred : defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = locales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );

  // 1. i18n redirect first if no locale
  if (!hasLocale) {
    const locale = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
    return NextResponse.redirect(url, 307);
  }

  // 2. Supabase session update second
  return await updateSession(request);
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
