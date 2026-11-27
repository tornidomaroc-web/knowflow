/**
 * WHERE THE APP STORE TERMS LIVE (Apple 3.1.2; item 4j, store step 1).
 *
 * One id, one href: the "App Store subscriptions" section of /terms
 * (src/components/legal/AppStoreTerms.tsx) carries this id, and the
 * paywall's Terms link (src/app/[locale]/dashboard/pro/page.tsx) points at
 * it, so the link a student taps beside the buy button lands on the clauses
 * that govern that purchase. scripts/verify-terms-iap.mjs holds the two
 * together.
 */
export const APP_STORE_TERMS_ID = 'app-store-subscriptions';

/** Apple's standard Licensed Application End User License Agreement. */
export const APPLE_STANDARD_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export function appStoreTermsHref(locale: string): string {
  return `/${locale}/terms#${APP_STORE_TERMS_ID}`;
}
