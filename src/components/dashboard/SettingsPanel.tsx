import Link from 'next/link';
import { Badge, Card, buttonVariants } from '@/components/ui';

interface SettingsPanelLabels {
  title: string;
  account: string;
  email: string;
  plan: string;
  free: string;
  pro: string;
  renews: string;
  upgrade: string;
  activeSubscription: string;
}

export interface SettingsPanelProps {
  email: string;
  isPro: boolean;
  /** Formatted renewal date, or null when not applicable. Shown only for Pro. */
  renewsOn: string | null;
  upgradeHref: string;
  labels: SettingsPanelLabels;
}

/**
 * Settings — dumb, presentational. Tier/renewal/email arrive as plain props from
 * the server wrapper (which is the sole caller of getEntitlement). Pure content:
 * the dashboard `<main>` (P2.7) owns the light canvas + padding.
 */
export function SettingsPanel({ email, isPro, renewsOn, upgradeHref, labels }: SettingsPanelProps) {
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
              {isPro && renewsOn && (
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
            {isPro && (
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.activeSubscription}
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
