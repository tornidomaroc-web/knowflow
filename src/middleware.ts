import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
 
const locales = ['en', 'ar'] as const;
const defaultLocale = 'en';

function getLocale(request: NextRequest): string {
  const acceptLang = request.headers.get('accept-language') ?? '';
  const preferred = acceptLang.split(',')[0].trim().substring(0, 2).toLowerCase();
  return locales.includes(preferred as 'en' | 'ar') ? preferred : defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = locales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );

  if (hasLocale) return NextResponse.next();
  const locale = getLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
