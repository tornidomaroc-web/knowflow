'use client';

import Link from 'next/link';
import { Card, buttonVariants } from '@/components/ui';
import { LatinText } from '@/components/ui/LatinText';
import { ClaySectionTitle } from '@/components/clay/ClaySectionTitle';
import { ClayStar } from '@/components/clay/ClayIcons';
import { cn } from '@/lib/utils';
import { useIap, useStore } from './IapProvider';

/** The paywall's address (src/app/[locale]/dashboard/pro/page.tsx). Never /pricing. */
export function paywallHref(locale: string): string {
  return `/${locale}/dashboard/pro`;
}

/** Whether an entry point may show: shell 2 (the provider exists), not Pro, and the plugin answers. */
function useOfferVisible(): { visible: boolean; locale: string; label: string } {
  const iap = useIap();
  const { call } = useStore();
  if (!iap || !iap.offer) return { visible: false, locale: 'en', label: '' };
  return { visible: !!call || !!iap.preview, locale: iap.locale, label: iap.offerLabel };
}

/** The refusal codes the offer follows (src/lib/rate-limit.ts, src/lib/ai-allowance.ts). */
export const OFFER_REFUSALS: readonly string[] = ['daily-limit', 'ai-allowance-used'];

/** Whether a refusal code is one Pro lifts. */
export function offersPro(code: unknown): boolean {
  return typeof code === 'string' && OFFER_REFUSALS.includes(code);
}

/**
 * THE BUTTON UNDER A DAILY-LIMIT OR AI-ALLOWANCE REFUSAL (shell 2 only).
 * Rendered by the refusal surfaces whenever the refusal carries the code
 * `daily-limit` or `ai-allowance-used`; it shows nothing on the web, in
 * build 8, for a Pro account, or without the plugin. A link to the paywall
 * inside the app, never to a web purchase page (3.1.1).
 */
export function ProOfferButton({ className }: { className?: string }) {
  const { visible, locale, label } = useOfferVisible();
  if (!visible) return null;
  return (
    <span data-kf-iap="offer" className={cn('mt-3 block', className)}>
      <Link href={paywallHref(locale)} className={cn(buttonVariants({ variant: 'secondary' }), 'w-full sm:w-auto')}>
        <LatinText text={label} />
      </Link>
    </span>
  );
}

/** Settings, shell 2, a free account: the plan card's place, one card, one button. */
export function ProOfferCard({ title, body, button }: { title: string; body: string; button: string }) {
  const { visible, locale } = useOfferVisible();
  if (!visible) return null;
  return (
    <Card data-kf-iap="plan" className="p-5">
      <ClaySectionTitle icon={<ClayStar />}>
        <LatinText text={title} />
      </ClaySectionTitle>
      <p className="mt-3 text-sm text-muted-foreground">
        <LatinText text={body} />
      </p>
      <Link href={paywallHref(locale)} className={cn(buttonVariants({ variant: 'primary' }), 'mt-4 w-full sm:w-auto')}>
        <LatinText text={button} />
      </Link>
    </Card>
  );
}
