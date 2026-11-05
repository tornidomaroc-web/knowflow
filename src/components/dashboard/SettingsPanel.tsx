import Link from 'next/link';
import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge, Card, buttonVariants } from '@/components/ui';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ClayAccount, ClayChevron, ClayFile, ClayHelp, ClayMail, ClayShield, ClaySliders, ClayStar } from '@/components/clay/ClayIcons';
import { ClaySectionTitle } from '@/components/clay/ClaySectionTitle';
import { LanguageSegment } from '@/components/dashboard/LanguageSegment';
import type { Locale } from '@/lib/i18n';
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
  renewsOn: string | null;
  cancelsOn: string | null;
  upgradeHref: string | null;
  locale: Locale;
  pathname: string;
  privacyHref: string;
  termsHref: string;
  supportEmail: string;
  labels: SettingsPanelLabels;
  reminderCard?: ReactNode;
  consentCard?: ReactNode;
  subscriptionCard?: ReactNode;
  deleteCard: ReactNode;
  /**
   * Step Redesign-2: the sign-out row in the Account card. The app has no top
   * bar any more, so this is where it signs out; the web shows it too (its
   * sidebar and top bar keep theirs). A client component, handed in by the
   * page as the delete card is, so this panel stays renderable on the server.
   */
  signOutRow?: ReactNode;
}

/**
 * The Settings screen (register #46). Every section is a card with an icon
 * tile; Step Redesign-2 gives it the large title, the clay cards and the
 * Account card's sign-out row, and keeps the plan card for the web and for a
 * Pro student only (Apple 3.1.3(f)).
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
  reminderCard,
  consentCard,
  subscriptionCard,
  deleteCard,
  signOutRow,
}: SettingsPanelProps) {
  const initial = (email.trim()[0] ?? '?').toUpperCase();

  return (
    <div>
      {/* Every line of Settings is balanced (design "C", PR 2; text-wrap is
          inherited), so no card ends on a word alone: the design-c render
          asserts it. */}
      <div className="max-w-3xl space-y-6 [text-wrap:balance]">
        <header>
          <h1 className="kf-title text-2xl font-bold text-foreground md:text-3xl">{labels.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
        </header>

        {/* ── Account ── */}
        <Card className="rise p-5">
          <ClaySectionTitle icon={<ClayAccount />}>{labels.account}</ClaySectionTitle>
          <div className="mt-4 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="kf-chip inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-lg font-bold text-primary"
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
          {/* Design "C", PR 3: no hairline between the address and the sign-out
              row; the space and the row's own pill separate them. */}
          {signOutRow && <div className="mt-3">{signOutRow}</div>}
        </Card>

        {/* ── Plan ── Apple 3.1.3(f), measured in the simulator 2026-10-08: inside
            the app a free student gets no plan card (its "Free" names a tier
            that exists only where it can be bought). A Pro student keeps it
            everywhere: the renewal and cancellation status is management, not
            a call to action. */}
        {(isPro || upgradeHref) && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <ClaySectionTitle icon={<ClayStar />}>{labels.plan}</ClaySectionTitle>
            <Badge variant={isPro ? 'primary' : 'neutral'}>{isPro ? labels.pro : labels.free}</Badge>
          </div>
          <div className="kf-tile mt-4 rounded-xl bg-raised p-4">
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
        )}

        {/* ── Preferences (design "C", PR 2, Prefs.dc.html): the clay sliders and
            the section's name, then each choice as two equal options in a
            pressed-in well, the chosen one a gold clay pill. Same storage as
            before: the language is the path (LanguageSegment), the theme the
            kf-theme cookie (ThemeToggle). ── */}
        <Card className="p-5">
          <ClaySectionTitle icon={<ClaySliders />}>{labels.preferences}</ClaySectionTitle>
          <div className="mt-4 space-y-4">
            <PreferenceRow label={labels.language}>
              <LanguageSegment locale={locale} pathname={pathname} label={labels.language} />
            </PreferenceRow>
            <PreferenceRow label={labels.appearance}>
              <ThemeToggle labels={{ appearance: labels.appearance, dark: labels.themeDark, light: labels.themeLight }} />
            </PreferenceRow>
          </div>
        </Card>

        {reminderCard}

        {consentCard}

        {subscriptionCard}

        {/* ── Help and legal. Apple 5.1.1(i): the privacy policy must be reachable
            inside the app; the terms and a support address belong beside it. ── */}
        <Card className="p-5">
          <ClaySectionTitle icon={<ClayHelp mark={locale === 'ar' ? '؟' : '?'} />}>{labels.helpLegal}</ClaySectionTitle>
          {/* Design "C", PR 3: the rows are clay tiles a few points apart, no
              divider lines (no hairline in "C"). */}
          <ul className="mt-4 space-y-2">
            <LinkRow href={privacyHref} icon={<ClayShield />} label={labels.privacyPolicy} />
            <LinkRow href={termsHref} icon={<ClayFile />} label={labels.terms} />
            {/* #127 (the owner's ruling): the line says how the answer reaches the
                student; the address stays visible under it. */}
            <LinkRow href={`mailto:${supportEmail}`} icon={<ClayMail />} label={labels.support} description={labels.supportDesc} detail={supportEmail} external />
          </ul>
        </Card>

        {deleteCard}
      </div>
    </div>
  );
}

function PreferenceRow({ label, children }: { label: string; children: ReactNode }) {
  // The name above its control at every width (Prefs.dc.html); the control
  // spans the card, its two options equal.
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-foreground">{label}</span>
      {children}
    </div>
  );
}

function LinkRow({
  href,
  icon,
  label,
  description,
  detail,
  external = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  /** A line in the page's language under the label. */
  description?: string;
  /** A left-to-right value (an address) under the label. */
  detail?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
        {detail && (
          <span className="block truncate text-xs text-muted-foreground" dir="ltr">
            {detail}
          </span>
        )}
      </span>
      <ClayChevron className="shrink-0 rtl:-scale-x-100" />
    </>
  );
  const className =
    'kf-tile flex min-h-[3.5rem] items-center gap-3 rounded-[1.125rem] px-3 py-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
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
