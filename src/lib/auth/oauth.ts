import { createClient } from '@/lib/supabase/client';

/**
 * THE ONE WAY A WEB PROVIDER SIGN-IN STARTS: Google, on the web only. Sign in
 * with Apple does NOT come through here: it is native, in the app only, with
 * an identity token (src/lib/auth/apple-bridge.ts, item 4f), so web OAuth
 * for Apple, its Services ID and its six-month secret are gone.
 *
 * WHY THERE IS NO SERVER ROUTE BEHIND THIS. A real button has a `window`, so
 * the browser client can do the whole start: `signInWithOAuth` builds the
 * authorize URL, stores the PKCE `code_verifier` in a COOKIE (the
 * `@supabase/ssr` browser client keeps auth state in cookies, which is the
 * whole reason this project uses it), and navigates. The verifier therefore
 * travels on the request that comes back, and `/api/auth/callback` reads it
 * server-side to exchange the code. Nothing of ours is touched on the way out.
 *
 * The return lands on /api/auth/callback: the middleware
 * matcher excludes `api`, so it is the one path NOT rewritten to /<locale>/…,
 * and it is already on the redirect allow-list for both origins.
 *
 * Returns the provider's refusal, or null once the browser has left the page.
 * The common "failure" — a person backing out at the provider's account
 * chooser — never reaches here: it comes back to the callback as
 * `access_denied` and is put back on the login page with nothing said.
 */
export type OAuthProvider = 'google';

export async function startOAuth(
  provider: OAuthProvider,
  origin: string = window.location.origin
): Promise<{ message: string; status: number | null } | null> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/api/auth/callback` },
  });
  if (!error) return null;
  console.error('[auth] signInWithOAuth refused', {
    provider,
    message: error.message,
    status: error.status ?? null,
  });
  return { message: error.message, status: error.status ?? null };
}
