import Link from 'next/link';
import { PlatformText } from '@/components/platform/PlatformText';
import { ClayAnswer, ClayBrandMark, ClayChat, ClayFile, ClayShield } from '@/components/clay/ClayIcons';
import { useTranslation, Locale } from '@/lib/i18n';
import { keepLastTwo } from '@/lib/separator';

/**
 * About (site and app twin: native/(site)/about re-exports this page).
 *
 * Design "C", PR 3: the body in the landing's language under the existing
 * chrome, the same text. The title block, the mission on a clay card, the
 * four tools as clay tiles of one structure (a tinted clay picture, the name,
 * one line), and the closing call on the dark card with the gold button, as
 * the landing ends. Every line is balanced (text-wrap is inherited), so no
 * heading or card ends on a word alone; the design-c render asserts it.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';
  const mark = isRtl ? '؟' : '?';
  // One picture per tool, in order: files to text, meaning, answers, privacy.
  const art = [<ClayFile key="f" />, <ClayChat key="c" />, <ClayAnswer key="a" mark={mark} />, <ClayShield key="s" />];
  const eyebrow = 'text-[0.8125rem] font-bold text-accent';

  return (
    <div data-kf-about className="py-6 [text-wrap:balance] lg:py-16" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-3xl space-y-[1.625rem] px-[1.125rem] md:px-6 lg:space-y-14">
        <section className="text-start lg:text-center">
          <h1 className="text-[2rem] font-extrabold leading-[1.2] text-foreground sm:text-5xl">{t.about.title}</h1>
          <p className="mt-3.5 text-[1.0625rem] font-medium leading-[1.6] text-muted-foreground lg:text-lg">{t.about.subtitle}</p>
        </section>

        <section className="kf-card rounded-3xl p-5 lg:p-8">
          <h2 className={eyebrow}>{t.about.missionLabel}</h2>
          <p className="mt-2 text-[1.25rem] font-bold leading-[1.55] text-foreground lg:text-2xl">{t.about.mission}</p>
        </section>

        <section>
          <h2 className={`${eyebrow} mb-3.5`}>{t.about.giants}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {t.about.tools.map((tool, idx) => (
              <div key={idx} data-kf-about-tool="" className="kf-card flex items-start gap-3.5 rounded-[1.375rem] p-4">
                {/* The tint tokens are global; `.kf-tint-*` is the app's scope only. */}
                <span className="kf-chip inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.875rem]" style={{ backgroundColor: `var(--tint-${(idx % 3) + 1})` }}>{art[idx]}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-foreground">{tool.title}</h3>
                  <p className="mt-0.5 text-sm font-medium text-muted-foreground">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="kf-ask flex flex-col items-center gap-3.5 rounded-[1.875rem] px-5 py-7 text-center lg:py-12">
          <ClayBrandMark />
          <h2 className="text-[1.625rem] font-extrabold text-[color:var(--clay-ask-fg)] lg:text-3xl">{keepLastTwo(t.about.ctaTitle)}</h2>
          <Link href={`/${locale}/signup`} className="kf-gold inline-flex min-h-[3.375rem] items-center justify-center rounded-full px-[1.875rem] text-base font-extrabold">
            {/* Step Wording-1: the app's twin may not say "free". */}
            <PlatformText web={t.about.cta} app={t.nav.createAccount} />
          </Link>
        </section>
      </div>
    </div>
  );
}
