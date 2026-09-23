import type { Locale } from '@/lib/i18n';
import { pluralize, type PluralForms } from '@/lib/i18n/plural';
import type { Tier } from '@/types';
import { MAX_UPLOAD_BYTES, isOverUploadLimit, type UploadReply } from '@/lib/upload-limits';

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
 * ============================================================================
 * WHY THE COPY STATES TIME REMAINING AND NOT A CLOCK TIME
 * ============================================================================
 * The first version of this module said "It resets at 00:00 UTC." That is TRUE
 * everywhere, and unusable by the student we are building for. Morocco is UTC+1
 * for most of the year and UTC+0 during Ramadan, so a student in Casablanca must
 * know what UTC is, what their offset from it is, and that the offset MOVES,
 * before that sentence tells them anything. Precision the reader cannot decode is
 * not information.
 *
 * Time remaining needs none of that: "it resets in about 3 hours" is true in
 * every timezone, requires no knowledge of where the student is, and is directly
 * actionable — they add three hours to the clock they are already looking at.
 *
 * TWO PROPERTIES THIS DEPENDS ON, BOTH DELIBERATE:
 *
 *  1. ALWAYS ROUND UP (`Math.ceil`). Rounding down would state a time at which
 *     the limit has NOT yet reset — the message would be a lie the student
 *     discovers by coming back and being refused again. Rounding up can only
 *     make us early, never wrong. "about" carries the imprecision honestly.
 *
 *  2. THE GRANULARITY CASCADES minutes → hours → days, so one formatter serves
 *     both the daily reset (always under 24h) and the monthly conversation reset
 *     (up to ~31 days) without either reading absurdly. Minutes never round to
 *     zero: the floor is 1, so the copy never says "in about 0 minutes".
 *
 * The remaining weakness, stated rather than hidden: the string is rendered once
 * and does not tick. It is shown in a transient error surface, not a dashboard,
 * and "about" absorbs the drift. The strictly better answer — render the reset
 * instant in the STUDENT'S OWN local time, client-side — needs a machine-readable
 * timestamp in the response, and neither wall this module exists to fix has a
 * field to put one in: the monthly denial is a 200 text stream and the daily
 * denial is text/plain. That is register #8's contract change, not this one's.
 *
 * WHAT IS DELIBERATELY NOT HERE. The per-subject SUBJECT cap (`knowledge_bases`)
 * is still rendered client-side from the dictionary (`dashboard.newKb.errorLimit*`)
 * because that route never had an English-only wall — register #1 named two routes
 * and this module closes those two. It is the one limit surface not centralised
 * here, and it is named so the next reader does not assume otherwise. (The line
 * under the drop zone, `dashboard.upload.supported`, is dictionary copy too, but
 * its number is not: `DropZone` fills it from `uploadLimitLabel` below.)
 *
 * ============================================================================
 * WHICH NUMBERS MAY BE PRINTED, AND WHICH MAY NOT
 * ============================================================================
 * NO PRICE APPEARS ANYWHERE — undecided (register #80). A Pro user at a ceiling
 * is never shown an upgrade line either, because there is nothing above them.
 *
 * NO PRO DAILY OR MONTHLY FIGURE IS PRINTED. Register #80 records those ceilings
 * as unsettled AND as the largest open cost exposure in the product: Pro's 2,000
 * questions/day is $615/month of inference against $9-11 net revenue, and the
 * monthly conversation ceiling sits in the same unclosed row. They are abuse
 * ceilings we intend to move, so printing one publishes a number we plan to
 * break. A Pro user is told they hit today's limit and when it returns, which is
 * everything they can act on. Free figures ARE printed: they are settled product
 * (the daily 10 shipped as register #80's daily half) and they are the number a
 * student weighing an upgrade actually needs.
 *
 * THE PER-SUBJECT MATERIALS CAP IS THE EXCEPTION AND PRINTS ITS NUMBER IN BOTH
 * TIERS — 10 free, 200 Pro, both ruled publishable. It is a per-subject shelf
 * size, not a rate: knowing it is how a student decides how to split a course.
 *
 * THE UPLOAD SIZE CEILING PRINTS ITS NUMBER TOO, IN BOTH TIERS (register #50). It
 * is the platform's ceiling, not a pricing call, it is the same for every
 * student, and nobody can choose a file to upload without knowing it.
 *
 * ============================================================================
 * ARABIC
 * ============================================================================
 * MSA, Western numerals 0-9, and tanween fatha on accusative adverbs to match the
 * shipped dictionary (`ar.ts` writes مجددًا six times and never مجددا).
 *
 * Counted nouns go through `pluralize`, because Arabic selects among SIX forms and
 * "3 ساعة" or "2 ساعات" is the app misreading its own primary language back at the
 * student — the defect `plural.ts` was written to end. Note the forms below are
 * whole PHRASES, not bare nouns: CLDR's own Arabic patterns drop the numeral at
 * `one` and `two` (ساعة already means "an hour", ساعتين "two hours"), and unlike
 * the streak card there is no numeral/unit typographic split here to preserve, so
 * the form simply omits the `{n}` slot where the language wants it omitted.
 *
 * The dual is ساعتين / يومين / دقيقتين, NOT the ساعتان / يومان that `streakUnit`
 * uses: these sit after بعد, which governs the genitive.
 */

export type LimitKind = 'query' | 'upload' | 'summary' | 'quiz';

/** Nouns, definite plural in Arabic so the numeral never inflects them. */
const NOUN: Record<Locale, Record<LimitKind, string>> = {
  en: { query: 'questions', upload: 'uploads', summary: 'summaries', quiz: 'quizzes' },
  ar: { query: 'الأسئلة', upload: 'الملفات المرفوعة', summary: 'الملخصات', quiz: 'الاختبارات' },
};

type DurationUnit = 'minute' | 'hour' | 'day';

/**
 * Counted-duration forms. `{n}` is replaced with the Western numeral; a form that
 * omits `{n}` is one where the language carries the count in the noun itself.
 */
const DURATION: Record<Locale, Record<DurationUnit, PluralForms>> = {
  en: {
    minute: { one: 'a minute', other: '{n} minutes' },
    hour: { one: 'an hour', other: '{n} hours' },
    day: { one: 'a day', other: '{n} days' },
  },
  ar: {
    minute: { one: 'دقيقة', two: 'دقيقتين', few: '{n} دقائق', many: '{n} دقيقة', other: '{n} دقيقة' },
    hour: { one: 'ساعة', two: 'ساعتين', few: '{n} ساعات', many: '{n} ساعة', other: '{n} ساعة' },
    day: { one: 'يوم', two: 'يومين', few: '{n} أيام', many: '{n} يومًا', other: '{n} يوم' },
  },
};

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Pick the coarsest unit that still reads usefully, rounding UP so the stated
 * time is never earlier than the real reset. Minutes floor at 1.
 */
function amountAndUnit(ms: number): { n: number; unit: DurationUnit } {
  const minutes = Math.max(1, Math.ceil(ms / MINUTE_MS));
  if (minutes < 60) return { n: minutes, unit: 'minute' };
  const hours = Math.ceil(ms / HOUR_MS);
  if (hours < 24) return { n: hours, unit: 'hour' };
  return { n: Math.ceil(ms / DAY_MS), unit: 'day' };
}

/** "3 hours" / "3 ساعات" / "an hour" / "ساعة". Never bare, never zero. */
function durationPhrase(locale: Locale, ms: number): string {
  const { n, unit } = amountAndUnit(ms);
  return pluralize(locale, n, DURATION[locale][unit]).replace('{n}', String(n));
}

/** "It resets in about 3 hours." — the only reset wording the student ever reads. */
function resetClause(locale: Locale, resetAt: Date, now: Date): string {
  const phrase = durationPhrase(locale, Math.max(0, resetAt.getTime() - now.getTime()));
  return locale === 'ar'
    ? `يتجدد الحد بعد نحو ${phrase}.`
    : `It resets in about ${phrase}.`;
}

/** Shown to free users only. States what Pro gives, never what it costs. */
const UPGRADE: Record<Locale, string> = {
  en: 'Pro has higher limits.',
  ar: 'الباقة الاحترافية تتيح حدودًا أعلى.',
};

const UPGRADE_MATERIALS: Record<Locale, string> = {
  en: 'Pro subjects hold more.',
  ar: 'الباقة الاحترافية تتيح عددًا أكبر.',
};

/**
 * WHAT A FULL SUBJECT MAY SAY, AND WHY IT IS A WARNING RATHER THAN ADVICE.
 *
 * An earlier draft said "You can add it to another subject." That was the obvious
 * remedy and it was HARMFUL, because Ask cannot span subjects: `match_chunks`
 * filters `where c.kb_id = match_kb_id` (`20260501_rag_pgvector.sql`), `/api/agent`
 * takes one `kb_id` and 400s without it, and the Ask page makes the student pick a
 * single subject through `KBSelector`. Splitting one course across two subjects
 * therefore puts half of it out of reach of every question. Steering a blocked
 * student into that is worse than telling them nothing, so this line stays: it
 * states the constraint that makes the obvious workaround a trap, at the one
 * moment the student is about to take it.
 *
 * CORRECTED 2026-09-22 (register #47). This comment used to say the split was
 * *"IRREVERSIBLE, because there is no delete path and no move path for a document
 * or a subject (the sole DELETE handler is `/api/account`, register #80(c))"*, that
 * the line therefore *"names no action"*, and that *"A Pro user at 200 has NO
 * remedy"*. `/api/documents/[id]` now deletes a single material, so every tier has
 * a real remedy and the message names it first (DELETE_FREES_A_PLACE below). There
 * is still no MOVE path and no subject delete, and the copy names neither.
 */
const ASK_IS_SINGLE_SUBJECT: Record<Locale, string> = {
  en: 'Ask works inside one subject at a time, so splitting a course in two puts half of it out of reach.',
  ar: 'تجيب صفحة اسأل من مادة واحدة فقط، لذا فإن تقسيم المقرر على مادتين يجعل نصفه خارج نطاق السؤال.',
};

/**
 * The remedy every tier has (register #47). True because `checkDocumentLimit`
 * counts the subject's live rows, so a deleted material's place is free on the
 * very next upload, with no counter to wait out.
 */
const DELETE_FREES_A_PLACE: Record<Locale, string> = {
  en: 'Deleting a material you no longer need frees its place.',
  ar: 'حذف ملف لم تعد تحتاجه يُفرغ مكانه.',
};

function join(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

/** The next UTC midnight — `usage_counters.day` defaults to `current_date`. */
export function nextDailyReset(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

export function dailyLimitMessage(
  locale: Locale,
  kind: LimitKind,
  cap: number,
  tier: Tier,
  resetAt: Date,
  now: Date = new Date()
): string {
  const noun = NOUN[locale][kind];
  // Pro's cap is withheld (see the numbers note above), so the head names the
  // kind without a figure rather than printing one we intend to change.
  const head =
    tier === 'pro'
      ? locale === 'ar'
        ? `بلغت حدك اليومي من ${noun}.`
        : `You've reached today's limit for ${noun}.`
      : locale === 'ar'
        ? `بلغت حدك اليومي من ${noun}: ${cap}.`
        : `You've reached today's limit of ${cap} ${noun}.`;
  return join([
    head,
    resetClause(locale, resetAt, now),
    tier === 'pro' ? '' : UPGRADE[locale],
  ]);
}

export function monthlyConversationMessage(
  locale: Locale,
  cap: number,
  tier: Tier,
  resetAt: Date,
  now: Date = new Date()
): string {
  const head =
    tier === 'pro'
      ? locale === 'ar'
        ? 'بلغت حدك الشهري من المحادثات.'
        : `You've reached this month's limit for conversations.`
      : locale === 'ar'
        ? `بلغت حدك الشهري من المحادثات: ${cap}.`
        : `You've reached this month's limit of ${cap} conversations.`;
  return join([
    head,
    resetClause(locale, resetAt, now),
    tier === 'pro' ? '' : UPGRADE[locale],
  ]);
}

/**
 * The one limit with NO clock in it. A subject's shelf never empties on a timer,
 * so there is no reset clause to write. The remedy is deleting a material, which
 * every tier has; the warning after it is why the OTHER obvious remedy, a second
 * subject, is a trap (see ASK_IS_SINGLE_SUBJECT).
 */
export function subjectMaterialsMessage(
  locale: Locale,
  cap: number,
  tier: Tier
): string {
  const head =
    locale === 'ar'
      ? `بلغت هذه المادة حدها من الملفات: ${cap}.`
      : `This subject already holds its limit of ${cap} materials.`;
  return join([
    head,
    DELETE_FREES_A_PLACE[locale],
    ASK_IS_SINGLE_SUBJECT[locale],
    tier === 'pro' ? '' : UPGRADE_MATERIALS[locale],
  ]);
}

/**
 * THE UPLOAD SIZE CEILING (register #50). The one limit this module is called
 * for from the BROWSER as well as the server, and deliberately: the check has to
 * run before anything is sent, so `DropZone` composes the refusal itself, and
 * `/api/ingest` composes the same sentence from the same function for a request
 * that got past the browser. Both take the number from `@/lib/upload-limits`.
 *
 * ROUNDING, AND WHICH WAY. Both figures have one decimal and 1 MB is 1,048,576
 * bytes, as in `@/lib/upload-limits`. The limit is rounded DOWN, so it is never
 * shown larger than it is. A refused file's size is rounded to the NEAREST tenth,
 * as the student's own computer shows it, except just over the limit, where that
 * would read "This file is 4 MB. The largest file you can upload is 4 MB." There
 * it is shown one tenth above the limit ("4.1 MB"), so a refused file always
 * reads larger than the limit.
 *
 * NO REMEDY IS OFFERED. The one a student will reach for, splitting the file,
 * spends a material place per part (10 per subject on the free plan) and gives
 * each part its own summary and quiz, and one sentence cannot say all of that. A
 * remedy that hides its cost is worse than none (ASK_IS_SINGLE_SUBJECT above is
 * the same judgement).
 */
const BYTES_PER_MB = 1024 * 1024;

const MEGABYTES: Record<Locale, string> = {
  en: '{n} MB',
  ar: '{n} ميغابايت', // the owner's spelling, ruled 2026-09-23 (register #111)
};

const tenthsOfMB = (bytes: number) => (bytes * 10) / BYTES_PER_MB;

const LIMIT_TENTHS = Math.floor(tenthsOfMB(MAX_UPLOAD_BYTES));

function megabytes(locale: Locale, tenths: number): string {
  const n = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
  return MEGABYTES[locale].replace('{n}', n);
}

/** "4 MB" / "4 ميغابايت", for the line under the drop zone. */
export function uploadLimitLabel(locale: Locale): string {
  return megabytes(locale, LIMIT_TENTHS);
}

/** The refusal for a file over the limit, from the browser or from the route. */
export function fileTooLargeMessage(locale: Locale, fileBytes: number): string {
  const size = megabytes(locale, Math.max(Math.round(tenthsOfMB(fileBytes)), LIMIT_TENTHS + 1));
  const limit = uploadLimitLabel(locale);
  return locale === 'ar'
    ? `حجم هذا الملف ${size}، وأكبر حجم يمكنك رفعه هو ${limit}.`
    : `This file is ${size}. The largest file you can upload is ${limit}.`;
}

/**
 * The sentence a student reads when an upload did not succeed.
 *
 * A 413 for a file over the limit is the size sentence, whoever sent it: the
 * route (JSON, for a request that got past the browser check) or the platform
 * (plain text, for one too large to reach the route at all). A 413 for a file
 * WITHIN the limit did not come from our limit (a school or office proxy with a
 * smaller cap would send one), and the size sentence would then contradict
 * itself ("This file is 2 MB. The largest file you can upload is 4 MB."), so it
 * falls through. Next, the route's own `error` is shown if it sent
 * one, as before. Anything else, including a reply that is not JSON at all, gets
 * `fallback` (the dictionary's `uploadFailed`), never a parser's error text.
 */
export function uploadFailureMessage(
  locale: Locale,
  status: number,
  reply: UploadReply | null,
  fileBytes: number,
  fallback: string
): string {
  if (status === 413 && isOverUploadLimit(fileBytes)) return fileTooLargeMessage(locale, fileBytes);
  const error = reply?.error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

/**
 * THE UPLOAD ROUTE'S OTHER REFUSALS (register #111). Every reply `/api/ingest`
 * can send a student, other than the limits above, in the student's language.
 * `DropZone` shows the route's `error` as it comes, so this is the only place
 * these sentences exist; the drop zone composes `type` itself for a dropped
 * file, before anything is sent, by the same rule (`isAllowedFileType`).
 *
 * TWO 500 SENTENCES, NOT ONE, because the truth differs by stage. Before the
 * file is forwarded to the ingestion service, no material was saved and the
 * student should simply try again. After the forward, the service owns the
 * material's final status ((b1) in the route), so the outcome is unknown to
 * this route: the material may finish, or be marked with an error. One sentence
 * covering both would have to be vague about the thing the student most needs
 * to know, whether their file is there.
 *
 * `type` and `mime` name the file's extension. It is taken from the filename,
 * so it is cut to ten plain characters before it is printed.
 */
export type UploadRefusal = 'request' | 'type' | 'mime' | 'session' | 'nothing-saved' | 'unconfirmed';

const FORMATS = 'PDF, DOCX, PPTX, XLSX, TXT, MD';

function printableExt(ext: string): string {
  const clean = ext.replace(/[^a-z0-9]/gi, '').slice(0, 10);
  return clean ? `.${clean}` : '';
}

export function uploadRefusalMessage(locale: Locale, kind: UploadRefusal, ext = ''): string {
  const e = printableExt(ext);
  switch (kind) {
    case 'request':
      return locale === 'ar'
        ? 'وصل الطلب بلا ملف أو بلا مادة. حدّث الصفحة ثم حاول مجددًا.'
        : 'The request arrived without a file or a subject. Refresh the page, then try again.';
    case 'type':
      return locale === 'ar'
        ? `يقبل KnowFlow ملفات ${FORMATS} فقط${e ? `، وهذا الملف من نوع ${e}` : '، وهذا الملف بلا امتداد'}.`
        : `KnowFlow takes ${FORMATS} files only${e ? `, and this file is a ${e}` : ', and this file has no extension'}.`;
    case 'mime':
      return locale === 'ar'
        ? `محتوى هذا الملف لا يطابق اسمه${e ? ` (${e})` : ''}. احفظه من جديد بنوعه الصحيح ثم ارفعه.`
        : `This file's contents do not match its name${e ? ` (${e})` : ''}. Save it again as the right type, then upload it.`;
    case 'session':
      return locale === 'ar'
        ? 'لقد خرجت من حسابك. سجّل الدخول مجددًا ثم ارفع الملف.'
        : 'You are signed out. Sign in again, then upload the file.';
    case 'nothing-saved':
      return locale === 'ar'
        ? 'لم يتم الرفع ولم تُحفظ أي مادة. حاول مجددًا بعد قليل.'
        : 'The upload did not go through, and no material was saved. Try again in a moment.';
    case 'unconfirmed':
      return locale === 'ar'
        ? 'وصل ملفك، لكننا لم نتمكن من تأكيد معالجته. حدّث الصفحة: ستظهر المادة جاهزة أو مع علامة خطأ، ويمكنك حذفها ورفعها مجددًا.'
        : 'Your file arrived, but we could not confirm it was processed. Refresh the page: the material will show as ready or marked with an error, and you can delete it and upload it again.';
  }
}

/**
 * Read the limit message the SERVER already composed, for the two clients that
 * otherwise render their own copy from the dictionary.
 *
 * `SummarySection` and `QuizSection` map a status to a dictionary string, which is
 * how their 429 copy was localized long before this module existed (register #27).
 * That copy cannot say WHEN the limit returns: the reset instant is server state,
 * and neither client has it. Since `/api/summarize` and `/api/quiz/generate` both
 * already return `enforceLimit`'s fully-localized string as `error`, reading it is
 * strictly more information in the same language — and it keeps all four kinds
 * speaking with one voice instead of two.
 *
 * Falls back to `null` (caller uses its dictionary line) if the body is missing,
 * not JSON, or carries no usable `error` — an error surface must never itself
 * throw. The response is cloned so the caller's own parse is undisturbed.
 */
export async function readServerLimitMessage(res: Response): Promise<string | null> {
  try {
    const body = await res.clone().json();
    const msg = (body as { error?: unknown })?.error;
    return typeof msg === 'string' && msg.trim() ? msg : null;
  } catch {
    return null;
  }
}

/** Burst guard. Not a quota: the student is fine, they are just too fast. */
export const TOO_FAST: Record<Locale, string> = {
  en: 'You are sending requests too quickly. Please wait a moment and try again.',
  ar: 'ترسل الطلبات بسرعة كبيرة. انتظر لحظة ثم حاول مجددًا.',
};

/** Fail-closed outage. Not the student's fault and never an upgrade prompt. */
export const TEMPORARILY_UNAVAILABLE: Record<Locale, string> = {
  en: 'Service is temporarily unavailable. Please try again shortly.',
  ar: 'الخدمة غير متاحة مؤقتًا. حاول مجددًا بعد قليل.',
};
