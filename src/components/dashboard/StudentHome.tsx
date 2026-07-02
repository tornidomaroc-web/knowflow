import Link from 'next/link';
import { ArrowRight, Flame, MessageCircle, Plus } from 'lucide-react';
import { Card } from '@/components/ui';
import { RecentActivity, type ActivityItem, type RecentActivityLabels } from './RecentActivity';

interface StudentHomeStat {
  label: string;
  value: number;
  desc: string;
}

interface StudentHomeLabels {
  welcome: string;
  askTitle: string;
  askDesc: string;
  newSubject: string;
  newSubjectDesc: string;
  subjects: string;
  streakLabel: string;
  streakUnit: string;
  recentActivity: string;
  activity: RecentActivityLabels;
}

export interface StudentHomeProps {
  stats: StudentHomeStat[];
  /** Current study streak. Static 0 today — Phase 5 wires real tracking. */
  streak: number;
  askHref: string;
  newSubjectHref: string;
  subjectsHref: string;
  labels: StudentHomeLabels;
  recentActivity: ActivityItem[];
}

/**
 * Student home — dumb, presentational. All data/labels arrive as plain props
 * (no i18n dict, no Supabase) so the shell can be reused/storybooked in Phase 8.
 *
 * First CONTENT screen to go light: the root paints its own light canvas
 * (`bg-background`) so every heading, card, and label sits on a light surface
 * with dark tokens — nothing inherits the layout's legacy `text-white`, so
 * nothing vanishes. The dark `<main>` still shows in its fixed-bar padding
 * gutter; that final gutter closes when the whole layout flips light at the end
 * of Phase 2 (un-migrated sibling screens still need the dark main until then).
 */
export function StudentHome({
  stats,
  streak,
  askHref,
  newSubjectHref,
  subjectsHref,
  labels,
  recentActivity,
}: StudentHomeProps) {
  return (
    <div className="rounded-2xl bg-background p-4 text-foreground md:p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{labels.welcome}</h1>
        </header>

        {/* Primary "Ask" entry + streak placeholder */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href={askHref}
            className="group flex items-center justify-between gap-4 rounded-xl bg-primary p-6 text-primary-foreground shadow-soft transition-colors hover:bg-primary-hover md:col-span-2"
          >
            <div className="min-w-0">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="text-lg font-semibold">{labels.askTitle}</p>
              <p className="mt-1 text-sm text-primary-foreground/80">{labels.askDesc}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </Link>

          {/*
            Streak placeholder — intentionally inert. Renders whatever `streak`
            is passed (0 today); the muted flame + neutral unit avoid implying
            live tracking before Phase 5 wires it.
          */}
          <Card className="flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.streakLabel}
              </span>
              <Flame className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3">
              <span className="text-4xl font-semibold text-foreground">{streak}</span>
              <span className="ms-2 text-sm text-muted-foreground">{labels.streakUnit}</span>
            </p>
          </Card>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, desc }) => (
            <Card key={label} className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </section>

        {/* Subjects quick-access */}
        <section className="space-y-3">
          <Link
            href={subjectsHref}
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-primary"
          >
            {labels.subjects}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </Link>
          <Link
            href={newSubjectHref}
            className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-soft transition-colors hover:border-primary"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <Plus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{labels.newSubject}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{labels.newSubjectDesc}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </Link>
        </section>

        {/* Recent activity */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.recentActivity}
          </h2>
          <RecentActivity items={recentActivity} labels={labels.activity} />
        </section>
      </div>
    </div>
  );
}
