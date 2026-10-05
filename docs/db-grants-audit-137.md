# Register #137, step 1: the write-grant audit of schema `public`

**Status: audit only. Read-only. Nothing in production changed, no grant changed, no migration written.**
Recorded 2026-10-05 against `main` at `ab7f402`. The owner's ruling of 2026-10-05 approved both halves of
row #137 (default privileges in principle; existing tables on condition of this audit first), and
fixed this step to the audit alone.

Two sides were read, with one query, `scripts/sql/read-public-grants.sql` (thirteen catalog sections,
each aggregated into one cell because the SQL editor's grid renders 14 rows at a time):

- **Expected side**: a database built from `supabase/migration-order.txt` (17 of 18 files applied,
  `002_storage.sql` skipped by the manifest) on Supabase's own postgres image, the digest
  `scripts/verify-subscriptions-rls.mjs` pins. Run 2026-10-05, output in §7.
- **Live side**: the production project, from the SQL editor, the same text. §8.

The code side is a grep of every `.from('<table>')` / `.table("<table>")` chain in `src/`,
`services/ingestion/` and `scripts/` followed within six lines by `insert`, `update`, `delete` or
`upsert`, every `.rpc(` call, and every client factory, with the role each client runs as. Line numbers
are at `ab7f402`.

## 1. Findings first

1. **Production carries five policies the repository never wrote (schema drift, not a hole).**
   The live read (§8) lists a second `FOR ALL` policy on each of `profiles` (`Users own profile`,
   `auth.uid() = id`), `knowledge_bases` (`Users own KBs`, `auth.uid() = user_id`), `documents`
   (`Users own documents`, `kb_id IN (SELECT id FROM knowledge_bases WHERE user_id = auth.uid())`),
   `conversations` (`Users own conversations`, `auth.uid() = user_id`) and `messages`
   (`Users own messages`, `conversation_id IN (SELECT id FROM conversations WHERE user_id =
   auth.uid())`), beside the repo's `Users can manage own ...` policy on the same table. No migration,
   commit or runbook names them; they were created by hand in the dashboard at some point before this
   audit. Each tests the same ownership as its twin, and permissive policies combine with OR, so they
   widen nothing; but the register's rule since #23 is that the live schema matches the migrations, and
   here it does not. The entitlement harnesses never saw them because they are built from the repo.
   **Verdict: drop the five by a repair migration in the first grants PR, after this record.**
2. **Production has an event trigger the repository never wrote, and it is benign.** `ensure_rls`
   (`ddl_command_end`, tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`, owner `postgres`) calls
   `public.rls_auto_enable()`, a `SECURITY DEFINER` plpgsql function with `search_path = pg_catalog`
   that runs `alter table if exists ... enable row level security` on every new table in `public` and
   logs the result. It is the platform's "automatically enable RLS on new tables" guard, created under
   the project's `postgres` role, not in any migration. It writes no rows and is not callable as a
   plain function (an event-trigger function refuses a direct call). It is the one object on
   production that the ruled default-privileges change complements rather than duplicates: a future
   table gets RLS from this trigger and, after #137, no write grant from the default ACL.
   **Verdict: keep; record it in the repository as a known platform object** so the next drift read
   does not re-discover it.
3. **`waitlist` is an open anonymous write path with no caller.** Policy `Anyone can join waitlist`
   (`FOR INSERT WITH CHECK (true)`, `003_waitlist.sql:10`) plus the default `INSERT` grant lets any
   holder of the public anon key (it ships in the browser bundle and sits in
   `.github/workflows/deletion-orphan-watch.yml`) insert unlimited rows with arbitrary e-mail addresses.
   The only app code that ever inserted into it was removed on 2026-07-01 (`2234aa0`, "remove dead
   waitlist code"); the one remaining code path is the account-deletion `DELETE` by e-mail, as
   `service_role` (`src/lib/account-deletion/orchestrate.ts:142`). Effect of abuse: junk personal data
   stored under our name, `email UNIQUE` lets an attacker pre-occupy an address, and the deletion sweep
   erases an attacker's row carrying a victim's address on that victim's account deletion (harmless).
   Not an entitlement or data-exposure hole: there is no `SELECT` policy, so nothing can be read back.
   **Verdict: revoke `INSERT`, `UPDATE`, `DELETE` from `anon` and `authenticated` in the first
   grants PR.** Dropping the policy itself is a policy change and belongs to the same PR by the owner's
   "its own migration" rule, but it is outside this audit step.
4. **No other table has a client write that the application does not need.** Every remaining
   `anon`/`authenticated` write grant is either used by a real path as `authenticated` (§2) or is
   already dead behind row security with no policy (`usage_counters`, `study_events`:
   the definer functions are the only writers). `anon` has **no** legitimate write on any table: every
   policy but the waitlist one tests `auth.uid()`, which is NULL for `anon`.
5. **Not a grant matter, recorded because the audit saw it: the free-tier subject cap is enforced on
   the client only.** `src/app/[locale]/dashboard/knowledge/new/page.tsx:59` asks `/api/check-limit`
   and then inserts from the browser (`:73`); the policy on `knowledge_bases` (`FOR ALL USING
   (auth.uid() = user_id)`) and the `INSERT` grant let a signed-in student call PostgREST directly and
   skip the check. Cost to us: nil (a subject is a row); product effect: the cap is advisory. The fix is a
   server route or a database-side count check, not a REVOKE, since the app needs this insert.
6. **`profiles.plan` is writable by its owner and read by nothing.** The policy is `FOR ALL`, the
   `UPDATE` grant is live, and no code reads the column for entitlement (`src/types/index.ts:196`:
   retired as a signal; `Tier` comes from `subscriptions`). No exposure today; a future reader of that
   column would inherit a user-settable value. The only writer is the signup upsert
   (`src/app/[locale]/signup/page.tsx:87`), which is **unreachable in production**: it runs only when
   `signUp` returns a session, and e-mail confirmation is on, so GoTrue returns none (`:76`). The
   trigger `handle_new_user` already writes `full_name` from the metadata `signUp` sends (`:55`).
   **Verdict: `profiles` can lose all three verbs once that dead upsert is deleted in the same PR**, so
   the record does not keep a write path the grant refuses.
7. **The definer functions are executable by `PUBLIC`.** `increment_usage`, `record_study_event`,
   `handle_new_user`, `current_streak` and `match_chunks` carry `=X/postgres` (every role may execute),
   because `grant execute ... to authenticated` adds to the default rather than replacing it. The two
   writers refuse a NULL `auth.uid()` (`raise exception 'not authenticated'`), so an anonymous call does
   nothing; `has_unresolved_deletion_orphan` is the one function that revoked `PUBLIC` first
   (`20260904:186`). Hygiene, not a hole; a candidate for the last grants PR.
8. **Nothing urgent.** No table lets `anon` or a signed-in student write another student's row; the
   wall for every table is row security, as #126 recorded, and this audit found no policy that fails
   to test ownership except the waitlist one above.

## 2. Table by table: writers and verdict

Roles: **svc** = `service_role` (a server-only key; bypasses RLS), **auth** = `authenticated` (the
student's own JWT, through the Next.js route client `src/lib/supabase/server.ts`, the browser client
`client.ts`, or the Railway ingestion service, which forwards the student's token on top of the anon key,
`services/ingestion/main.py:157-175`), **def** = a `SECURITY DEFINER` function (runs as its owner,
`postgres`; a REVOKE on the table does not touch it), **RI** = a foreign-key cascade (runs with the
referencing table owner's rights; no grant involved).

| Table | Policies (cmd / roles) | Writers today (file:line, role) | Verdict for `anon` + `authenticated` |
|---|---|---|---|
| `profiles` | ALL / public: `auth.uid() = id` (+ live duplicate `Users own profile`, §1.1) | `handle_new_user` trigger on `auth.users` (def, `001:14`); `signup/page.tsx:87` upsert (auth, unreachable, §1.6); RI cascade from `auth.users` | **Revoke INSERT, UPDATE, DELETE** after deleting the dead upsert. |
| `knowledge_bases` | ALL / public: `auth.uid() = user_id` (+ live duplicate `Users own KBs`) | `dashboard/knowledge/new/page.tsx:73` insert (auth, browser) | **Keep INSERT for `authenticated`; revoke UPDATE, DELETE; revoke all three from `anon`.** Subject delete (register #47, not built) will GRANT DELETE in its own migration. |
| `documents` | ALL / public: owner via `knowledge_bases` (+ live duplicate `Users own documents`) | insert `api/ingest/route.ts:170` (auth); update `ingest:219,236,260`, `api/summarize/route.ts:277`, `lib/material-rename.ts:111,133`, Railway `services/ingestion/main.py:237,265` (all auth); delete `lib/material-deletion.ts:253` (auth, the `session` client; the `admin` client there touches storage only) | **Keep INSERT, UPDATE, DELETE for `authenticated`; revoke all three from `anon`.** |
| `conversations` | ALL / public: `auth.uid() = user_id` (+ live duplicate `Users own conversations`) | insert `api/agent/route.ts:247` (auth); RI from `knowledge_bases` | **Keep INSERT; revoke UPDATE, DELETE; all three from `anon`.** |
| `messages` | ALL / public: owner via `conversations` (+ live duplicate `Users own messages`) | insert `api/agent/route.ts:256,345` (auth); RI | **Keep INSERT; revoke UPDATE, DELETE; all three from `anon`.** |
| `waitlist` | INSERT / public: `true` | delete `lib/account-deletion/orchestrate.ts:142` (svc). No insert anywhere since `2234aa0`. | **Revoke INSERT, UPDATE, DELETE from both** (§1.3). |
| `subscriptions` | SELECT / public: `auth.uid() = user_id` | upsert/update `api/paddle/webhook/route.ts:115,155` (svc) | Done by #126 (`20261004`). Nothing further. |
| `chunks` | SELECT, INSERT, DELETE / public: owner via `knowledge_bases` | delete `services/ingestion/main.py:217`, insert `:231` (auth, forwarded token); `backfill.py:133,137` (svc, one-shot script) | **Keep INSERT, DELETE for `authenticated`; revoke UPDATE; all three from `anon`.** |
| `usage_counters` | SELECT / public: `auth.uid() = user_id` | `increment_usage` (def, `20260708:117`) via `lib/rate-limit.ts:118` | **Revoke INSERT, UPDATE, DELETE from both.** No policy permits a client write today; the grant is dead weight. |
| `quizzes` | ALL / public: owner via `documents` | insert `api/quiz/generate/route.ts:360`, delete `:398` (auth) | **Keep INSERT, DELETE; revoke UPDATE; all three from `anon`.** |
| `quiz_items` | ALL / public: owner via `quizzes` | insert `api/quiz/generate/route.ts:392` (auth); RI from `quizzes` | **Keep INSERT; revoke UPDATE, DELETE; all three from `anon`.** |
| `study_events` | SELECT / public: `auth.uid() = user_id` | `record_study_event` (def, `20260709:112`) via `lib/study-events.ts:72` | **Revoke INSERT, UPDATE, DELETE from both.** |
| `account_deletion_orphans` | none (RLS on, no policy) | insert `lib/account-deletion/orphan-record.ts:110` (svc) | Already `revoke all ... from anon, authenticated` (`20260904:137`). Nothing further. |

`quiz_attempts` was created and dropped on the same day (`20260709_quiz_attempts_drop.sql`); it does not
exist. No view, materialised view, foreign table or sequence exists in `public` on the expected side
(every `id` is `gen_random_uuid()`), and no column-level ACL exists.

Reads are untouched by every verdict above: `SELECT` stays granted everywhere it is today.

**What the verdicts do not claim.** Every "keep" grant is used by the student's own role, so a student
can also issue that write directly through PostgREST, bypassing the route that normally performs it
(a `documents` row without a file, a `chunks` row with a chosen embedding, a `quizzes` row). Row
security confines each to the student's own subjects, and none spends our money (the paid calls sit in
the routes behind `enforceLimit`). Column-level revokes cannot narrow this: the server routes and the
Railway service write those columns as the same `authenticated` role.

## 3. Functions, triggers and views that write

Expected side, `public`, extension-owned functions excluded (the pgvector operators belong to the
extension, which lives in `public` on the image):

| Function | Mode | Owner | Writes | Execute | Called from |
|---|---|---|---|---|---|
| `handle_new_user()` | DEFINER, no `search_path` pin | postgres | `profiles` INSERT | PUBLIC + the three API roles | trigger `on_auth_user_created` on `auth.users` (fired by GoTrue as `supabase_auth_admin`) |
| `increment_usage(text)` | DEFINER, `search_path=public` | postgres | `usage_counters` INSERT/UPDATE (own row only, `auth.uid()`) | PUBLIC + API roles | `src/lib/rate-limit.ts:118` |
| `record_study_event(text)` | DEFINER, `search_path=public` | postgres | `study_events` INSERT (own row only) | PUBLIC + API roles | `src/lib/study-events.ts:72` |
| `has_unresolved_deletion_orphan()` | DEFINER, `search_path=''` | postgres | none (one boolean) | `anon`, `authenticated`, `service_role`, `postgres` (PUBLIC revoked) | `deletion-orphan-watch.yml` |
| `current_streak(text)` | INVOKER | postgres | none | PUBLIC + API roles | `src/lib/streak.ts:71` |
| `match_chunks(...)` | INVOKER | postgres | none | PUBLIC + API roles | `src/app/api/agent/route.ts:155` |

Live only (§8): `rls_auto_enable()` (DEFINER, `search_path=pg_catalog`, owner `postgres`, executable
by PUBLIC and the API roles, `writes=f`), the event-trigger function of §1.2; and the platform's own
event triggers owned by `supabase_admin` (`pgrst_ddl_watch`, `pgrst_drop_watch`, the three
`issue_pg_*_access` and `issue_graphql_placeholder`), which touch no table of ours.

The `6.definers` sweep (every `SECURITY DEFINER` function in any non-system schema whose body contains a
write verb and names `public.`) returns exactly the three definer writers above. The only non-internal
trigger on a public table or on `auth.users` is `on_auth_user_created`. No views.

Consequence for #137: a REVOKE on `usage_counters`, `study_events` or `profiles` changes nothing for
these three functions; they keep writing as `postgres`. `handle_new_user` has no `search_path` pin, which
`20260904` noted as the repo's older style; it is reachable only by GoTrue's insert, so it is listed, not
flagged.

## 4. Default privileges: who grants what, and which grantor our paths create tables under

Expected side (`4.defacl`, schema `public` rows):

| Grantor | Object | ACL handed to new objects |
|---|---|---|
| `postgres` | tables | `postgres, anon, authenticated, service_role = arwdDxtm` |
| `postgres` | sequences | the four roles `= rwU` |
| `postgres` | functions | the four roles `= X` |
| `supabase_admin` | tables | the same four roles `= arwdDxtm` |
| `supabase_admin` | sequences | `rwU` |
| `supabase_admin` | functions | `X` |

Other grantors in the catalog scope other schemas (`storage` by `postgres`; `auth` by
`supabase_auth_admin`; `realtime` and `graphql_public` by `supabase_admin`) and never touch `public`.
No row has `defaclnamespace = 0` (a global default), so nothing outside these rows applies.

**Which grantor our real paths use.** A default ACL applies to objects created *by that grantor role*.
Every table in `public` is owned by `postgres` on the expected side, and the four paths that have ever
created a table here all run as `postgres`:

- the SQL editor, where every migration has been applied by hand (`supabase-migration-runbook.md` §0,
  register #23); the live read's `0.who` section proves it runs as `postgres` (§8);
- the dashboard table editor, which goes through the same `postgres` connection (the role the
  `postgres` entry in `11.roles` describes: login, `bypassrls`, `createrole`, member of the three API
  roles and of `supabase_privileged_role`);
- `scripts/gen-db-types.sh` and the two verify harnesses, which apply migrations with `psql -U postgres`
  against throwaway containers (never production);
- a Supabase CLI `db push`, which the repo cannot run (`migration-order.txt` explains why) and which
  also connects as `postgres`.

`supabase_admin` is the platform's superuser: it creates extension objects and the platform's own
schemas, and nothing of ours. It is not a role `postgres` can act for: `postgres` is not a member of it
(`11.roles`), so `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...` from the editor would fail with
"must be member of role", and that entry cannot be changed by us at all.

**The statement, therefore, names `postgres` and only `postgres`:**

```sql
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon, authenticated;
```

Reversal: the same statement with `grant ... to`. It changes only the `postgres`/`public`/tables row of
`pg_default_acl`; existing tables, sequences, functions, `service_role` and the `supabase_admin` row are
untouched. The residual gap, a table created in `public` by `supabase_admin`, is covered by the
table-by-table rule (a new table's own migration declares and proves its grants) and by the live read,
which lists owners.

## 5. Where the owner's ruling and this audit disagree

- **"Revoke table by table, each with its own baseline, rollback and proof."** Thirteen separate
  migrations would be thirteen hand applications in the editor and thirteen live reads for statements
  that are each one line. The audit keeps the per-table baseline (the §2 row), the per-table rollback
  (one `grant` line each, recorded in the migration header) and the per-table proof (one assertion row
  each in a grants matrix), but groups them into **three migrations by risk**, so each application is
  one editor run and one read. The grouping is proposed, not assumed; a table-per-PR schedule needs no
  new audit, only more PRs.
- **Default privileges "approved in principle".** The audit recommends building it **last**, after the
  grants-matrix proof exists in CI: the proof is what catches a future migration that creates a table
  and forgets its GRANT, which row #137 named as the risk of (b). Done first, the REVOKE adds risk
  with nothing yet watching for it.
- **Anon.** The ruling speaks of `anon` and `authenticated` together. The audit found no legitimate
  `anon` write on any table, so `anon` loses all three verbs everywhere in the first PR, not table by
  table.

## 6. The build plan this audit supports

Three `fix(#137)` PRs, each with the #126 shape: migration file with the production baseline and the
verbatim rollback in its header, `migration-order.txt` entry, a proof that fails without the migration
(deliberate red run recorded), hand application in the SQL editor after merge, then the live read
`scripts/sql/read-public-grants.sql` compared with the expected side, and the write proofs as the API
roles inside aborted transactions. Then one `docs(#137)` PR per step.

1. **PR A, dead grants and `anon`.** `revoke insert, update, delete on table public.waitlist,
   public.usage_counters, public.study_events from anon, authenticated;` and `revoke insert, update,
   delete on table public.profiles, public.knowledge_bases, public.documents, public.conversations,
   public.messages, public.chunks, public.quizzes, public.quiz_items from anon;`. Drop the waitlist
   INSERT policy in the same file. Add `scripts/verify-public-grants.mjs`: a declared intended-writers
   matrix (table x role x verb) asserted against the migrations-built database, plus for each
   revoked table a write as `authenticated` that must answer `42501`. CI job `public-grants`, made
   required after its first green run on `main`. The same migration drops the five hand-made duplicate
   policies of §1.1 (`drop policy if exists "Users own ..." on ...`, five lines), so the live schema
   and the repository agree before any grant moves; the proof asserts the policy count per table.
2. **PR B, the live tables' unused verbs for `authenticated`.** `knowledge_bases` UPDATE, DELETE;
   `conversations` UPDATE, DELETE; `messages` UPDATE, DELETE; `chunks` UPDATE; `quizzes` UPDATE;
   `quiz_items` UPDATE, DELETE. Matrix updated; proof adds, for each kept verb, a write as the owner
   that succeeds and is rolled back, so a revoke that over-reaches goes red.
3. **PR C, the future.** The `alter default privileges for role postgres` statement above, `profiles`
   losing all three verbs with the dead signup upsert deleted, and `revoke execute ... from public` on
   the five functions in §1.7 (re-granting `authenticated` where the app calls them). The proof then
   asserts the `pg_default_acl` row on the migrations-built database, and the live read confirms it on
   production.

Order of application on production: A, then B, then C, each only after its own live read.

## 7. Expected side: the read on the migrations-built database (2026-10-05)

`0.who`: `current_user=postgres session_user=postgres` (the harness connects as `postgres`; on the
expected side this proves nothing about the editor, which §8 does).

`1.relations` (13 tables, all `kind=r owner=postgres rls=t forced=f`):

- `account_deletion_orphans`: `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`
- `subscriptions`: `{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=arwdDxtm/postgres}`
- the other eleven (`chunks`, `conversations`, `documents`, `knowledge_bases`, `messages`, `profiles`,
  `quiz_items`, `quizzes`, `study_events`, `usage_counters`, `waitlist`):
  `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`

`2.privs` (has_table_privilege, SELECT INSERT UPDATE DELETE): `account_deletion_orphans` anon and
authenticated all `false`, service_role all `true`; `subscriptions` anon and authenticated
`true false false false`, service_role all `true`; every other table all `true` for all three roles.

`3.policies`: the fourteen policies of §2, all `PERMISSIVE`, all `roles=public`, bodies as the
migrations wrote them (the ownership subselects expand to `( SELECT knowledge_bases.user_id FROM
knowledge_bases WHERE (knowledge_bases.id = ...))`).

`4.defacl`: the six `public` rows of §4, plus `storage` (grantor `postgres`), `auth` (grantor
`supabase_auth_admin`, grantees `postgres` and `dashboard_user`), `realtime` and `graphql_public`
(grantor `supabase_admin`). No global row.

`5.functions`: the six functions of §3. `6.definers`: `public.handle_new_user()`,
`public.increment_usage(p_kind text)`, `public.record_study_event(p_kind text)`. `7.triggers`:
`auth.users | on_auth_user_created | fn=handle_new_user enabled=O`. `8.views`: none. `9.colacl`: none.
`10.sequences`: none.

`11.roles`: `anon`, `authenticated` and `service_role` cannot log in; `service_role` has `bypassrls`;
`authenticator` logs in and is a member of all three (PostgREST's switch); `postgres` logs in, is not
superuser, has `bypassrls` and `createrole`, and is a member of `anon`, `authenticated`,
`authenticator`, `service_role`, `supabase_privileged_role` and the `pg_*` monitoring roles;
`supabase_admin` is the superuser. `12.schema`: `public` owned by `pg_database_owner`, `USAGE` to
`PUBLIC`, `postgres`, `anon`, `authenticated`, `service_role`.

## 8. Live side: the production read (2026-10-05, ~19:45Z)

Method: the owner signed in to the dashboard; the agent loaded `scripts/sql/read-public-grants.sql`
into the SQL editor and ran it once (13 rows). The grid holds every cell's full text in the page, so
the comparison was done in the page: each line of each section hashed and matched against the
expected side's hashes (the same djb2 over trimmed lines); only unmatched lines were read out in
full. A second read-only statement then fetched the one function body and `pg_event_trigger`.
Nothing was written; no user row was read. The editor auto-saved the statement as an "Untitled
query" in the owner's private list, as it does for every run.

**Identical to §7, line for line:** `0.who` (`current_user=postgres session_user=postgres`: the
editor, and therefore every hand-applied migration, runs as `postgres`), `1.relations` (13 tables,
owners, RLS flags, every `relacl` byte-identical, including `subscriptions` after #126 and
`account_deletion_orphans`), `2.privs` (all 39 matrix lines), `6.definers` (the same three),
`7.triggers` (`on_auth_user_created` only), `8.views`, `9.colacl`, `10.sequences` (none),
`11.roles` (all eleven lines, including `postgres` not a member of `supabase_admin`), `12.schema`.

**`4.defacl`: the six `public` rows identical.** One line differs, outside our scope: the
`supabase_admin` / `realtime` / tables row reads `postgres=a*r*wdDxtm` on production (grant option on
INSERT and SELECT), `arwdDxtm` on the image. Platform-owned, no bearing on #137.

**`3.policies`: 43 lines live against 34 expected; every expected line present; the nine extra lines
are the five policies of §1.1** (two of them span three lines because their `IN (SELECT ...)` bodies
wrap). Policy count per table on production: `chunks` 3, `conversations` 2, `documents` 2,
`knowledge_bases` 2, `messages` 2, `profiles` 2, and 1 each on `quiz_items`, `quizzes`,
`study_events`, `subscriptions`, `usage_counters`, `waitlist`; `account_deletion_orphans` none.

**`5.functions`: 7 live against 6 expected; the six expected lines identical; the extra is
`rls_auto_enable()`** of §1.2. `pg_event_trigger` on production: `ensure_rls` (owner `postgres`,
`ddl_command_end`, tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`, function
`rls_auto_enable`, enabled) and six platform triggers owned by `supabase_admin`
(`pgrst_ddl_watch`, `pgrst_drop_watch`, `issue_pg_cron_access`, `issue_pg_graphql_access`,
`issue_pg_net_access`, `issue_graphql_placeholder`).

**What the live side changes in the verdicts:** nothing in §2's grant verdicts (the grants are
byte-identical to the expected side), and two additions to the plan: the policy repair in PR A
(§6) and the platform object recorded here.
