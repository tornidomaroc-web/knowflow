/**
 * WHICH SHELL IS ASKING, AND WHAT MAY BE SHOWN TO IT (Apple 3.1.1(a) and 4.8;
 * `docs/store/STORE_PATH.md` step a; PIVOT_PLAN.md §8).
 *
 * Apple's rule, verbatim in §8: outside the US storefront an app "may not
 * include buttons, external links, or other calls to action that direct
 * customers to purchasing mechanisms other than in-app purchase". Morocco and
 * the Gulf are not the US storefront. So inside the app there is no Upgrade
 * button, no link to /pricing, and no "Pro has higher limits" sentence in a
 * refusal. The Google sign-in button is hidden there too, because Google
 * refuses OAuth inside an embedded web view and native sign-in is a later
 * step. The web keeps all of them.
 *
 * ONE MARKER, READ AT REQUEST TIME. The app is a native shell that loads
 * tryknowflow.com, so the server serves both shells from one build and can
 * only tell them apart per request. The shell appends `KnowFlowApp/<n>` to
 * its web view's user agent (Capacitor `appendUserAgent`, step b), and every
 * request the web view makes, document loads and fetches alike, carries it.
 * `x-kf-platform: native` is honoured as well, for a client that sets it.
 *
 * THE MARKER ONLY REMOVES. Anyone can forge a user agent or a header, so the
 * native answer must grant nothing: no entitlement, no limit, no auth, no
 * different data. It is consumed by exactly two predicates below and by the
 * middleware's redirect of the marketing root and /pricing to the dashboard,
 * and every consumer HIDES something the web would show. A forged marker in
 * a normal browser hides that browser's own upgrade links and Google button
 * and nothing else. `scripts/verify-platform-gate.mjs` holds this: for every
 * gated surface, what the native variant renders is a subset of the web
 * variant.
 *
 * FAIL TOWARD THE WEB. An absent or unknown marker is `'web'`, which shows the
 * links: the web app is the product today, and a bug that hid Upgrade from
 * every web student would cost revenue silently, while the app sets its
 * marker explicitly and the gate script checks the reading.
 *
 * CACHING. A page whose output depends on the marker must be rendered per
 * request: a static page is built once, with no request and so as the web
 * variant, and the CDN would serve it to the app. Every page that reads the
 * marker does so through `currentPlatform()` (`src/lib/platform-server.ts`),
 * which reads `headers()` and thereby opts the route out of static
 * rendering; Next then answers with `Cache-Control: private, no-store`, so
 * no shared cache ever holds either variant. The proof is on production, not
 * in a unit test: `STORE_PATH.md` and Section 7 record the headers read.
 */
export type Platform = 'web' | 'native';

/** The request header a client may set. */
export const PLATFORM_HEADER = 'x-kf-platform';

/**
 * The token the shell appends to its user agent, followed by a version:
 * `KnowFlowApp/1`. Step b sets `appendUserAgent: 'KnowFlowApp/1'` in the
 * Capacitor config and nothing else on the server has to change.
 */
export const NATIVE_USER_AGENT_TOKEN = 'KnowFlowApp';
const NATIVE_USER_AGENT = /\bKnowFlowApp\/\d/;

export function resolvePlatform(value: unknown): Platform {
  return value === 'native' ? 'native' : 'web';
}

/**
 * The one reading. `get` is `Headers.get` or anything shaped like it, so the
 * middleware, a route handler, a server component (through `headers()`) and
 * a proof script all read the same way.
 */
export function platformFromHeaders(get: (name: string) => string | null | undefined): Platform {
  if (get(PLATFORM_HEADER) === 'native') return 'native';
  if (NATIVE_USER_AGENT.test(get('user-agent') ?? '')) return 'native';
  return 'web';
}

export function platformFromRequest(request: { headers?: { get(name: string): string | null } }): Platform {
  // Defensive on purpose: a real Request always has headers, but the route
  // proofs (`scripts/verify-*.mjs`) drive the real handlers with a literal
  // `{ json() }` and must keep working; a request with no headers is simply
  // the web.
  const headers = request?.headers;
  if (!headers || typeof headers.get !== 'function') return 'web';
  return platformFromHeaders((name) => headers.get(name));
}

/**
 * Whether a purchase link or an upgrade sentence may be shown. Every gated
 * surface asks this and nothing else reads the platform for it. The argument
 * is required: there is no build-time default any more, so a caller cannot
 * pick up a stale answer by omission.
 */
export function purchaseLinksAllowed(platform: Platform): boolean {
  return platform === 'web';
}

/**
 * Whether the Google sign-in button may be shown. Hidden in the app until
 * native sign-in ships (STORE_PATH.md S1): Google refuses OAuth inside an
 * embedded web view, so the button would only fail there.
 */
export function googleSignInAllowed(platform: Platform): boolean {
  return platform === 'web';
}
