import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, FileText, LifeBuoy, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge, Card, buttonVariants } from '@/components/ui';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ENDONYM, locales, switchLocaleHref, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface SettingsPanelLabels {
  title: string;
  subtitle: string;
  account: string;
  email: string;
  plan: string;
  free: string;
  pro: string;
  freePlanDesc: string;
  proPlanDesc: string;
  renews: string;
  /** Shown INSTEAD of `renews` once a cancellation is scheduled. */
  cancels: string;
  upgrade: string;
  activeSubscription: string;
  preferences: string;
  language: string;
  appearance: string;
  themeDark: string;
  themeLight: string;
  helpLegal: string;
  privacyPolicy: string;
  terms: string;
  support: string;
  supportDesc: string;
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
  /**
   * Where Upgrade goes, or NULL when no purchase link may be shown. The page
   * decides from `purchaseLinksAllowed()` (Apple 3.1.1(a), src/lib/platform.ts):
   * on the web a free student gets the button; in the store build the plan
   * card is status only. Null, not a boolean beside a string, so a caller
   * cannot pass an href and forget the gate.
   */
  upgradeHref: string | null;
  locale: Locale;
  /** This page's own path, so the language links keep the student here. */
  pathname: string;
  privacyHref: string;
  termsHref: string;
  supportEmail: string;
  labels: SettingsPanelLabels;
  /** The cancel-subscription card, Pro only; rendered after Preferences. */
  subscriptionCard?: ReactNode;
  /** The delete-account card; rendered last, as the destructive action should be. */
  deleteCard: ReactNode;
}

/**
 * Settings (register #46) — dumb, presentational, and built for the store
 * shell first. Tier, dates and the upgrade href arrive as plain props from the
 * server wrapper (the sole caller of getEntitlement); nothing here reads a
 * cookie, a session or an environment variable.
 *
 * ORDER, AND WHY. Account (who you are) → Plan (what you have) → Preferences
 * (language and appearance, the two things a student changes most) → the
 * subscription exit for Pro → help and the legal pages Apple 5.1.1(i) wants
 * reachable inside the app → delete, last, because the destructive action must
 * come after the gentler ones (register #70).
 *
 * THE PLAN CARD IS STATUS ONLY UNLESS `upgradeHref` IS GIVEN. That is the
 * whole of Apple 3.1.1(a) on this screen: no button, no link, no sentence that
 * points at a purchase outside the app. The web passes the href; the native
 * build passes null.
 */
export function SettingsPanel({
  email,
  isPro,
  renewsOn,
  cancelsOn,
  upgradeHref,
  locale,
  pathname,
  privacyHref,
  termsHref,
  supportEmail,
  labels,
  subscriptionCard,
  deleteCard,
}: SettingsPanelProps) {
  const initial = (email.trim()[0] ?? '?').toUpperCase();

  return (
    <div>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{labels.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
        </header>

        {/* ── Account ── */}
        <Card className="p-5">
          <SectionLabel>{labels.account}</SectionLabel>
          <div className="mt-4 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-lg font-bold text-primary"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{labels.email}</p>
              <p className="truncate text-sm font-medium text-foreground" dir="ltr">
                {email}
              </p>
            </div>
          </div>
        </Card>

        {/* ── Plan ── */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>{labels.plan}</SectionLabel>
            <Badge variant={isPro ? 'primary' : 'neutral'}>{isPro ? labels.pro : labels.free}</Badge>
          </div>
          <div className="mt-4 rounded-xl bg-raised p-4">
            <p className="text-base font-semibold text-foreground">{isPro ? labels.pro : labels.free}</p>
            <p className="mt-1 text-sm text-muted-foreground">{isPro ? labels.proPlanDesc : labels.freePlanDesc}</p>
            {isPro && cancelsOn && (
              <p className="mt-3 text-xs text-muted-foreground">
                {labels.cancels} {cancelsOn}
              </p>
            )}
            {isPro && !cancelsOn && (
              <p className="mt-3 text-xs text-muted-foreground">
                {/* Suppressed once a cancellation is scheduled: "Active subscription"
                    beside "Cancels on" reads as a contradiction. */}
                <span className="font-medium text-success">{labels.activeSubscription}</span>
                {renewsOn && (
                  <>
                    {' · '}
                    {labels.renews} {renewsOn}
                  </>
                )}
              </p>
            )}
          </div>
          {!isPro && upgradeHref && (
            <Link href={upgradeHref} className={cn(buttonVariants({ variant: 'primary' }), 'mt-4 w-full sm:w-auto')}>
              <Sparkles className="h-4 w-4" />
              {labels.upgrade}
            </Link>
          )}
        </Card>

        {/* ── Preferences ── */}
        <Card className="p-5">
          <SectionLabel>{labels.preferences}</SectionLabel>
          <div className="mt-2 divide-y divide-border">
            <PreferenceRow label={labels.language}>
              {/* The locale is the path, so each option is a LINK to this page in
                  that language; the middleware remembers whichever is followed
                  (register #83). `lang` on each so a screen reader says it right. */}
              <div role="group" aria-label={labels.language} className="inline-flex rounded-xl border border-border bg-raised p-1">
                {locales.map((l) => {
                  const selected = l === locale;
                  return (
                    <Link
                      key={l}
                      href={selected ? pathname : switchLocaleHref(locale, pathname)}
                      lang={l}
                      aria-current={selected ? 'true' : undefined}
                      className={cn(
                        'inline-flex h-10 min-w-[6rem] items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected ? 'bg-surface text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {ENDONYM[l]}
                    </Link>
                  );
                })}
              </div>
            </PreferenceRow>
            <PreferenceRow label={labels.appearance}>
              <ThemeToggle labels={{ appearance: labels.appearance, dark: labels.themeDark, light: labels.themeLight }} />
            </PreferenceRow>
          </div>
        </Card>

        {subscriptionCard}

        {/* ── Help and legal. Apple 5.1.1(i): the privacy policy must be reachable
            inside the app; the terms and a support address belong beside it. ── */}
        <Card className="p-5">
          <SectionLabel>{labels.helpLegal}</SectionLabel>
          <ul className="mt-2 divide-y divide-border">
            <LinkRow href={privacyHref} icon={ShieldCheck} label={labels.privacyPolicy} />
            <LinkRow href={termsHref} icon={FileText} label={labels.terms} />
            <LinkRow href={`mailto:${supportEmail}`} icon={LifeBuoy} label={labels.support} detail={supportEmail} external />
          </ul>
        </Card>

        {deleteCard}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  // Weight and colour carry the hierarchy; no tracking utility, so the label
  // sets the same in both scripts (register #101).
  return <h2 className="text-xs font-semibold uppercase text-muted-foreground">{children}</h2>;
}

function PreferenceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </div>
  );
}

function LinkRow({
  href,
  icon: Icon,
  label,
  detail,
  external = false,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
  detail?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {detail && (
          <span className="block truncate text-xs text-muted-foreground" dir="ltr">
            {detail}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint rtl:-scale-x-100" />
    </>
  );
  const className =
    'flex min-h-[3.5rem] items-center gap-3 py-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg';
  return (
    <li>
      {external ? (
        <a href={href} className={className}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={className}>
          {inner}
        </Link>
      )}
    </li>
  );
}
