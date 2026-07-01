'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui';
import type { Locale } from '@/lib/i18n';

/**
 * Shared sign-out wiring (client Supabase signOut + redirect to login), used by
 * both the desktop sidebar and the mobile top bar so the exact auth behaviour
 * lives in one place. Preserves the original handleSignOut semantics.
 */
export function SignOutButton({
  locale,
  label,
  iconOnly = false,
}: {
  locale: Locale;
  label: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

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
