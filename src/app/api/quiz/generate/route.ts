import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { enforceLimit } from '@/lib/rate-limit';
import type { ClientQuizItem, Quiz } from '@/types';

// Same cheap tier as /api/summarize and /api/agent — a quiz is a single, bounded
// Haiku call. Identical model string to summarize's SUMMARY_MODEL on purpose.
const QUIZ_MODEL = 'claude-haiku-4-5-20251001';

// Input cap: identical to /api/summarize (~48K tokens ≈ ~120K chars,
// cross-language-safe). A longer document is quizzed from its first
// INPUT_CHAR_CAP chars and the model is told so — NEVER a silent truncation.
const INPUT_CHAR_CAP = 120_000;

// Thin-content guard (fabrication safeguard, code layer): identical threshold to
// /api/summarize. Below this many non-whitespace chars there isn't enough real
// source to quiz on; we refuse in code BEFORE enforceLimit so a no-op request
// doesn't burn a counter or risk a padded/fabricated model call.
const MIN_CONTENT_CHARS = 200;

// Fixed question count. Five is the deliberate default: enough questions for
// meaningful retrieval practice over one document, short enough to keep the JSON
// small (lower truncation risk) and generation cheap. See PR notes for the
// argument. The model is told this count; we do NOT hard-reject a slightly
// different count (a valid 4- or 6-item array is still usable) — we only reject
// malformed items (see validateItems).
const QUIZ_QUESTION_COUNT = 5;

// Answer-option bounds enforced both here (defense in depth) and by the DB
// `quiz_item_valid` CHECK (register #28).
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

// Token headroom is larger than summarize's 1024 on purpose: quiz output is
// structured JSON, and a truncated response is UNPARSEABLE (→ 502, nothing
// persisted), so headroom against truncation matters more than for free prose.
// 4096 comfortably covers ~5 MCQs in either language while still bounding cost.
const MAX_QUIZ_TOKENS = 4096;

// Strict-JSON quiz-writer instructions (prompt layer). Kept as a constant so the
// cached system block never forks — the per-request language directive lives in
// the dynamic user turn, exactly as /api/summarize does.
const SYSTEM_INSTRUCTIONS = `You are KnowFlow's quiz writer. You create a multiple-choice quiz that tests a student's understanding of ONE study document.

Rules:
- Base every question ONLY on what is inside the <document> block in the user message. It is your sole source of truth. Never test facts, names, or numbers that are not in the document.
- Create exactly ${QUIZ_QUESTION_COUNT} questions.
- Each question must have between ${MIN_OPTIONS} and ${MAX_OPTIONS} answer options, with EXACTLY ONE correct option.
- Write every question and every option in the language specified in the user message, regardless of the document's own language.
- Output STRICT JSON ONLY: a single JSON array and nothing else. No prose, no explanation, no markdown, no code fences.
- Each array element must be an object with EXACTLY these three keys:
    "question": a string,
    "options": an array of ${MIN_OPTIONS} to ${MAX_OPTIONS} strings,
    "correct_index": an integer, the 0-based index into "options" of the correct answer (0 to options.length - 1).
- Do not add any other keys. Do not number the questions inside the text. Do not mark which option is correct anywhere except via correct_index.`;

// Defensive fence-stripper + array extractor. With the assistant prefill of "["
// the model output is already a bare array continuation, but we still strip any
// stray ```json / ``` fences and clip to the outermost [...] so a trailing stray
// token can't defeat JSON.parse. If the shape is hopeless we return it as-is and
// let JSON.parse throw (→ 502).
function extractJsonArrayText(s: string): string {
  const t = s.replace(/```(?:json)?/gi, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return t;
  return t.slice(start, end + 1);
}

interface ValidItem {
  question: string;
  options: string[];
  correct_index: number;
}

// All-or-nothing validation. Returns null on ANY violation so the caller can 502
// without persisting a partial quiz. Mirrors (and layers on top of) the DB
// `quiz_item_valid` CHECK: non-empty array, each item has a non-empty question,
// an options array of 2-5 non-empty strings, and an integer correct_index that
// is a valid 0-based index into THAT item's options.
function validateItems(parsed: unknown): ValidItem[] | null {
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const out: ValidItem[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const question = item.question;
    const options = item.options;
    const correctIndex = item.correct_index;

    if (typeof question !== 'string' || question.trim().length === 0) return null;
    if (!Array.isArray(options)) return null;
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return null;
    if (!options.every((o) => typeof o === 'string' && o.trim().length > 0)) return null;
    if (
      typeof correctIndex !== 'number' ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      return null;
    }

    out.push({
      question: question.trim(),
      options: (options as string[]).map((o) => o.trim()),
      correct_index: correctIndex,
    });
  }
  return out;
}

// Single flat shape (not a discriminated union): the project compiles with
// strict:false, where union narrowing on a boolean discriminant does NOT kick in
// (see LimitResult in rate-limit.ts). On error, `error` is true; otherwise `quiz`
// is the row (or null when none exists) and `items` are its client-safe items.
interface QuizFetchResult {
  error: boolean;
  quiz?: Quiz | null;
  items?: ClientQuizItem[];
}

// Client-safe fetch of an existing quiz + its items. CRITICAL (register #29):
// the item select lists explicit columns and OMITS `correct_index` — the answer
// key never leaves the server. `quiz` is null when none exists.
async function fetchClientQuiz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string
): Promise<QuizFetchResult> {
  const { data: quiz, error: quizErr } = await supabase
    .from('quizzes')
    .select('id, document_id, generated_at, model, created_at, is_partial')
    .eq('document_id', documentId)
    .maybeSingle();

  if (quizErr) {
    console.error('quiz/generate: quiz fetch failed', quizErr);
    return { error: true };
  }
  if (!quiz) return { error: false, quiz: null };

  const { data: items, error: itemsErr } = await supabase
    .from('quiz_items')
    .select('id, quiz_id, question, options, position') // NO correct_index — register #29
    .eq('quiz_id', quiz.id)
    .order('position', { ascending: true });

  if (itemsErr) {
    console.error('quiz/generate: quiz_items fetch failed', itemsErr);
    return { error: true };
  }

  return { error: false, quiz, items: (items ?? []) as ClientQuizItem[] };
}

export async function POST(request: Request) {
  try {
    // 1. Body.
    const { document_id, locale } = await request.json();
    if (!document_id || typeof document_id !== 'string') {
      return NextResponse.json({ error: 'Missing document_id' }, { status: 400 });
    }

    // 2. Fail-closed language whitelist. Questions follow the APP UI language
    //    (register #27), never the document's. Any value other than 'ar'
    //    collapses to 'en'; only the derived directive is interpolated.
    const lang = locale === 'ar' ? 'ar' : 'en';

    // 3. Auth.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 4. RLS-scoped document fetch. Ownership is enforced by the "manage own
    //    documents" policy: a missing OR not-owned row both come back null → 404
    //    (never leak that a document exists).
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, status, markdown_content')
      .eq('id', document_id)
      .maybeSingle();

    if (docErr) {
      console.error('quiz/generate: document fetch failed', docErr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // 5. Cache check by EXISTENCE of a quizzes row (generate-once; register #28's
    //    unique(document_id)). Runs BEFORE enforceLimit so a re-read never charges
    //    a quiz credit. The returned payload is client-safe (no correct_index).
    const cached = await fetchClientQuiz(supabase, document_id);
    if (cached.error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    if (cached.quiz) {
      return NextResponse.json({
        quiz: cached.quiz,
        items: cached.items,
        // Real persisted value (register #29 sibling honesty fix): a cached quiz
        // now reports whether it was generated from only the first part.
        is_partial: cached.quiz.is_partial,
        generated_at: cached.quiz.generated_at,
        model: cached.quiz.model,
        cached: true,
      });
    }

    // 6. Only a fully-processed document has usable text.
    if (doc.status !== 'ready') {
      return NextResponse.json(
        { error: 'This material is still processing. Try again once it is ready.' },
        { status: 409 }
      );
    }

    // 7. Content guard — BEFORE enforceLimit, so a no-op doesn't burn a counter.
    const content = (doc.markdown_content ?? '').trim();
    if (content.replace(/\s/g, '').length < MIN_CONTENT_CHARS) {
      return NextResponse.json(
        { error: 'There is not enough text in this material to make a quiz.' },
        { status: 422 }
      );
    }

    // 8. B7 cost guard: dedicated daily quiz cap, IN FRONT of the paid Claude
    //    call. The 'quiz' kind is its own counter, so quiz generation never
    //    drains the query or summary caps. The atomic increment happens before
    //    the paid work — the fail-closed cost ceiling is preferred pre-revenue
    //    over a decrement race (register #24).
    const limit = await enforceLimit(user.id, 'quiz');
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.error }, { status: limit.status });
    }

    // 9. Long-document handling: single pass within the input cap; the model is
    //    told explicitly it is seeing only the first part — never a silent cut.
    const isPartial = content.length > INPUT_CHAR_CAP;
    const sourceText = isPartial ? content.slice(0, INPUT_CHAR_CAP) : content;
    const partialNote = isPartial
      ? '\n\nNote: this is only the FIRST PART of a longer document. Write questions ONLY about the part provided below; do not ask about content that is not shown.'
      : '';

    // Concrete language directive (dynamic, per request) — kept in the user turn
    // so the cached system block does not fork per locale, exactly as summarize.
    const langDirective =
      lang === 'ar'
        ? 'Write every question and every answer option in Arabic (العربية), even if the document itself is written in another language such as English. Translate the meaning faithfully into Arabic; do not leave text in the source language.'
        : 'Write every question and every answer option in English, even if the document itself is written in another language such as Arabic. Translate the meaning faithfully into English; do not leave text in the source language.';

    const userTurn = `${langDirective}\n\nCreate a ${QUIZ_QUESTION_COUNT}-question multiple-choice quiz that tests understanding of the following study document. Output the strict JSON array described in your instructions and nothing else.${partialNote}\n\n<document>\n${sourceText}\n</document>`;

    // 10. Paid Haiku call. Assistant prefill "[" forces a bare JSON array and
    //     suppresses any preamble/fence (the strongest prompt-level reliability
    //     lever short of tool-use — see PR notes). The prefilled "[" is NOT
    //     echoed in the response, so we re-attach it before parsing.
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

    let completion = '';
    try {
      const resp = await anthropic.messages.create({
        model: QUIZ_MODEL,
        max_tokens: MAX_QUIZ_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_INSTRUCTIONS,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          { role: 'user', content: userTurn },
          { role: 'assistant', content: '[' },
        ],
      });
      completion = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    } catch (e) {
      console.error('quiz/generate: Claude call failed', e);
      return NextResponse.json(
        { error: 'Could not generate a quiz right now. Please try again shortly.' },
        { status: 502 }
      );
    }

    // 11. Defensive parse + validate. Any failure → 502, nothing persisted (never
    //     store a partial/invalid quiz). correct_index is validated in-range here
    //     as defense in depth alongside the DB CHECK.
    let items: ValidItem[] | null = null;
    try {
      const parsed = JSON.parse(extractJsonArrayText('[' + completion));
      items = validateItems(parsed);
    } catch (e) {
      console.error('quiz/generate: JSON parse failed', e);
      items = null;
    }
    if (!items) {
      return NextResponse.json(
        { error: 'Could not generate a valid quiz right now. Please try again shortly.' },
        { status: 502 }
      );
    }

    // 12. Persist. Two inserts (supabase-js has no client-side transaction across
    //     statements; a true fix is a SECURITY DEFINER RPC — deferred, needs a
    //     migration → out of P4.1 scope, see PR notes).
    //     - quizzes first (FK parent). A unique(document_id) violation (23505)
    //       means a concurrent request already generated one → treat as cache hit.
    //     - quiz_items next. If they fail, DELETE the just-inserted quiz row so we
    //       never leave an orphan empty quiz (which the step-5 cache check would
    //       then return forever, with no retry possible under the unique index).
    const generatedAt = new Date().toISOString();
    const { data: quizRow, error: quizErr } = await supabase
      .from('quizzes')
      .insert({ document_id, generated_at: generatedAt, model: QUIZ_MODEL, is_partial: isPartial })
      .select('id, document_id, generated_at, model, created_at, is_partial')
      .single();

    if (quizErr) {
      if (quizErr.code === '23505') {
        const raced = await fetchClientQuiz(supabase, document_id);
        if (!raced.error && raced.quiz) {
          return NextResponse.json({
            quiz: raced.quiz,
            items: raced.items,
            is_partial: raced.quiz.is_partial,
            generated_at: raced.quiz.generated_at,
            model: raced.quiz.model,
            cached: true,
          });
        }
      }
      console.error('quiz/generate: quiz insert failed', quizErr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const itemsToInsert = items.map((it, idx) => ({
      quiz_id: quizRow.id,
      question: it.question,
      options: it.options,
      correct_index: it.correct_index,
      position: idx,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('quiz_items')
      .insert(itemsToInsert)
      .select('id, quiz_id, question, options, position'); // NO correct_index — register #29

    if (itemsErr) {
      // Compensating delete — do not leave an orphan empty quiz.
      await supabase.from('quizzes').delete().eq('id', quizRow.id);
      console.error('quiz/generate: quiz_items insert failed', itemsErr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // 13. Return the fresh quiz WITHOUT correct_index.
    const clientItems = ((insertedItems ?? []) as ClientQuizItem[])
      .slice()
      .sort((a, b) => a.position - b.position);

    return NextResponse.json({
      quiz: quizRow,
      items: clientItems,
      is_partial: isPartial,
      generated_at: generatedAt,
      model: QUIZ_MODEL,
      cached: false,
    });
  } catch (error) {
    console.error('Quiz generate API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
