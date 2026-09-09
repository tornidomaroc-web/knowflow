'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * The one way into a Google sign-in. Used by both /login and /signup, which
 * differ only in their label.
 *
 * ============================================================================
 * WHY THERE IS NO SERVER ROUTE BEHIND THIS
 * ============================================================================
 * PR #125 needed one, because it was a headless harness with no `window` to
 * navigate. A real button has one, so the browser client can do the whole
 * start: `signInWithOAuth` builds the authorize URL, stores the PKCE
 * `code_verifier`, and navigates. Nothing of ours is touched on the way out.
 *
 * That matters for the verifier. `createBrowserClient` from `@supabase/ssr`
 * keeps auth state in COOKIES rather than localStorage, which is the whole
 * reason this project uses it. So the verifier written here travels on the
 * request that comes back, and `/api/auth/callback` can read it server-side to
 * exchange the code. A localStorage-backed client would have made the callback
 * structurally unable to finish the exchange.
 *
 * The return lands on /api/auth/callback, which needs no new plumbing: the
 * middleware matcher excludes `api`, so it is the one path NOT rewritten to
 * /<locale>/..., and it is already on the redirect allow-list for both origins.
 * That is why every other auth entry point in this app already lives there.
 *
 * ============================================================================
 * THE FAILURE ARM A REAL PERSON ACTUALLY HITS
 * ============================================================================
 * The common one is not an outage, it is someone changing their mind at
 * Google's account chooser. That returns `error=access_denied` to the callback,
 * which sends them back here with no message at all, because nothing failed and
 * a notice would be telling them something untrue about their own decision.
 *
 * This state is the other arm: `signInWithOAuth` refusing before any navigation
 * happens, which is a real fault on our side or the network's. It says so
 * plainly and leaves the email form directly underneath, still usable.
 */
export function GoogleButton({
  label,
  errorLabel,
}: {
  label: string;
  errorLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setFailed(false);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    // Reached only when the redirect never happened. On success the browser has
    // already left this page, so there is nothing to reset.
    if (error) {
      console.error('[auth] signInWithOAuth refused', {
        message: error.message,
        status: error.status ?? null,
      });
      setFailed(true);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-60"
      >
        <GoogleMark />
        <span>{label}</span>
      </button>
      {failed && (
        <p className="text-xs text-red-600" role="alert">
          {errorLabel}
        </p>
      )}
    </div>
  );
}

/** Google's four-colour mark, inline so it is not a blocked external asset. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
