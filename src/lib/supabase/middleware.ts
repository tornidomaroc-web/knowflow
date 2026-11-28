import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '../../../supabase/database.types';
import { SESSION_COOKIE_OPTIONS } from './cookie-options';

/**
 * A signed-out request for the dashboard goes to LOGIN, in the app and on the
 * web alike (login first, after activation fix 3's sign-up-first rule and its
 * `kf-seen` mark were removed). Login carries a visible way to sign up.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Match /<locale>/dashboard[/...]
  const dashboardMatch = pathname.match(/^\/([a-z]{2})\/dashboard(\/|$)/);
  if (!user && dashboardMatch) {
    const locale = dashboardMatch[1];
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
