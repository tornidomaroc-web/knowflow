import type { CapacitorConfig } from '@capacitor/cli';

/**
 * THE APP IS A NATIVE SHELL OVER THE LIVE SITE (docs/store/STORE_PATH.md,
 * step b; the decision is §1.1 and §8.3 of that file).
 *
 * `server.url` points the web view at tryknowflow.com, so the app shows the
 * same server-rendered pages, cookies and API routes as the web, from one
 * deploy. The server tells the two shells apart by ONE marker, the user-agent
 * token appended below (`src/lib/platform.ts`): with it, the middleware
 * rewrites the signed-out pages to their `/native/` twins (no Pricing link,
 * no Google button) and sends the landing and /pricing to the dashboard;
 * every signed-in page reads it per request. Nothing else identifies the
 * app, and nothing on the server has to change for the app to be recognised
 * (step a, bfd8c7b).
 *
 * Capacitor's reference says of `server.url`: "This is not intended for use
 * in production." That is the framework disclaiming the bridge on a remote
 * origin, and `.github/workflows/ios-smoke.yml` is the check: it starts the
 * app in a simulator and reads `window.Capacitor` inside a page served from
 * tryknowflow.com. If that reading ever turns false, the fallback is the
 * bundled build (STORE_PATH.md §1.1), not a workaround here.
 *
 * `webDir` is NOT the app. It holds two static files that `cap sync` copies
 * into the shell: `index.html`, which Capacitor requires a web directory to
 * have and which the shell never shows while `server.url` is set (the launch
 * storyboard covers the first load), and `offline.html`, which
 * `server.errorPath` shows when a page load fails (no network). Neither
 * reaches the web.
 *
 * `allowNavigation` keeps the web view on the site: any other host, an
 * external link in the footer for instance, opens in the system browser
 * (Capacitor's default for a host outside this list), which is also what a
 * student expects of a link to GitHub or to a mail address.
 */
const config: CapacitorConfig = {
  appId: 'com.knowflow.app',
  appName: 'KnowFlow',
  webDir: 'native/www',
  server: {
    url: 'https://tryknowflow.com',
    allowNavigation: ['tryknowflow.com'],
    errorPath: 'offline.html',
  },
  ios: {
    // The marker the server reads (`NATIVE_USER_AGENT_TOKEN` in src/lib/platform.ts
    // followed by a digit). Applied to every request the web view makes:
    // document loads, the router's fetches and the API calls alike.
    appendUserAgent: 'KnowFlowApp/1',
    contentInset: 'automatic',
  },
  android: {
    appendUserAgent: 'KnowFlowApp/1',
  },
};

export default config;
