import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '../../../supabase/database.types';
import { SESSION_COOKIE_OPTIONS } from './cookie-options';
import { SEEN_COOKIE, SEEN_COOKIE_OPTIONS, SEEN_COOKIE_VALUE, type SignedOutPage } from '@/lib/first-screen';

/**
 * `firstScreen` (activation fix 3, `src/lib/first-screen.ts`): where a
 * signed-out request for the dashboard goes, and whether a signed-in one
 * writes the `kf-seen` mark. The defaults are the web's behaviour, unchanged.
 */
export async function updateSession(
  request: NextRequest,
  firstScreen: { signedOutPage: SignedOutPage; markSeen: boolean } = { signedOutPage: 'login', markSeen: false },
) {
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
    url.pathname = `/${locale}/${firstScreen.signedOutPage}`;
    return NextResponse.redirect(url);
  }

  if (user && firstScreen.markSeen) {
    supabaseResponse.cookies.set(SEEN_COOKIE, SEEN_COOKIE_VALUE, SEEN_COOKIE_OPTIONS);
  }

  return supabaseResponse;
}
