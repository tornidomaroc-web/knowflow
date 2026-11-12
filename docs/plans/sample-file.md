# Build plan: "try with a sample file" (audit cause 9)

**Status: approach (b) APPROVED by the owner 2026-11-11; the inputs are built (section 10), the route and the button are not.** Owner decision 2026-11-11: a button on the
zero-material home's three-steps card creates a subject "مثال" / "Sample"
holding one short file about the cell, asks for the AI permission first, then
offers one ready question under the Ask field. The file does not use one of the
day's 5 uploads. The student can delete it.

Copy drafts: `docs/copy-drafts/sample_file_cell.md` (the file's text) and
`docs/copy-drafts/sample_file_ui.md` (the button, names, question, refusals).
Code references are to main at 74909d8.

## 1. Where the button sits

- The three-steps card is `pathCard` in
  `src/components/dashboard/StudentHome.tsx:235`. It is drawn while a step is
  left (`stepsLeft > 0`, line 195) and comes first when the upload step is not
  done (`homeStepsFirst`, `src/lib/home-order.ts`, used at line 210 and 319).
- The button goes inside that `<section>`, under the `<ol>` of steps, and is
  drawn only when `stepsFirst` is true: the upload step is not done, which is
  the home's own definition of "no material yet". Once any material exists the
  button is gone, with no new query.
- Web and app alike: the card is the same component on both, and the button
  carries no purchase wording, so the app-wording rule
  (`scripts/lib/app-wording.mjs`) has nothing to exclude.
- It is a client island (`SampleFileButton`), because the page is a server
  component and the button needs the consent sheet (`useAiConsent`,
  `src/components/ai-consent/AiConsentProvider.tsx:45`) and a POST.

## 2. How the subject and the file are created

### The two paths, compared

| | (a) static file, normal ingestion | (b) static file, chunks written from the repo |
|---|---|---|
| What runs per student | storage upload, `documents` row, Railway `/ingest`: conversion, chunking, Voyage embedding, chunk insert | storage upload, `documents` row at `ready`, chunk rows inserted with embeddings computed ONCE and committed |
| Calls to Voyage AI per sample | 1 (2 to 3 chunks) | 0 |
| Calls to Railway per sample | 1, with its cold start and its failure modes (`src/app/api/ingest/route.ts:321` onward) | 0 |
| Time to ready | seconds to tens of seconds; the student waits on a spinner | one request, about as long as creating a subject |
| Can it fail for our reasons | yes: every ingestion failure the upload path has | only a database or storage error |
| Daily attempt counter (`increment_usage`, the ceiling of 10) | must be bypassed on purpose, or the sample spends an attempt | never touched: `/api/ingest` is not called |
| Page labels (G2) | from the PDF's form feeds, if MarkItDown and pdfminer agree (`services/ingestion/main.py:558`) | written by us: `page_start`, `page_end`, `page_kind` are plain chunk columns |
| Drift risk | none: the real pipeline | the committed vectors must come from the same model and chunker as production (`VOYAGE_MODEL`, `main.py:32`; `CHUNK_TOKENS` 512, `CHUNK_OVERLAP` 64, lines 78 to 79) |

### What was measured, and what was not

- Text size (counted by script on the draft): Arabic 293 words, English 349.
- Chunks: the chunker cuts 512-token windows with `cl100k_base`
  (`main.py:100`, `516`). NOT measured here: `tiktoken` is not installed on
  this machine and nothing was installed for a design step. Estimate: English
  about 450 tokens, 1 chunk; Arabic about 900 to 1,100 tokens, 2 to 3 chunks.
  The build's first step prints the exact numbers in the `ingestion-image` job.
- Cost of (a): one embedding call of at most about 1,100 tokens. Voyage's list
  price for `voyage-3-large` is not verified in this session; at the order of
  USD 0.2 per million tokens it is about USD 0.0002 per sample. Money is NOT
  what separates the two paths. Time, failure and the counter are.
- RLS allows (b) without the service role: a student may insert their own
  chunks (`supabase/migrations/20260501_rag_pgvector.sql:35`), their own
  documents and subjects (`001_initial_schema.sql:38`, `53`).

### Recommendation: (b)

One route, `POST /api/sample`, under the student's own session:

1. `getUser()`, then `hasAiConsent(user)` or 403 `ai_consent_required`
   (`src/lib/ai-consent.ts:39`), exactly as `/api/ingest` does at line 133.
2. Idempotency read (section 5). If the sample exists, answer with its subject id.
3. `checkKBLimit` (`src/lib/limits-server.ts:27`); refuse with the reused
   subject-limit line.
4. Insert the subject (name from the dictionary by locale), insert the
   `documents` row with a minted id, `status: 'ready'`,
   `embedding_status: 'ready'`, `chunk_count`, `pages_total: 2`,
   `pages_no_text: 0`, `storage_path`, `is_sample: true`.
5. Upload the committed PDF bytes to the `documents` bucket at the normal key
   `{userId}/{kbId}/{documentId}/{name}` (`src/lib/storage-key.ts`), so rename
   and delete behave as for any material.
6. Insert the chunk rows from `src/lib/sample-file/cell.{ar,en}.json`:
   `content`, `token_count`, `chunk_index`, `embedding`, page columns.
7. On any failure after the subject insert: delete the subject (cascade removes
   the document and chunks) and the stored file, answer 500 with
   `sampleFailed`.

The committed JSON is produced by a script that calls the ingestion service's
OWN functions (`_convert_to_markdown`, `_chunk_text`, `_assign_pages`,
`_embed`) on the committed PDF, so the chunks are byte-for-byte what (a) would
have stored. It needs the Voyage key once. **Open question for the owner:**
where that one run happens. Proposed: a `workflow_dispatch` workflow in an
environment that holds the Voyage key, uploading the JSON as an artifact that a
PR then commits. No key reaches the repo or a log.

A proof holds the drift risk: `verify-sample-file.mjs` and a Python test fail
when the JSON's recorded model, chunk size, overlap or the PDF's sha256 differ
from `main.py` and the committed file.

## 3. The AI permission

- The button calls `useAiConsent()` first. With permission already given, it
  POSTs. Without it, the sheet opens (the same sheet as upload, quiz and
  summary), and "I agree" then POSTs.
- "Not now": nothing is created, no request is sent, and the card shows the
  approved `dashboard.aiConsent.declined` sentence, as the drop zone does
  (`src/components/upload/DropZone.tsx:280`).
- Honest note: creating the sample under (b) sends nothing to Anthropic or
  Voyage AI. The permission is still asked first, as decided, because the very
  next tap (the ready question) does send the question to both. The server
  refuses without it (step 1), so the order cannot be skipped by calling the
  route directly.

## 4. The day's uploads

- The 5 the student sees are today's documents not at `error`
  (`keptUploadsToday`, `src/lib/upload-allowance.ts:57`, read at
  `src/app/api/ingest/route.ts:165`). A sample row created today would count.
- The attempt counter is not touched by (b).
- **Without a schema change it can be done, and I do not recommend it.** The
  marker would be `storage_path IS NULL` on a row created today (every upload
  since #110 writes a path). It overloads a column whose NULL already means
  "created before #110", and a rename writes a path into such a row
  (`src/app/api/documents/[id]/route.ts:142`), after which the sample would
  count.
- **Recommended: one column.** Migration, as text only, NOT applied:

```sql
-- supabase/migrations/2026MMDD_documents_is_sample.sql
alter table public.documents
  add column is_sample boolean not null default false;

comment on column public.documents.is_sample is
  'True for the one sample file /api/sample creates. Not counted in the day''s uploads (src/lib/upload-allowance.ts).';
```

  The read at `route.ts:165` adds `is_sample` to its select and
  `keptUploadsToday` skips rows where it is true. No policy changes: the
  existing "for all" policy covers the column.
- What the column does NOT protect, stated plainly: a student can already write
  their own `documents` rows through the API (the policy is "for all"), so they
  could set `is_sample` on a real upload and free a place in the 5. They can do
  the equivalent today by setting `status` to `error`. Both are bounded by the
  atomic attempt ceiling (10 ingestions a day), which this plan does not touch.
- Order of work if approved: the migration is applied to production by hand
  BEFORE the code merges (as with the page columns in #307), then `db-types`
  and `public-grants` stay green.

## 5. Idempotency and the subject limit

- **Double tap:** the button disables on the first press (`sampleAdding`). The
  server is the real guard: step 2 looks for the caller's document with
  `is_sample = true`; if one exists it returns that subject's id and creates
  nothing.
- **Two requests at the same instant** can both pass that read and make two
  sample subjects. A database guard would need a second column
  (`knowledge_bases.is_sample` with a unique index on `(user_id) where
  is_sample`). **Recommended:** accept the rare duplicate in the first build and
  say so in the PR: the button disables on press, it is visible only at zero
  material, and the student can delete the extra file.
- **A second sample later:** the button is gone once any material exists. If
  the student deleted the sample file and has no other material, the button is
  back and a new sample is created in a new subject, unless the old "مثال"
  subject still exists and is empty, in which case the route reuses it.
- **The 5-subject limit:** checked in step 3 with the same function the
  new-subject page uses through `/api/check-limit`. The sample subject counts
  as one of the 5. Refusal reuses `dashboard.newKb.errorLimit*`.

## 6. Format

- **PDF, two pages.** It is the format students upload most, and a PDF is what
  makes a page label honest: the pill reads "ص 2" because the answer IS on
  page 2 of a real two-page file the student can see named in the subject.
- Markdown would be simpler to commit and diff, but `main.py:558` gives page
  numbers only to PDFs and slides, and a label on a file with no pages would be
  invented.
- Under (b) the pill comes from the chunk columns we write (`page_kind`
  `'page'`), read by `src/lib/citation-pages.ts:29` and shown by the Ask
  sources. The script in section 2 takes the numbers from the real PDF, so the
  label is the one (a) would have produced.
- The PDF is generated from `docs/copy/` text by a committed script (a pinned
  generator in CI, fonts embedded, Arabic shaped), and the Arabic one must pass
  #309's reading-order conversion: the test in section 7 converts it back and
  compares with the source text.

## 7. Tests first, failing on main

Written before the feature, each shown failing on main:

1. `scripts/verify-sample-file.mjs` (typecheck job, no network):
   - the button is drawn only inside `stepsFirst` in `StudentHome.tsx`;
   - `/api/sample` refuses without consent before any insert, and checks the
     subject limit before the subject insert;
   - `keptUploadsToday` does not count a row with `is_sample: true`, and still
     counts every other row exactly as today (the existing activation-5 cases
     re-run);
   - the route never calls `enforceUploadLimit` or `increment_usage`;
   - the committed JSON: chunk count, 1024-length vectors
     (`20260501_rag_pgvector.sql:18`), page columns present, recorded model and
     chunker equal to `main.py`, sha256 of the PDF equal to the committed file;
   - the ready question is offered only for the sample subject, and the file's
     text contains the answer's key words (energy, cellular respiration).
2. `services/ingestion/tests/test_sample_file.py` (ingestion-image job): the
   committed PDFs convert to the committed text (Arabic in logical order), two
   pages, chunks equal to the JSON's contents.
3. `verify-arabic-copy`: the new keys, from the batch file, with the count raised.

Render checks and fixtures (design-c; ar and en, light and dark, 390 and 1280):

- `home-empty` with the button: the button at least 44 x 44, its line on one
  or two lines with no one-word line; in the first view at 390 x 844.
- `home-empty` after "Not now": the declined sentence under the button.
- `subject-sample`: the subject "مثال" holding the one file, ready.
- `ask-sample`: the ready question under the Ask field, on one line, inside its
  chip; and `ask-sample-answered` from a fixture answer with a page pill.
- Forced cases: a button drawn with material present must be flagged; a ready
  question on a non-sample subject must be flagged.

On a device: the signed-in iOS run must NOT press the button (it would write to
the reviewer account). It only asserts the button's presence or absence.

## 8. Risks

- **Cost per sample:** (b) costs no AI call to create. The ready question costs
  what any question costs and counts in the day's questions.
- **Abuse:** a loop of create and delete makes subjects, rows and a small
  stored file, all under the caller's own account and RLS, with no AI spend.
  The subject limit bounds live subjects. No new rate limit is proposed; say if
  you want the route held to a few calls a day.
- **RLS:** every write is the student's own session; no service role in the
  route. Deletion of the stored file already uses the service role inside
  `deleteMaterial` (`src/lib/material-deletion.ts:157`), unchanged.
- **The reviewer's fresh install:** Apple sees the button on the empty home.
  It names no plan or price, creates content the reviewer can delete, and asks
  the AI permission first, which is the behaviour Apple 5.1.2(i) reviewed.
  The reviewer account must be left without a sample after any manual check.
- **Deletion:** the file is deleted like any material (#47). **There is no
  subject delete on main**: after deleting the file, the empty "مثال" subject
  stays and holds one of the 5 places. Either the route reuses that empty
  subject next time (planned above), or subject delete is built first. This is
  the one gap between "the student can delete it" and what main can do.
- **Stale vectors:** if `VOYAGE_MODEL` or the chunker changes, the committed
  vectors no longer match queries. The proof in section 2 fails the build
  until the JSON is regenerated.
- **A sample is not the student's material:** the two new accounts measured on
  2026-11-11 created a subject and stopped at the file. A sample answers "what
  does this do", not "I have no file at hand" on a phone; cause 5 (camera)
  stays open for that.

## 9. Decided recommendation

Build (b): `/api/sample` writes the subject, the stored two-page PDF, a `ready`
document marked `is_sample`, and chunks with committed embeddings, after the AI
permission. It needs one small migration (`documents.is_sample`) applied by
hand before the merge, and one keyed run to produce the embeddings.

## 10. Built in #319 (2026-11-11): the inputs; the Arabic blocker resolved for the sample

No `src/` and no `supabase/` change. The `is_sample` migration is still text
only (section 4).

### What is in the repo

| Path | What |
|---|---|
| `data/sample-file/cell.ar.pdf`, `cell.en.pdf` | The two PDFs, two pages each, made from the approved text by `scripts/sample-file/make_pdfs.py` (WeasyPrint, DejaVu Sans embedded: the #309 fixture's face) |
| `data/sample-file/manifest.json`, `SHA256SUMS` | Each PDF's sha256, the model, dimensions, chunk size and overlap the embeddings must be made with |
| `scripts/sample-file/generate.py` | Runs production's own functions on each PDF; asserts the extracted text equals the approved text before any embedding; writes `cell.<lang>.json` |
| `.github/workflows/sample-embeddings.yml` | Manual only; environment `sample-embeddings`, secret `VOYAGE_SAMPLE_KEY`; uploads the JSON as an artifact |
| `scripts/verify-sample-file.mjs` | In the tsc job: fails on a changed PDF, model, chunk size, overlap or JSON; "not generated yet" passes |

**Why `data/sample-file/`:** outside `src/` (the relay, design-c, field-zoom and
redesign-built all watch `src/**`, so adding or regenerating these files starts
no device run and no render run) and outside `public/` (a file there is served
to anyone at a public address and cached by the CDN; the sample must reach a
student only through `/api/sample`, after sign-in and the AI permission). The
later route reads the PDF bytes and imports the JSON from this folder; Next
needs the folder listed in `outputFileTracingIncludes` for that route.

### Measured (the production functions, no key)

| | Pages | Text equals the approved text | Chunks | Token counts | Page labels |
|---|---|---|---|---|---|
| English | 2 | yes, both pages | 1 | 464 | 1-2 |
| Arabic | 2 | yes, both pages (after the marks were dropped, below) | 3 | 512, 512, 439 | 1, 1-2, 2 |

This replaces the estimate in section 2 (English 1 chunk, Arabic 2 to 3).

### Layout finding: every block starts at the left margin

pdfminer orders text boxes by a mix of height and left edge. A short,
right-aligned Arabic heading sank below the paragraph after it, in all four
fonts and three line heights tried. Left alignment (the direction stays
right-to-left) kept the order in every case. The file is read for its text
only; the app never shows it as a page.

### RESOLVED FOR THE SAMPLE: production puts shadda and tanween on the wrong letter

**Resolved for the sample on 2026-11-11 by dropping the marks:** the owner
approved writing the 7 words below without their shadda or tanween, in the
approved text and in the Arabic PDF. Both languages now extract exactly.
**Production's mark rule is still wrong for students' own PDFs; that is its
own PR, later.**

What was found, with the marks still in: the Arabic PDF's text came out of
production's conversion with 7 words changed. Each is a letter carrying a
shadda or a tanween:

| Approved | Extracted by production |
|---|---|
| معًا | معاً |
| حيًّا. | حي اًّ. |
| جدًّا. | جداًّ. |
| ينظّم | ينظمّ |
| وتحوّل | وتحولّ |
| عددًا | عدداً |
| ينظّم | ينظمّ |

Cause, measured: `_line_units` (`services/ingestion/main.py`, #309) joins a
mark to the glyph its drawn point lies over. In these PDFs the point of a mark
lies about 0.1 to 1.3 pt inside the glyph drawn before it, not over its own
letter, so the mark goes to the neighbour. Tried and no better: Amiri, Noto
Naskh Arabic, Noto Kufi Arabic, two alignments, three line heights, and a
second PDF engine (PyMuPDF). Without the marks the same PDF extracts exactly.

This is not only about the sample: a student's Arabic PDF with tashkeel made
the same way is stored with the same misplaced marks today.

The two ways out were (A) write the 7 words without their marks, or (B) fix
the mark rule in `main.py` first. The owner chose (A). Three marked words
stay in the text because they extract correctly as they are. (B) is still
owed for real uploads: `_line_units` in `services/ingestion/main.py`, with a
marked-text PDF as its fixture.

### The order from here

1. DONE 2026-11-11: (A) chosen, the Arabic PDF regenerated, `manifest.json`
   and `SHA256SUMS` hold its new sha256; the English PDF is byte-identical.
2. The owner creates a temporary Voyage AI key and adds it as the secret
   `VOYAGE_SAMPLE_KEY` in a new GitHub environment `sample-embeddings`
   (recommended: restrict the environment to `main`).
3. The owner, or the agent on the owner's word, runs `sample-embeddings` from
   `main`. The owner deletes the key at Voyage and the secret.
4. A PR commits `cell.ar.json` and `cell.en.json` from the run's artifact;
   `verify-sample-file` then checks them on every run.
5. The migration (`documents.is_sample`) is applied to production by hand.
6. The UI PR: `/api/sample`, the button, the ready question, the strings as
   a batch file, the tests of section 7.

### 2026-11-11: embeddings generated by run 43122125966 and committed; secret and key deleted the same night

Run 43122125966 (`sample-embeddings`, `main` at 730270d, Python 3.11.18 after
#320) extracted both PDFs equal to the approved text, 2 pages each, and wrote
`cell.ar.json` (3 chunks: 512, 512, 439 tokens; pages 1, 1-2, 2) and
`cell.en.json` (1 chunk: 464 tokens; pages 1-2), each embedding 1024 numbers
from voyage-3-large. The two files are committed from its artifact unchanged.
The owner deleted the secret `VOYAGE_SAMPLE_KEY` and the Voyage key the same
night; the environment `sample-embeddings` lists no secret. Steps 2 to 4 above
are done; 5 and 6 remain.
