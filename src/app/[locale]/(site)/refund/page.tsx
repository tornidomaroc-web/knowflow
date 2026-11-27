import { Locale } from '@/lib/i18n';
import { SUPPORT_EMAIL } from '@/lib/site';
import { PlatformText } from '@/components/platform/PlatformText';
import { AppStoreOnly } from '@/components/legal/AppStoreOnly';
import { APPLE_REFUND_URL } from '@/lib/iap/terms';

export default async function RefundPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return (
    <div className="py-24" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto px-6 text-muted-foreground text-start [text-wrap:pretty]">
        <h1 className="text-[2rem] leading-[1.2] sm:text-5xl font-bold mb-4 text-foreground">Refund Policy</h1>
        <p className="text-sm uppercase tracking-wide font-medium text-primary mb-12">Last updated: November 2026</p>

        {/* Step Wording-1: the app's twin (reached only by URL, its footer has no Refund link)
            names no plan and no other way to pay (3.1.1). It no longer says "nothing is sold or
            charged inside this app": from build 9 the app sells KnowFlow Pro through the App Store.
            Item 4j, store step 2: Paddle's refunds are for purchases on this website only; the
            App Store section shows on the web always and in the app only where the KnowFlowStore
            plugin answers (build 9), marked (AppStoreOnly). */}
        <PlatformText
          web={<>
          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 1: Free Plan</h2>
          <p className="mb-6">No charges apply to the free plan. No refund is necessary.</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 2: Pro Plan</h2>
          <p className="mb-6">KnowFlow Pro bought on this website is sold through Paddle, which is the merchant of record for those purchases, so refunds for them are requested from Paddle and decided by Paddle. To ask for one, contact Paddle Order Support at <a className="underline" href="https://paddle.net">paddle.net</a> with the email address on your account. You can also write to us at {SUPPORT_EMAIL} and we will raise it with Paddle for you. The <a className="underline" href="https://www.paddle.com/legal/refund-policy">refund policy Paddle publishes</a> applies; we do not add a separate window of our own.</p>

          <AppStoreRefund heading="Section 3: App Store Purchases" />

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 4: Cancelling</h2>
          <p className="mb-6">You can cancel a subscription bought on this website at any time from Settings in your dashboard. Cancelling stops any future charge, and you keep Pro until the end of the period you have already paid for. An App Store subscription is cancelled in your Apple Account settings instead (Section 3).</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Section 5: Contact</h2>
          <p className="mb-6">For any billing questions, contact: {SUPPORT_EMAIL}</p>
          </>}
          app={<>
            <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Refunds</h2>
            <p className="mb-6">Any payment made for a KnowFlow account is governed by the terms shown when it is made.</p>
            <AppStoreRefund heading="App Store purchases" />
            <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">Contact</h2>
            <p className="mb-6">For any question about your account, contact: {SUPPORT_EMAIL}</p>
          </>}
        />
      </div>
    </div>
  );
}

/**
 * The App Store refund and cancelling section: the same bytes on the web
 * (Section 3) and in build 9 (marked), never in build 8 or Android. It names
 * no other way to pay (3.1.1), types no price, and its one link is in running
 * text (the 44 pt control rule exempts it).
 */
function AppStoreRefund({ heading }: { heading: string }) {
  return (
    <AppStoreOnly mark="refund">
      <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground">{heading}</h2>
      <p className="mb-6">If you subscribed to KnowFlow Pro in the KnowFlow app for iPhone or iPad, Apple took the payment through the App Store. Refunds for App Store purchases are requested from Apple and decided by Apple, under Apple&apos;s rules: you can ask for one at <a className="underline" href={APPLE_REFUND_URL}>reportaproblem.apple.com</a>. We cannot refund an App Store purchase ourselves.</p>
      <p className="mb-6">To stop the next renewal, cancel the subscription in your Apple Account settings at least 24 hours before the end of the current period. You keep KnowFlow Pro until the end of the period you have paid for. Deleting your KnowFlow account does not cancel an App Store subscription.</p>
    </AppStoreOnly>
  );
}
