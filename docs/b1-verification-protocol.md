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

### 2.6 The throwaway account, the upload ORDER, and what V6–V10 will be worth — recorded 2026-08-08, BEFORE the run

**Written before the V6–V10 run, not after it.** This section exists so that these things are on the
record while they can still be read as conditions rather than as post-hoc justification. §5.1 is not
edited; the deviations are recorded here, per this file's convention.

#### 2.6.1 "Confirm email" is now ENABLED — §5.1 step 1's justification is FALSE

§5.1 step 1 reads: *"Signup routes straight to `/dashboard` with an active session because 'Confirm
email' is disabled (`docs/supabase-migration-runbook.md:122-125`)."* **That sentence no longer
describes the system.** Confirmation is enabled, established by evidence on 2026-08-08: a
confirmation email was delivered for a new signup and its link was consumed successfully.

Background, because it explains why nobody noticed: Supabase SMTP was pointed at a Resend account
that had been deleted when the domain moved to Brevo, so the stored key was dead and **no
confirmation mail had been leaving the system at all**. DNS was never implicated — Resend's records
were on the domain throughout. The repair went via Brevo, which surfaced a second finding (Starter
plan expired 2026-05-19, zero credits, no free downgrade path, hence *"Email not sent: Your account
has insufficient credits"*), and then via a new Resend account with `tryknowflow.com` verified in the
EU region so the surviving SPF and MX records stayed valid and only DKIM was replaced. Supabase SMTP
is now `smtp.resend.com:465`, username `resend`, sender `noreply@tryknowflow.com`.

#### 2.6.2 The consequent `/login` claim — UNOBSERVED CODE READING, recorded as such

With confirmation enabled, `signUp` returns a `user` with a **null session**, and
`src/app/[locale]/signup/page.tsx:53` pushes to `/<locale>/dashboard` **unconditionally**, without
consulting whether a session exists. `src/lib/supabase/middleware.ts:29-34` then redirects any
`/<locale>/dashboard*` request with no user to `/<locale>/login` — no query parameter, no message,
no explanation of any kind.

**This is a reading of the code and nothing more. It has never been observed.** Nobody has recorded
what that page did in the seconds after the signup form was submitted. It is written here so that it
can be tested, not so that it can be cited.

**It is scoped to the form-submit step only.** An earlier, unscoped version of this claim — that
repairing the mailer would leave the user bounced to `/login` — **was wrong as stated**, and is
corrected here rather than quietly narrowed. What happens after the confirmation link is followed is
**observed**: the link lands on the dashboard with a live session. The two steps are different, and
the claim only ever applied to the first.

#### 2.6.3 The account was created off-protocol, and the precise reason that is acceptable

The (b1) throwaway account `tornido.maroc2024+b1verify2@gmail.com` was created on **production**,
through the real signup form, while verifying the SMTP repair. §5.1 step 1 asks for PR B's preview.

**The precise claim that legitimises it — stated precisely, because a loose version of it would not
survive review:** `git diff main...HEAD --stat` on this branch shows that **the only file differing
between `main` and PR B that Next compiles or serves is `src/app/api/ingest/route.ts`.** The commit
that adds this section changes documentation only and introduces **no runtime file**. Therefore
`src/app/[locale]/signup/page.tsx` is byte-identical on both, and an account created through
production's signup form is indistinguishable from one created through the preview's. The account
itself is a row in the **shared Supabase auth project**, not a per-deployment artifact.
Corroborating, and independent of which commit production happens to serve: `signup/page.tsx` has
not changed since `48ac550`, **2026-07-03**.

**The limit of that claim, stated rather than left to be discovered:** it compares `main` to this
branch. It does not independently verify that production Vercel serves `main`'s head. The 2026-07-03
date is what makes the conclusion hold anyway.

**What this does NOT license.** Items 3–7 and V6–V10 still run against **PR B's preview and only
that one**. §5.1's substantive requirement — that the uploads traverse the `route.ts` which calls
`/ingest` — is untouched by any of the above.

#### 2.6.4 THE UPLOAD ORDER IS LOAD-BEARING: `QORVANTHIL` FIRST, `corrupt.pdf` SECOND

**Do not reorder these two uploads. They look interchangeable and they are not.**

**V9's pass condition is satisfied by nearly every post-insert failure path in
`src/app/api/ingest/route.ts` — not only by a conversion failure inside the service.** Three
branches write a non-null `error_message`, leave zero chunk rows, and move the document to
`status='error'` / `embedding_status='error'` **without `/ingest` ever having processed anything**:

- **`:218-221`** — an authenticated session carrying no access token: `error_message` = *"no access
  token on an authenticated session"*.
- **`:255`** — the ingestion service unreachable: `error_message` = *"ingestion service unreachable:
  …"*. This is what a wrong or unreachable service URL on the preview looks like.
- **`:292`** — a non-2xx from the service: `error_message` = *"ingestion service returned 404: …"*.
  **This is what a version-skewed or missing `/ingest` looks like**, and V9 alone cannot tell it
  apart from MarkItDown correctly rejecting a bad file.

So: run `corrupt.pdf` first against a misconfigured preview and **V9 goes green while `/ingest` has
never once been exercised**. The `QORVANTHIL` upload is the discriminator — it can only satisfy V6
and V7 if the request genuinely reached `/ingest` and the service persisted chunks under this user's
RLS. Ordering it first converts V9 from *"an error row appeared"* into *"an error row appeared on a
path already proven to reach the service."*

**One branch is the exception, and it is recorded because naming it as the example would have been
wrong.** The unset-`INGESTION_TOKEN` branch at **`:196-200`** writes `status='error'` and
`embedding_status='error'` but **no `error_message`**, so the column stays null from the insert at
`:141-147` and such a row **fails** V9 rather than faking a pass. It is not the hazard. The three
branches above are.

#### 2.6.5 The `profiles` precondition is kept even though the answer looks obvious

Before the item-3 upload, and alongside Q7-BEFORE, confirm the throwaway account has a `profiles`
row. Register **#23**: a written migration is never an applied one, and the row's existence depends
on the `on_auth_user_created` trigger (`001_initial_schema.sql:23-25`) actually being live. If it is
not, `knowledge_bases.user_id references profiles(id)` (`001_initial_schema.sql:30`) makes **subject
creation fail with a foreign-key violation** — after the signup has already been spent.

**This check became less redundant, not more, on 2026-08-08.** With confirmation enabled, the
client-side `profiles` upsert at `signup/page.tsx:42` runs with **no session**, so the policy
`auth.uid() = id` (`001_initial_schema.sql:11`) rejects it with **`42501`** — and the guard at `:48`
only swallows `23505`, routing it to `console.error` and nowhere else. **The `profiles` row now
rests entirely on the trigger**, where it previously had a second writer. Nothing surfaces the
difference.

#### 2.6.6 V6–V10 will be `owner-attested`, not `machine-verified`

Recorded now, so that §10's Provenance column is not decided at write-up time. No agent in the
executing session holds a database credential. Every query in §4 runs in the **Supabase SQL editor by
the repository owner** — as §3 already requires — and its output is pasted back for adjudication
against the pass conditions. That is the **same epistemic class as V3 and V5**, and it is not weaker
for being stated. `machine-verified` (§10) means an agent ran the query itself; that will not be true
of these rows, and they must not carry the mark.

### 2.7 §2.1's mandated fixture is EMPIRICALLY INVALID — recorded 2026-08-08, after V9 failed to occur

**§2.1's replacement method does not work, and this was established by spending an upload on it.** The
fixture is replaced below with one whose failure is measured rather than asserted. Written before the
replacement fixture is uploaded, per the discipline in §2.6.

#### 2.7.1 What §2.1 claims, and the clause that is false

§2.1 mandates *"a plain text file containing the literal text `not a pdf`, renamed to `corrupt.pdf`"*
and states it *"passes the extension + MIME allowlist … reaches MarkItDown, **which raises** →
`_convert_to_markdown` raises → caught at `services/ingestion/main.py:409` → `_mark_error` writes the
terminal error → 500 to the caller."*

**"which raises" is false.** Every link after it was conditional on it, so the whole chain is void.

Observed 2026-08-08T20:5xZ on PR B's preview, throwaway account
`d52de42c-cf30-4d46-a130-26bbbd925bae`: the 9-byte fixture uploaded as `corrupt.pdf` reached
`status='ready'`, `embedding_status='ready'`, `error_message` null, `chunk_count=1`, with chunk 0
holding exactly `not a pdf` (9 chars). Document `e1170dd6-4326-4955-9667-1e2923ca34a6`. **It was
accepted, converted, chunked and embedded.** V9 did not fail; it did not occur.

**The agent executing this run repeated §2.1's claim as the expected code path and told the owner
what exception to watch for, without ever having run MarkItDown against that input.** That is
recorded because the failure is not that a document was wrong — it is that an unverified assertion
was passed along a second time inside the run whose purpose is to stop exactly that.

#### 2.7.2 THE METHOD, which matters more here than the result: a probe calibrated against a known production outcome

**A future reader should take the method from this section, not just the fixture.** A local probe of
a library's behaviour is worth nothing on its own — it is a different machine with a different
dependency resolution, which is §8.1.1's own finding about this very package. What converts it into
evidence is a **control**.

`markitdown[all]==0.1.5` — the exact pin from `services/ingestion/requirements.txt` — was installed
in a throwaway local venv on Python 3.12.10, and seven candidate payloads were run through **the same
call shape as `main.py:294-301`**: a temp file whose suffix preserves the client-supplied filename
(and therefore its extension), then `MarkItDown().convert(path)`.

**Candidate 1 was the 9-byte fixture whose production result was already known.** The rule fixed
before the probe ran: *if the harness does not reproduce production on the control, every other
result is discarded.*

It reproduced it exactly — `CONVERTED, len=9, 'not a pdf'`, the same bytes the database holds.

| Payload (extension as named) | Result |
|---|---|
| **CONTROL** — `not a pdf`, 9 bytes, `.pdf` | **CONVERTED, no raise.** `len=9`, `'not a pdf'` — matches production |
| 2048 random bytes, `.pdf` | **RAISED** `FileConversionException` — `PdfConverter threw PDFSyntaxError: No /Root object! - Is this really a PDF?` |
| 0 bytes, `.pdf` | **RAISED** — same |
| `%PDF-1.4\n` + 2048 random bytes, `.pdf` | **RAISED** — same |
| **2048 null bytes, `.pdf`** | **RAISED** — same |
| 2048 random bytes, `.docx` | **RAISED** — `DocxConverter threw BadZipFile: File is not a zip file` |
| 2048 random bytes, `.xlsx` | **RAISED** — `XlsxConverter threw BadZipFile: File is not a zip file` |

**The mechanism, read off which converter threw.** Every raise came from the **extension-driven**
converter. The control raised nothing because no converter was reached: MarkItDown sniffs content and
**the plain-text converter is a universal accept for text-like bytes**, so the extension is only
consulted when sniffing finds nothing text-like. §2.1's fixture was defeated by its own readability
— it was too plainly text to ever reach the PDF path.

**The limit of this evidence, stated rather than left to be found.** A calibrated local harness is
not the Railway container. `markitdown[all]==0.1.5` resolves its transitive tree freely and the base
image is a mutable tag (§8.1.1), so the two dependency sets differ by construction. The control
agreeing is strong evidence **about the harness** and is **not proof about Railway**.

#### 2.7.3 The replacement fixture — REPRODUCIBLE, which is why it is not the random one

**2048 null bytes, uploaded as `corrupt2.pdf`.**

```sh
head -c 2048 /dev/zero > corrupt2.pdf
```

`md5 = c99a74c555371a433d121f551d6c6398`, size 2048, every byte `0x00`.

Random bytes raised identically and were **rejected as the fixture** because they cannot be
regenerated by a future reader. A fixture nobody can recreate is the class of artifact this document
exists to prevent. That two maximally different non-text payloads — uniform nulls and high-entropy
random — both raise through the same `PdfConverter → PDFSyntaxError` path is what makes the mechanism
robust rather than incidental to one payload.

**FILENAME DEVIATION, and it is not cosmetic.** §2.1 and Q6a pin `filename = 'corrupt.pdf'`. That
name now identifies the **junk `ready` row** left by the invalid fixture, which is retained as
evidence and will be removed by §6.3 at PR C. The replacement is therefore named **`corrupt2.pdf`**,
and **Q6a's target row is identified by `filename = 'corrupt2.pdf'`** for this run. §4's standing
warning — *"never by position: a retry can put more than one candidate in range"* — anticipated this
exactly.

#### 2.7.4 THE STOP RULE — binding, not a handshake

**If the `corrupt2.pdf` upload also converts instead of raising, the run STOPS.** No third fixture,
no adjusted payload, no further attempt in this session. V9 is left unfilled, the remaining upload
budget is left unspent, and V9 is reopened later with a different method rather than a third guess.

This is written down because the pressure to try one more thing is highest at exactly the moment it
should be resisted, and because two fixtures have now been proposed on reasoning and one of them was
wrong.

#### 2.7.5 A product finding, and an owner claim corrected BY MEASUREMENT

The invalid fixture demonstrated a real gap: `src/app/api/ingest/route.ts:70-88` gates uploads on
**extension and MIME only** — magic-byte verification is B5b and has not landed — while
`_convert_to_markdown` (`main.py:294-301`) preserves the client-supplied extension into the temp path
and lets MarkItDown pick a converter by **sniffing content**. So a file whose content does not match
its declared extension is accepted, converted as its *sniffed* type, and stored `ready` with
`file_type` recording the *declared* type. The mismatch is flagged nowhere. **This is pre-existing and
identical on `main`; PR B neither causes nor worsens it.** Severity is data integrity, not security:
the content is the uploader's own and RLS-scoped, and the extension allowlist still applies.

**The repository owner's framing of this finding was that "a user can upload a damaged file and be
shown a READY material whose content is garbage, with no signal anywhere." The probe disproved it,
and it is recorded as disproved rather than softened.** A structurally destroyed PDF — real
`%PDF-1.4` header, garbage body — **RAISED**, landing on the error path exactly as designed. The
silent-acceptance path requires the payload to **sniff as text** (or as another convertible type), not
merely to be damaged. The true claim is narrower than the one made: it is a **type-mismatch** hole,
not a **damaged-file** hole, and a renamed `.txt` is its shape rather than a corrupted document.

Untested and not claimed either way: a **structurally valid** PDF with corrupted content streams,
which might extract garbage without raising.

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
| **N8** Watch Paths does not orphan PR C | **after C** — *re-sequenced 2026-08-02, see §9.1* | See §9 and **§9.1**, which supersedes the "between B and C" placement and specifies the two-direction empirical test | **Yes.** |
| **N9** `/convert` still requires authentication | **A** post-merge | Unauthenticated `POST /convert` returns **401** | **Yes** — no UI, no SQL. |
| **N10** base image digest-pinned and dependencies hash-locked — **HARD GATE on PR C** | **C** **pre**-merge | `services/ingestion/Dockerfile` reads `FROM python:3.11-slim@sha256:…` and a `--generate-hashes` lock is present. **Added 2026-08-02; see §8.1.1.** Without it PR C ships the one change in this sequence whose abort path is known broken. | **Yes** — repo-side, greppable; no UI, no SQL, no dashboard. |

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
   **→ READ §2.6 BEFORE EXECUTING THIS STEP. The "Confirm email is disabled" justification above is
   FALSE as of 2026-08-08 (§2.6.1), and the account this protocol uses was created on production
   rather than here, for the reason stated in §2.6.3.** The sentence is left unedited because this
   file records corrections in §2 rather than by rewriting the step; the pointer is added because a
   reader executing §5.1 as a runbook would otherwise act on it.
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

### 7.4 Most of PR B's failure surface is still unexercised — recorded 2026-08-08, after V9 passed

**V9 exercised exactly one of `route.ts`'s failure branches, and it is important that nobody reads a
green V9 as covering the rest.** The `corrupt2.pdf` run reached `:292` (the non-2xx branch) and
proved the guarded write **stands down** when the service has already written a terminal status.

**Still never executed, in any environment:**

- **The RESCUE half of the same guard.** `failIfStillProcessing` has two behaviours: stand down when
  the row has moved off `processing`, and **rescue the row when the service never wrote anything**.
  Only the first has run. The rescue half is **the orphan-stuck-at-`processing` killer this whole
  change exists for**, and it remains proven by code reading alone.
- **`:255`** — the ingestion service unreachable (fetch throws).
- **`:310`** — a 200 carrying an unrecognised ack shape.
- **`:196-200`** — `INGESTION_TOKEN` unset.
- **`:218-221`** — an authenticated session carrying no access token.

**Ruling 2026-08-08: accepted as untested, and PR B is not held on it.** Each of these requires
inducing an infrastructure fault — killing the service mid-request, desynchronising a token,
deploying a mismatched image — against the service being stabilised, which is the same class of
deliberately induced outage that §2.1 struck the `VOYAGE_API_KEY` method for. The cost is real and
immediate; the coverage gained is a branch whose correctness the successful stand-down already makes
credible.

**This is an accepted risk, not a solved one**, and it is recorded here for the same reason as §7.1:
so that a future reader cannot mistake V1–V12 for more than they are.

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

> **AMENDED 2026-08-02 — READ §8.1.1 BEFORE ACTING ON ANY TRIGGER BELOW.** The four triggers survive
> **unchanged as detection conditions**. The **remedy** they pointed at does not. Railway marks
> deployment images **REMOVED** on this plan — **for the entire deployment history, not just old
> ones** — so the no-rebuild rollback this section promised **does not exist**. §8.1.1 states what
> replaced it, and what that costs.

> **TRIGGER 1 — If `GET /health` does not return HTTP 200 within 10 minutes of PR A's merge, roll
> back. Do not debug forward.**
>
> *Amended 2026-08-02:* **ten minutes is the window to DECIDE, not the window to finish.** A
> rollback is now a rebuild (§8.1.1), so budget build time **on top of** the decision. The
> `ingestion-image` job builds this exact context in **~50s** (52s on `9e31c22`, 56s on `0c73297`),
> which is the closest available proxy for Railway's build. The margin still fits; it is thinner
> than the number implies, and it is no longer dominated by container start.

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
>
> *Amended 2026-08-02:* the sequence is now **roll back, THEN IMMEDIATELY RE-PROBE N9 against the
> rolled-back deployment.** "Roll back first, diagnose after" was premised on rollback being fast
> and known-good. It is now neither. Because the rollback rebuilds from source rather than
> re-activating the image that was running (§8.1.1), **nothing guarantees the rebuilt image
> reproduces the authenticated behaviour of the deployment you are rolling back to.** Rolling an
> auth defect into an unverified rebuild and walking away is a new failure mode, and it is worse
> than the one being fixed. The trigger still fires; it now has a second half.

### 8.1.1 The rollback, as it actually works — corrected 2026-08-02

**The superseded claim is preserved rather than deleted, because it led every rollback plan in this
file and deleting it would hide why the plans were shaped that way:**

> ~~**The rollback:** Railway dashboard → Deployments → the last pre-PR-A deployment → **Rollback**.
> It re-activates an already-built image with no rebuild. Production Next is unchanged and still
> calls `/convert`, which that image serves (`services/ingestion/main.py:146` on `main`). Duration
> is container start plus health gate.~~

**That paragraph is false on this plan.** Read from the Railway dashboard on 2026-08-02: **every
deployment in the history is marked REMOVED**, not merely the old ones. There is no already-built
image to re-activate. What "Rollback" does now is **rebuild from that commit's source**.

Three consequences, graded by how much they cost:

1. **"no rebuild" — false.** Rollback is a rebuild. Nothing re-activates.
2. **"container start plus health gate" — false, but survivable.** Add ~50s of build (see TRIGGER 1
   above). Slower, not disqualifying.
3. **THE FIDELITY LOSS — the real casualty, and it was never written down because it was assumed.**
   `services/ingestion/Dockerfile` says `FROM python:3.11-slim`, a **mutable tag**, and
   `requirements.txt` pins its seven direct dependencies but **nothing transitive** — there is no
   lock file and no hashes, and `markitdown[all]==0.1.5` pulls the entire PDF/DOCX/PPTX extraction
   stack unpinned. So rebuilding commit *X* today produces an image with **today's base layer and
   today's transitive dependency resolution**. **A rollback therefore restores SOURCE, not STATE.**
   It is not a return to a verified artifact; it is a **forward deploy to an unverified one that
   happens to carry older source.**

**What that changes about every trigger in §8.1:**

- **Every rollback must be followed by re-running V1, N9 and V4** against the rolled-back
  deployment. This section previously required nothing after a rollback, because rolling back was
  *defined* as returning to a known-good state. It is not one any more. Without the re-run, a
  rollback can silently introduce a **new** defect while removing the old one — and it would be
  discovered by the same mechanism that found the last one, which is to say nine days later.
- **TRIGGER 4 gains an explicit second half**, stated in the amendment above.
- **TRIGGER 1's ten minutes is a decision budget**, not a completion budget.

**DIGEST-PINNING IS A PRECONDITION FOR THIS PROCEDURE WORKING — not cleanup, and not an
optimisation.** This section cannot be repaired by rewriting it. Rewriting only makes it *honest*;
the procedure stays degraded. The only change that makes "roll back" mean what this file has always
assumed it means is pinning the base image **by digest** in `services/ingestion/Dockerfile` and
adding a hash-pinned dependency lock. With those, rebuilding commit *X* reproduces near-identical
bytes and rollback recovers its definition. Without them, **no rollback OF THE INGESTION SERVICE can
restore a known artifact, ever.**

**That scope is deliberate and was narrowed 2026-08-02 after an earlier draft of this paragraph
overstated it.** The precondition binds on rollbacks of the **Railway ingestion service** — the
subject of this entire section. It does **not** bind on **PR B**, and the reason is a fact worth
stating rather than leaving to be re-derived: **PR B changes `src/app/api/ingest/route.ts`, which is
a Vercel deployment, and Vercel RETAINS its deployments.** PR B's abort path is `git revert` or
Vercel's own instant rollback, neither of which touches a Railway image. **PR B never depended on
the rollback that was already dead.** See the amended asymmetry note above.

> ### HARD GATE — the digest pin and the hash-locked lockfile are REQUIRED BEFORE PR C MERGES.
>
> **This is a gate, not a recommendation, and it carries a date because a precondition narrowed
> without a deadline becomes an intention — and an intention recorded as a completed action is
> exactly the defect this PR's §7 block supersedes in the 2026-07-23 register-#45 entry.** A future
> reader is entitled to hold this sequence to the sentence above the same way they would have been
> entitled to hold it to the unscoped version.
>
> **PR C is where the precondition binds**, because PR C is a `services/` change whose failure mode
> is remediated by exactly the Railway rollback that §8.1.1 has just shown does not work. Merging
> PR C without the pin means shipping the one change in this sequence whose abort path is known to
> be broken.
>
> **Required, both of them, in `services/ingestion/`:**
> 1. `Dockerfile` — `FROM python:3.11-slim@sha256:<digest>` replacing the mutable tag.
> 2. A hash-pinned dependency lock (`pip-compile --generate-hashes`), because pinning the base
>    while `markitdown[all]==0.1.5` still resolves its transitive tree freely leaves most of the
>    drift surface open.
>
> **Recorded as row N10 in §10**, so it is checkable rather than merely written down.

`.github/workflows/ingestion-image.yml:29-36` already ruled on the location: the Dockerfile, so CI
and Railway move together — pinning in CI alone is a silent false-green. That is a `services/`
change and is **deliberately not in this PR.**

**This rollback is valid for the entire PR A window and dies the moment PR B merges** — after that,
production Next calls `/ingest`, and the pre-PR-A image does not have it, so rolling back one
deployment makes things strictly worse. That asymmetry is why V1 gates PR B.

**Amended 2026-08-02 — the asymmetry above is real but it was never PR B's safety net, and the
distinction matters now that §8.1.1 has shown the net was already gone.** For the *service*, the
rollback did not "die the moment PR B merges" — **it was already dead and nobody knew**, because
Railway had reaped the images this section assumed it could re-activate. What survives unchanged is
the narrower true statement: **PR B's own abort path never ran through Railway at all.** PR B
changes `src/app/api/ingest/route.ts`, which is a **Vercel** deployment, and **Vercel retains its
deployments** — so PR B aborts by `git revert` or by Vercel's own instant rollback, neither of which
needs a Railway image to exist. **That is the fact that makes moving PR B safe rather than merely
convenient**, and it is the reason the digest-pin gate below lands on **PR C**, which genuinely does
depend on a Railway rollback, rather than on PR B, which never did.

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

### 9.1 RULED 2026-08-02 — Watch Paths is set AFTER PR C, not between B and C. This is a B9 line.

**The "between B and C" placement above is superseded.** It schedules the pattern's **first live
exercise on PR C** — the single merge in this whole sequence that **must** trigger a deploy, and the
one whose silent failure §9 itself describes as `/convert` staying live forever with no symptom. An
untested configuration pattern should never have its debut on the deploy that cannot be allowed to
go missing.

**Why not simply rely on the monitor to catch it:** it would. `production-monitor` derives its
expected `/convert` status from `main.py` at the checked-out commit, so a PR C that merges without
deploying reds within **one tick — at most ~15 minutes**. That is a real backstop and it is why the
monitor had to land before any Watch Paths change. **But catching it is not the same as wanting it
to happen.** Debugging a glob's evaluation root *inside* the shim-removal window mixes two unrelated
problems — "did PR C deploy?" and "is the pattern right?" — at the moment when the answer to the
first must be unambiguous. **There is no gain that offsets it:** the only thing Watch Paths buys is
avoiding redundant rebuilds, and a redundant rebuild is cheap. Sequence it after PR C, where a wrong
pattern costs a delayed deploy instead of an invisible one.

**How the pattern gets verified empirically once set — both directions, because one is not enough:**

| Push | Pattern `services/ingestion/**` | Reading |
|---|---|---|
| no-op commit touching **only a file under `services/ingestion/`** | a deployment fires | globs are **repo-root-relative** → pattern confirmed |
| same | **no** deployment | root-dir-relative, **or the pattern was discarded** → retest with `**` |
| no-op commit touching **only a file outside `services/`** (e.g. `docs/`) | **no** deployment | pattern is **active** |
| same | a deployment fires | pattern is being **ignored** → revert to empty; it is not trusted |

**The negative push is not optional.** A malformed pattern that Railway silently discards passes the
positive test, delivers zero savings, and leaves everyone believing the scoping is on. Only the
outside-`services/` push distinguishes "root-dir-relative and working" from "discarded entirely".

`services/ingestion/**` is the right first probe because it can only match under one reading: taken
as Root-Directory-relative it would require `services/ingestion/services/ingestion/…`, which never
exists. Record deployment ID, commit SHA, trigger label and duration for **each** of the two pushes,
read from Railway's deployment list — never inferred from the absence of a notification. **The
pattern is not trusted until the next real `services/` change is confirmed live by probing the
running service**, N6-style, rather than by reading the dashboard.

---

## 10. Results

**Empty cells are not "pass by default."** A blank cell means the check has not been run, and V12
forbids merging PR B while any PR-A/PR-B row is blank.

### The **Artifact** column — what it can and cannot prove

**Renamed from "Deployment" and re-specified 2026-08-02, because its original promise cannot be
kept.** It was defined as recording "the Railway deployment ID or image digest each row was observed
against," so that "a green row can be tied to the artifact that produced it after any rollback" —
the register **#39** problem this file exists to solve.

**It cannot do that any more, and no wording fixes it.** Railway marks deployment images **REMOVED**
on this plan, for the entire history (§8.1.1). **No row below can be re-inspected.** The deployment
*record* survives; the *artifact* does not.

So the column records, in this order:

1. **`built from <sha>` — the durable identity.** Which source produced the row. Survives everything.
2. **`observed <UTC>` — when the check ran.** Survives everything.
3. **`ARTIFACT REAPED` — mandatory on every row.** Present so no reader mistakes an identifier for a
   retrievable artifact.
4. **`dep <id>` — a pointer into Railway's own record, secondary and expiring.** It is **not**
   artifact identity. It earns its place for exactly one reason: **Railway rebuilds `main`'s head on
   any trigger, so one commit SHA can correspond to several distinct deployments** — and because the
   base tag is mutable and transitive dependencies are unlocked, those deployments are **not
   guaranteed to be the same artifact**. The SHA alone cannot separate them; the ID can. It is also
   the only handle on build duration and trigger label. It proves nothing about bytes.

**`⟨FILL-IN⟩` marks a value not yet read off the dashboard.** It is a populated, honest cell — not a
settled one. **V12 is checked when PR B merges, not when this table is drafted**, so a `⟨FILL-IN⟩`
does not block drafting; it must be resolved before PR B moves. **Both of this table's `⟨FILL-IN⟩`
markers were resolved 2026-08-02 before PR B moved**; the convention is kept for future rows.

### Why the ID must be labelled with what kind of thing it is

**Recorded because it cost a session, and because it is the single cleanest argument for this whole
column.** A Railway deployment card's header shows an **8-hex string that is a DEPLOYMENT-ID prefix**
— it is **not a commit SHA**. Unlabelled, it looks exactly like an abbreviated git object, and it was
read as one: it does not resolve with `git cat-file`, does not resolve after `git fetch --prune`, and
returns **422** from the GitHub commits API. Every explanation offered for those failures assumed the
string was a commit and searched for a reason the commit was missing. **None of them could be right,
because the string was never a commit at all.**

The lesson generalises past Railway: **an identifier recorded without stating what it points to will
be read as the wrong kind of thing, and every subsequent inference inherits the error.** That is why
each cell below spells out `built from <commit>` and `dep <deployment-ID prefix>` separately and
says so in words, instead of listing two 8-hex strings side by side and trusting the reader.

### Provenance classes

Every row carries one, because "PASS" alone hides how much the PASS is worth:

- **`machine-verified`** — an agent ran the probe or query against live production this session and
  the result is reproducible by anyone with the same access.
- **`owner-attested`** — observed by the repository owner in a dashboard or UI. Not machine-verified,
  and not weaker for being honest about it. **V3** established this class; **V5** joins it.
- **`CI-observed`** — asserted by a workflow on a runner nobody here controls, with public logs.

**Unfilled rows carry `— (PR X fills)` in this column until they are run.** That is a placeholder
naming who owes the row, not a provenance class, and it replaces the old **Filled by** column.

**V1, V2 and N9 carry `machine-verified` + `CI-observed` together**, and that combination is what
makes them a stronger class than a one-time reading. Since 2026-08-02T14:59Z the
`production-monitor` workflow (PR **#75**) re-asserts all three **every 15 minutes**. They stopped
being a single observation by one agent at that moment. No other row has an independent standing
check, and none of them should be read as if it does.

**`CI-observed` asserts whatever is LIVE at each tick — never the artifact the row was filled
against.** The two claims are different and must not be collapsed. Concretely, and by a margin small
enough to prove the point: deployment `d7fb32b5` stopped at **14:59:24Z**, and the monitor's first
`/health` probe fired at **14:59:25.5Z** — **1.5 seconds later**, against the deployment PR #75's
merge had just created. **So the standing corroboration for V1/V2/N9 began against a different
artifact than the one their `machine-verified` observation was taken on.** That is correct behaviour
and exactly what a monitor is for; it is recorded here so nobody later reads the `CI-observed` mark
as evidence that a *reaped* artifact is still being checked. Nothing re-checks a reaped artifact.
Nothing can.

**Who fills what:**

- **PR A creates this file** with the V11 row already filled, since the `ingestion-image` workflow
  merged ahead of it and is already green on `main`. Every other cell starts blank.
- **PR A fills** V3 on its own branch before merge, since the Railway variables are readable now and
  item 8 gates PR A pre-merge.
- **V1, V2, V4, V5, N4 and N9 are only observable after PR A's image is live**, so they are recorded
  by a small **docs-only PR to `main`** between PR A and PR B — a PR, not a direct push, like every
  other change in this repo. That PR's merge commit is the artifact V12 checks for. **That PR is
  this one.** It is docs-only, so it triggers a Railway rebuild of an unchanged `main.py`.
  **Corrected 2026-08-02: that rebuild is not "harmless" and not incidental — it is a defect with
  its own register row.** Confirmed empirically the same day: PR **#74** touched only `src/` and
  `docs/`, and the Railway dashboard showed the resulting deployment **active, "via GitHub",
  successful**. Every frontend or docs PR silently rebuilds and swaps the production ingestion
  image, from a mutable base tag and unlocked transitive dependencies. It is still a free rehearsal
  of the swap; it is no longer filed as harmless.
- **PR B fills** V6, V7, V8, V9, V10, and V12, and may not be merged until every row above is filled.
- **PR C fills** the N5 and N6 rows, and records the cleanup.

| Row | Check | Provenance | Run at (UTC) | Result | Evidence | Artifact |
|-----|-------|-----------|--------------|--------|----------|------------|
| V11 | `ingestion-image` green on `main` | CI-observed | 2026-07-26 20:41 | **PASS** — `success` in **44s** on `eaad75294e9102ef83e93b810542e93217e2a2f1` | https://github.com/tornidomaroc-web/knowflow/actions/runs/30219501234 | CI runner; no Railway deployment |
| V3 | No service-role key on Railway; anon key decodes `role: anon` | owner-attested | 2026-07-29 15:57 | **PASS** | Decoded payload's `role` claim reads `anon`, not `service_role`; legacy Supabase JWT format, so the `sb_publishable_` branch did not apply. Railway service carries no `SUPABASE_SERVICE_ROLE_KEY` — its four user variables are `INGESTION_TOKEN`, `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. See dependency note below. | Dashboard read plus local decode; no Railway deployment |
| V1 | `/health` returns 200 | machine-verified + **CI-observed** | 2026-08-02 14:06:10 | **PASS** — HTTP 200 | `GET /health` → `200` in 0.43s. Re-asserted every 15 min since 14:59Z by `production-monitor` (PR #75); first run [30753322454](https://github.com/tornidomaroc-web/knowflow/actions/runs/30753322454) green in 9s. | built from `9e31c22` · observed 2026-08-02T14:06:10Z · **ARTIFACT REAPED** (Railway status: *Removed*) · dep `d7fb32b5` — an 8-hex **deployment-ID prefix, NOT a commit SHA** · deployment live 2026-08-02T14:02Z → 14:59:24Z, so the observation falls inside its lifetime |
| V2 | `/health` reports `supabase_configured: true` | machine-verified + **CI-observed** | 2026-08-02 14:06:10 | **PASS** | Body: `{"ok":true,"embed_provider":"voyage","embed_model":"voyage-3-large","embed_dim":1024,"supabase_configured":true}`. The monitor additionally asserts `embed_dim == 1024`, which this row never covered — `chunks.embedding` is `vector(1024)`. | built from `9e31c22` · observed 2026-08-02T14:06:10Z · **ARTIFACT REAPED** (Railway status: *Removed*) · dep `d7fb32b5` — an 8-hex **deployment-ID prefix, NOT a commit SHA** · deployment live 2026-08-02T14:02Z → 14:59:24Z, so the observation falls inside its lifetime |
| V4 | Production upload via `/convert` shim reaches `ready` | machine-verified | 2026-08-02 14:20 (document created 2026-08-01 16:00:40) | **PASS** — all five Q3 conditions | Q3 on `6c0ff12c-b462-479f-b918-1889f19703a2` (`cv_abdelfettah_amellah.pdf`, account `72ebd7b5`): `status=ready`, `embedding_status=ready`, `chunk_count=2` = `actual_chunk_rows=2`, `has_markdown=true` (2633 chars), `error_message` null. **Q4 was additionally run against this same document as supporting evidence — not as V7**, which is PR B's preview upload: 2 rows, 0 null embeddings, 0 wrong dims, `min_idx=0`, `max_idx=1`, `distinct_idx=2`, both vectors 1024-dim. | built from `ee45958` · **produced** 2026-08-01T16:00:40Z (observed 2026-08-02) · **ARTIFACT REAPED** (Railway status: *Removed*) · dep `16ea983d` — an 8-hex **deployment-ID prefix, NOT a commit SHA** · created 2026-08-01T15:38Z; its deploy log carries the authenticated `/convert` 200 at 15:45:03Z and the restoration upload at 16:00:48Z |
| V5 | Production Ask returns a grounded answer | **owner-attested** | 2026-08-01 | **PASS** | The summarize action on document `6c0ff12c` returned a substantive **Arabic summary drawn from the PDF's real content**, not the "can't find that in your materials" response. **Attested by the repository owner, not machine-verified — the same epistemic class as V3.** No artifact, log or transcript survives behind it. | built from `ee45958` · observed 2026-08-01 · **ARTIFACT REAPED** (Railway status: *Removed*) · dep `16ea983d` — an 8-hex **deployment-ID prefix, NOT a commit SHA** · created 2026-08-01T15:38Z; its deploy log carries the authenticated `/convert` 200 at 15:45:03Z and the restoration upload at 16:00:48Z |
| N4 | All-accounts Q6b (§4) returns 0, `created_at` bounded at PR A's merge | machine-verified | 2026-08-02 14:2x | **PASS** — 0, both bounded and unbounded | `documents where status='processing' and created_at > 2026-07-29T19:20:36Z` (PR A's merge) across **all accounts** → **0**. Re-run with the date bound removed → also **0**, so nothing is stranded anywhere at any time, which is stronger than the row requires. | **Not attributable to a single deployment.** This row asserts a **global invariant across every document ever written**, not the behaviour of one artifact. Observed 2026-08-02T14:2xZ. |
| N9 | Unauthenticated `POST /convert` returns 401 | machine-verified + **CI-observed** | 2026-08-02 14:0x | **PASS** — `401 {"detail":"Missing bearer token"}` | **TRIGGER 4 does not fire.** Probed before any other work this session, precisely because it is a rollback trigger. **The multipart file part is load-bearing:** FastAPI validates the body *before* the bearer check, so an unauthenticated POST with **no** file returns **422 `"Field required"`** — proven by direct probe, not inferred. With a file part and no `Authorization`: **401**. Re-asserted every 15 min by `production-monitor`. | built from `9e31c22` · observed 2026-08-02T14:0xZ · **ARTIFACT REAPED** (Railway status: *Removed*) · dep `d7fb32b5` — an 8-hex **deployment-ID prefix, NOT a commit SHA** · deployment live 2026-08-02T14:02Z → 14:59:24Z, so the observation falls inside its lifetime |
| V6 | Preview upload via `/ingest` satisfies Q3 | **owner-attested** (§2.6.6) | 2026-08-08 20:33 | **PASS** — all five Q3 conditions | Q3 on `9b422ed4-77f7-4673-a02d-1969d1aa4eed` (`qorvanthil-b1b-20260803.md`, throwaway `d52de42c-cf30-4d46-a130-26bbbd925bae`): `status=ready`, `embedding_status=ready`, `chunk_count=1` = `actual_chunk_rows=1`, `has_markdown=true` (1169 chars), `error_message` null. Document `created_at` 2026-08-08T20:33:29.224554Z. **SUBSTITUTED ARTIFACT — see the note below this table.** | Vercel preview built from `295e1b4` · observed 2026-08-08T20:33Z · **RETAINED** — Vercel does not reap its deployments (§8.1.1) · Railway ingestion service: `main` head was `365ac24`; the serving deployment is ⟨FILL-IN: dashboard⟩ and its image is **ARTIFACT REAPED** |
| V7 | Q4 all six conditions | **owner-attested** (§2.6.6) | 2026-08-08 20:3x | **PASS** — all six | Q4 on `9b422ed4`: `rows=1` (>0), `null_embeddings=0`, `wrong_dims=0`, `min_idx=0`, `max_idx=0` = `rows-1`, `distinct_idx=1` = `rows`. The embeddings crossed into Postgres as real `vector(1024)`, not as null or text. | Same as V6 |
| V8 | Preview Ask contains `QORVANTHIL`; Q5 returns rows | **owner-attested** (§2.6.6) | 2026-08-08 20:3x–21:0x | **PASS** — both halves | Q5 returned **1 row, no error** (`chunk_index 0`), so the persisted values are `vector(1024)` data the cosine operator and HNSW index accept. Preview Ask, asked verbatim *"What is QORVANTHIL?"*, returned an answer containing the literal string `QORVANTHIL` and the fact defined alongside it; citation chip read `qorvanthil-b1b-20260803.md`. **STRONGER THAN THE BAR, and this is why:** the answer reproduced the ingested document's *distinguishing* account of the 50 — chunk rows per insert call, chosen to stay under the REST interface's request-size ceiling **rather than for throughput** — which **contradicts** the substitute document authored for this run and never ingested (which called the 50 an embedding-provider batch). The answer could therefore only have come from the artifact actually in the database. | Same as V6 |
| V9 | `corrupt2.pdf` reaches `error`, 0 chunks; Q6b = 0 | **owner-attested** (§2.6.6) | 2026-08-08 22:1x | **PASS** — all four Q6a conditions and Q6b | **FIXTURE SUBSTITUTED UNDER §2.7 — §2.1's mandated fixture is empirically invalid and this row was NOT obtained with it.** Q6a on `d23154de-9909-4a01-b890-99147b5618d5` (`corrupt2.pdf`, 2048 null bytes, `md5 c99a74c555371a433d121f551d6c6398`): `status='error'`, `embedding_status='error'`, `chunk_rows=0`, `error_message` = *"File conversion failed after 1 attempts: - PdfConverter threw PDFSyntaxError with message: No /Root object!"*. Q6b `stuck_processing=0`. UI showed *"Error — Ingestion failed"*; `POST /api/ingest` → **500**; the file never entered the materials list. Both pre-existing rows survived untouched at `ready`/1 chunk. **WHO OWNS TERMINAL STATUS — OBSERVED, NOT READ:** that `error_message` is the **service's own** string from `_mark_error` (`main.py:257-275`, called at `:409-410`) and is **none of `route.ts`'s** strings. An unconditional post-forward write would have replaced it with *"ingestion service returned 500: …"*. It did not. So the guarded `.eq('status','processing')` write (`route.ts:179-189`, called at `:292`) **stood down as designed** — the premise of this entire PR, proved on the wire. The zero-row UPDATE is not directly observable; its **effect** is, and that is what this cell claims. | Vercel preview built from `5bc850e` · observed 2026-08-08T22:1xZ · **RETAINED** (§8.1.1) · Railway ingestion service: `main` head was `365ac24`; serving deployment ⟨FILL-IN: dashboard⟩, image **ARTIFACT REAPED**. **`route.ts` is byte-identical between `295e1b4` and `5bc850e`** — the only commit between them is docs-only — so V6–V8 and V9 exercised the same runtime code |
| V10 | `material_uploaded` = Q7-BEFORE + 1 | **owner-attested** (§2.6.6) | 2026-08-08 20:3x | **PASS** — in its absolute form | Q7-BEFORE, run before the item-3 upload while the account was empty and **read rather than assumed** (§2.2): `before_count = 0`. Q7-AFTER: `material_uploaded` **`n = 1`**, `first_at = last_at = 2026-08-08T20:33:31.348123Z`. Equal timestamps mean one emit instant, not two events collapsed by the grouping. **EMIT-TIMING CORROBORATION:** that occurred_at is **2.124 s after** the document's `created_at` (20:33:29.224554Z), consistent with the emit firing after the service's ack at `route.ts:329` rather than at row insert — evidence for the gating this PR claims, which the row's own condition does not cover. **Not claimed:** Q7-AFTER was run *before* the two failed uploads and has **not** been re-read since, so this table does not assert that a failed upload emits nothing. | Same as V6 |
| V12 | This table committed with no blanks above | — *(filled by the commit that fills the rest)* | | | | |
| N5 | Nothing calls `/convert`; production Next at or after PR B's merge SHA | — *(PR C fills, pre-merge)* | | | | |
| N6 | `POST /convert` returns 404; production upload still passes Q3 | — *(PR C fills, post-merge)* | | | | |
| N8 | Watch Paths pattern empirically confirmed to fire **in both directions** (§9.1) | — *(fills **after** C; re-sequenced 2026-08-02)* | | | | |
| **N10** | **HARD GATE (§8.1.1)** — `services/ingestion/Dockerfile` pins the base **by digest** and a **hash-pinned** dependency lock is in place | — *(PR C fills, **pre**-merge)* | | | | |
| — | Throwaway account cleanup (§6.3) executed and §6.2 re-run all-zero | — *(PR C fills)* | | | | |

### Two artifacts in the throwaway account that a future reader will misread

**1. `qorvanthil-b1b-20260803.md` is NOT the file §2.3's step authored for this run.** The document
that satisfied V6, V7 and V8 was authored in an **earlier session** for this same purpose. A
different `qorvanthil.md` was written at the start of this run specifically to remove ambiguity about
the fixture, and it was **not** the one uploaded. The substitution was caught at STOP 2 and
adjudicated before any row was recorded: §2.3 mandates **properties** (a `.txt`/`.md` authored for
the purpose, containing `QORVANTHIL`, defined as something specific and checkable, unique within the
subject), **not exact bytes**, and the ingested file satisfies every clause. V8 was then adjudicated
against `documents.markdown_content` read from the database — the artifact actually ingested — and
against nothing else. **Had §2.3 pinned exact bytes, this would have cost a re-upload.** It did not,
and that is luck rather than design.

**2. There is a `corrupt.pdf` row sitting at `status='ready'` with nine bytes of content, and it is
EVIDENCE, not a malfunction.** Document `e1170dd6-4326-4955-9667-1e2923ca34a6`, `file_type='pdf'`,
`chunk_count=1`, chunk 0 holding exactly `not a pdf`. **This is §2.1's mandated V9 fixture failing to
fail** — the run that proved §2.1 empirically invalid (§2.7.1). It is deliberately **retained** so
the finding is inspectable rather than merely described, and it is why the working fixture had to be
named `corrupt2.pdf` (§2.7.3): Q6a selects by filename, and two rows called `corrupt.pdf` would be
exactly the ambiguity §4 warns about. It is removed by §6.3 at PR C along with the rest of the
account. **A reader who finds it and concludes the pipeline is broken has the story backwards** — it
records that the pipeline accepted something it should have rejected, which is register-worthy
(§2.7.5) and is not what V9 measured.

### Line-reference drift in §2.1 — no substantive change

§2.1 cites `src/app/api/ingest/route.ts:59-76` for the extension + MIME allowlist and `:71` for the
tolerance of empty and generic MIME. In PR B those moved to **`:59-88`** and **`:83`**. The gating
logic is unchanged; only the line numbers drifted. Recorded so a future reader who follows the
citations and finds different code does not conclude the behaviour changed.

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
| 2026-08-08 | **§10 filled by PR B for V6, V7, V8, V9, V10 — all PASS — and §7.4 added.** V8 recorded as stronger than its bar: the Ask reproduced the ingested document's distinguishing account of the batch size, which contradicts the never-ingested substitute, so retrieval is proved against the artifact actually in the database. V9 records **who owns terminal status, observed on the wire** — the `error_message` is `_mark_error`'s own string and none of `route.ts`'s, so the guarded `.eq('status','processing')` write demonstrably stood down; the cell states that the guard's *effect* is observed and the zero-row UPDATE itself is not. V10 carries the emit-timing corroboration (2.124 s after the document's `created_at`) and explicitly declines to claim anything about failed uploads, which were never re-read. Two throwaway-account artifacts are documented against misreading: the **substituted** QORVANTHIL file, and the **retained `corrupt.pdf` junk `ready` row** that is evidence of §2.1's invalid fixture rather than a malfunction. §2.1's line references recorded as drifted (`:59-76`→`:59-88`, `:71`→`:83`), no substantive change. **§7.4 records that V9 exercised ONE failure branch and that the guard's RESCUE half — the orphan killer — plus `:255`, `:310`, `:196-200` and `:218-221` remain unexercised in every environment; accepted as untested, PR B not held on it.** Provenance for all five rows is **`owner-attested`** per §2.6.6. Two Railway deployment IDs left as `⟨FILL-IN: dashboard⟩`. |
| 2026-08-08 | **§2.7 added by PR B, after V9 failed to occur and before the replacement fixture was uploaded.** §2.1's mandated fixture is empirically INVALID — the 9-byte `not a pdf` file reached `status='ready'` with 1 chunk, because MarkItDown sniffs content and the plain-text converter accepts text-like bytes before the extension is ever consulted. Records the probe **method** (a local `markitdown[all]==0.1.5` harness **calibrated against the known production result on a control payload**, with the discard rule fixed before it ran) ahead of its outcome; the replacement fixture (2048 null bytes, `md5 c99a74c555371a433d121f551d6c6398`, chosen over random bytes for reproducibility); the `corrupt2.pdf` filename deviation and its effect on Q6a; a **binding stop rule** forbidding a third fixture; and a product finding in which the repository owner's "damaged file shown READY with garbage" framing is **disproved by measurement** — a structurally destroyed PDF raises as designed, so the hole is type-mismatch, not damage. |
| 2026-08-08 | **§2.6 added by PR B, before the V6–V10 run.** Records: "Confirm email" is now ENABLED, so §5.1 step 1's justification is false (§2.6.1); the `/login` consequence, corrected, scoped to the form-submit step and labelled an **unobserved code reading** (§2.6.2); the throwaway account's off-protocol creation on production and the precise one-runtime-file argument that legitimises it (§2.6.3); **the load-bearing upload order**, with the three `route.ts` branches that would otherwise produce a false V9 PASS (§2.6.4); the `profiles` precondition and why confirmation-enabled signup made it load-bearing (§2.6.5); and that V6–V10 will be **`owner-attested`**, not `machine-verified` (§2.6.6). A pointer to §2.6 was added at §5.1 step 1; the step's own text is unedited. |
| 2026-07-26 | Created by PR A. Eight points pinned verbatim from PR #70; §1.2 preamble struck; item 6's `VOYAGE_API_KEY` method struck; Q7-BEFORE and the `QORVANTHIL` step made mandatory; N1-N9 added; §7 accepted-untested recorded. Pre-creation review also added §2.4/§2.5 (the two places §1.1 is superseded), **N9** (register #45 auth probe), TRIGGER 3 (production Ask), the §10 Deployment column, and pinned items 3-7 to **PR B's** preview deployment. |
