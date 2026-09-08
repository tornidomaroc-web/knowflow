import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '../../../supabase/database.types';

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Route Handlers.
 *
 * `server.ts` writes cookies through `next/headers` and swallows the failure in
 * a `catch {}`. That is right for Server Components, where the write is not
 * allowed, and wrong here: on an auth callback a swallowed write means the
 * session silently never lands and the failure looks like "the user just isn't
 * signed in". So this variant buffers every write and `applyCookies` copies the
 * buffer onto the response we actually return.
 */
export function createRouteClient(request: NextRequest) {
  const pending: PendingCookie[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Mutate the incoming jar too, so a later read inside the same
            // handler sees what an earlier call in the same handler wrote.
            request.cookies.set(name, value);
            pending.push({ name, value, options });
          });
        },
      },
    }
  );

  function applyCookies<T extends NextResponse>(response: T): T {
    pending.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  }

  return { supabase, applyCookies };
}
