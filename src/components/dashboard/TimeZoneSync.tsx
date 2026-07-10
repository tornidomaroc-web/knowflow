'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TIME_ZONE_COOKIE } from '@/lib/streak';

/**
 * Phase 5 (P5.3) — the zone capture. Renders nothing.
 *
 * ============================================================================
 * WHY A COOKIE, AND WHY THIS IS SMALLER THAN THE ALTERNATIVES
 * ============================================================================
 * The streak must be bucketed in the student's zone, and only the browser knows it.
 * `dashboard/page.tsx` is a SERVER component that already reads cookies (every
 * `createClient()` call does, via `next/headers`). So the cheapest channel from
 * browser to server component is a cookie: this component writes one, the page reads
 * it with the machinery it already has, and `page.tsx` stays a server component.
 *
 * The alternatives all cost more:
 *   - Make the page a client component: loses the server-side auth redirect and the
 *     four parallel count queries, and re-plumbs everything for one string.
 *   - Carve the streak card into a client island that fetches `/api/streak?tz=`:
 *     needs a new route, a loading state, and turns one RSC render into a waterfall
 *     — and `StudentHome` is deliberately dumb and presentational (it must stay
 *     storybookable in Phase 8), so the island would have to live outside it.
 *   - Middleware: cannot run `Intl` against the *browser's* zone; it only sees
 *     headers, and no request header carries the IANA zone.
 *
 * ============================================================================
 * WHY THE FIRST PAINT SHOWS THE GHOST, AND WHY THAT IS CORRECT
 * ============================================================================
 * On a student's very first dashboard render the cookie does not exist, so
 * `getCurrentStreak` returns `null` and the existing P2.2 placeholder renders its
 * ghost. This component then writes the cookie and calls `router.refresh()`, and the
 * real number arrives on the next server render.
 *
 * That flicker is not a defect being tolerated — it is the standing "Honest
 * placeholders" rule (docs/PROGRESS.md §5) doing its job. Before the zone is known
 * the streak is genuinely NOT MEASURED, and a ghost is the only honest thing to
 * render. The alternative — assume a default zone for one paint — would flash a
 * confident number that may be wrong by a day for a Gulf student, then silently
 * correct itself. A dash that becomes a number is honest; a wrong number that
 * becomes a different number is not.
 *
 * After the first visit the cookie persists and there is no flicker and no refresh.
 */
export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    // The IANA NAME, never `getTimezoneOffset()`. Morocco reverts to UTC+0 for
    // Ramadan, so an offset captured in March misfiles April. A name resolves
    // against the tz database at read time, in Postgres, every time.
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Ancient/exotic runtime with no zone support. Leave the cookie unset: the
      // streak stays "not measured" rather than becoming a guess.
      return;
    }
    if (!zone) return;

    // Zone names are `Area/Location` — ASCII letters, digits, and `/_+-`. Anything
    // else is not a zone this browser should have produced, and encoding it into a
    // cookie would let a tampered runtime smuggle `;` attributes into the header.
    // Postgres validates it again against pg_timezone_names before it reaches
    // `at time zone`; this is the near-side half of that check.
    if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(zone)) return;

    const current = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1);

    // Already correct: write nothing, refresh nothing. This is the steady state on
    // every visit after the first, so the common path costs one cookie read.
    if (current === zone) return;

    // `path=/` so any route can read it; one year; `SameSite=Lax` because it must
    // survive a normal top-level navigation back into the app. No `Secure` flag
    // hard-coded — localhost dev is http, and the value is a display preference
    // carrying no secret and granting no authority.
    document.cookie = `${TIME_ZONE_COOKIE}=${zone}; path=/; max-age=31536000; SameSite=Lax`;

    // Re-render the server component with the cookie now present. Fires once per
    // zone change (first visit, or a student who has actually travelled), never on
    // a steady-state visit — the `current === zone` guard above returns first.
    router.refresh();
  }, [router]);

  return null;
}
