import type { Locale } from '@/lib/i18n';
import type { Tier } from '@/types';

/**
 * The one place every limit message a student can read is written (register #1).
 *
 * WHY SERVER-SIDE AND NOT A DICTIONARY KEY THE CLIENT RENDERS. Register #1's own
 * disposition names the remedy: "needs locale plumbed into API routes", and
 * register #27 already shipped it for `/api/summarize`, which takes `locale` in
 * its body and whitelists it here-style. Two of the four walls this closes cannot
 * be done any other way without a contract change: `/api/agent`'s monthly
 * conversation limit returns 200 and STREAMS its text as an assistant message
 * (register #8), so there is no status for a client to branch on, and its daily
 * limit returns text/plain that ChatBox renders verbatim. Threading locale reaches
 * all four with no response-shape change and no client rendering logic.
 *
 * WHAT IS DELIBERATELY NOT HERE. `/api/summarize` and `/api/quiz/generate` already
 * have localized 429 copy in the dictionaries, which their clients render by
 * mapping the status (`SummarySection.tsx`, `QuizSection.tsx`). Those clients never
 * read the server's string. `enforceLimit` still builds one for them, because the
 * function has one contract for four kinds and a silently-English arm would be the
 * thing that rots.
 *
 * NUMERALS ARE 0-9 IN BOTH LOCALES, and the Arabic is phrased so the count never
 * governs the noun: "حدك اليومي من الأسئلة: 10" needs no CLDR plural category,
 * unlike `streakUnit`. That is why there is no `plural.ts` call here.
 *
 * NO PRICE APPEARS ANYWHERE. The price is undecided (register #80). A Pro user at
 * a ceiling is never shown an upgrade line, because there is nothing above them.
 */

export type LimitKind = 'query' | 'upload' | 'summary' | 'quiz';

/** Nouns, definite plural in Arabic so the numeral never inflects them. */
const NOUN: Record<Locale, Record<LimitKind, string>> = {
  en: { query: 'questions', upload: 'uploads', summary: 'summaries', quiz: 'quizzes' },
  ar: { query: 'الأسئلة', upload: 'الملفات المرفوعة', summary: 'الملخصات', quiz: 'الاختبارات' },
};

/**
 * The reset is UTC midnight, because `usage_counters.day` defaults to
 * `current_date` on a UTC database. "Tomorrow" was false for anyone east of UTC
 * in their local small hours: at 02:00 in the Gulf the counter clears at 04:00
 * the SAME local day. Naming the instant is true in every timezone.
 */
const DAILY_RESET: Record<Locale, string> = {
  en: 'It resets at 00:00 UTC.',
  ar: 'يعاد ضبط الحد عند 00:00 بتوقيت UTC.',
};

const MONTHLY_RESET: Record<Locale, string> = {
  en: 'It resets on the 1st at 00:00 UTC.',
  ar: 'يعاد ضبط الحد في اليوم الأول من الشهر عند 00:00 بتوقيت UTC.',
};

/** Shown to free users only. States what Pro gives, never what it costs. */
const UPGRADE: Record<Locale, string> = {
  en: 'Pro has higher limits.',
  ar: 'خطة Pro تتيح حدودا أعلى.',
};

const UPGRADE_MATERIALS: Record<Locale, string> = {
  en: 'Pro subjects hold more.',
  ar: 'خطة Pro تتيح عددا أكبر.',
};

function join(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

export function dailyLimitMessage(
  locale: Locale,
  kind: LimitKind,
  cap: number,
  tier: Tier
): string {
  const noun = NOUN[locale][kind];
  const head =
    locale === 'ar'
      ? `بلغت حدك اليومي من ${noun}: ${cap}.`
      : `You've reached today's limit of ${cap} ${noun}.`;
  return join([head, DAILY_RESET[locale], tier === 'pro' ? '' : UPGRADE[locale]]);
}

export function monthlyConversationMessage(
  locale: Locale,
  cap: number,
  tier: Tier
): string {
  const head =
    locale === 'ar'
      ? `بلغت حدك الشهري من المحادثات: ${cap}.`
      : `You've reached this month's limit of ${cap} conversations.`;
  return join([head, MONTHLY_RESET[locale], tier === 'pro' ? '' : UPGRADE[locale]]);
}

export function subjectMaterialsMessage(
  locale: Locale,
  cap: number,
  tier: Tier
): string {
  const head =
    locale === 'ar'
      ? `بلغت هذه المادة حدها من الملفات: ${cap}.`
      : `This subject already holds its limit of ${cap} materials.`;
  return join([head, tier === 'pro' ? '' : UPGRADE_MATERIALS[locale]]);
}

/** Burst guard. Not a quota: the student is fine, they are just too fast. */
export const TOO_FAST: Record<Locale, string> = {
  en: 'You are sending requests too quickly. Please wait a moment and try again.',
  ar: 'ترسل الطلبات بسرعة كبيرة. انتظر لحظة ثم حاول مجددا.',
};

/** Fail-closed outage. Not the student's fault and never an upgrade prompt. */
export const TEMPORARILY_UNAVAILABLE: Record<Locale, string> = {
  en: 'Service is temporarily unavailable. Please try again shortly.',
  ar: 'الخدمة غير متاحة مؤقتا. حاول مجددا بعد قليل.',
};
