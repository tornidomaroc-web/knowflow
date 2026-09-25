/**
 * WHICH SHELL IS RUNNING, AND WHAT MAY BE SHOWN IN IT (Apple 3.1.1(a), a
 * recorded Phase 8 gate; PIVOT_PLAN.md §8).
 *
 * Apple's rule, verbatim in §8: outside the US storefront an app "may not
 * include buttons, external links, or other calls to action that direct
 * customers to purchasing mechanisms other than in-app purchase". Morocco and
 * the Gulf are not the US storefront. So inside the packaged app there is no
 * Upgrade button, no link to /pricing, and no "Pro has higher limits" sentence
 * in a refusal. The web app keeps all of them.
 *
 * ONE FLAG, TWO HALVES, BECAUSE THE SERVER SERVES BOTH.
 *
 * - THE BUILD. `NEXT_PUBLIC_KF_PLATFORM=native` is set when the Capacitor
 *   bundle is built (Phase 8) and inlined into the client. Everything rendered
 *   from that bundle reads `PLATFORM` and hides its purchase links. The web
 *   build never sets it and is `'web'`.
 * - THE REQUEST. The native shell talks to the SAME `/api/*` on Vercel that
 *   the web app does, and four refusals are composed on the server
 *   (`dailyLimitMessage`, `monthlyConversationMessage`,
 *   `subjectMaterialsMessage`). A server cannot read a build-time flag of a
 *   client it did not build, so the native bundle sends `x-kf-platform: native`
 *   on every same-origin API call (`NativePlatformHeader`), and each route
 *   passes `platformFromRequest(request)` down to the sentence.
 *
 * FAIL SAFE IN THE STORE'S DIRECTION? No: fail toward the WEB. An absent or
 * unknown value is `'web'`, which shows the links. That is deliberate: the
 * web app is the product today, and a bug that hid Upgrade from every web
 * student would cost revenue silently, while the native build sets the flag
 * explicitly and is checked by `scripts/verify-store-purchase-links.mjs`.
 */
export type Platform = 'web' | 'native';

export const PLATFORM: Platform = process.env.NEXT_PUBLIC_KF_PLATFORM === 'native' ? 'native' : 'web';

/** The request header the native bundle adds to its API calls. */
export const PLATFORM_HEADER = 'x-kf-platform';

export function resolvePlatform(value: unknown): Platform {
  return value === 'native' ? 'native' : 'web';
}

export function platformFromRequest(request: { headers?: { get(name: string): string | null } }): Platform {
  // Defensive on purpose: a real Request always has headers, but the route
  // proofs (`scripts/verify-*.mjs`) drive the real handlers with a literal
  // `{ json() }` and must keep working; a request with no headers is simply
  // the web.
  return resolvePlatform(request?.headers?.get?.(PLATFORM_HEADER) ?? null);
}

/**
 * Whether a purchase link or an upgrade sentence may be shown. The one
 * question every gated surface asks; nothing else reads `PLATFORM` directly.
 */
export function purchaseLinksAllowed(platform: Platform = PLATFORM): boolean {
  return platform === 'web';
}
