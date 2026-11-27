/**
 * UNIVERSAL LINKS (iOS 1.1, big item 4g). The apple-app-site-association file
 * tryknowflow.com serves at /.well-known/apple-app-site-association (the route
 * in src/app/.well-known/), and a pure matcher with Apple's own rule, so the
 * route and its proof (scripts/verify-universal-links.mjs) share ONE source.
 *
 * NO LINK OPENS THE APP (item 4j, build 9 device finding). From #343 to here
 * the confirm sign-up and reset password mails (`/api/auth/callback?token_hash=
 * …&type=signup|recovery`) were included. On TestFlight build 9 (1.1), with the
 * app installed, the reset mail's link tapped in Gmail for iOS did nothing at
 * all: Gmail stayed in front, no app switch, no browser, and Vercel logged no
 * request to /api/auth/callback. The app's own observer cannot cause that: iOS
 * brings the app forward before any app code sees a link, and the active-app
 * hand-off is proven in the simulator (ios-smoke proof 13, "idle"). Before
 * build 9 the same mail opened in the browser and worked. So both includes are
 * gone and the file is one catch-all exclude: every mail link opens where the
 * mail client opens links, as before build 9. A reset done in Safari ends with
 * a new password the app's login takes; `webcredentials` (below) offers it.
 *
 * Apple's CDN refreshes this file about once a week after install and offers
 * no invalidation (TN3155: "Devices check for updates approximately once per
 * week after app installation. To download a newer version of the AASA file,
 * reinstall the app."), so a device that holds the old file keeps opening the
 * two mail links in the app until it refreshes or the app is reinstalled.
 *
 * Bringing an include back needs a device proof of the mail client first, not
 * a simulator one: the simulator's proof hands the link to SceneDelegateProxy
 * directly and never exercises Gmail or swcd.
 *
 * Apple's rule ("components", applinks.Details.Components): the FIRST matching
 * component decides; `exclude: true` keeps the URL in the browser; a URL no
 * component matches is not opened in the app. `*` matches any run of
 * characters, `?` exactly one. `comment` is ignored by Apple. The entitlement
 * (ios/App/App/App.entitlements) still names applinks:tryknowflow.com; with
 * this file it claims nothing, and dropping it would need a new build.
 *
 * `webcredentials`: iOS offers the password a student saved in Safari inside
 * the app's login, which covers the mail clients that open links in their own
 * browser (no universal link fires there).
 *
 * THIS MODULE IMPORTS NOTHING: production-monitor loads it alone, from the
 * commit Vercel is serving, to know what the live file must be.
 */

/** Team NQ23SMHXJV + bundle com.knowflow.app (capacitor.config.ts). */
export const APP_ID = 'NQ23SMHXJV.com.knowflow.app';

/** The only host the app is associated with. www 307s to it (Apple refuses redirects). */
export const UNIVERSAL_LINK_HOST = 'tryknowflow.com';

type Component = {
  '/': string;
  '?'?: Record<string, string>;
  exclude?: true;
  comment: string;
};

export const AASA: {
  applinks: { details: { appIDs: string[]; components: Component[] }[] };
  webcredentials: { apps: string[] };
} = {
  applinks: {
    details: [
      {
        appIDs: [APP_ID],
        components: [
          {
            '/': '*',
            exclude: true,
            comment: 'every link stays in the browser, the confirm and reset mails included (build 9: Gmail dropped the reset link)',
          },
        ],
      },
    ],
  },
  webcredentials: { apps: [APP_ID] },
};

/** Apple's pattern: `*` any run (empty too), `?` exactly one character. */
function patternMatches(pattern: string, value: string): boolean {
  const source = pattern
    .split('')
    .map((ch) => (ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${source}$`, 's').test(value);
}

/**
 * Would iOS open `url` in the app? True only for https://tryknowflow.com (no
 * port) and only when the first matching component is an include.
 */
export function aasaMatches(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.hostname !== UNIVERSAL_LINK_HOST || u.port !== '') return false;
  for (const component of AASA.applinks.details[0].components) {
    if (!patternMatches(component['/'], u.pathname)) continue;
    const query = component['?'] ?? {};
    const all = Object.entries(query).every(
      ([key, pattern]) => u.searchParams.has(key) && patternMatches(pattern, u.searchParams.get(key) ?? ''),
    );
    if (!all) continue;
    return component.exclude !== true;
  }
  return false;
}
