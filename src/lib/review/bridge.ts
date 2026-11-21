import { shellVersionFromHeaders } from '@/lib/platform';

/**
 * THE RATING BRIDGE (iOS 1.1, big item 4h), the same shape as
 * src/lib/auth/apple-bridge.ts: reached through `window.Capacitor`, which the
 * iOS shell injects into every page. No `@capacitor/core` import, no package.
 *
 * THE GATE: shell 2 or later (read from navigator.userAgent after mount, by
 * the server's own parser), the native bridge, iOS, AND the `KnowFlowReview`
 * plugin answering. PR 2 adds the plugin (ios/App/App/KnowFlowReview.swift);
 * until a binary carries it this returns null everywhere, so PR 1 is dormant.
 * A new plugin, not a method on KnowFlowStore: a shell-2 binary built before
 * PR 2 answers for KnowFlowStore without the method, and the gate would pass.
 *
 * Who gets null: the web (no window.Capacitor); build 8 (`KnowFlowApp/1`);
 * the Android shell (it also says `KnowFlowApp/2`, but getPlatform() is
 * android and the plugin is absent); a forged `KnowFlowApp/2` in a browser.
 * Even a page that misbehaved and called request() in a loop is capped by
 * Apple at 3 sheets in 365 days, and the sheet reads nothing from the page.
 *
 * Two methods only. `available` resolves the app's CFBundleShortVersionString
 * and opens nothing. `request` asks StoreKit (AppStore.requestReview(in:),
 * SKStoreReviewController on iOS 15) and tells the page nothing back: Apple
 * never says whether a sheet showed. It is called from ONE place, the quiz
 * result's ReviewTrigger, and never from a tap (Apple: "don't call ... in
 * response to a button tap"). The Settings row is a link instead.
 */
export const REVIEW_PLUGIN = 'KnowFlowReview';

/** The first shell that may carry the plugin (build 9's marker). */
export const REVIEW_SHELL_VERSION = 2;

/**
 * Apple's persistent write-review link for KnowFlow (App Store id
 * 6820418649), the documented form: "Append the query parameter
 * action=write-review". Capacitor hands a top-level navigation off the app's
 * host to UIApplication.open, so iOS opens the App Store app on this page.
 * The only copy in src.
 */
export const WRITE_REVIEW_URL = 'https://apps.apple.com/app/id6820418649?action=write-review';

export type ReviewAvailability = { available: boolean; version: string | null };

export type ReviewBridge = {
  available: () => Promise<ReviewAvailability>;
  request: () => Promise<unknown>;
};

type NativeBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options: object) => Promise<unknown>;
};

export function reviewShellAllowed(shellVersion: number): boolean {
  return Number.isInteger(shellVersion) && shellVersion >= REVIEW_SHELL_VERSION;
}

export function reviewBridge(userAgent: string = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? ''): ReviewBridge | null {
  if (!reviewShellAllowed(shellVersionFromHeaders((name) => (name === 'user-agent' ? userAgent : null)))) return null;
  const C = (globalThis as { Capacitor?: NativeBridge }).Capacitor;
  if (!C?.isNativePlatform?.()) return null;
  if (!C.getPlatform || C.getPlatform() !== 'ios') return null;
  if (!C.isPluginAvailable?.(REVIEW_PLUGIN) || !C.nativePromise) return null;
  const native = C.nativePromise;
  return {
    available: async () => {
      try {
        const r = (await native(REVIEW_PLUGIN, 'available', {})) as { available?: unknown; version?: unknown } | null;
        const version = r && typeof r === 'object' && typeof r.version === 'string' && r.version.trim() !== '' && r.version.length <= 32 ? r.version : null;
        return { available: !!r && typeof r === 'object' && r.available === true && version !== null, version };
      } catch {
        return { available: false, version: null };
      }
    },
    request: () => native(REVIEW_PLUGIN, 'request', {}),
  };
}
