# Backfill chunks for legacy documents

`backfill.py` re-chunks and embeds documents that were ingested before Phase 2
RAG (PR #3). Without it, the agent answers "no relevant passages" for those
documents because they have `markdown_content` but no rows in `chunks`.

> **Local script only.** It needs the Supabase service-role key, which bypasses
> RLS. Do not deploy it, do not commit the key, do not expose it as an HTTP
> endpoint.

## Prerequisites

1. PR #3 (Phase 2 RAG) merged into `main`.
2. `supabase/migrations/20260501_rag_pgvector.sql` applied to the project (run
   it from the Supabase SQL editor or `supabase db push`). This creates the
   `chunks` table and adds `documents.embedding_status` /
   `documents.error_message`.

## Setup

From the repo root:

```bash
cd services/ingestion
python -m venv .venv
. .venv/Scripts/activate          # PowerShell: .venv\Scripts\Activate.ps1
pip install supabase httpx tiktoken
```

Set environment variables (PowerShell shown; `export` in bash):

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOi..."   # service-role, NOT anon
$env:VOYAGE_API_KEY = "pa-..."
# optional: $env:VOYAGE_MODEL = "voyage-3-large"
```

The service-role key is in **Supabase Dashboard → Project Settings → API →
Project API keys → `service_role`**. Treat it like a database password.

## Run

Dry run first — lists what would be processed and how many chunks each
document would produce, without writing:

```powershell
python backfill.py
```

Once the dry run looks right, commit:

```powershell
python backfill.py --commit
```

Sample output:

```
Mode: COMMIT
Embedding model: voyage-3-large (dim 1024)
Found 7 document(s) needing backfill.
[1/7] employee-handbook.pdf ... ready (24 chunks)
[2/7] q1-report.docx ... ready (11 chunks)
[3/7] empty-notes.txt ... skipped-empty
...
Summary:
  ready: 6
  dry-run: 0
  skipped-empty: 1
  skipped-no-chunks: 0
  errors: 0
  total chunks processed: 84
```

## Verifying

In the Supabase SQL editor:

```sql
select count(*) from chunks;
select id, filename, embedding_status, chunk_count from documents
where embedding_status = 'ready';
```

The agent should now find passages for those documents.

## Behavior notes

- Re-running is safe. For each document the script deletes existing chunks for
  that `document_id` before inserting the fresh batch, so a partial previous
  run won't leave duplicates.
- A document with non-null but blank `markdown_content` is reported as
  `skipped-empty` and its `embedding_status` is left untouched.
- An embedding or insert failure marks the document `embedding_status = 'error'`
  with the error message stored in `documents.error_message`. Fix the cause
  and re-run; it'll pick the document up again.
- Chunk size, overlap, model, and dimension are kept in lockstep with
  `services/ingestion/main.py`. If you change them there, mirror the change
  here before re-running.
