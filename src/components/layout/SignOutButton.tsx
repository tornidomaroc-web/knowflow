'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClayChevron, ClaySignOut } from '@/components/clay/ClayIcons';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import type { Locale } from '@/lib/i18n';
import { useSingleFlight } from '@/lib/use-single-flight';

/**
 * Signs the student out and returns to the login page. Three shapes: the
 * sidebar's full button, the web top bar's icon, and (Step Redesign-2) a
 * Settings row, which is where the app offers it now that it has no top bar.
 */
export function SignOutButton({
  locale,
  label,
  iconOnly = false,
  variant = 'button',
}: {
  locale: Locale;
  label: string;
  iconOnly?: boolean;
  variant?: 'button' | 'row';
}) {
  const router = useRouter();
  // Item 4j: the press shows at once and a second press does nothing. Sign
  // out waits on the auth server and then on the login page, a round trip
  // each, and nothing moved meanwhile. `leaving` stays true after the push:
  // this screen is on its way out, and the button must not come back.
  const [leaving, setLeaving] = useState(false);
  const once = useSingleFlight();

  const handleSignOut = once(async () => {
    setLeaving(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push(`/${locale}/login`);
    } catch {
      setLeaving(false);
    }
  });

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={leaving}
        aria-busy={leaving || undefined}
        data-kf-signout="row"
        className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-lg py-2 text-start transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-70 disabled:opacity-50"
      >
        <span className="kf-chip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
          {/* Design "C", PR 3: the clay sign-out glyph, everywhere this button is. */}
          <ClaySignOut width={20} height={20} className="rtl:-scale-x-100" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
        <ClayChevron className="shrink-0 rtl:-scale-x-100" />
      </button>
    );
  }

  if (iconOnly) {
    return (
      <Button variant="ghost" size="icon" onClick={handleSignOut} disabled={leaving} aria-label={label} title={label}>
        <ClaySignOut className="rtl:-scale-x-100" />
      </Button>
    );
  }

  return (
    <Button variant="ghost" onClick={handleSignOut} disabled={leaving} className="w-full justify-start text-muted-foreground">
      <ClaySignOut width={20} height={20} className="shrink-0 rtl:-scale-x-100" />
      {label}
    </Button>
  );
}
