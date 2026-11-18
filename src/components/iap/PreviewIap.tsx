import type { ReactNode } from 'react';
import { IapProvider } from './IapProvider';

/**
 * DESIGN PREVIEWS ONLY (preview/ask, preview/subject, preview/camera): the
 * in-app Pro context as the dashboard layout gives it to a free account at
 * shell 2, as if the StoreKit plugin answered, so the "See Pro" button under
 * a daily-limit or AI-allowance refusal can be drawn (scripts/design-c/iap.mjs).
 * `on` is false for the web and build 8: the children are returned as they
 * are, the same tree as before.
 */
export function PreviewIap({ on, locale, offerLabel, children }: { on: boolean; locale: string; offerLabel: string; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <IapProvider userId="00000000-0000-4000-8000-000000000000" offer locale={locale} offerLabel={offerLabel} preview>
      {children}
    </IapProvider>
  );
}
