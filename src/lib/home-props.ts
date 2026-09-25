import type { Locale } from '@/lib/i18n'
import { purchaseLinksAllowed } from '@/lib/platform'
import type { PluralForms } from '@/lib/i18n/plural'
import type {
  OnboardingStep,
  QuotaMeter,
  SubjectProgress,
} from '@/components/dashboard/StudentHome'
import type { ActivityItem, RecentActivityLabels } from '@/components/dashboard/RecentActivity'

/**
 * The label + href assembly for <StudentHome/>, shared by the real dashboard page
 * and by `/preview/student-home`.
 *
 * WHY THIS MODULE EXISTS. StudentHome is deliberately dumb — no i18n dict, no
 * Supabase — because local dev writes to the PRODUCTION database and a component
 * that fetches its own data cannot be looked at safely. That contract means both
 * callers must do the same label resolution, and the preview would silently drift
 * from the real screen the first time a key changed. Doing it once here means the
 * screen Abo Jad judges is the screen students get, with only the DATA differing.
 *
 * It takes a translation object and returns plain strings. It never touches the
 * database and never imports a Supabase client.
 */

// The `home` slice of the dictionary, structurally. Typed from the dictionary
// itself rather than restated, so a renamed key fails `tsc` here instead of
// rendering `undefined` on the page.
type HomeDict = {
  welcome: string
  talkAgentTitle: string
  talkAgentDesc: string
  newSubject: string
  newKbDesc: string
  streakLabel: string
  streakUnit: PluralForms
  streakZoneHint: string
  recentActivity: string
  noActivity: string
  conversation: string
  showLess: string
  viewAll: string
  unknownKb: string
  planTitle: string
  planFree: string
  planPro: string
  questionsLeft: string
  uploadsLeft: string
  ofWord: string
  subjectsUsed: string
  allSubjects: string
  materialsWord: string
  noSubjects: string
  noSubjectsDesc: string
  startTitle: string
  step1Title: string
  step1Desc: string
  step2Title: string
  step2Desc: string
  step3Title: string
  step3Desc: string
  whatTitle: string
  whatLine1: string
  whatLine2: string
  whatLine3: string
  upgradeCta: string
}

export interface HomeLabelsInput {
  home: HomeDict
  subjectsNavLabel: string
  isPro: boolean
  /** Already resolved through `pluralize` by the caller, or '' beside the ghost. */
  streakUnit: string
  /** The Continue card's three sentences (#85, `dashboard.continueCard`). */
  cont: { title: string; body: string; cta: string }
}

export function buildHomeLabels({ home, subjectsNavLabel, isPro, streakUnit, cont }: HomeLabelsInput) {
  const activity: RecentActivityLabels = {
    noActivity: home.noActivity,
    conversation: home.conversation,
    showLess: home.showLess,
    viewAll: home.viewAll,
    unknownKb: home.unknownKb,
  }

  return {
    continueTitle: cont.title,
    continueBody: cont.body,
    continueCta: cont.cta,
    welcome: home.welcome,
    askTitle: home.talkAgentTitle,
    askDesc: home.talkAgentDesc,
    newSubject: home.newSubject,
    newSubjectDesc: home.newKbDesc,
    subjects: subjectsNavLabel,
    streakLabel: home.streakLabel,
    streakUnit,
    streakZoneHint: home.streakZoneHint,
    recentActivity: home.recentActivity,
    planTitle: home.planTitle,
    planName: isPro ? home.planPro : home.planFree,
    ofWord: home.ofWord,
    subjectsUsed: home.subjectsUsed,
    allSubjects: home.allSubjects,
    materialsWord: home.materialsWord,
    noSubjects: home.noSubjects,
    noSubjectsDesc: home.noSubjectsDesc,
    startTitle: home.startTitle,
    whatTitle: home.whatTitle,
    whatLines: [home.whatLine1, home.whatLine2, home.whatLine3],
    upgradeCta: home.upgradeCta,
    activity,
  }
}

export function buildHrefs(locale: Locale) {
  return {
    askHref: `/${locale}/dashboard/agent`,
    newSubjectHref: `/${locale}/dashboard/knowledge/new`,
    subjectsHref: `/${locale}/dashboard/knowledge`,
    // Null in the store build: no purchase link inside the app (Apple 3.1.1(a)).
    upgradeHref: purchaseLinksAllowed() ? `/${locale}/pricing` : null,
  }
}

/**
 * The three-step path. `done` is derived from real counts, so the path empties
 * itself as the student works and disappears entirely once all three are true —
 * a working account does not carry onboarding forever.
 */
export function buildOnboarding(
  home: HomeDict,
  locale: Locale,
  counts: { subjects: number; materials: number; conversations: number },
): OnboardingStep[] {
  const h = buildHrefs(locale)
  return [
    { key: 'subject', title: home.step1Title, desc: home.step1Desc, done: counts.subjects > 0, href: h.newSubjectHref },
    { key: 'upload', title: home.step2Title, desc: home.step2Desc, done: counts.materials > 0, href: h.subjectsHref },
    { key: 'ask', title: home.step3Title, desc: home.step3Desc, done: counts.conversations > 0, href: h.askHref },
  ]
}

/**
 * The daily quotas, as REMAINING rather than used.
 *
 * `usage_counters.day` defaults to `current_date`, which is SERVER UTC. Naming a
 * day ("3 of 10 used today") is therefore false for this entire audience — a
 * student at 00:30 in Morocco is on the previous UTC day — and this project has
 * already paid for that exact bug once in the try-again-tomorrow copy. Remaining
 * counts carry no day word at all, so the copy cannot lie even though the counter
 * underneath it still buckets in UTC. Fixing the BUCKET is register #80's job.
 */
export function buildQuotas(
  home: HomeDict,
  used: { query: number; upload: number },
  caps: { query: number; upload: number },
): QuotaMeter[] {
  const clamp = (n: number) => (n < 0 ? 0 : n)
  return [
    { key: 'questions', label: home.questionsLeft, remaining: clamp(caps.query - used.query), total: caps.query },
    { key: 'uploads', label: home.uploadsLeft, remaining: clamp(caps.upload - used.upload), total: caps.upload },
  ]
}

export type { OnboardingStep, QuotaMeter, SubjectProgress, ActivityItem }
