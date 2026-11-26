'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ITEM 4J: THE TAPPED TAB IS ACTIVE ON THE TAP.
 *
 * Every dashboard screen is rendered per request, and the tab bar used to
 * follow `usePathname()`, which moves only when the router commits the new
 * screen. On build 9 that was 1.3 to 2.1 s after the tap (ios-signed-in
 * 45696193733, the "nav" readings of its Settings, Subjects and Ask taps), with
 * the old tab still gold and nothing else moving, so the student tapped again.
 *
 * `start(href)` is called from the tab link's `onNavigate`, which Next calls
 * for a client navigation only (never for a modified click that opens another
 * tab), so the tapped tab takes the gold pill in the same frame as the tap.
 * When the pathname changes (the screen, or its loading skeleton, has
 * committed) the pending target is dropped and the real pathname rules again.
 * A navigation that ends in a full page load (an error, a redirect to sign-in)
 * unmounts this state with the page.
 */
export function usePendingNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    setPending(null);
  }, [pathname]);
  return { pathname, current: pending ?? pathname, start: setPending };
}
