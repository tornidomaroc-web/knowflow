'use client';

import Link from 'next/link';
import { googleSignInAllowed } from '@/lib/platform';
import { usePlatform } from '@/components/platform/PlatformProvider';

/**
 * The login page inside the app, for a student who registered on the web with
 * Google (docs/PROGRESS.md 2026-10-09, path A: no third-party login in the
 * app). The Google button is hidden there, and such an account has no
 * password, so the e-mail form alone would only answer "invalid credentials".
 * Supabase lets an account with no password set its first one through the
 * recovery link (auth `user.go`, `addingFirstPassword`), so the line points at
 * the page's own "Forgot your password?" link, named by its own label.
 *
 * Shown exactly where the Google button is not, read from the same context
 * the button reads; on the web, where the button is, it renders nothing.
 */
export function GoogleAccountHint({ text, forgotLabel, forgotHref }: { text: string; forgotLabel: string; forgotHref: string }) {
  if (googleSignInAllowed(usePlatform())) return null;
  const [before, after = ''] = text.split('{forgot}');
  return (
    <p data-kf-google-hint className="text-center text-xs leading-relaxed text-muted-foreground">
      {before}
      <Link href={forgotHref} className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
        {forgotLabel}
      </Link>
      {after}
    </p>
  );
}
