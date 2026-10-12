'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import type { Locale } from '@/lib/i18n';

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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        data-kf-signout="row"
        className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-lg py-2 text-start transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="kf-chip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
          <LogOut className="h-4 w-4 rtl:-scale-x-100" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint rtl:-scale-x-100" />
      </button>
    );
  }

  if (iconOnly) {
    return (
      <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label={label} title={label}>
        <LogOut className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-muted-foreground">
      <LogOut className="h-4 w-4" />
      {label}
    </Button>
  );
}
