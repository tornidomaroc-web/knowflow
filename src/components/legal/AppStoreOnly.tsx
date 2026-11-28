'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { purchaseLinksAllowed } from '@/lib/platform';
import { storeBridge } from '@/lib/iap/bridge';
import { appStoreTermsMode } from '@/components/legal/AppStoreTerms';

/**
 * APP STORE COPY ON /privacy AND /refund (item 4j, store step 2).
 *
 * The same gate as the App Store section of /terms (AppStoreTerms.tsx, #357),
 * for the pieces of the other two legal pages that name the App Store
 * purchase: the processor line and the deletion line on /privacy, the refund
 * and cancelling section on /refund.
 *
 *   - the web: in the server markup, unmarked (the page App Store Connect
 *     links and the reviewer opens in a browser);
 *   - the app: NOTHING in the server markup, because /privacy and /refund are
 *     one prerendered twin for build 8 and build 9 (and the Android shell).
 *     After mount, and only where the KnowFlowStore plugin answers (build 9),
 *     the piece appears inside `data-kf-iap="<mark>"`, where the shell-2
 *     wording rule allows purchase words (scripts/lib/app-wording.mjs).
 *     Build 8 and Android never draw it (3.1.3(f)).
 *
 * The decision is appStoreTermsMode, unchanged, so the three legal pages can
 * never disagree about who sees App Store copy. Every piece carries
 * `data-kf-app-store-legal="<mark>"` so the proofs (scripts/verify-legal-iap.mjs,
 * design-c legal.mjs) find it whether marked or not.
 *
 * The children name no other way to pay (3.1.1) and type no price.
 */
export type AppStoreOnlyTag = 'li' | 'p' | 'span' | 'div';

export function AppStoreOnly({ mark, as = 'div', className, children }: { mark: string; as?: AppStoreOnlyTag; className?: string; children: ReactNode }) {
  const web = purchaseLinksAllowed(usePlatform());
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    if (appStoreTermsMode(web, storeBridge() !== null) === 'marked') setInApp(true);
  }, [web]);

  if (!web && !inApp) return null;
  const Tag = as;
  // The mark sits on the piece itself: an <li> stays a direct child of its <ul>.
  return (
    <Tag className={className} data-kf-app-store-legal={mark} {...(web ? {} : { 'data-kf-iap': mark })}>
      {children}
    </Tag>
  );
}
