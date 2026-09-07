import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Card, buttonVariants } from '@/components/ui';

interface SettingsPanelLabels {
  title: string;
  account: string;
  email: string;
  plan: string;
  free: string;
  pro: string;
  renews: string;
  /** Shown INSTEAD of `renews` once a cancellation is scheduled. */
  cancels: string;
  upgrade: string;
  activeSubscription: string;
}

export interface SettingsPanelProps {
  email: string;
  isPro: boolean;
  /** Formatted renewal date, or null when not applicable. Shown only for Pro. */
  renewsOn: string | null;
  /**
   * Formatted date the subscription runs until once a cancellation is
   * SCHEDULED, or null. Non-null replaces the renewal line: telling a customer
   * who has just cancelled that their plan "renews" on that date would be
   * exactly backwards, and it is the same date.
   *
   * Null also covers "we could not ask Paddle" - see readScheduledCancellation.
   * The page degrades to the plain entitlement rather than to an error.
   */
  cancelsOn: string | null;
  upgradeHref: string;
  labels: SettingsPanelLabels;
  /**
   * Extra cards rendered below the plan card, inside the same column so they
   * inherit its width and spacing. The delete-account affordance arrives this
   * way rather than as a prop bundle: it is interactive and stateful, and this
   * component stays dumb.
   */
  children?: ReactNode;
}

/**
 * Settings — dumb, presentational. Tier/renewal/email arrive as plain props from
 * the server wrapper (which is the sole caller of getEntitlement). Pure content:
 * the dashboard `<main>` (P2.7) owns the light canvas + padding.
 */
export function SettingsPanel({
  email,
  isPro,
  renewsOn,
  cancelsOn,
  upgradeHref,
  labels,
  children,
}: SettingsPanelProps) {
  return (
    <div>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{labels.title}</h1>

        <Card className="p-6">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.account}
          </h2>
          <p className="text-xs text-muted-foreground">{labels.email}</p>
          <p className="mt-1 text-sm text-foreground">{email}</p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.plan}
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Badge variant={isPro ? 'primary' : 'neutral'}>{isPro ? labels.pro : labels.free}</Badge>
              {isPro && cancelsOn && (
                <span className="text-xs text-muted-foreground">
                  {labels.cancels} {cancelsOn}
                </span>
              )}
              {isPro && !cancelsOn && renewsOn && (
                <span className="text-xs text-muted-foreground">
                  {labels.renews} {renewsOn}
                </span>
              )}
            </div>
            {!isPro && (
              <Link href={upgradeHref} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                {labels.upgrade}
              </Link>
            )}
            {/* Suppressed once a cancellation is scheduled: the subscription is
                still active, but "Active subscription" beside "Cancels on" reads
                as a contradiction, and the cancel card below already says
                plainly what happens next. */}
            {isPro && !cancelsOn && (
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.activeSubscription}
              </span>
            )}
          </div>
        </Card>

        {children}
      </div>
    </div>
  );
}
