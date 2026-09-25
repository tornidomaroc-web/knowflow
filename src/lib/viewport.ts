import type { Viewport } from 'next';

/**
 * THE VIEWPORT, AND WHY `viewportFit: 'cover'` IS NOT OPTIONAL (register #96,
 * corrected 2026-09-25).
 *
 * `MobileNav` has padded its bottom bar with `env(safe-area-inset-bottom)`
 * since P2, and #96 recorded that "on a notched phone the nav grows". It did
 * not: without `viewport-fit=cover` iOS lays the page out inside the safe
 * area and reports every `env(safe-area-inset-*)` as 0, so the padding was a
 * no-op and the claim was never true on a device. With `cover` the page runs
 * under the notch and the home indicator, the insets become real, and the
 * bars below account for them (`MobileNav`, `DashboardShell`, `SiteHeader`).
 *
 * Exported from its own module, not written inline in the layout, so
 * `scripts/verify-safe-areas.mjs` can import the object without pulling in
 * `next/font`.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // The browser chrome's tint on Android and in iOS Safari. One value, the
  // dark ground: the theme toggle cannot rewrite a <meta> that Next renders
  // once, and a light-theme student sees a dark address bar, which is the
  // lesser wrong. The native shells set their status bars from code.
  themeColor: '#14110d',
};
