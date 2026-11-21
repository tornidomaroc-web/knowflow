'use client';

import { useEffect, useState } from 'react';
import { ClayChat } from '@/components/clay/ClayIcons';
import { LinkRow } from '@/components/dashboard/LinkRow';
import { LatinText } from '@/components/ui/LatinText';
import { WRITE_REVIEW_URL, reviewBridge } from '@/lib/review/bridge';

/**
 * "Rate KnowFlow" in Settings, the last row of Help and legal (iOS 1.1, big
 * item 4h). Apple allows "a persistent link to your App Store product page in
 * your app's settings", with `action=write-review`; it is also the only
 * compliant answer to a tap, since the StoreKit prompt must never follow a
 * button. So this is a plain link (LinkRow's `<a>`, no target): Capacitor
 * hands the navigation to iOS and the App Store app opens on the write-review
 * page. It calls no plugin method but `available`.
 *
 * Nothing on the server and nothing until the KnowFlowReview plugin answers
 * (the after-mount pattern of the Apple button): the web, build 8 and a
 * shell-2 binary without the plugin draw the Settings they drew before.
 * The Latin names ("KnowFlow", "App Store") go through LatinText, so in the
 * Arabic lines each is a left-to-right isolate.
 */
export function RateRow({ label, description }: { label: string; description: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const bridge = reviewBridge();
    if (!bridge) return;
    let alive = true;
    void bridge.available().then((r) => {
      if (alive && r.available) setShown(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!shown) return null;
  return (
    <LinkRow
      href={WRITE_REVIEW_URL}
      icon={<ClayChat />}
      label={<LatinText text={label} />}
      description={<LatinText text={description} />}
      external
      mark="rate"
    />
  );
}
