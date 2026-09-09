'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PASSWORD_REPLACED_COOKIE } from '@/lib/auth/password-replaced';
import type { Locale } from '@/lib/i18n';

type Labels = { title: string; body: string; action: string; dismiss: string };

/**
 * Shown once, on the first dashboard render after Google sign-in took over an
 * unconfirmed password account. See `src/lib/auth/password-replaced.ts` for the
 * GoTrue mechanism and for why the callback can tell this user apart from a
 * first-time Google signup.
 *
 * WHY IT READS AS AN OUTCOME AND NOT AN ERROR. Nothing went wrong and nothing
 * was lost: the account, its id and every row under it survived, and GoTrue
 * discarded an unproven password on purpose. The person on the other side does
 * not need an apology or a warning triangle. They need to know why the password
 * they remember has stopped working, before they try it and conclude they are
 * the one who got it wrong.
 *
 * WHY THE COOKIE IS CLEARED HERE. The layout renders this from a cookie the
 * callback set, and a Server Component cannot clear one. Doing it on mount is
 * what makes the notice one-shot: the banner stays on screen for this render
 * because its visibility is React state, while the next server render finds no
 * cookie and emits nothing. The 10-minute `maxAge` on the cookie is the backstop
 * for someone who never reaches the dashboard at all.
 *
 * The link goes to /reset-password rather than /forgot-password on purpose.
 * That page gates on a live session, and this user has one from the Google sign
 * in they just completed, so they can set a password immediately. Sending them
 * through the mail round trip would be asking them to prove an address in order
 * to fix a problem caused by not having proved it.
 */
export function PasswordReplacedNotice({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Labels;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    document.cookie = `${PASSWORD_REPLACED_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-sm text-foreground">
      <p className="font-semibold">{labels.title}</p>
      <p className="mt-1 text-muted-foreground">{labels.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={`/${locale}/reset-password`}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          {labels.action}
        </Link>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs text-muted-foreground underline"
        >
          {labels.dismiss}
        </button>
      </div>
    </div>
  );
}
