import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../supabase/database.types';
import { SESSION_COOKIE_OPTIONS } from './cookie-options';

export function createClient() {
  // The browser writes the session cookies itself after a password sign-in and
  // on every refresh, replacing what the server wrote, so it carries the same
  // flags (`cookie-options.ts`).
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: SESSION_COOKIE_OPTIONS }
  );
}
