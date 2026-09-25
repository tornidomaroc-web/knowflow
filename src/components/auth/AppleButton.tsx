'use client';

import { useState } from 'react';
import { startOAuth } from '@/lib/auth/oauth';

/**
 * Sign in with Apple, beside Google on /login and /signup (Apple guideline
 * 4.8, PIVOT_PLAN.md §5: the moment a third-party login is offered in the
 * app, Apple's own must be offered too). The two pages differ only in the
 * label.
 *
 * THE BUTTON FOLLOWS APPLE'S HUMAN INTERFACE GUIDELINES FOR THIS CONTROL, and
 * that is a requirement, not taste: the Apple logo, the words "Sign in with
 * Apple" / "Continue with Apple", a solid black or white fill with the logo
 * and text in the opposite colour, a height at least 44pt. It is painted
 * `bg-foreground text-background`, which is cream on the dark theme and near-
 * black on the light one, so it is Apple's white button on dark and Apple's
 * black button on light without a theme branch.
 *
 * THE CODE PATH IS LIVE BUT THE PROVIDER IS NOT ENABLED. `startOAuth('apple')`
 * is the same call Google makes; until the owner registers the Services ID and
 * the key with Apple and turns the provider on in Supabase (register #119),
 * Supabase refuses the start and the button shows `errorLabel`. That is the
 * honest state: the app is ready, the console work is the owner's.
 */
export function AppleButton({ label, errorLabel }: { label: string; errorLabel: string }) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setFailed(false);
    setLoading(true);
    const refusal = await startOAuth('apple');
    // Reached only when the redirect never happened.
    if (refusal) {
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
        className="flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <AppleMark />
        <span>{label}</span>
      </button>
      {failed && (
        <p className="text-xs text-danger" role="alert">
          {errorLabel}
        </p>
      )}
    </div>
  );
}

/** Apple's logo, in the button's own text colour, as the HIG requires. */
function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}
