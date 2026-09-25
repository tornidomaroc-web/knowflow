import { createClient } from '@/lib/supabase/server';
import { KBSelector } from '@/components/agent/KBSelector';
import { AgentEmptyState } from '@/components/agent/AgentEmptyState';
import { Locale, locales, useTranslation, resolveLocale } from '@/lib/i18n';
import type { KnowledgeBase } from '@/types';

// Thin server wrapper: data only. The chat UI (KBSelector) is a client island;
// the no-subjects case renders the dumb <AgentEmptyState/> (Phase 8 reuse).
export default async function AgentPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = resolveLocale(locale);
  const t = useTranslation(safeLocale);

  const supabase = await createClient();

  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('*')
    .order('created_at', { ascending: false });

  if (!kbs || kbs.length === 0) {
    return (
      <AgentEmptyState
        newHref={`/${safeLocale}/dashboard/knowledge/new`}
        labels={{
          title: t.dashboard.nav.knowledge,
          prompt: t.dashboard.home.newKbDesc,
          cta: t.dashboard.home.newSubject,
        }}
      />
    );
  }

  return (
    /*
      THE ASK SCREEN IS THE ONE DASHBOARD SCREEN WITH A DEFINITE HEIGHT, AND
      THIS LINE IS WHY THE COMPOSER STOPPED SITTING UNDER THE BOTTOM NAV.

      WHAT WAS WRONG. `h-full` here was INERT: the parent `<main>` carries
      `min-h-screen`, and a percentage height resolves against a parent's
      HEIGHT, not its min-height, so this box was auto-sized by its content all
      along. The content was `ChatBox`, which set its own
      `h-[calc(100dvh-100px)]` — a number that cannot be right, because the
      component has no way to know what is above and below it. Adding it up on
      production: 72px of `<main>`'s `pt-[4.5rem]`, plus 61px of KBSelector's
      subject bar, plus 2px of card border, plus the 100dvh-100 itself, put the
      card's bottom edge 35px BELOW the viewport — while a 57px bottom nav was
      fixed over the last 57px of it. `elementFromPoint` at the Send button's
      centre returned a nav <a>, in both locales. The button was not merely
      overlapped: at the initial scroll position its lower half was off-screen.

      WHY A HEIGHT AND NOT MORE PADDING ON THE COMPOSER. Padding was the other
      route and it is the worse one, for a reason that is structural rather than
      cosmetic. Padding makes the card TALLER, so the page still overflows, the
      document still scrolls, and the composer's distance from the nav then
      depends on scroll offset — it would clear the nav at the bottom of the
      scroll and be off-screen at the top, which is where a student arrives. It
      also has to hardcode the nav's height in a component that cannot see the
      nav, so the two numbers drift apart the first time the nav changes.
      Constraining the height fixes the cause: the document no longer overflows
      at all, so there is no scroll position at which the composer can move.

      THE ARITHMETIC, so the next reader can check it rather than trust it.
      `<main>` is `p-4 pb-24 pt-[4.5rem] … md:p-8`, and at >=768px `md:p-8`
      wins outright (Tailwind emits responsive variants after the base
      utilities, same specificity), so the padding to subtract is 4.5rem+6rem
      below md and 4rem at md. Subtracting exactly that makes the document
      exactly 100dvh tall — nothing overflows, nothing scrolls.

      WHY `env(safe-area-inset-bottom)` IS IN THE SUBTRACTION. `MobileNav`
      already pads itself by that same env value, so on a notched phone the nav
      grows downward-anchored and its TOP edge rises by ~34px. Subtracting the
      inset here makes the gap between the card and the nav a CONSTANT 39px
      (96px of `pb-24` minus the nav's 57px of real height) instead of
      39px-minus-the-inset, which would have left only ~5px on an iPhone. No
      fallback value is given because none can be reached: every browser that
      parses `dvh` (2022) has supported `env()` since 2017/18, so there is no
      engine that would see this as invalid and drop it.
    */
    <div className="flex flex-col h-[calc(100dvh-4.5rem-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)]">
      {/*
        The <Database> generic types `language` as `string | null` because
        knowledge_bases.language is bare `text` with NO check constraint — the
        'ar' | 'en' | 'both' domain is held by the APP (the typed <select> in the
        KB-create form is the sole writer), not by the database. This narrowing
        cast asserts that application invariant; it is not DB-guaranteed, so a
        row written outside the web app could violate it.
      */}
      <KBSelector kbs={kbs as KnowledgeBase[]} />
    </div>
  );
}
