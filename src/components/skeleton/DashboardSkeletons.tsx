'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/components/platform/PlatformProvider';
import type { SkeletonRoute } from './routes';

/**
 * ITEM 4J: THE SCREEN ANSWERS THE TAP AT ONCE.
 *
 * Every dashboard screen is rendered per request (the session, the
 * entitlement, RLS reads in eu-west-1 from functions in iad1), so a tab tap
 * waited 1.3 to 2.1 s on build 9 with nothing moving (ios-signed-in
 * 45696193733). These are the `loading.tsx` screens of the five segments that
 * wait on the server: Next shows them the moment the tap is taken (a tab link
 * prefetches its loading screen while it is on screen), inside the real
 * chrome, so the tab bar stays where it is and only the canvas changes.
 *
 * THE SHAPE OF THE REAL PAGE, NOT A SPINNER (the owner's brief): the same
 * containers with the same classes, paddings and gaps as the screen they
 * stand for (StudentHome, SubjectsList, the subject page, Ask, SettingsPanel),
 * so the title, the first card and the tab bar do not jump when the data
 * arrives. No text at all (no new string, nothing to translate or to read
 * aloud wrongly); `aria-busy` on the region. Clay throughout: the cards are
 * the real `kf-card` / `kf-ask` / `kf-streak` surfaces and the placeholders
 * are pressed-in "bones" (`.kf-bone`, globals.css), light and dark from the
 * theme tokens, mirrored under RTL by logical properties only.
 *
 * Motion: a slow opacity breath on the bones, only under
 * `prefers-reduced-motion: no-preference` (globals.css). The design-c renders
 * run with reduced motion, so they show the resting picture.
 *
 * `data-kf-skeleton` names the screen; design-c check 32 reads it.
 */

/** A pressed-in placeholder. `ask`: on the dark ask card. */
function Bone({ className, ask = false }: { className?: string; ask?: boolean }) {
  return <span aria-hidden="true" className={cn('block rounded-full', ask ? 'kf-bone-ask' : 'kf-bone', className)} />;
}

/** A line of text: the line box of the real text, the bone inside it. */
function Line({ box, bone, ask = false }: { box: string; bone: string; ask?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('flex items-center', box)}>
      <Bone ask={ask} className={bone} />
    </span>
  );
}

function Region({ route, className, children }: { route: SkeletonRoute; className?: string; children: ReactNode }) {
  return (
    <div data-kf-skeleton={route} aria-busy="true" className={className}>
      {children}
    </div>
  );
}

/** The large title of a screen (`.kf-title`: 34/41, 36/44 from md). */
function Title({ bone = 'h-8 w-44' }: { bone?: string }) {
  return <Line box="h-[2.5625rem] md:h-11" bone={bone} />;
}

/** A section title (ClaySectionTitle: the clay icon and a 17 px heading). */
function SectionTitle({ bone = 'h-4 w-32' }: { bone?: string }) {
  return (
    <span aria-hidden="true" className="flex h-8 items-center gap-2.5">
      <Bone className="h-8 w-8 shrink-0 !rounded-[0.625rem]" />
      <Bone className={bone} />
    </span>
  );
}

/** The home (StudentHome, an account with material): greeting, ask card, two-up, allowance, continue. */
export function HomeSkeleton() {
  const web = usePlatform() === 'web';
  return (
    <Region route="home" className="max-w-6xl space-y-[1.125rem]">
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0 flex-1">
          <Line box="h-5" bone="h-3 w-11/12 max-w-md" />
          <Line box="h-5 md:hidden rtl:hidden" bone="h-3 w-3/5" />
          <Line box="mt-1 h-10" bone="h-7 w-56 max-w-full" />
          {web && <Bone className="mt-2 h-6 w-16" />}
        </div>
        <Bone className="h-11 w-11 shrink-0" />
      </header>
      <div className="kf-ask flex items-center gap-2 rounded-[1.75rem] px-[1.125rem] py-[1.375rem]">
        <div className="min-w-0 flex-1">
          <Line ask box="h-[1.8rem]" bone="h-5 w-3/5" />
          <Line ask box="mt-1.5 h-[1.4rem]" bone="h-3 w-4/5" />
          <Line ask box="h-[1.4rem] md:hidden rtl:hidden" bone="h-3 w-1/2" />
          <Bone ask className="mt-4 h-[2.875rem] w-44" />
        </div>
        <Bone ask className="h-[4.75rem] w-[4.75rem] shrink-0" />
      </div>
      <section className="grid grid-cols-2 gap-3.5">
        {['kf-streak rounded-3xl', 'kf-card'].map((surface) => (
          <div key={surface} className={cn(surface, 'flex min-w-0 flex-col p-4')}>
            <span aria-hidden="true" className="flex h-[3.25rem] w-14 items-end">
              <Bone className="h-11 w-11 !rounded-2xl" />
            </span>
            <Line box="mt-2 h-[1.625rem]" bone="h-4 w-3/4" />
            <span aria-hidden="true" className="mt-1 flex min-h-[2.25rem] flex-col justify-center gap-1.5">
              <Bone className="h-2.5 w-11/12" />
              <Bone className="h-2.5 w-1/2" />
            </span>
          </div>
        ))}
      </section>
      <section className="kf-card p-[1.125rem]">
        <Line box="h-6" bone="h-4 w-36" />
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-w-0 flex-col items-center">
              <Bone className="h-[58px] w-[58px]" />
              <Line box="mt-2 h-6" bone="h-4 w-12" />
              <Line box="mt-0.5 h-4" bone="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </section>
      <section className="kf-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-4">
          <Bone className="h-11 w-11 shrink-0 !rounded-xl" />
          <div className="min-w-0">
            <Line box="h-5" bone="h-3.5 w-44" />
            <Line box="mt-0.5 h-5" bone="h-3 w-36" />
            <Line box="mt-0.5 h-4" bone="h-2.5 w-20" />
          </div>
        </div>
        <Bone className="h-11 w-32" />
      </section>
    </Region>
  );
}

/** One subject card of the list (SubjectsList's SubjectCard, with materials). */
function SubjectCardSkeleton() {
  return (
    <div className="kf-card flex flex-col p-4 md:p-5">
      <div className="flex items-center gap-3.5">
        <Bone className="h-[3.25rem] w-[3.25rem] shrink-0 !rounded-[1.0625rem]" />
        <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center">
          <Line box="h-7" bone="h-5 w-2/3" />
          <Line box="mt-0.5 h-5" bone="h-3 w-1/2" />
          <Bone className="mt-1.5 h-6 w-10 sm:hidden" />
        </div>
        <Bone className="h-[52px] w-[52px] shrink-0 sm:hidden" />
        <Bone className="hidden h-7 w-12 shrink-0 sm:block" />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Bone className="hidden h-16 w-16 shrink-0 sm:block" />
        <div className="grid w-full flex-1 grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="kf-tile flex flex-col p-3">
              <Bone className="h-4 w-4 !rounded-md" />
              <Line box="mt-1 h-4" bone="h-2.5 w-3/4" />
              <Line box="mt-1 h-7" bone="h-5 w-6" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Line box="h-4" bone="h-2.5 w-32" />
        <div className="flex items-center gap-2">
          <Bone className="h-11 w-24" />
          <Bone className="h-11 w-11" />
        </div>
      </div>
    </div>
  );
}

/** The subjects list (SubjectsList): title, line, "new subject", the cards. */
export function SubjectsSkeleton() {
  return (
    <Region route="subjects" className="max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full md:w-auto">
          <Title bone="h-8 w-40" />
          <Line box="mt-1 h-5" bone="h-3 w-4/5 md:w-80" />
          <Line box="h-5 md:hidden rtl:hidden" bone="h-3 w-1/2" />
        </div>
        <Bone className="h-11 w-36" />
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <SubjectCardSkeleton key={i} />
        ))}
      </div>
    </Region>
  );
}

/** One material card (MaterialCard): file chip, name, kit, the study buttons. */
function MaterialCardSkeleton() {
  return (
    <div className="kf-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <Bone className="h-11 w-11 shrink-0 !rounded-xl" />
        <div className="min-w-0 flex-1">
          <Line box="h-5" bone="h-3.5 w-3/5" />
          <Line box="mt-0.5 h-4" bone="h-2.5 w-2/5" />
        </div>
        <Bone className="h-6 w-14 shrink-0" />
      </div>
      <Bone className="mt-3 h-10 w-full !rounded-xl" />
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Bone className="h-11 w-full !rounded-xl" />
        <Bone className="h-11 w-full !rounded-xl" />
      </div>
    </div>
  );
}

/** A subject (the subject page): header card, the upload tile, the materials. */
export function SubjectSkeleton() {
  return (
    <Region route="subject">
      <div className="max-w-5xl space-y-6">
        <div className="kf-card rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Bone className="hidden h-[72px] w-[72px] shrink-0 !rounded-2xl sm:block" />
              <div className="min-w-0">
                <Title bone="h-8 w-52 max-w-full" />
                <Line box="mt-1 h-5" bone="h-3 w-40" />
              </div>
            </div>
            <Bone className="h-11 w-56 max-w-full !rounded-xl" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
            {[0, 1, 2].map((i) => (
              <div key={i} className="kf-tile flex flex-col rounded-xl p-3">
                <Bone className="h-[18px] w-[18px] !rounded-md" />
                <Line box="mt-1 h-4" bone="h-2.5 w-3/4" />
                <Line box="mt-1 h-6" bone="h-5 w-6" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="kf-streak flex min-h-[4.75rem] w-full items-center gap-3.5 rounded-[1.375rem] px-4 py-3.5">
            <Bone className="h-11 w-11 shrink-0 !rounded-xl" />
            <span aria-hidden="true" className="min-w-0 flex-1">
              <Line box="h-6" bone="h-4 w-1/2" />
              <Line box="mt-0.5 h-5" bone="h-3 w-2/5" />
            </span>
          </div>
          <Line box="h-5 justify-center" bone="h-2.5 w-3/5 max-w-xs" />
          <Line box="h-5 justify-center" bone="h-2.5 w-1/3 max-w-[10rem]" />
        </div>
        <section className="space-y-3">
          <Line box="h-4" bone="h-2.5 w-20" />
          <div className="space-y-3">
            <MaterialCardSkeleton />
            <MaterialCardSkeleton />
          </div>
        </section>
      </div>
    </Region>
  );
}

/** Ask (the agent page): the large title in the app, the Ask card at the page's own height. */
export function AskSkeleton() {
  const native = usePlatform() === 'native';
  return (
    <Region
      route="ask"
      className={native
        ? 'flex flex-col h-[calc(100dvh-1.25rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)]'
        : 'flex flex-col h-[calc(100dvh-4.5rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)]'}
    >
      {native && <Line box="mb-3 h-[2.5625rem] shrink-0" bone="h-8 w-24" />}
      <div className="kf-card flex min-h-0 flex-1 overflow-hidden rounded-xl">
        <div className="kf-well my-2 ms-2 hidden w-64 shrink-0 rounded-[1.25rem] md:block" />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-3">
            <Bone className="h-11 w-11 shrink-0 md:hidden" />
            <Bone className="h-11 w-36 shrink-0" />
            <Bone className="h-11 w-32 shrink-0" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Bone className="h-9 w-9 shrink-0 !rounded-xl" />
            <span aria-hidden="true" className="min-w-0">
              <Line box="h-4" bone="h-2.5 w-20" />
              <Line box="h-5" bone="h-3.5 w-32" />
            </span>
          </div>
          <div className="kf-well mx-2 flex min-h-0 flex-1 flex-col items-center overflow-hidden rounded-[1.25rem] p-4 md:p-6">
            <Bone className="h-14 w-14 shrink-0" />
            <Line box="mt-2 h-7" bone="h-4 w-3/5 max-w-xs" />
            <Line box="mt-1 h-5" bone="h-3 w-2/3 max-w-sm" />
            <div className="mt-5 w-full max-w-lg space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="kf-card flex h-[4.5rem] items-center gap-3 !rounded-[1.25rem] px-4">
                  <Bone className="h-9 w-9 shrink-0 !rounded-xl" />
                  <span aria-hidden="true" className="min-w-0 flex-1 space-y-2">
                    <Bone className="h-3 w-11/12" />
                    <Bone className="h-3 w-1/2" />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="shrink-0 p-3 pb-6 md:p-4">
            <div className="kf-well flex h-[4.5rem] items-end justify-end rounded-2xl p-2">
              <Bone className="h-11 w-11 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </Region>
  );
}

/** Settings (SettingsPanel): title, account, preferences, then the app's reminder or the web's plan. */
export function SettingsSkeleton() {
  const web = usePlatform() === 'web';
  return (
    <Region route="settings" className="max-w-3xl space-y-6">
      <header>
        <Title bone="h-8 w-40" />
        <Line box="mt-1 h-5" bone="h-3 w-56 max-w-full" />
      </header>
      <div className="kf-card p-5">
        <SectionTitle bone="h-4 w-24" />
        <div className="mt-4 flex items-center gap-4">
          <Bone className="h-12 w-12 shrink-0" />
          <span aria-hidden="true" className="min-w-0 flex-1">
            <Line box="h-4" bone="h-2.5 w-12" />
            <Line box="h-5" bone="h-3.5 w-48 max-w-full" />
          </span>
        </div>
        <div className="mt-3 flex min-h-[3.5rem] items-center gap-3 py-2">
          <Bone className="h-9 w-9 shrink-0 !rounded-lg" />
          <Line box="h-5 flex-1" bone="h-3.5 w-24" />
        </div>
      </div>
      {web ? (
        <div className="kf-card p-5">
          <SectionTitle bone="h-4 w-16" />
          <div className="kf-tile mt-4 rounded-xl p-4">
            <Line box="h-6" bone="h-4 w-16" />
            <Line box="mt-1 h-5" bone="h-3 w-4/5" />
          </div>
          <Bone className="mt-4 h-11 w-full !rounded-xl sm:w-40" />
        </div>
      ) : null}
      <div className="kf-card p-5">
        <SectionTitle bone="h-4 w-28" />
        <div className="mt-4 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Line box="h-5" bone="h-3.5 w-24" />
              <Bone className="h-[3.875rem] w-full !rounded-[1.375rem]" />
            </div>
          ))}
        </div>
      </div>
      {!web ? (
        <div className="kf-card p-5">
          <SectionTitle bone="h-4 w-32" />
          <span aria-hidden="true" className="mt-3 block space-y-2">
            <Bone className="h-3 w-11/12" />
            <Bone className="h-3 w-4/5" />
            <Bone className="h-3 w-3/5" />
          </span>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Line box="h-5" bone="h-3.5 w-36" />
            <Bone className="h-8 w-14 shrink-0" />
          </div>
        </div>
      ) : null}
    </Region>
  );
}

const BY_ROUTE: Record<SkeletonRoute, () => ReactNode> = {
  home: HomeSkeleton,
  subjects: SubjectsSkeleton,
  subject: SubjectSkeleton,
  ask: AskSkeleton,
  settings: SettingsSkeleton,
};

/** The design preview's entry: one skeleton by name. */
export function DashboardSkeleton({ route }: { route: SkeletonRoute }) {
  const Screen = BY_ROUTE[route];
  return <Screen />;
}
