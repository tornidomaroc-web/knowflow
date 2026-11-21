/**
 * UNIVERSAL LINKS (iOS 1.1, big item 4g). The apple-app-site-association file
 * tryknowflow.com serves at /.well-known/apple-app-site-association (the route
 * in src/app/.well-known/), and a pure matcher with Apple's own rule, so the
 * route and its proof (scripts/verify-universal-links.mjs) share ONE source.
 *
 * A NARROW ALLOWLIST, ON PURPOSE. Apple's CDN refreshes this file about once a
 * week after install and offers no invalidation (TN3155), so a wrong include
 * reaches students for a week. Exactly two links open the app: the confirm
 * sign-up mail and the reset password mail, both token_hash links that verify
 * server-side and need nothing from the browser that asked for them. The rest
 * stays in the browser:
 * - `?code=`: the Google OAuth return. Its PKCE verifier is in the browser that
 *   started the sign-in; handed to the app it would fail and break the web
 *   sign-in. Excluded explicitly, so nothing depends on whether iOS opens an
 *   app on a redirect.
 * - `?error=`: a refused link is answered where it was opened.
 * - everything else, the dashboard included: a Paddle checkout returning to
 *   the dashboard would otherwise pull a paying web student into the app.
 *
 * Apple's rule ("components", applinks.Details.Components): the FIRST matching
 * component decides; `exclude: true` keeps the URL in the browser; a URL no
 * component matches is not opened in the app (the final catch-all says so
 * explicitly). `*` matches any run of characters, `?` exactly one, so `?*` is
 * "at least one character". Query items the dictionary does not name (the
 * mail links' `locale=`) do not stop a match. `comment` is ignored by Apple.
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
            '/': '/api/auth/callback',
            '?': { code: '?*' },
            exclude: true,
            comment: 'OAuth return: its PKCE verifier is in the browser that started it',
          },
          {
            '/': '/api/auth/callback',
            '?': { error: '?*' },
            exclude: true,
            comment: 'a refused link is answered where it was opened',
          },
          {
            '/': '/api/auth/callback',
            '?': { token_hash: '?*', type: 'signup' },
            comment: 'Confirm sign-up mail',
          },
          {
            '/': '/api/auth/callback',
            '?': { token_hash: '?*', type: 'recovery' },
            comment: 'Reset password mail',
          },
          {
            '/': '*',
            exclude: true,
            comment: 'everything else stays in the browser',
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
