import { PRO_LIMITS } from '@/lib/limits';
import { DAILY_CAPS } from '@/lib/rate-limit';
import type { PaywallFigures } from '@/components/iap/Paywall';

/**
 * WHAT THE PAYWALL SAYS PRO GIVES, READ FROM THE CODE THAT ENFORCES IT, so the
 * screen cannot promise a number the server does not grant: subjects and files
 * per subject (src/lib/limits.ts, PRO_LIMITS), questions and uploads a day
 * (src/lib/rate-limit.ts, DAILY_CAPS.pro). Summaries and quizzes are the same
 * in both tiers (5 a day), so they are not offered as a Pro gain.
 *
 * "Up to": the AI allowance (src/lib/ai-allowance.ts, 5.00 USD per 30 days
 * for Pro) can refuse before a daily figure is reached when a month is spent
 * on long summaries and large files; every figure is a ceiling, never a
 * promise of that many every day.
 */
export function proFigures(): PaywallFigures {
  return {
    subjects: PRO_LIMITS.knowledge_bases,
    materials: PRO_LIMITS.documents,
    questions: DAILY_CAPS.pro.query,
    uploads: DAILY_CAPS.pro.upload,
  };
}
