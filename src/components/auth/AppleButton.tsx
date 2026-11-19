'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { appleBridge, signInWithApple, type AppleBridge, type AppleSupabase } from '@/lib/auth/apple-bridge';
import { LatinText } from '@/components/ui/LatinText';

/**
 * SIGN IN WITH APPLE, NATIVE, IN THE APP ONLY (iOS 1.1, big item 4f). FIRST
 * on /login and /signup, above Google (which the app never shows) and above
 * the email card, which stays where it was. The web never shows it: there is
 * no web OAuth for Apple any more (src/lib/auth/oauth.ts).
 *
 * WHEN IT SHOWS: after mount, only where `appleBridge()` answers (shell 2,
 * iOS, the KnowFlowApple plugin). Everywhere else this renders nothing, so
 * the web, build 8 and a build 9 cut before PR 2 are the same picture as
 * before (design-c check 22).
 *
 * APPLE'S HUMAN INTERFACE GUIDELINES FOR THIS CONTROL, which App Review
 * checks (https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple):
 *  - Apple's own wording: "Sign in with Apple" / "Continue with Apple"
 *    (auth.appleLogin / auth.appleSignup, unchanged since public v1).
 *  - A solid BLACK button with white logo and title on the light theme, a
 *    solid WHITE one with black on the dark theme (`kf-apple-button`,
 *    globals.css). Pure #000 and #FFF, not the theme's ink and cream.
 *  - The logo is "Use only the logo artwork downloaded from Apple Design
 *    Resources": AppleLogo below is the one path of
 *    "Logo - SIWA - Left-aligned - Black - Large.svg" from
 *    https://devimages-cdn.apple.com/design/resources/download/Logo-Sign-in-with-Apple.dmg
 *    (dmg sha256 99fba5c8a294a86653294b3766d7ce21dde47cc75a77367659c45ea168699af6,
 *    svg sha256 038d2940e825dfb07101f6611f163b8954b9cf37b21bf2818e04b581b44442b1),
 *    unchanged, in Apple's own 39 x 44 frame; only its fill follows the
 *    button's title colour, which is Apple's black or white variant.
 *    scripts/verify-apple-signin.mjs holds the path's sha256.
 *  - 54 pt tall like the Google pill beside it on the web (HIG: at least 44).
 */
export function useAppleSignIn(): AppleBridge | null {
  const [bridge, setBridge] = useState<AppleBridge | null>(null);
  useEffect(() => {
    setBridge(appleBridge());
  }, []);
  return bridge;
}

export function AppleButton({
  bridge,
  label,
  errorLabel,
  locale,
  onSignedIn,
}: {
  bridge: AppleBridge;
  label: string;
  errorLabel: string;
  locale: string;
  onSignedIn: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setFailed(false);
    setLoading(true);
    const result = await signInWithApple(bridge, createClient() as unknown as AppleSupabase, locale);
    if (result === 'signed-in') {
      onSignedIn();
      return;
    }
    // Cancel in Apple's sheet says nothing, the way a Google back-out does.
    setFailed(result === 'failed');
    setLoading(false);
  };

  return (
    <div className="space-y-3" data-kf-apple-signin="">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="pressable kf-apple-button flex min-h-[3.375rem] w-full items-center justify-center rounded-full pe-5 text-base font-bold transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <AppleLogo />
        {/* "Apple" inside the Arabic title is a left-to-right isolate (LatinText); the English one is unchanged. */}
        <span>
          <LatinText text={label} />
        </span>
      </button>
      {failed && (
        <p className="text-xs text-danger" role="alert">
          {errorLabel}
        </p>
      )}
    </div>
  );
}

/** Apple's artwork, unchanged (see above), in the button's title colour. */
function AppleLogo() {
  return (
    <svg width="39" height="44" viewBox="0 0 39 44" aria-hidden="true" className="shrink-0">
      <path fill="currentColor" fillRule="nonzero" d="M19.8196726,13.1384615 C20.902953,13.1384615 22.2608678,12.406103 23.0695137,11.4296249 C23.8018722,10.5446917 24.3358837,9.30883662 24.3358837,8.07298156 C24.3358837,7.9051494 24.3206262,7.73731723 24.2901113,7.6 C23.0847711,7.64577241 21.6353115,8.4086459 20.7656357,9.43089638 C20.0790496,10.2090273 19.4534933,11.4296249 19.4534933,12.6807374 C19.4534933,12.8638271 19.4840083,13.0469167 19.4992657,13.1079466 C19.5755531,13.1232041 19.6976128,13.1384615 19.8196726,13.1384615 Z M16.0053051,31.6 C17.4852797,31.6 18.1413509,30.6082645 19.9875048,30.6082645 C21.8641736,30.6082645 22.2761252,31.5694851 23.923932,31.5694851 C25.5412238,31.5694851 26.6245041,30.074253 27.6467546,28.6095359 C28.7910648,26.9312142 29.2640464,25.2834075 29.2945613,25.2071202 C29.1877591,25.1766052 26.0904927,23.9102352 26.0904927,20.3552448 C26.0904927,17.2732359 28.5316879,15.8848061 28.6690051,15.7780038 C27.0517133,13.4588684 24.5952606,13.3978385 23.923932,13.3978385 C22.1082931,13.3978385 20.6283185,14.4963764 19.6976128,14.4963764 C18.6906198,14.4963764 17.36322,13.4588684 15.7917006,13.4588684 C12.8012365,13.4588684 9.765,15.9305785 9.765,20.5993643 C9.765,23.4982835 10.8940528,26.565035 12.2824825,28.548506 C13.4725652,30.2268277 14.5100731,31.6 16.0053051,31.6 Z" />
    </svg>
  );
}
