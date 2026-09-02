# Deletion preflight read — catalog queries and their expectations

Register **#62** remedy **(ii)**. These are the read-only catalog queries that answer the
questions `supabase/migrations/` structurally cannot: what production actually enforces, as
opposed to what the folder declares.

**Why this file exists rather than a link.** #62 rules that the production-schema read
*"cannot run in CI and must not"* — a public repository must never hold a production
credential — so it runs as a **periodic owner-executed read producing a pasted artifact**.
Periodic requires a durable, versioned definition of what to run. This is that definition.
It follows the convention `supabase/migrations/20260829_spine_constraints.sql` already set:
the verification query ships in the repository, the **result** goes in the register.

**Results live in `docs/PROGRESS.md` register #62, not here.** This file is the plan; the
register carries the facts, dated and attributed. A migration file is a plan, not a fact,
and neither is this one.

---

## Standing rules for running these

- **Everything here is read-only.** Five `SELECT`s. No DDL, no `INSERT`/`UPDATE`/`DELETE`,
  no `ALTER`, no `DROP`. Nothing here can change production.
- **Run them ONE AT A TIME, in order, in a fresh SQL editor tab.** The Supabase SQL editor
  renders the result of the **last** statement it executed. Pasting several together runs
  them all and shows one, and the results you could not see are indistinguishable from
  results that were never produced — register **#60**'s own sentence.
- **A permissions error is a finding.** Record the error text; do not work around it.
- **Paste results verbatim, with the run number, the UTC timestamp and the project ref.**
  If a run returns nothing, write *"zero rows"* explicitly. An omitted result and an empty
  result are the two things this exercise exists to keep apart.
- **Run 3 returns a full function body and THIS REPOSITORY IS PUBLIC.** Read it before
  pasting it anywhere. If it holds a credential, replace the value with `[REDACTED]` **and
  say in the record that you redacted it and what kind of value it was** — a silent
  redaction is worse than none.

---

## Run 0 — identity probe

Establishes which database and which role actually answered. Not optional: the SQL editor
does not always render a role selector, and a catalog read against the wrong database
returning plausible rows is the worst outcome available here.

```sql
select current_user::text       as who_am_i,
       session_user::text       as session_role,
       current_database()::text as db_name,
       current_setting('server_version') as pg_version;
```

**Expected:** one row, `who_am_i` and `session_role` both `postgres`. Anything else — stop.

---

## Run 1 — Q10: everything that can intercept a DELETE

Non-internal triggers and rewrite rules across `public` and `auth`. **Deliberately wider
than "is there a delete-side trigger on `auth.users`"**: a trigger on `profiles`,
`documents`, `conversations` or `messages` fires inside the same cascade and does the same
damage. Same widening `68f918f` applied to the spine query, for the same reason.

`tgisinternal = false` excludes the triggers Postgres creates to enforce foreign keys;
those are already covered by the six delete rules verified on 2026-08-29.

```sql
with trg as (
  select 'trigger'::text                                as kind,
         n.nspname::text                                as schema_name,
         c.relname::text                                as on_object,
         t.tgname::text                                 as name,
         ((case when (t.tgtype::int & 64) <> 0 then 'INSTEAD OF'
                when (t.tgtype::int &  2) <> 0 then 'BEFORE'
                else 'AFTER' end) || ' ' ||
          concat_ws('/',
            case when (t.tgtype::int &  4) <> 0 then 'INSERT'   end,
            case when (t.tgtype::int &  8) <> 0 then 'DELETE'   end,
            case when (t.tgtype::int & 16) <> 0 then 'UPDATE'   end,
            case when (t.tgtype::int & 32) <> 0 then 'TRUNCATE' end))::text as fires,
         (p.proname || case when p.prosecdef
                            then '  [SECURITY DEFINER]' else '' end)::text as runs,
         t.tgenabled::text                              as enabled,
         ((t.tgtype::int & 8) <> 0)                     as touches_delete
    from pg_trigger   t
    join pg_class     c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc      p on p.oid = t.tgfoid
   where t.tgisinternal = false
     and n.nspname in ('public', 'auth')
),
rul as (
  select 'rewrite rule'::text, schemaname::text, tablename::text, rulename::text,
         'REWRITE RULE'::text, left(definition, 120)::text, '-'::text,
         (definition ilike '%delete%')
    from pg_rules
   where schemaname in ('public', 'auth')
     and rulename <> '_RETURN'
)
select * from trg
union all
select * from rul
 order by touches_delete desc, schema_name, on_object, name;
```

**Column meanings.** `fires` decodes `tgtype`'s bitmask (`INSTEAD OF` means the real
operation never happens). `enabled`: `O` origin, `D` disabled, `A` always, `R` replica —
anything but `O` on a trigger you rely on is its own finding. `touches_delete` sorts first,
so every row that matters is at the top.

**Expected:** exactly one row, `touches_delete = false` —
`auth · users · on_auth_user_created · AFTER INSERT · handle_new_user [SECURITY DEFINER] · O`.
Zero rewrite rules.

**Finding — stop the arc:** any row with `touches_delete = true`, or any `rewrite rule`.
A `BEFORE DELETE` trigger that raises aborts the deletion *after* the Paddle cancel has
already run and cannot be undone; an `AFTER DELETE` trigger writing to an audit table can
recreate personal data after erasure. Either is a design input, not a footnote.

---

## Run 2 — the object census

Tests the claim that no *other* unrecorded privileged object exists. `rls_auto_enable` was
found on 2026-08-24 by exactly this kind of enumeration, and a database that held one
unrecorded object can hold two.

**Extension-owned functions are excluded, and they must be.** pgvector installs into
`public` here; without the `pg_depend.deptype = 'e'` filter this returns ~131 rows and is
uninterpretable.

```sql
select 'function'::text                                    as kind,
       n.nspname::text                                     as schema_name,
       p.proname::text                                     as name,
       pg_get_function_identity_arguments(p.oid)::text      as detail,
       (case when p.prosecdef then 'SECURITY DEFINER'
                              else 'security invoker' end)::text as privilege,
       coalesce(array_to_string(p.proconfig, ', '),
                '(search_path NOT pinned)')::text              as config,
       pg_get_userbyid(p.proowner)::text                    as owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and not exists (select 1 from pg_depend d
                    where d.objid = p.oid
                      and d.classid = 'pg_proc'::regclass
                      and d.deptype = 'e')
union all
select 'event trigger'::text,
       '(cluster-wide)'::text,
       e.evtname::text,
       (e.evtevent || ' on ' ||
        coalesce(array_to_string(e.evttags, ','), 'ALL COMMANDS') ||
        '  [enabled=' || e.evtenabled::text || ']')::text,
       (case when p.prosecdef then 'SECURITY DEFINER'
                              else 'security invoker' end)::text,
       ('executes ' || p.proname)::text,
       pg_get_userbyid(e.evtowner)::text
  from pg_event_trigger e
  join pg_proc p on p.oid = e.evtfoid
 order by kind, name;
```

**Expected:** **six** project functions in `public` — `current_streak`, `handle_new_user`,
`increment_usage`, `match_chunks`, `record_study_event`, `rls_auto_enable` — of which **five
are declared in `supabase/migrations/` and `rls_auto_enable` is NOT**, because it exists only in
the database; that is register #62's divergence class (4), and this read reviews its body
without repairing it; plus seven event triggers: `ensure_rls` (owner `postgres`,
executes `rls_auto_enable`) and six `supabase_admin`-owned Supabase platform triggers
(`issue_graphql_placeholder`, `issue_pg_cron_access`, `issue_pg_graphql_access`,
`issue_pg_net_access`, `pgrst_ddl_watch`, `pgrst_drop_watch`).

**Finding — stop the arc:** any function or event trigger that is neither of those. Its
body has to be read before anything is built on this schema.

**NOT a finding, and this is a correction to an earlier version of this read.** Event
triggers firing on `sql_drop` are **not** in a deletion's path. `sql_drop` fires for DDL
`DROP` statements. Account deletion is DML — `DELETE FROM` — and **PostgreSQL event
triggers never fire on DML at all.** An earlier draft told the runner to stop on any
`sql_drop` event trigger; that rule conflated DDL `DROP` with row `DELETE` and would have
halted the arc on PostgREST schema-cache machinery that cannot touch it.

---

## Run 3 — the body of `rls_auto_enable`

What the repository knows about this function is that its `search_path` is pinned — a
`pg_proc.proconfig` fact. **A pinned `search_path` is not a reviewed body.** #62: *its
source exists only in the database.*

```sql
select p.oid::regprocedure::text                     as identity,
       n.nspname::text                                as schema_name,
       p.prosecdef                                    as security_definer,
       coalesce(array_to_string(p.proconfig, ', '),
                '(search_path NOT pinned)')             as config,
       pg_get_userbyid(p.proowner)::text              as owner,
       pg_get_functiondef(p.oid)                      as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname = 'rls_auto_enable'
   and n.nspname not in ('pg_catalog', 'information_schema');
```

**Expected:** one row; an `event_trigger` function that loops
`pg_event_trigger_ddl_commands()` and runs `alter table if exists … enable row level
security` on newly created `public` tables. **Touches nothing that already exists.**

**Finding — stop the arc:** a body that modifies existing rows or objects, drops or alters
policies, writes to any table, or reacts to anything other than table creation.

---

## Run 4 — Q8: CHECK constraints, failing closed in both directions

Built the way the spine query was: the **expected set drives the result** and the database
is joined onto it, so an absent constraint renders `MISSING` rather than vanishing from a
shorter result nobody counts. `full outer` rather than `left`, so a CHECK that exists in
production and not in the folder renders `UNRECORDED`.

`quiz_attempts`' three CHECKs are deliberately absent from the expected set:
`20260709_quiz_attempts_drop.sql` drops that table. If they appear, they appear as
`UNRECORDED`, which is the correct answer.

```sql
with expected(table_name, constraint_name) as (
  values ('quiz_items'::text,  'quiz_item_valid'::text),
         ('quiz_items',         'position_non_negative'),
         ('quizzes',            'quizzes_lang_valid'),
         ('study_events',       'study_event_kind_valid')
),
observed(table_name, constraint_name, definition) as (
  select c.relname::text, con.conname::text, pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class     c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where con.contype = 'c'
     and n.nspname = 'public'
)
select coalesce(e.table_name, o.table_name)           as table_name,
       coalesce(e.constraint_name, o.constraint_name) as constraint_name,
       case when e.constraint_name is null
              then 'UNRECORDED - live, not in the folder'
            when o.constraint_name is null
              then 'MISSING - in the folder, not live'
            else 'present' end                       as status,
       coalesce(o.definition, '(absent)')              as live_definition,
       (e.constraint_name is not null
        and o.constraint_name is not null)              as ok
  from expected e
  full outer join observed o
    on o.table_name = e.table_name
   and o.constraint_name = e.constraint_name
 order by ok, table_name, constraint_name;
```

**`ok` asserts existence, not text.** `live_definition` is for the eye: comparing rendered
SQL mechanically produces false findings on whitespace alone, and a query that asserted
more than it can decide would be worse than one that decides less and says so.

**Expected definitions:**

| constraint | definition |
|---|---|
| `quizzes_lang_valid` | `CHECK ((lang = ANY (ARRAY['ar'::text, 'en'::text])))` |
| `study_event_kind_valid` | `CHECK ((kind = ANY (ARRAY['quiz_submitted'::text, 'summary_generated'::text, 'question_asked'::text, 'material_uploaded'::text])))` |
| `position_non_negative` | `CHECK (("position" >= 0))` |
| `quiz_item_valid` | a `CASE` over `jsonb_typeof(options)` requiring a non-empty array and `correct_index` inside its bounds |

**Finding — record, do not stop.** A `MISSING` or differently-valued `quizzes_lang_valid` /
`study_event_kind_valid` voids register **#42**'s ground for excluding `Quiz.lang` and
`StudyEventKind` (*"DB-CHECK-backed — a different invariant kind, not app-enforced-only"*);
they become app-enforced-only, which is #42's open class. Nothing here blocks the deletion
work, which is why this run is last.

---

## Note on PostgreSQL 17

`pg_constraint.contype = 'c'` is CHECK only. From PostgreSQL 17, `NOT NULL` constraints also
appear in `pg_constraint`, as `contype = 'n'` — they do not pollute Run 4, but do not widen
that filter without re-reading this line. Production read `17.6` on 2026-09-02.
