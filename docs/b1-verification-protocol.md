# (b1) verification protocol — register #51

**Status: PINNED 2026-07-26, before PR A merges.** This file is the binding definition of
"verified" for the three-PR (b1) sequence. It is written **before** the work so the acceptance
criteria cannot be renegotiated afterwards, and its results table is filled in **as** the work
proceeds so that a future reader can tell a checked box from an assumed one.

Why this is a file and not a PR body: register **#39**'s standing rule is that "live-proven" and
"repo-reproducible" are two separate claims and a ✅ requires both. A protocol that lives only in
GitHub's UI is not in the repo — it cannot be diffed, cannot be grepped, and does not survive a
clone. It also cannot be a §7 changelog block: `PROGRESS.md` §7 entries are **immutable once they
land** and must render as a single added hunk with zero deletions, whereas this document is written
before the work and annotated with outcomes after it. §7 instead carries one immutable block per PR
that points here and states the outcome.

Precedent: `docs/b5b-scoping.md` was created as its own file for the same reason under register #50.

---

## 0. The sequence this protocol gates

| PR | Contents | Effect on production |
|----|----------|----------------------|
| **A0** | CI only: build the ingestion image and import the module inside it | None. No service code changes. |
| **A** | `services/ingestion/` gains `/ingest` and **keeps** a byte-identical `/convert` shim | New image goes live. Production Next still calls `/convert`. |
| **B** | `src/app/api/ingest/route.ts` repointed to `/ingest` | Production Next starts using `/ingest`, which is already live. |
| **C** | `/convert` shim deleted | The temporary re-exposure of register #50's blob endpoint is closed. |

The split exists because Railway auto-deploys `main` and Vercel deploys `main` independently, in an
order nobody controls. A single merge that renamed the endpoint **and** repointed the caller had a
real skew window: if Vercel won the race, the new route's `/ingest` call hit an image that did not
have it yet — a 404, `!pyResponse.ok`, and **every upload failing** until the Docker build landed.
Landing the service first, with both endpoints live, makes that window zero-length.

---

## 1. The eight verification points, verbatim from PR #70

Reproduced exactly as written in PR #70's body. No paraphrase, no renumbering, no silent edits.
Corrections and re-timings are recorded in §2 below and never by altering the text here.

### 1.1 Preamble — binding

> **Verification must go through the authenticated preview UI or a read-only SQL query.** The
> preview is **SSO-gated — `curl` cannot reach it anonymously**, and an unauthenticated request
> produces the SSO page, not a result. Uploads burn a rate-limit credit and the #22 free tier: use a
> throwaway subject and delete the rows after.

### 1.2 Preamble — ~~STRUCK~~

> ~~**Deploy Railway and Vercel both from this branch before testing** — the endpoint rename means a
> mixed deploy 404s (loudly, by design).~~

**STRUCK 2026-07-26. Reason:** this instruction is the *branch-repoint* procedure — pointing
Railway's production service at a feature branch. That plan was adjudicated and rejected: it creates
a state where the live service runs code `main` does not deploy, which is register **#39**'s failure
class one layer down, and it leaves Railway pointed at a branch that GitHub auto-deletes on merge.
The three-PR sequence replaces it entirely. **Replacement instruction:** *PR A is merged and its
image is confirmed live (V1, V2) before any of items 3–7 is attempted.* **Editorial note:** the
blockquote markers and the strikethrough in §1.2 are this document's own annotation, not part of
PR #70's text, which carries the sentence as plain unstruck body text.

### 1.3 The eight

> 1. **Image builds without an import crash.** Railway build succeeds and the container starts — this PR adds `supabase==2.29.0` to `requirements.txt` and imports `acreate_client`/`AsyncClient`/`AsyncClientOptions` at module scope, so a bad resolve is a boot-time crash, not a runtime one. Confirm `/health` returns 200.
> 2. **Railway env present.** `GET /health` returns `"supabase_configured": true`. If it is `false`, `SUPABASE_URL` and/or `SUPABASE_ANON_KEY` are missing and every upload will fail closed at 503. **Set `SUPABASE_ANON_KEY` to the anon/publishable key — never the service-role key.**
> 3. **Authenticated end-to-end upload reaches `status='ready'`.** Upload through the preview UI; then confirm the `documents` row has `status='ready'`, `embedding_status='ready'`, a **`chunk_count` matching the actual `chunks` row count**, and **non-null `markdown_content`**.
> 4. **`chunks` rows present with a non-null `vector(1024)`.** Confirm the chunk rows exist for that `document_id` and that `embedding` is non-null with **1024 dimensions** (`vector_dims(embedding)`) — this is the check that the embeddings actually crossed into Postgres as vectors rather than as null/text.
> 5. **The Ask/agent retrieval path returns results for the new doc.** Ask a question in that subject whose answer is only in the new document; confirm `match_chunks` retrieves from it. This is the real proof that persistence-by-Railway produced chunks the existing retrieval path can use.
> 6. **A forced failure leaves `status='error'` with no partial chunk set and no stuck `processing`.** Force a failure (e.g. temporarily break `VOYAGE_API_KEY` on Railway, or upload a file that fails conversion) and confirm the row lands at `status='error'` with an `error_message`, **zero** chunk rows for that document, and **nothing left at `processing`**. Restore the env afterwards.
> 7. **`study_events` `kind='material_uploaded'` fires exactly once** for one successful upload — not zero (the emit is still gated on the ack) and not twice.
> 8. **BLOCKING SECURITY CHECK — no service-role key reached Railway.** Inspect the Railway service's environment variables directly and confirm **no `SUPABASE_SERVICE_ROLE_KEY` and no other RLS-bypassing credential is set**, and that `SUPABASE_ANON_KEY` holds the **anon** key (decode it: the JWT's `role` claim must be `anon`, not `service_role`). **If a service-role key is present, do not merge — remove and rotate it first.** Repo-side proof is already in this PR (`grep` shows zero service-role env reads in `main.py`, the Dockerfile, or the route; the only hits are prose forbidding it and the local-only `backfill.py`, which the Dockerfile does not copy into the image) — item 8 verifies the **live environment**, which the repo cannot prove.
>
> **Do not merge until all eight pass.**

---

## 2. Corrections to the eight

Recorded here rather than by editing §1, so the original list stays auditable.

### 2.1 Item 6's method — the `VOYAGE_API_KEY` mutation is STRUCK

Item 6 offers two methods. The first — *"temporarily break `VOYAGE_API_KEY` on Railway"* — is
**struck entirely and must not be used.** `/embed` and `/ingest` share one uvicorn process, so
breaking that key breaks the **Ask path for every real user** (`src/lib/ingestion.ts:15`) and every
real upload for the duration, and it needs a restart to take effect plus another to restore — two
extra image swaps on the service being stabilised. It is a deliberately induced production outage.

**The mandated method is a deterministic conversion failure with zero production impact:**

Upload a plain text file containing the literal text `not a pdf`, renamed to `corrupt.pdf`, with
MIME `application/pdf` (or empty — empty and generic MIME are tolerated at
`src/app/api/ingest/route.ts:71`). It passes the extension + MIME allowlist
(`route.ts:59-76` gates on extension and MIME only; magic-byte verification is B5b and has not
landed), reaches MarkItDown, which raises → `_convert_to_markdown` raises → caught at
`services/ingestion/main.py:409` → `_mark_error` writes the terminal error → 500 to the caller.
Identical code path. No environment mutation. Nothing to restore.

### 2.2 Item 7 requires a baseline read — MANDATORY

As written, *"fires exactly once"* is unmeasurable: there is no before-value to compare against.
**Query Q7-BEFORE (§4) must be run before the item-3 upload** and its number recorded. This step is
missing from PR #70's list and is a real gap in it, not a restatement.

### 2.3 Item 5 requires a planted proper noun — MANDATORY

*"Confirm `match_chunks` retrieves from it"* has no crisp threshold: a plausible answer that happens
not to cite the new document is ambiguous, and an ambiguous item cannot gate a merge.

**Mandated procedure:** the item-3 upload must be a `.txt` or `.md` file **authored for this
purpose** containing an invented proper noun that appears **nowhere else** in the throwaway subject
and nowhere in ordinary language. Use exactly:

QORVANTHIL


Write a document in which `QORVANTHIL` is defined as something specific and checkable — for example
a sentence of the form *"QORVANTHIL is the internal codename for the 2026 ingestion rewrite, and its
batch size is 50."* Item 5 then asks a question whose only possible source is that sentence
(*"What is QORVANTHIL?"*), and the pass condition becomes binary: **the answer contains the string
`QORVANTHIL` and the fact defined alongside it.** No judgment call remains.

### 2.4 §1.1's "preview UI or read-only SQL" is SUPERSEDED in three places

§1.1 is binding and pinned, and three procedures in this document fall outside it. Recorded here
rather than by editing §1:

- **N6 and N9** are `curl` calls against `/convert` — one authenticated, one deliberately not.
  Neither is the preview UI nor a read-only SQL query. They are the only way to observe an
  endpoint's presence and its auth posture, which no UI surfaces.
- **§6.3** is destructive SQL. Cleanup cannot be read-only.
- **N1, N3, N4 and N9** run against **production**, not the preview. Their purpose is to prove the
  live shim, the live Ask path and the live auth gate survived the image swap, which no preview
  can show.

Every one of §1's eight points remains bound by §1.1 unchanged.

### 2.5 §1.1's "delete the rows after" is SUPERSEDED for the real account only

§1.1 ends *"use a throwaway subject and delete the rows after."* That stands in full for the
**throwaway** account, and §6.3 executes it. It does **not** apply to the production rows created by
N1, N3 and N9: §6.4 rules those are **left in place**, because hand-deleting rows from a live
account to tidy a test is a larger risk than one extra document. **Do not run §6.3 against the real
account.**

---

## 3. Gate table

`<UID>` = the throwaway `auth.users.id`. `<DOC_ID>` = the document under test.
All SQL runs in the **Supabase SQL editor as `postgres`**, which bypasses RLS — required, because
`study_events`, `usage_counters`, and `storage.objects` have no policy covering the reads and
deletes below.

**Every "B pre-merge" check runs against PR B's preview deployment specifically** — see §5.1 for why
PR A's preview would produce a green V6 that means nothing.

**N1, N2, N3 and N7 are aliases, not extra work.** They are the same observations as **V4, V2, V5**
and **V11** respectively (§8). They appear here because §3 is organised by *when* a check runs and
§8 by *what must hold*; that is also why they get no separate row in §10.

| Check | Gates | Evidence artifact | Observable without the authenticated UI? |
|-------|-------|-------------------|------------------------------------------|
| 1 | **A** post-merge (CI twin in **A0**, now `ingestion-image` on every push to `main`) | HTTP 200 from `GET /health` | **Yes** — `/health` is the only endpoint with no `_check_auth` call. Anonymous GET. |
| 2 | **A** post-merge | Same body contains `"supabase_configured": true` | **Yes** — same GET. |
| 3 | **B** pre-merge | Q3 | Trigger: **no** (SSO-gated preview UI). Proof: **yes** (SQL). |
| 4 | **B** pre-merge | Q4 | **Yes**, once item 3's upload exists. |
| 5 | **B** pre-merge | Preview UI Ask + Q5 pre-check | **Partly** — Q5 proves the vectors are searchable; only the UI proves the app's retrieval path. |
| 6 | **B** pre-merge | Q6a + Q6b | Trigger: **no**. Proof: **yes**. |
| 7 | **B** pre-merge | Q7-BEFORE + Q7-AFTER | **Yes**, but the baseline must be read before item 3. |
| 8 | **A** **pre**-merge | Railway variable list + JWT payload decode | **Yes** — no UI, no SQL. |
| **N1** production upload survives the `/convert` shim | **A** post-merge | Production UI upload + Q3 against your real account | Trigger: **no**. Proof: **yes**. |
| **N2** `/health` reports `supabase_configured: true` | **A** post-merge | Same GET as item 2 | **Yes.** |
| **N3** Ask path still works after the swap | **A** post-merge | One production Ask returning a grounded answer | **No.** |
| **N4** `/ingest` live but unused by production | **A** post-merge | The all-accounts Q6b variant (§4) returns 0, with its `created_at > <PR A merge timestamp>` bound | **Yes.** |
| **N5** nothing still calls `/convert` | **C** pre-merge | `grep -rn "/convert" src/` returns zero hits **and** the production Vercel deployment's commit SHA is at or after PR B's merge commit | **Yes.** |
| **N6** `/convert` gone, uploads still work | **C** post-merge | Authenticated `POST /convert` returns **404**; then one production upload passes Q3 | Partly — the 404 probe needs only `INGESTION_TOKEN`; the upload needs the UI. |
| **N7** image builds and imports in CI | **A0** | The `ingestion-image` workflow green on `main` (register **#52**) | **Yes.** |
| **N8** Watch Paths does not orphan PR C | between **B** and **C** | See §9 | **Yes.** |
| **N9** `/convert` still requires authentication | **A** post-merge | Unauthenticated `POST /convert` returns **401** | **Yes** — no UI, no SQL. |

---

## 4. The exact queries

### Q3 — item 3 and N1

```sql
select d.id,
       d.filename,
       d.status,
       d.embedding_status,
       d.chunk_count,
       (d.markdown_content is not null)                            as has_markdown,
       length(d.markdown_content)                                  as markdown_len,
       (select count(*) from chunks c where c.document_id = d.id)  as actual_chunk_rows,
       d.error_message
from documents d
join knowledge_bases k on k.id = d.kb_id
where k.user_id = '<UID>'
order by d.created_at desc
limit 5;
```

**PASS iff**, for the row under test:
`status = 'ready'` **and** `embedding_status = 'ready'` **and** `chunk_count = actual_chunk_rows`
**and** `has_markdown = true` **and** `error_message is null`.

For **N1**, substitute your real account's `user_id` for `<UID>`.

### Q4 — item 4 (single-row binary)

```sql
select count(*)                                                as rows,
       count(*) filter (where embedding is null)               as null_embeddings,
       count(*) filter (where vector_dims(embedding) <> 1024)  as wrong_dims,
       min(chunk_index)                                        as min_idx,
       max(chunk_index)                                        as max_idx,
       count(distinct chunk_index)                             as distinct_idx
from chunks
where document_id = '<DOC_ID>';
```

**PASS iff** `rows > 0` **and** `null_embeddings = 0` **and** `wrong_dims = 0` **and**
`min_idx = 0` **and** `distinct_idx = rows` **and** `max_idx = rows - 1`.

### Q5 — item 5 pre-check (does NOT replace the UI Ask)

```sql
select c.document_id,
       c.chunk_index,
       left(c.content, 80) as preview
from chunks c
join knowledge_bases k on k.id = c.kb_id
where k.user_id = '<UID>'
order by c.embedding <=> (
  select embedding from chunks where document_id = '<DOC_ID>' and chunk_index = 0
)
limit 5;
```

**PASS iff** it returns rows without error. This proves the persisted values are real `vector(1024)`
data that the cosine operator and the HNSW index accept.

**It does NOT prove the application's retrieval path.** `match_chunks` has its own signature and its
own RLS posture, and this protocol deliberately does not invent a call to it — writing a query whose
parameter list has not been read from `supabase/migrations/20260501_rag_pgvector.sql` would be
exactly the kind of unverified claim this document exists to prevent. **The UI Ask (§2.3) remains
item 5's real evidence.**

### Q6a / Q6b — item 6

```sql
-- Q6a: the forced-failure document
select d.id, d.filename, d.status, d.embedding_status, d.error_message,
       (select count(*) from chunks c where c.document_id = d.id) as chunk_rows
from documents d
join knowledge_bases k on k.id = d.kb_id
where k.user_id = '<UID>'
order by d.created_at desc
limit 3;
```

```sql
-- Q6b: nothing stranded anywhere in the throwaway account
select count(*) as stuck_processing
from documents d
join knowledge_bases k on k.id = d.kb_id
where k.user_id = '<UID>' and d.status = 'processing';
```

Identify the target row by **`filename = 'corrupt.pdf'`**, never by position: `limit 3` is a
convenience for reading, and a retry can put more than one candidate in range.

**PASS iff** the `corrupt.pdf` row shows `status = 'error'` **and** `embedding_status = 'error'`
**and** `error_message is not null` **and** `chunk_rows = 0`; **and** Q6b returns
`stuck_processing = 0`.

For **N4** — the single definition of that check, used by §3 and §10 alike — run Q6b with the
`k.user_id` filter removed, across all accounts, and keep the `created_at` bound:

```sql
select count(*) as stuck_processing_all_accounts
from documents
where status = 'processing'
  and created_at > '<PR A merge timestamp, UTC>';
```

**PASS iff** `0`.

### Q7 — item 7

```sql
-- Q7-BEFORE: run this BEFORE the item-3 upload. Record the number.
select count(*) as before_count
from study_events
where user_id = '<UID>' and kind = 'material_uploaded';
```

```sql
-- Q7-AFTER: run after the item-3 upload succeeds.
select kind, count(*) as n, min(occurred_at) as first_at, max(occurred_at) as last_at
from study_events
where user_id = '<UID>'
group by kind;
```

**PASS iff** the `material_uploaded` count equals `before_count + 1`, exactly. On a fresh throwaway
account `before_count` is `0`, so the pass condition is `n = 1`.

### Item 8 — the anon-key decode

```bash
# Paste the SUPABASE_ANON_KEY value read from the Railway dashboard.
echo '<VALUE>' | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null
```

**PASS iff** the decoded payload contains `"role":"anon"`. **FAIL** on `"role":"service_role"`.

If the value is not a JWT (Supabase's newer key format), the check becomes: it must begin
`sb_publishable_` and must **not** begin `sb_secret_`.

Independently, the Railway variable list must contain **no** key named `SUPABASE_SERVICE_ROLE_KEY`
and no other RLS-bypassing credential. As of 2026-07-26 the service carries exactly four user
variables: `INGESTION_TOKEN`, `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

### N6 — `/convert` is gone after PR C

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://knowflow-production.up.railway.app/convert \
  -H "Authorization: Bearer <INGESTION_TOKEN>" \
  -F 'file=@/dev/null'
```

**PASS iff** the status code is **404**. A `401` means the token is wrong and the check is
inconclusive. A `200` or `500` means the shim is still live — **PR C did not deploy** (see §9).

### N9 — `/convert` still requires authentication

Run **after PR A's image is live**, with **no** `Authorization` header:

```bash
curl -s -o /dev/null -w '%{http_code}
'   -X POST https://knowflow-production.up.railway.app/convert   -F 'file=@/dev/null'
```

**PASS iff** the status code is **401**. A **`200` means the ingestion endpoint is publicly open** —
anyone can drive conversion and embedding without a credential. That is **register #45's exact
failure**, the one that cost a token rotation, and it is **worse live harm than a failed upload**: a
broken upload is visible and bounded, an open endpoint is invisible and unbounded. It is
**TRIGGER 4** (§8.1) and it is not negotiable. A `404` after PR A means the shim did not deploy at
all, which fails N1/V4 first.

---

## 5. Throwaway account and disposable subject

### 5.1 Setup

**Which preview: PR B's preview deployment, and only that one.** Items 3-7 and V6-V10 must run
against the Vercel preview built from **PR B's branch**, because that is the only deployment whose
`route.ts` calls `/ingest`. **PR A's preview still calls `/convert`.** Running the throwaway account
there would satisfy V6 through V10 without exercising `/ingest` a single time — every result would
look green and none of them would mean anything.

1. Sign up a **new** account through **PR B's preview deployment** with a disposable address — e.g.
   `tornido.maroc2024+b1verify@gmail.com`. Gmail plus-addressing delivers to the same inbox and
   creates a distinct `auth.users` row. Signup routes straight to `/dashboard` with an active
   session because "Confirm email" is disabled (`docs/supabase-migration-runbook.md:122-125`), and
   `signUp` (`src/app/[locale]/signup/page.tsx:29`) never sets `emailRedirectTo` before routing to
   `/dashboard` (`:53`) — so the preview's `*.vercel.app` domain is not a blocker.
2. Create **one** subject named `zz-b1-verify-delete-me`.
3. Record `<UID>` immediately:
   ```sql
   select id, email, created_at from auth.users where email = '<throwaway address>';
   ```
4. **Run Q7-BEFORE now**, while the account is empty. This is the baseline item 7 requires.
5. Author the `QORVANTHIL` document per §2.3 before uploading anything.
6. Budget: **two** uploads — one success (items 3, 4, 5, 7) and one `corrupt.pdf` (item 6). Two
   uploads means two `upload_count` increments against the free tier's daily cap.

### 5.2 Interaction with `_persist`'s delete-then-insert

`_persist` (`services/ingestion/main.py:217`) runs `delete().eq("document_id", document_id)` before
inserting, so a retry against the same `document_id` converges instead of duplicating. This has **no
effect on cleanup**: every upload through `route.ts:128-137` inserts a **fresh** `documents` row, so
the same document is never re-ingested by this flow. Chunk counts are therefore per-document and
additive across uploads, and Q4's `distinct_idx = rows` remains a valid duplicate check.

---

## 6. Cleanup

### 6.1 Confirm the live foreign keys first

Register **#23**'s standing rule: a written migration file is never an applied one. The live project
may have been altered by hand. Run this before deleting anything:

```sql
select conrelid::regclass as child_table,
       conname,
       confrelid::regclass as parent_table,
       confdeltype  -- 'a' = NO ACTION, 'c' = CASCADE, 'n' = SET NULL
from pg_constraint
where contype = 'f'
  and confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
order by 1;
```

What the repo says, and why it matters:

- `profiles.id references auth.users` — **no cascade** (`001_initial_schema.sql:3`). A naive
  `delete from auth.users` raises a foreign-key violation.
- `conversations.user_id references profiles(id)` — **no cascade** (`001_initial_schema.sql:61`).
  Item 5's Ask **creates a `conversations` row**, so this blocks `delete from profiles`. Not
  hypothetical.
- `knowledge_bases.user_id references profiles(id) on delete cascade` (`:30`).
- `documents.kb_id references knowledge_bases(id) on delete cascade` (`:43`).
- `chunks.document_id` and `chunks.kb_id` — both `on delete cascade`
  (`20260501_rag_pgvector.sql:13-14`).
- `study_events.user_id references auth.users(id) on delete cascade`
  (`20260709_study_events.sql:66`).
- `usage_counters.user_id references auth.users(id) on delete cascade`
  (`20260629_usage_counters.sql:8`).

### 6.2 Inventory before deleting

```sql
select
  (select count(*) from knowledge_bases where user_id = '<UID>')                         as kbs,
  (select count(*) from documents d join knowledge_bases k on k.id = d.kb_id
     where k.user_id = '<UID>')                                                          as docs,
  (select count(*) from chunks c join knowledge_bases k on k.id = c.kb_id
     where k.user_id = '<UID>')                                                          as chunk_rows,
  (select count(*) from conversations where user_id = '<UID>')                           as convos,
  (select count(*) from study_events where user_id = '<UID>')                            as study_rows,
  (select count(*) from usage_counters where user_id = '<UID>')                          as usage_rows,
  (select count(*) from storage.objects
     where bucket_id = 'documents' and (string_to_array(name,'/'))[1] = '<UID>')         as storage_objs;
```

### 6.3 Ordered deletion

Explicit and deepest-first, so it is independent of whatever the live cascades turn out to be.

```sql
begin;

-- 1. Storage. Does NOT cascade from auth.users, and 002_storage.sql grants only
--    INSERT and SELECT policies on storage.objects — there is no DELETE policy,
--    so this is only possible as postgres.
delete from storage.objects
 where bucket_id = 'documents'
   and (string_to_array(name, '/'))[1] = '<UID>';

-- 2. Content, deepest first.
delete from chunks
 where kb_id in (select id from knowledge_bases where user_id = '<UID>');

delete from documents
 where kb_id in (select id from knowledge_bases where user_id = '<UID>');

delete from knowledge_bases where user_id = '<UID>';

-- 3. The Ask path's rows. `messages` cascades from `conversations`; `conversations`
--    does NOT cascade from `profiles`, so this must precede step 5.
delete from conversations where user_id = '<UID>';

-- 4. The two ledgers. Both cascade from auth.users, but neither has a DELETE
--    policy, so they are removable only here.
delete from study_events   where user_id = '<UID>';
delete from usage_counters where user_id = '<UID>';

-- 5. Profile, then (separately) the account.
delete from profiles where id = '<UID>';

commit;
```

```sql
-- 6. Separately, after the transaction commits:
delete from auth.users where id = '<UID>';
```

```sql
-- 7. Prove it: re-run §6.2. Every column must be 0. Then:
select count(*) as account_rows from auth.users where id = '<UID>';   -- must be 0
```

**If step 2's `delete from documents` raises a foreign-key error**, a child table references
`documents` that this protocol did not enumerate. **Do not force it and do not guess the table.**
Ask Postgres which children actually exist, then stop:

```sql
select conrelid::regclass as child_table, conname, confdeltype
from pg_constraint
where contype = 'f' and confrelid = 'public.documents'::regclass
order by 1;
```

**Show that result and STOP for a ruling before deleting anything further.** Two things are already
known and need no investigation: `quizzes` **cascades** (`20260708_quizzes.sql:31` —
`document_id uuid references documents(id) on delete cascade`) so it needs no manual delete; and
`20260705_document_summaries.sql` creates **no table at all** — it adds `summary`,
`summary_generated_at`, `summary_model` and `summary_is_partial` as **columns on `documents`**.

### 6.4 What is irreversible

The rows above all go. What cannot be undone:

- **Voyage API tokens consumed** — real spend and quota against `VOYAGE_API_KEY`, for the successful
  upload and for any partial batch. Deleting rows does not refund it.
- **Supabase free-tier metering already recorded** for the billing period (register **#22**) —
  egress, storage-byte-hours, and API requests are counted at time of use, not at time of deletion.
- **Railway build minutes and container compute** for PR A's image build and swap.
- **Vercel function invocations** and their logs, plus Supabase auth audit-log entries for the
  signup and sign-in.
- **The production rows created by N1 and N3.** N1 creates a real `documents` row plus its chunks and
  a real `material_uploaded` study event on the founder's own account; N3 creates a real
  `conversations` row and its messages. **Ruling 2026-07-26: these are left in place.** They are
  indistinguishable from ordinary use, and hand-deleting rows from a live account to tidy a test is a
  larger risk than one extra document. Do **not** run §6.3 against the real account.

---

## 7. Accepted as untested

Written plainly so nobody later reads V1–V12 as meaning more than they do.

### 7.1 `/ingest` goes live having never processed a request anywhere

**`/ingest` goes live in production having never processed a request anywhere**, so nobody may read
V1 through V12 as meaning it was tested before shipping. Between PR A's merge and PR B's preview run,
the endpoint is reachable in production and has not handled a single request in any environment.
Items 1 and 2 prove the process booted and its environment is present; they prove nothing about
whether an ingestion succeeds. The eight points cover `/ingest`'s behaviour only **after** it is
already live.

Eliminating this would require a second Railway environment, which was considered and rejected: the
alternative reintroduces the deploy-skew window the three-PR sequence exists to close. **This is an
accepted risk, not a solved one.**

### 7.2 `_persist`'s idempotency guard is not exercised by any check

The delete-then-insert at `services/ingestion/main.py:217` only matters on a retry against the **same**
`document_id`. `src/app/api/ingest/route.ts:128-137` inserts a fresh `documents` row on every upload,
so that branch is **unreachable through the UI**. No item in §1 and no N-check in §3 exercises it. Its
correctness rests entirely on code reading.

**Ruling 2026-07-26: accepted as untested.** Reaching it would require a hand-rolled authenticated
`POST /ingest` carrying a live end-user JWT and the service token, for a branch that only
`backfill.py`-shaped retries actually reach. That is not worth the handling of a live user token.

### 7.3 The protocol is human-executed

V11 is the only **CI-checked** condition, and it is CI-checked only because the `ingestion-image`
workflow exists. V12 is mechanically *checkable* after the fact (`git show` on `main`), but nothing
runs it automatically. Every other row depends on a person running a query and reading it
correctly. That is
inherent to verifying a live system. It is why **V12 (committed results) is load-bearing**: it is the
only thing that makes a skipped check visible afterwards.

---

## 8. "Verified" — the binary

**PR B may be merged if and only if every one of the following holds. There is no partial credit and
no "mostly."**

| # | Condition | Determined by |
|---|-----------|---------------|
| **V1** | `GET https://knowflow-production.up.railway.app/health` returns **HTTP 200** | Anonymous GET (item 1) |
| **V2** | That response body contains **`"supabase_configured": true`** | Same GET (item 2, N2) |
| **V3** | The Railway variable list contains **no** `SUPABASE_SERVICE_ROLE_KEY` and no other RLS-bypassing credential, and `SUPABASE_ANON_KEY` decodes to `"role":"anon"` (or is an `sb_publishable_` key) | Dashboard + decode (item 8) |
| **V4** | **A production upload through the `/convert` shim reaches `status='ready'`** with `chunk_count = actual_chunk_rows` and non-null markdown | Production UI + Q3 (**N1**) |
| **V5** | **A production Ask returns a grounded answer** | Production UI (**N3**) |
| **V6** | A preview upload via `/ingest` satisfies **Q3** in full | Preview UI + Q3 (item 3) |
| **V7** | **Q4** returns `rows > 0`, `null_embeddings = 0`, `wrong_dims = 0`, `min_idx = 0`, `distinct_idx = rows`, `max_idx = rows - 1` | Q4 (item 4) |
| **V8** | The preview Ask answer **contains the string `QORVANTHIL`** and the fact defined alongside it, **and** Q5 returns rows without error | Preview UI + Q5 (item 5, §2.3) |
| **V9** | The `corrupt.pdf` upload yields `status='error'`, `embedding_status='error'`, non-null `error_message`, **`chunk_rows = 0`**; and **Q6b returns 0** | Preview UI + Q6a/Q6b (item 6, §2.1) |
| **V10** | `material_uploaded` count = **Q7-BEFORE + 1**, exactly | Q7-BEFORE and Q7-AFTER (item 7, §2.2) |
| **V11** | The `ingestion-image` workflow is **green on `main`** (register **#52**) | GitHub Actions (**N7**) |
| **V12** | This file's results table (§10) is **committed to `main`** with every PR-A/PR-B row filled — no blanks, no "n/a". V12's own row is the one exception and is filled with the SHA of the commit that fills the rest, since it cannot precede itself | `git show` on `main` |

**V12 is not bureaucracy.** Without it, "verified" is a memory rather than a repo fact, and a future
reader cannot distinguish a check that passed from a check that was skipped. That distinction is the
entire content of register **#39**.

### 8.1 Rollback triggers

There are **four**. Reducing them would be wrong.

> **TRIGGER 1 — If `GET /health` does not return HTTP 200 within 10 minutes of PR A's merge, roll
> back. Do not debug forward.**

> **TRIGGER 2 — If V4 fails (a production upload through the `/convert` shim does not reach
> `status='ready'`), roll back immediately.** That is live user harm, and it means the shim is not
> contract-identical after all. Debugging it forward leaves production uploads broken for the
> duration of the investigation.

> **TRIGGER 3 — If V5/N3 fails (a production Ask returns nothing, or returns an answer not grounded
> in the user's own documents), roll back immediately.** Same reasoning as TRIGGER 2. The Ask path
> is the core product path; PR A rewrites the module that also serves `/embed`
> (`src/lib/ingestion.ts:15`); and a broken Ask is live user harm that an upload check does not
> announce.

> **TRIGGER 4 — If N9 fails (an UNAUTHENTICATED `POST /convert` returns anything other than 401),
> roll back immediately.** A `200` means the ingestion endpoint is publicly open and anyone can
> drive conversion and embedding without a credential — **register #45's exact failure**. This is
> worse live harm than a failed upload: a broken upload is visible and bounded, an open endpoint is
> invisible and unbounded. Roll back first, diagnose after.

**The rollback:** Railway dashboard → Deployments → the last pre-PR-A deployment → **Rollback**. It
re-activates an already-built image with no rebuild. Production Next is unchanged and still calls
`/convert`, which that image serves (`services/ingestion/main.py:146` on `main`). Duration is
container start plus health gate.

**This rollback is valid for the entire PR A window and dies the moment PR B merges** — after that,
production Next calls `/ingest`, and the pre-PR-A image does not have it, so rolling back one
deployment makes things strictly worse. That asymmetry is why V1 gates PR B.

**A dashboard rollback leaves live ≠ `main`**, which is register **#39**'s hazard. It must be
followed by a revert PR and a §7 entry. Leaving it as a quiet dashboard fact is not an option.

### 8.2 What is NOT a rollback trigger

`/health` returning **200 with `"supabase_configured": false`** is **not** a rollback. The process
booted; `/convert` and `/embed` do not touch Supabase, so production is healthy. Fix the environment
variables, restart, re-probe. But V2 is unmet, so **PR B does not move.**

Everything else in V1–V12 is debug-forward-but-do-not-proceed.

---

## 9. N8 — Watch Paths, and the way PR C can silently fail

Railway's "knowflow" service has **Root Directory `/services/ingestion`** and an **empty Dockerfile
Path**, so it builds `services/ingestion/Dockerfile` through that root. As of 2026-07-26 **Watch
Paths is empty**, meaning every merge to `main` rebuilds and swaps the image — including PR B, which
changes only TypeScript.

Setting Watch Paths between PR B and PR C avoids that redundant swap. **But it introduces a silent
failure mode:** a pattern that never matches means **PR C merges green and `/convert` stays live
forever, with no symptom anywhere.**

**This protocol does not state whether Railway's Watch Paths globs are evaluated relative to the repo
root or relative to the Root Directory, because that has not been confirmed.** Do not guess. Determine
it empirically: set the pattern, push a no-op commit touching only `services/ingestion/`, and confirm
a deploy fires. **Until that is confirmed, leave Watch Paths empty** — a redundant rebuild is cheap; a
silently skipped PR C is not.

**N6 is the backstop.** If `POST /convert` does not return 404 after PR C merges, PR C did not deploy.

---

## 10. Results

**Empty cells are not "pass by default."** A blank cell means the check has not been run, and V12
forbids merging PR B while any PR-A/PR-B row is blank.

The **Deployment** column records the Railway deployment ID or image digest each row was observed
against. Without it a green row cannot be tied to the artifact that produced it after any rollback —
which is the register **#39** problem this file exists to solve.

**Who fills what:**

- **PR A creates this file** with the V11 row already filled, since the `ingestion-image` workflow
  merged ahead of it and is already green on `main`. Every other cell starts blank.
- **PR A fills** V3 on its own branch before merge, since the Railway variables are readable now and
  item 8 gates PR A pre-merge.
- **V1, V2, V4, V5, N4 and N9 are only observable after PR A's image is live**, so they are recorded
  by a small **docs-only PR to `main`** between PR A and PR B — a PR, not a direct push, like every
  other change in this repo. That PR's merge commit is the artifact V12 checks for. It is docs-only,
  so it triggers a redundant Railway rebuild of an unchanged `main.py` — harmless, and a second free
  rehearsal of the swap.
- **PR B fills** V6, V7, V8, V9, V10, and V12, and may not be merged until every row above is filled.
- **PR C fills** the N5 and N6 rows, and records the cleanup.

| Row | Check | Filled by | Run at (UTC) | Result | Evidence | Deployment |
|-----|-------|-----------|--------------|--------|----------|------------|
| V11 | `ingestion-image` green on `main` | PR A | 2026-07-26 20:41 | **PASS** — `success` in **44s** on `eaad75294e9102ef83e93b810542e93217e2a2f1` | https://github.com/tornidomaroc-web/knowflow/actions/runs/30219501234 | CI runner; no Railway deployment |
| V3 | No service-role key on Railway; anon key decodes `role: anon` | PR A (pre-merge) | 2026-07-29 15:57 | **PASS** | Decoded payload's `role` claim reads `anon`, not `service_role`; legacy Supabase JWT format, so the `sb_publishable_` branch did not apply. Railway service carries no `SUPABASE_SERVICE_ROLE_KEY` — its four user variables are `INGESTION_TOKEN`, `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. See dependency note below. | Dashboard read plus local decode; no Railway deployment |
| V1 | `/health` returns 200 | PR A (post-merge PR) | | | | |
| V2 | `/health` reports `supabase_configured: true` | PR A (post-merge PR) | | | | |
| V4 | Production upload via `/convert` shim reaches `ready` | PR A (post-merge PR) | | | | |
| V5 | Production Ask returns a grounded answer | PR A (post-merge PR) | | | | |
| N4 | All-accounts Q6b (§4) returns 0, `created_at` bounded at PR A's merge | PR A (post-merge PR) | | | | |
| N9 | Unauthenticated `POST /convert` returns 401 | PR A (post-merge PR) | | | | |
| V6 | Preview upload via `/ingest` satisfies Q3 | PR B | | | | |
| V7 | Q4 all six conditions | PR B | | | | |
| V8 | Preview Ask contains `QORVANTHIL`; Q5 returns rows | PR B | | | | |
| V9 | `corrupt.pdf` reaches `error`, 0 chunks; Q6b = 0 | PR B | | | | |
| V10 | `material_uploaded` = Q7-BEFORE + 1 | PR B | | | | |
| V12 | This table committed with no blanks above | PR B | | | | |
| N5 | Nothing calls `/convert`; production Next at or after PR B's merge SHA | PR C (pre-merge) | | | | |
| N6 | `POST /convert` returns 404; production upload still passes Q3 | PR C (post-merge) | | | | |
| N8 | Watch Paths pattern empirically confirmed to fire | between B and C | | | | |
| — | Throwaway account cleanup (§6.3) executed and §6.2 re-run all-zero | PR C | | | | |

**V3 rests on two dependencies that this PASS does not discharge.** First, the absence half is a
**dashboard read performed by the repository owner, not by the agent recording this row** — no
tooling here enumerated Railway's variables, so "no `SUPABASE_SERVICE_ROLE_KEY`" is an attested
observation, not a machine-verified one. Second, **decoding proves the value examined is an anon
key; it does not prove it is the value the deployed service holds.** The decode ran against a copy.
Nothing in this check ties that copy to the variable Railway injects at runtime. V3 is therefore
PASS on the claim as stated and no wider.

---

## 11. Change log for this file

| Date | Change |
|------|--------|
| 2026-07-26 | Created by PR A. Eight points pinned verbatim from PR #70; §1.2 preamble struck; item 6's `VOYAGE_API_KEY` method struck; Q7-BEFORE and the `QORVANTHIL` step made mandatory; N1-N9 added; §7 accepted-untested recorded. Pre-creation review also added §2.4/§2.5 (the two places §1.1 is superseded), **N9** (register #45 auth probe), TRIGGER 3 (production Ask), the §10 Deployment column, and pinned items 3-7 to **PR B's** preview deployment. |
