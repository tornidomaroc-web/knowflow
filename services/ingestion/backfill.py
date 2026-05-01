"""
Backfill chunks for documents that were ingested before Phase 2 RAG.

LOCAL SCRIPT ONLY. Do not expose as an HTTP endpoint and do not deploy. The
script needs the Supabase service-role key (which bypasses RLS) so a single
mistake — committed key, exposed endpoint — would let anyone read or wipe
every user's data.

Reads documents where embedding_status != 'ready' AND markdown_content IS NOT
NULL, re-chunks the markdown and generates Voyage embeddings, then inserts the
rows into the chunks table. Defaults to dry-run; pass --commit to actually
write.

Prerequisites:
  1. PR #3 (Phase 2 RAG) merged into main.
  2. supabase/migrations/20260501_rag_pgvector.sql applied to Supabase
     (creates chunks table, adds documents.embedding_status / .error_message).

See BACKFILL.md (next to this file) for the runbook.
"""

import argparse
import asyncio
import os
import sys

import httpx
import tiktoken
from supabase import acreate_client, AsyncClient

# Kept in sync by hand with services/ingestion/main.py from PR #3. This is a
# one-shot migration script, so duplication is acceptable; the live service
# remains the source of truth.
VOYAGE_MODEL = os.environ.get("VOYAGE_MODEL", "voyage-3-large")
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
EMBED_DIM = 1024
CHUNK_TOKENS = 512
CHUNK_OVERLAP = 64
CHUNK_INSERT_BATCH = 50

ENCODER = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str) -> list[dict]:
    tokens = ENCODER.encode(text)
    if not tokens:
        return []
    chunks: list[dict] = []
    step = CHUNK_TOKENS - CHUNK_OVERLAP
    for i, start in enumerate(range(0, len(tokens), step)):
        end = min(start + CHUNK_TOKENS, len(tokens))
        piece = ENCODER.decode(tokens[start:end])
        if piece.strip():
            chunks.append({"chunk_index": i, "content": piece, "token_count": end - start})
        if end == len(tokens):
            break
    return chunks


async def embed(http: httpx.AsyncClient, voyage_key: str, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    out: list[list[float]] = []
    for i in range(0, len(texts), 128):
        batch = texts[i : i + 128]
        resp = await http.post(
            VOYAGE_URL,
            headers={"Authorization": f"Bearer {voyage_key}"},
            json={
                "input": batch,
                "model": VOYAGE_MODEL,
                "input_type": "document",
                "output_dimension": EMBED_DIM,
            },
            timeout=60.0,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Voyage error {resp.status_code}: {resp.text[:200]}")
        out.extend(item["embedding"] for item in resp.json()["data"])
    return out


async def fetch_pending(sb: AsyncClient) -> list[dict]:
    res = await (
        sb.table("documents")
        .select("id, kb_id, filename, embedding_status, markdown_content")
        .neq("embedding_status", "ready")
        .not_.is_("markdown_content", "null")
        .execute()
    )
    return res.data or []


async def backfill_one(
    sb: AsyncClient,
    http: httpx.AsyncClient,
    voyage_key: str,
    doc: dict,
    commit: bool,
) -> tuple[str, int, str | None]:
    md = (doc.get("markdown_content") or "").strip()
    if not md:
        return ("skipped-empty", 0, None)

    chunks = chunk_text(md)
    if not chunks:
        return ("skipped-no-chunks", 0, None)

    try:
        embeddings = await embed(http, voyage_key, [c["content"] for c in chunks])
    except Exception as e:
        return ("embed-error", 0, str(e))
    if len(embeddings) != len(chunks):
        return ("embed-error", 0, "chunk/embedding count mismatch")

    rows = [
        {
            "document_id": doc["id"],
            "kb_id": doc["kb_id"],
            "chunk_index": c["chunk_index"],
            "content": c["content"],
            "token_count": c["token_count"],
            "embedding": emb,
        }
        for c, emb in zip(chunks, embeddings)
    ]

    if not commit:
        return ("dry-run", len(rows), None)

    # Idempotent: clear any partial chunks left by a prior failed run for this
    # document before re-inserting.
    await sb.table("chunks").delete().eq("document_id", doc["id"]).execute()

    for i in range(0, len(rows), CHUNK_INSERT_BATCH):
        try:
            await sb.table("chunks").insert(rows[i : i + CHUNK_INSERT_BATCH]).execute()
        except Exception as e:
            await (
                sb.table("documents")
                .update({"embedding_status": "error", "error_message": str(e)[:500]})
                .eq("id", doc["id"])
                .execute()
            )
            return ("insert-error", i, str(e))

    await (
        sb.table("documents")
        .update({"embedding_status": "ready", "chunk_count": len(rows), "error_message": None})
        .eq("id", doc["id"])
        .execute()
    )
    return ("ready", len(rows), None)


async def run() -> int:
    parser = argparse.ArgumentParser(description="Backfill chunks for legacy documents.")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually write to the database. Without this flag the script is a dry run.",
    )
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    voyage_key = os.environ.get("VOYAGE_API_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.", file=sys.stderr)
        return 2
    if not voyage_key:
        print("ERROR: VOYAGE_API_KEY must be set.", file=sys.stderr)
        return 2

    mode = "COMMIT" if args.commit else "DRY RUN (use --commit to write)"
    print(f"Mode: {mode}")
    print(f"Embedding model: {VOYAGE_MODEL} (dim {EMBED_DIM})")

    sb: AsyncClient = await acreate_client(url, key)
    docs = await fetch_pending(sb)
    print(f"Found {len(docs)} document(s) needing backfill.")
    if not docs:
        return 0

    totals = {
        "ready": 0,
        "dry-run": 0,
        "skipped-empty": 0,
        "skipped-no-chunks": 0,
        "errors": 0,
    }
    total_chunks = 0

    async with httpx.AsyncClient() as http:
        for n, doc in enumerate(docs, 1):
            label = f"[{n}/{len(docs)}] {doc.get('filename') or doc['id']}"
            print(f"{label} ... ", end="", flush=True)
            status, count, err = await backfill_one(sb, http, voyage_key, doc, args.commit)
            if status in ("ready", "dry-run"):
                totals[status] += 1
                total_chunks += count
                print(f"{status} ({count} chunks)")
            elif status.startswith("skipped"):
                totals[status] += 1
                print(status)
            else:
                totals["errors"] += 1
                print(f"ERROR: {err}")

    print()
    print("Summary:")
    for k, v in totals.items():
        print(f"  {k}: {v}")
    print(f"  total chunks processed: {total_chunks}")
    return 0 if totals["errors"] == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
