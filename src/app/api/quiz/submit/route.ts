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

// The internal, server-only shape of a quiz item during grading. `correct_index`
// lives ONLY inside this type and never crosses the response boundary — see the
// GradedResult type, which is what actually gets serialized.
interface GradingItem {
  id: string;
  position: number;
  correct_index: number;
  options: unknown;
}

// The ONLY per-item shape that may leave the server (register #29). Note what is
// absent: no `correct_index`, no `question`, no `options`. The client already has
// the questions and options from POST /api/quiz/generate; echoing them back would
// be redundant, and echoing the answer key would make the quiz self-answering.
interface GradedResult {
  item_id: string;
  selected_index: number | null;
  is_correct: boolean;
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

    // 4. THE ONE QUERY THAT MAY READ THE ANSWER KEY (register #29). This result is
    //    server-only: it is consumed by the grading loop below and never appears in
    //    any response. `question` is deliberately NOT selected — grading does not
    //    need it, and every column we do not fetch is one we cannot leak.
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
    //    so an out-of-range guess can never coincidentally equal it.
    const results: GradedResult[] = items.map((item) => {
      const has = submitted.has(item.id);
      const selected = has ? submitted.get(item.id) : null;
      const optionCount = Array.isArray(item.options) ? item.options.length : 0;
      const inRange = selected !== null && selected < optionCount;
      return {
        item_id: item.id,
        selected_index: selected,
        is_correct: inRange && selected === item.correct_index,
      };
    });

    const score = results.filter((r) => r.is_correct).length;

    // 8. Minimal response. No correct_index, anywhere, for any item — including
    //    the ones answered wrong (a student must not be able to harvest the key by
    //    answering deliberately wrong and reading it back). No is_partial /
    //    generated_at / model: those belong to the generate response and would only
    //    duplicate what the client already holds.
    //
    //    Stateless by design: nothing is persisted. There is no attempts table, and
    //    register #28 keeps the taking layer keyed to quiz_id so one can be added
    //    later as a pure migration.
    //
    //    No enforceLimit: grading performs no Claude call and costs no credit, so
    //    charging a quiz counter here would wrongly drain the generation cap.
    //    (See PR notes: this leaves /submit unthrottled, which is a real gap —
    //    the per-item is_correct flags are an answer-key oracle across repeated
    //    submissions. Scoped to the caller's OWN quiz by RLS, so it is self-
    //    cheating, not a cross-user vulnerability.)
    return NextResponse.json({
      quiz_id: quiz.id,
      score,
      total: items.length,
      results,
    });
  } catch (error) {
    console.error('Quiz submit API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
