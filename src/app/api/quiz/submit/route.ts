import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Well-formed-UUID gate. Applied to `quiz_id` BEFORE any DB query on purpose:
// `quizzes.id` is a `uuid` column, so a malformed value reaches Postgres as
// `invalid input syntax for type uuid` (22P02), which surfaces as a query error
// and would be mapped to a 500 — a client input mistake reported as a server
// fault. Validating the shape here keeps that case an honest 400.
//
// Deliberately version-agnostic (any hex in the version/variant nibbles): the
// point is to reject values Postgres cannot cast, not to police UUID versions.
// `gen_random_uuid()` emits v4, but a stricter regex would only create a second
// way to be wrong.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Defensive bound on the submitted answer array. A quiz is 5 questions; nothing
// legitimate submits hundreds. This is not in the P4.2 contract — it is a cheap
// guard so a hostile body cannot make us build an unbounded Map. Rejecting is
// safe: a real client can never trip it.
const MAX_ANSWERS = 200;

// The internal shape of a quiz item during grading. `options` and `position` stay
// server-side; `correct_index` is copied into the graded results deliberately (see
// GradedResult). Nothing serializes this type directly.
interface GradingItem {
  id: string;
  position: number;
  correct_index: number;
  options: unknown;
}

// The per-item shape returned by GRADING (register #29). `correct_index` IS here,
// deliberately — but ONLY on items the student actually attempted, hence optional.
// This is the one response in the product allowed to carry the key. It must still
// never appear on /api/quiz/generate, nor on any quiz-item read that PRECEDES
// grading: a quiz whose answers you can see before attempting it has no value.
//
// Revealing the key is the REWARD FOR AN ATTEMPT, not the gift of a request. When
// the reveal was unconditional, `{"answers": []}` returned every correct_index for
// zero attempts — and wrote a 0/N attempt row that a future streak feature would
// misread as studying. Gating the reveal on a real attempt closes that, and closes
// the same bypass dressed as an out-of-range guess (see ATTEMPTED, below).
//
// `question` and `options` stay absent: the client already holds them from the
// generate response, and re-sending them would only duplicate state.
interface GradedResult {
  item_id: string;
  selected_index: number | null;
  is_correct: boolean;
  correct_index?: number;
}

// A submitted answer, after validation. `selected_index` is null when the student
// left the item blank OR sent something that is not a usable integer index — both
// grade as incorrect rather than erroring (an unanswered question is a wrong
// answer, not a bad request).
function readSelectedIndex(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return null;
  return raw;
}

export async function POST(request: Request) {
  try {
    // 1. Body. Parsed and fully validated BEFORE any DB work or auth-dependent
    //    branch, so a malformed request is cheap and honestly reported.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { quiz_id, answers } = (body ?? {}) as {
      quiz_id?: unknown;
      answers?: unknown;
    };

    if (!quiz_id || typeof quiz_id !== 'string') {
      return NextResponse.json({ error: 'Missing quiz_id' }, { status: 400 });
    }
    // Shape-check before the query — a malformed id is a 400, never a 22P02 → 500.
    if (!UUID_RE.test(quiz_id)) {
      return NextResponse.json({ error: 'Invalid quiz_id' }, { status: 400 });
    }
    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing answers' }, { status: 400 });
    }
    if (answers.length > MAX_ANSWERS) {
      return NextResponse.json({ error: 'Too many answers' }, { status: 400 });
    }

    // 2. Auth. Same convention as /api/quiz/generate.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 3. RLS-scoped quiz fetch. The "Users can manage own quizzes" policy resolves
    //    ownership two hops up (quiz.document_id → documents.kb_id →
    //    knowledge_bases.user_id), so a quiz that exists but belongs to someone
    //    else comes back null — identical to one that does not exist. Both → 404,
    //    never leaking that the id is real. Column-explicit: we need only the id.
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .select('id')
      .eq('id', quiz_id)
      .maybeSingle();

    if (quizErr) {
      console.error('quiz/submit: quiz fetch failed', quizErr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // 4. The grading fetch — the one place the answer key is read. It reaches the
    //    client only through the graded results below, AFTER an attempt, never as
    //    raw items. `question` is deliberately NOT selected: grading does not need
    //    it, and every column we do not fetch is one we cannot mishandle.
    //    quiz_items RLS independently re-checks ownership three hops up.
    const { data: rawItems, error: itemsErr } = await supabase
      .from('quiz_items')
      .select('id, position, correct_index, options')
      .eq('quiz_id', quiz.id)
      .order('position', { ascending: true });

    if (itemsErr) {
      console.error('quiz/submit: quiz_items fetch failed', itemsErr);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const items = (rawItems ?? []) as GradingItem[];

    // 5. Zero-item guard. A quizzes row can exist with no items: register #30's
    //    residual window (process death between the quiz insert and the items
    //    insert, before the compensating delete runs). Grading it would divide by
    //    zero and report a meaningless 0/0. Refuse loudly instead.
    //    409 mirrors /api/quiz/generate's "not in a usable state yet" code.
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'This quiz is incomplete and cannot be graded.' },
        { status: 409 }
      );
    }

    // 6. Index the submitted answers by item_id. FIRST occurrence wins: a body with
    //    the same item_id twice is ambiguous, and silently taking the last value
    //    would let a client append a "correction" after its real answer. Entries
    //    whose item_id is not a string are skipped — they can never match an item.
    //
    //    SAFETY NOTE: `item_id` is never used in a DB query. It is only ever a Map
    //    key compared against ids we already fetched, so an attacker-controlled
    //    item_id cannot reach Postgres, and needs no UUID validation.
    const submitted = new Map<string, number | null>();
    for (const raw of answers) {
      if (!raw || typeof raw !== 'object') continue;
      const { item_id, selected_index } = raw as {
        item_id?: unknown;
        selected_index?: unknown;
      };
      if (typeof item_id !== 'string') continue;
      if (submitted.has(item_id)) continue; // first-wins
      submitted.set(item_id, readSelectedIndex(selected_index));
    }

    // 7. Grade, server-side, against `correct_index`. The item list — not the
    //    submitted list — drives the loop. That is what makes the two required
    //    behaviours fall out for free:
    //      * an item with no submitted answer is simply `undefined` → incorrect;
    //      * a submitted item_id that belongs to another quiz (or to nothing) is
    //        never visited, so it cannot affect the score.
    //    An out-of-range selected_index (>= options.length) is graded incorrect
    //    rather than rejected: the DB CHECK guarantees correct_index is in range,
    //    so an out-of-range guess can never coincidentally equal it. It also does
    //    NOT count as an attempt, so it earns no answer reveal.
    const results: GradedResult[] = items.map((item) => {
      const has = submitted.has(item.id);
      const selected = has ? submitted.get(item.id) : null;
      const optionCount = Array.isArray(item.options) ? item.options.length : 0;

      // ATTEMPTED means the student picked a REAL option on this item: a
      // non-negative integer that indexes inside this item's own `options`.
      //
      // "Not null" is NOT a sufficient test, and using it would reopen the very
      // hole this gate exists to close. readSelectedIndex accepts any non-negative
      // integer, so `selected_index: 99` is non-null while selecting nothing — a
      // client could send 99 for every item and harvest the whole key in ONE
      // request without attempting anything, exactly as `{"answers": []}` used to.
      // Requiring an in-range choice makes the reveal cost a genuine commitment.
      const attempted = selected !== null && selected < optionCount;

      const result: GradedResult = {
        item_id: item.id,
        selected_index: selected,
        is_correct: attempted && selected === item.correct_index,
      };

      // Reveal the key ONLY as feedback on a real attempt. Unattempted items come
      // back { item_id, selected_index: null, is_correct: false } with no
      // correct_index — an honest 0 that teaches nothing, which is correct: there
      // is nothing to learn from a question you did not engage.
      if (attempted) {
        result.correct_index = item.correct_index;
      }
      return result;
    });

    const score = results.filter((r) => r.is_correct).length;
    const total = items.length;

    // 8. Grading is STATELESS — nothing is persisted. `quiz_attempts` was dropped in
    //    P5.0 (migration 20260709_quiz_attempts_drop.sql): it cascaded through
    //    quizzes → documents, so deleting one material erased attempts beneath it.
    //    That is right for content-lifecycle data and exactly wrong for a streak,
    //    which is an immutable claim about the student's past. The streak substrate
    //    is `study_events` (PIVOT_PLAN.md §7 row 5), built in its own later step; it
    //    must NOT be an FK to any content table. See register #33.
    //
    //    Response carries correct_index ONLY on attempted items (see GradedResult),
    //    and NOT is_partial / generated_at / model — those belong to the generate
    //    response and would only duplicate what the client already holds.
    //
    //    No enforceLimit: grading performs no Claude call and costs no credit, so
    //    charging the 'quiz' counter here would wrongly drain the GENERATION cap —
    //    a student could exhaust their daily quota by retaking one quiz five times.
    //    A dedicated submission throttle is the right instrument and is deferred to
    //    its own step (register #32).
    return NextResponse.json({
      quiz_id: quiz.id,
      score,
      total,
      results,
    });
  } catch (error) {
    console.error('Quiz submit API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
