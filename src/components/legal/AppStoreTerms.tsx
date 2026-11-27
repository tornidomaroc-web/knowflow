'use client';

import { useEffect, useState } from 'react';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { purchaseLinksAllowed } from '@/lib/platform';
import { storeBridge } from '@/lib/iap/bridge';
import { APP_STORE_TERMS_ID, APPLE_STANDARD_EULA } from '@/lib/iap/terms';

/**
 * THE APP STORE SUBSCRIPTION TERMS (Apple 3.1.2; item 4j, store step 1).
 *
 * WHO SEES IT. /terms is prerendered, and its app twin
 * (src/app/[locale]/native/(site)/terms) is ONE page for build 8 and build 9,
 * so the server cannot tell the two shells apart there. The section names a
 * subscription, a price and Pro, which the app's wording rule
 * (scripts/lib/app-wording.mjs) forbids in build 8 everywhere and allows in
 * build 9 only inside an element marked `data-kf-iap`. So:
 *
 *   - the web: in the server markup, unmarked, like the rest of the page.
 *     This is the page the App Store metadata links and the reviewer opens
 *     in a browser;
 *   - the app: NOTHING in the server markup. After mount, and only where the
 *     KnowFlowStore plugin answers (src/lib/iap/bridge.ts: registered by the
 *     iOS shell from build 9 only; absent in build 8 and in the Android shell,
 *     which also sends `KnowFlowApp/2`), the section appears inside
 *     `data-kf-iap="terms"`. Build 8 never draws it: the same rule as every
 *     other purchase surface (src/components/iap/IapProvider.tsx).
 *
 * The text is the same bytes in both places, and it names no other way to
 * pay (3.1.1) and types no price (the App Store shows it).
 *
 * The paywall's Terms link ends in `#app-store-subscriptions`. On the web the
 * browser scrolls to it; in the app the section arrives after mount, so it
 * scrolls itself into view when the address asks for it.
 */
/**
 * The one decision, kept pure so scripts/verify-terms-iap.mjs can hold it:
 * `plain` on the web, `marked` in the app where the plugin answers, else
 * nothing.
 */
export function appStoreTermsMode(web: boolean, pluginAnswers: boolean): 'plain' | 'marked' | null {
  if (web) return 'plain';
  return pluginAnswers ? 'marked' : null;
}

export function AppStoreTerms() {
  const web = purchaseLinksAllowed(usePlatform());
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    if (appStoreTermsMode(web, storeBridge() !== null) === 'marked') setInApp(true);
  }, [web]);

  useEffect(() => {
    if (inApp && window.location.hash === `#${APP_STORE_TERMS_ID}`) {
      document.getElementById(APP_STORE_TERMS_ID)?.scrollIntoView({ block: 'start' });
    }
  }, [inApp]);

  if (web) return <AppStoreTermsSection />;
  if (!inApp) return null;
  return (
    <div data-kf-iap="terms">
      <AppStoreTermsSection />
    </div>
  );
}

export function AppStoreTermsSection() {
  return (
    <section data-kf-terms-app-store="" aria-labelledby={APP_STORE_TERMS_ID}>
      <h2 id={APP_STORE_TERMS_ID} className="text-2xl font-semibold mt-8 mb-4 text-foreground scroll-mt-24">App Store subscriptions</h2>
      <p className="mb-4">This section applies when you subscribe to KnowFlow Pro inside the KnowFlow app for iPhone or iPad, through Apple&apos;s App Store.</p>
      <ul className="mb-6 space-y-3 list-disc ps-6">
        <li><strong>The subscription.</strong> KnowFlow Pro is an auto-renewable subscription with a period of one month.</li>
        <li><strong>The price.</strong> The App Store shows the price, in your own currency, before you confirm the purchase.</li>
        <li><strong>Payment.</strong> Payment is charged to your Apple Account when you confirm the purchase.</li>
        <li><strong>Renewal.</strong> The subscription renews automatically each month unless you cancel it at least 24 hours before the end of the current period. Your Apple Account is charged for the next month within the 24 hours before the current period ends.</li>
        <li><strong>Managing and cancelling.</strong> You can manage the subscription and turn off automatic renewal at any time in your Apple Account settings. When you cancel, you keep KnowFlow Pro until the end of the period you have paid for.</li>
        <li><strong>Refunds.</strong> Refunds for App Store purchases are handled by Apple, under Apple&apos;s rules.</li>
        <li><strong>Deleting your account.</strong> Deleting your KnowFlow account does not cancel an App Store subscription. Cancel it in your Apple Account settings as well.</li>
      </ul>
      {/* A paragraph, not a list item: a link in running text is exempt from the 44 pt control rule (design-c audit). */}
      <p className="mb-6"><strong>Apple&apos;s licence.</strong> Apple&apos;s standard <a className="underline" href={APPLE_STANDARD_EULA}>Licensed Application End User License Agreement</a> also applies to your use of the app.</p>
    </section>
  );
}
