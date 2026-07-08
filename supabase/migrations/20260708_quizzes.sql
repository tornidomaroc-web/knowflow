-- Phase 4 (P4.0): quizzes schema foundation.
-- Document-scoped, multiple-choice quizzes with SERVER-SIDE grading. A quiz is
-- generated once from a single document (like the Phase 3 summary), and its
-- items carry the correct answer — which never leaves the server.
--
-- Two NEW tables (001-style: dedicated tables + FK on delete cascade + RLS with
-- indirect ownership resolved by subquery), NOT additive columns. This differs
-- from the Phase 3 summary, which hung columns off `documents`, because a quiz is
-- a one-to-many aggregate (one document → one quiz → many items), not a single
-- scalar per document.
--
-- The usage-counter extension IS additive and idempotent, mirroring exactly the
-- convention established by 20260705_document_summaries.sql (`add column if not
-- exists`, `create or replace function`), so re-running is safe. The existing
-- query/upload/summary branches of increment_usage are reproduced VERBATIM; only
-- a new 'quiz' branch is appended.

-- 1. Quiz: one generated quiz per document (generate-once, read-many — the same
--    primary cost control as summaries). `generated_at`/`model` are null until a
--    generation run fills them (P4.1). No user_id column: ownership is resolved
--    two hops up (quiz.document_id → documents.kb_id → knowledge_bases.user_id),
--    mirroring the indirect-ownership shape of the documents/messages policies in
--    001_initial_schema.sql.
--
--    UNIQUE (document_id) enforces generate-once at the DB level (register #26,
--    consistent with the summary decision and the cost-ceiling rule): a second
--    generation attempt for the same document cannot insert a duplicate row, so
--    the P4.1 route returns the cached quiz instead of paying for another one.
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  generated_at timestamptz,
  model text,
  created_at timestamptz default now(),
  constraint quizzes_document_id_unique unique (document_id)
);

alter table quizzes enable row level security;
create policy "Users can manage own quizzes" on quizzes for all using (
  auth.uid() = (
    select user_id from knowledge_bases
    where id = (select kb_id from documents where id = document_id)
  )
);

-- 2. Quiz item: one multiple-choice question. `options` is a JSON array of choice
--    strings; `correct_index` is the 0-based index into that array of the correct
--    option; `position` orders the items within the quiz.
--
--    SECURITY-CRITICAL: `correct_index` is SERVER-ONLY by design. It must NEVER be
--    selected into any client-facing payload — the client receives questions +
--    options only, and grading happens server-side against this column (enforced
--    at the API layer in P4.2). Leaking it would make every quiz self-answering.
--
--    Ownership is resolved three hops up (quiz_item.quiz_id → quizzes.document_id
--    → documents.kb_id → knowledge_bases.user_id), the same indirect-ownership
--    pattern one level deeper than quizzes.
--
--    Integrity CHECKs (RLS guards ownership, not validity — these guard validity):
--      * quiz_item_valid — `options` must be a non-empty JSON array AND
--        `correct_index` must point at a real choice inside it (0-based, strictly
--        in range), so a stored answer can never index outside its own options.
--      * position_non_negative — `position` is a 0-based order key.
--
--    quiz_item_valid uses CASE, NOT a flat AND chain, to force evaluation order.
--    jsonb_array_length() raises on a non-array, and Postgres does NOT guarantee
--    left-to-right short-circuit of AND (manual §4.2.14 — the same reason its
--    division-by-zero example must use CASE, not `x > 0 AND y/x > 1.5`). The CASE
--    guard is the type check ALONE (no length call in WHEN); only when `options`
--    is proven an array does the THEN branch call jsonb_array_length(). Result: a
--    malformed non-array `options` yields a clean quiz_item_valid violation, never
--    a runtime jsonb type error.
create table quiz_items (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade not null,
  question text not null,
  options jsonb not null,
  correct_index int not null,
  position int not null,
  constraint quiz_item_valid check (
    case when jsonb_typeof(options) = 'array'
         then jsonb_array_length(options) > 0
              and correct_index >= 0
              and correct_index < jsonb_array_length(options)
         else false
    end
  ),
  constraint position_non_negative
    check (position >= 0)
);

alter table quiz_items enable row level security;
create policy "Users can manage own quiz_items" on quiz_items for all using (
  auth.uid() = (
    select user_id from knowledge_bases
    where id = (
      select kb_id from documents
      where id = (select document_id from quizzes where id = quiz_id)
    )
  )
);

-- 3. Dedicated daily quiz counter (B7 family), parallel to query_count /
--    upload_count / summary_count. Separate column = separate cap, so quiz
--    generation (a paid Claude call over a document) is bounded independently and
--    never drains the query or summary quotas. Additive + idempotent; no new RLS
--    policy is required — usage_counters stays read-own, and quiz_count is written
--    only through increment_usage() (SECURITY DEFINER, bypasses RLS).
alter table usage_counters
  add column if not exists quiz_count int not null default 0;

-- 4. Extend the atomic increment primitive with a 'quiz' branch. The 'query',
--    'upload', and 'summary' branches are UNCHANGED (reproduced verbatim from
--    20260705_document_summaries.sql). Still SECURITY DEFINER with a pinned
--    search_path; auth.uid() still resolves to the caller, so a user can only ever
--    increment their OWN row. Any unknown kind still raises (fail closed).
create or replace function increment_usage(p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_kind = 'query' then
    insert into usage_counters (user_id, day, query_count)
    values (v_user, current_date, 1)
    on conflict (user_id, day)
    do update set query_count = usage_counters.query_count + 1
    returning query_count into v_count;
  elsif p_kind = 'upload' then
    insert into usage_counters (user_id, day, upload_count)
    values (v_user, current_date, 1)
    on conflict (user_id, day)
    do update set upload_count = usage_counters.upload_count + 1
    returning upload_count into v_count;
  elsif p_kind = 'summary' then
    insert into usage_counters (user_id, day, summary_count)
    values (v_user, current_date, 1)
    on conflict (user_id, day)
    do update set summary_count = usage_counters.summary_count + 1
    returning summary_count into v_count;
  elsif p_kind = 'quiz' then
    insert into usage_counters (user_id, day, quiz_count)
    values (v_user, current_date, 1)
    on conflict (user_id, day)
    do update set quiz_count = usage_counters.quiz_count + 1
    returning quiz_count into v_count;
  else
    raise exception 'invalid usage kind: %', p_kind;
  end if;

  return v_count;
end;
$$;

grant execute on function increment_usage(text) to authenticated;
