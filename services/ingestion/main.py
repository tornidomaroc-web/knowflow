import hmac
import os
import re
import shutil
import tempfile
from typing import Literal

import httpx
import tiktoken
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Body
from fastapi.responses import JSONResponse
from markitdown import MarkItDown
from pydantic import BaseModel
from supabase import acreate_client, AsyncClient, AsyncClientOptions

app = FastAPI()

INGESTION_TOKEN = (os.environ.get("INGESTION_TOKEN") or "").strip()
# Rotation without downtime. While a new token is being rolled out, Railway holds
# the new value here and the old one in INGESTION_TOKEN, so Vercel is accepted
# with either while its own variable is switched and redeployed. Unset (or blank)
# outside a rotation, and then it matches nothing.
INGESTION_TOKEN_NEXT = (os.environ.get("INGESTION_TOKEN_NEXT") or "").strip()
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")
VOYAGE_MODEL = os.environ.get("VOYAGE_MODEL", "voyage-3-large")
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
EMBED_DIM = 1024

# (b1) Persistence config. This service now writes chunks and owns the terminal
# `documents` status, so it needs Supabase — but it authenticates as the UPLOADING
# USER, using the access token forwarded per request, on top of the PUBLIC anon
# key. There is deliberately NO service-role key here and there must never be one:
# register #45 proved this exact service was publicly duplicable and its bearer
# token shared, so an RLS-bypassing credential in this process would have turned
# that incident into a full-database breach. backfill.py's docstring forbids the
# same thing for the same reason; it stays a local-only script. Every write below
# therefore lands under the existing RLS policies (001_initial_schema.sql:53,
# 20260501_rag_pgvector.sql:31-41) and can only touch rows the user already owns.
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Matches backfill.py's CHUNK_INSERT_BATCH: keeps each insert under Supabase's
# request-size limit (a 1024-float vector per row is not small).
CHUNK_INSERT_BATCH = 50

# Embedding provider seam (PIVOT_PLAN.md §4): swap providers with one env var, no
# schema change. Default 'voyage' (the only provisioned path); 'bge_m3' is a
# documented stub. Normalized so trailing space / casing can't cause a silent miss.
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "voyage").strip().lower()

# /embed's only caller is embedQuery (src/lib/ingestion.ts:37), with the Ask
# question as typed: src/app/api/agent/route.ts:166 passes `message` on with no
# length check, and the Ask box (src/components/agent/ChatBox.tsx:275) has no
# maxLength. Document chunks never come through /embed; /ingest embeds them
# itself, 512 tokens each. 32,000 characters is far beyond any question (the
# agent budgets 1,200 tokens for a whole conversation's history,
# route.ts:91), and for ordinary text it stays inside voyage-3-large's
# 32,000-token context, so a question under the cap reaches Voyage whole
# (Voyage truncates silently past its context). Over it, the request is
# refused before Voyage is called, so a holder of the token cannot buy
# embeddings by the megabyte.
MAX_EMBED_CHARS = 32_000

# /ingest's only caller, src/app/api/ingest/route.ts, refuses a file over
# MAX_UPLOAD_BYTES (4 MiB, src/lib/upload-limits.ts:38) at route.ts:84 before
# forwarding it, and Vercel itself takes no request body over 4.5 MB. Twice
# 4 MiB therefore never refuses a real upload, and bounds what one request can
# spend on conversion and embedding.
MAX_INGEST_BYTES = 8 * 1024 * 1024

CHUNK_TOKENS = 512
CHUNK_OVERLAP = 64

# tiktoken's cl100k_base is a reasonable proxy for chunk sizing across languages
# even though the embedding model uses its own tokenizer.
ENCODER = tiktoken.get_encoding("cl100k_base")


def _check_auth(authorization: str | None) -> None:
    """Accept INGESTION_TOKEN, or INGESTION_TOKEN_NEXT while a rotation is on.

    Every configured token is compared, with hmac.compare_digest and as bytes,
    and only then is the answer known, so the timing tells a caller neither
    which token matched nor how much of one it got right (compare_digest can
    still show that the lengths differ; the tokens are random, so a length is
    not worth hiding). As bytes so a non-ASCII bearer is a 401, not the
    TypeError compare_digest raises for non-ASCII str. A blank
    or unset INGESTION_TOKEN_NEXT is not in the list, so it can never match, and
    an empty bearer can never match the non-empty INGESTION_TOKEN. Nothing here
    is logged.
    """
    if not INGESTION_TOKEN:
        raise HTTPException(status_code=503, detail="Service not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    presented = authorization.removeprefix("Bearer ").strip().encode("utf-8")
    accepted = [t for t in (INGESTION_TOKEN, INGESTION_TOKEN_NEXT) if t]
    matched = False
    for token in accepted:
        matched |= hmac.compare_digest(presented, token.encode("utf-8"))
    if not matched:
        raise HTTPException(status_code=401, detail="Invalid token")


def _safe_basename(name: str | None) -> str:
    """Reduce a client-supplied filename to a safe, flat basename (B4).

    Mirrors the Next-side sanitizer (src/app/api/ingest/route.ts) so the two
    layers behave the same: a name like ../../evil.pdf can't inject ../ into a
    path. os.path.basename is posix-only here, so backslashes are normalized to
    forward slashes first to also strip Windows-style separators.
    """
    base = os.path.basename((name or "").replace("\\", "/"))
    base = re.sub(r"[\x00-\x1f\x7f]", "", base)   # strip control chars
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)  # allowlist
    base = base.lstrip(".")                        # drop leading dots ("..", etc.)
    return base or "upload"                        # mkstemp adds its own entropy


def _chunk_text(text: str, chunk_tokens: int = CHUNK_TOKENS, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    tokens = ENCODER.encode(text)
    if not tokens:
        return []

    chunks = []
    step = chunk_tokens - overlap
    for i, start in enumerate(range(0, len(tokens), step)):
        end = min(start + chunk_tokens, len(tokens))
        piece = ENCODER.decode(tokens[start:end])
        if piece.strip():
            chunks.append({
                "chunk_index": i,
                "content": piece,
                "token_count": end - start,
            })
        if end == len(tokens):
            break
    return chunks


async def _embed(texts: list[str], input_type: Literal["query", "document"]) -> list[list[float]]:
    # Provider dispatch (PIVOT_PLAN.md §4): one branch, no registry/ABC. Voyage is
    # the only provisioned path today; bge_m3 is a documented stub.
    if EMBEDDING_PROVIDER == "voyage":
        return await _embed_voyage(texts, input_type)
    if EMBEDDING_PROVIDER == "bge_m3":
        return await _embed_bge_m3(texts, input_type)
    raise HTTPException(
        status_code=503,
        detail=f"Unknown EMBEDDING_PROVIDER '{EMBEDDING_PROVIDER}' — see PIVOT_PLAN.md §4",
    )


async def _embed_bge_m3(texts: list[str], input_type: Literal["query", "document"]) -> list[list[float]]:
    # Documented stub (PIVOT_PLAN.md §4). Self-hosted bge-m3 (dense dim 1024,
    # cosine) is intentionally NOT implemented yet: torch / sentence-transformers
    # stay OUT of requirements.txt so the image stays slim until we provision an
    # Oracle Always Free ARM VM at the §4 switch trigger. The real encode call
    # goes here, honoring the same contract (dim 1024, same call for query/doc).
    raise HTTPException(
        status_code=503,
        detail="Embedding provider 'bge_m3' is not provisioned — see PIVOT_PLAN.md §4",
    )


async def _embed_voyage(texts: list[str], input_type: Literal["query", "document"]) -> list[list[float]]:
    if not VOYAGE_API_KEY:
        raise HTTPException(status_code=503, detail="VOYAGE_API_KEY is not set")
    if not texts:
        return []

    out: list[list[float]] = []
    # Voyage limit: up to 128 inputs per request.
    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(0, len(texts), 128):
            batch = texts[i : i + 128]
            resp = await client.post(
                VOYAGE_URL,
                headers={"Authorization": f"Bearer {VOYAGE_API_KEY}"},
                json={
                    "input": batch,
                    "model": VOYAGE_MODEL,
                    "input_type": input_type,
                    "output_dimension": EMBED_DIM,
                },
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Embedding provider error: {resp.status_code}",
                )
            data = resp.json()
            out.extend(item["embedding"] for item in data["data"])
    return out


async def _user_client(user_token: str) -> AsyncClient:
    """Build a Supabase client that acts AS THE UPLOADING USER (b1, Option B).

    The anon key is the apiKey; the user's forwarded access token is the
    Authorization bearer, so PostgREST evaluates `auth.uid()` as that user and
    every RLS policy applies unchanged. supabase-py's `create()` skips its own
    session lookup when an Authorization header is supplied in options, so this
    token is the only identity the client ever has.

    Built PER REQUEST on purpose. A module-level client would be shared across
    concurrent uploads and would leak one user's bearer token into another
    user's writes — the client holds the header, not the call.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_URL / SUPABASE_ANON_KEY are not set",
        )
    return await acreate_client(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        AsyncClientOptions(headers={"Authorization": f"Bearer {user_token}"}),
    )


async def _load_owned_document(sb: AsyncClient, document_id: str, kb_id: str) -> dict:
    """Read the target row THROUGH RLS before doing any expensive work.

    Two jobs. (1) Ownership pre-check: the row is invisible to this token unless
    the user owns its knowledge base, so a missing row means "not yours" and we
    stop before spending a Voyage batch on it. (2) We take `kb_id` from the
    DATABASE, not from the caller — the request's kb_id is cross-checked against
    it and a mismatch is rejected, so a caller holding INGESTION_TOKEN cannot
    file chunks under one KB while pointing them at a document in another.
    """
    res = await (
        sb.table("documents").select("id, kb_id").eq("id", document_id).execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Document not found or not owned by this user",
        )
    row = rows[0]
    if str(row["kb_id"]) != str(kb_id):
        raise HTTPException(status_code=400, detail="kb_id does not match document")
    return row


async def _persist(
    sb: AsyncClient,
    document_id: str,
    kb_id: str,
    markdown_text: str,
    chunks: list[dict],
) -> None:
    """Write the chunk set and flip the document to its terminal ready state.

    Same idempotent shape backfill.py uses: clear any partial chunk set left by a
    prior failed attempt for this document, then batch-insert. A retry of a
    half-written document therefore converges instead of accumulating duplicates.
    """
    await sb.table("chunks").delete().eq("document_id", document_id).execute()

    rows = [
        {
            "document_id": document_id,
            "kb_id": kb_id,
            "chunk_index": c["chunk_index"],
            "content": c["content"],
            "token_count": c["token_count"],
            "embedding": c["embedding"],
        }
        for c in chunks
    ]
    for i in range(0, len(rows), CHUNK_INSERT_BATCH):
        await sb.table("chunks").insert(rows[i : i + CHUNK_INSERT_BATCH]).execute()

    # The terminal status write. This service owns it now: once the ack leaves
    # here the row is already `ready`, so a caller that times out waiting for the
    # ack cannot strand a document at `processing`.
    res = await (
        sb.table("documents")
        .update(
            {
                "markdown_content": markdown_text,
                "status": "ready",
                "embedding_status": "ready",
                "chunk_count": len(rows),
                "error_message": None,
            }
        )
        .eq("id", document_id)
        .execute()
    )
    # An UPDATE filtered out by RLS is not an error in PostgREST — it matches
    # zero rows and returns 200. Without this check we would ack "ready" for a
    # document whose status never moved.
    if not (res.data or []):
        raise RuntimeError("Ready update matched no document row")


async def _mark_error(sb: AsyncClient, document_id: str, message: str) -> None:
    """Best-effort terminal failure write. Never raises.

    If this cannot land (expired token, Supabase down), the caller still sees a
    non-2xx ack and applies its own fallback, so the row does not stay stuck.
    """
    try:
        await (
            sb.table("documents")
            .update(
                {
                    "status": "error",
                    "embedding_status": "error",
                    "error_message": message[:500],
                }
            )
            .eq("id", document_id)
            .execute()
        )
    except Exception as e:  # noqa: BLE001 - diagnostics only; must not mask the real error
        print(f"_mark_error failed for {document_id}: {e}", flush=True)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "embed_provider": EMBEDDING_PROVIDER,
        "embed_model": VOYAGE_MODEL,
        "embed_dim": EMBED_DIM,
        # (b1) Booleans only — never the URL or the key. Lets the deploy check
        # "is persistence configured" without an upload and without leaking
        # anything to an unauthenticated caller.
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
    }


def _upload_size(file: UploadFile) -> int:
    """The upload's size in bytes. The multipart parser has already spooled it."""
    if file.size is not None:
        return file.size
    pos = file.file.tell()
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(pos)
    return size


def _convert_to_markdown(file: UploadFile) -> str:
    fd, tmp_path = tempfile.mkstemp(suffix=f"_{_safe_basename(file.filename)}")
    os.close(fd)
    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        md = MarkItDown()
        result = md.convert(tmp_path)
        return result.text_content or ""
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    kb_id: str = Form(...),
    authorization: str | None = Header(default=None),
    x_supabase_token: str | None = Header(default=None),
):
    """Convert -> chunk -> embed -> PERSIST, and own the terminal document status.

    (b1) Replaced `/convert`, which returned every chunk's 1024-float embedding
    plus the full markdown inline for the caller to insert. Two things are fixed
    by moving the writes here: that 9-13x return blob no longer crosses the
    network or gets materialized in the caller's memory, and the document can no
    longer be stranded at `processing` by a caller that dies after we succeed —
    because the `ready` transition happens here, before the ack is sent. The
    `/convert` compatibility shim that served the switch-over is deleted (PR C of
    the b1 sequence): nothing calls it, and a caller that still did would get a
    loud 404.

    Two credentials, two different jobs. `Authorization` is INGESTION_TOKEN (or
    INGESTION_TOKEN_NEXT during a rotation, see _check_auth) and proves the
    caller is our own backend. `X-Supabase-Token` is the END USER's
    Supabase access token and is the only thing that authorizes a database write
    — it is used as a bearer on the anon key, so RLS decides what may be touched.
    """
    _check_auth(authorization)
    if not x_supabase_token:
        raise HTTPException(status_code=401, detail="Missing X-Supabase-Token")
    # Before any Supabase call, like the 401s above: the row is still
    # `processing`, and the caller's failure guard writes the error, as it does
    # for an auth refusal (src/app/api/ingest/route.ts:319).
    if _upload_size(file) > MAX_INGEST_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    # Built before the expensive work so a bad/expired user token fails fast, and
    # so the failure writer below is always available once conversion starts.
    sb = await _user_client(x_supabase_token)
    await _load_owned_document(sb, document_id, kb_id)

    try:
        markdown_text = _convert_to_markdown(file)
        chunks = _chunk_text(markdown_text)
        if chunks:
            embeddings = await _embed([c["content"] for c in chunks], input_type="document")
            if len(embeddings) != len(chunks):
                raise RuntimeError("chunk/embedding count mismatch")
            for c, emb in zip(chunks, embeddings):
                c["embedding"] = emb

        await _persist(sb, document_id, kb_id, markdown_text, chunks)
    except HTTPException as e:
        await _mark_error(sb, document_id, str(e.detail))
        raise
    except Exception as e:
        await _mark_error(sb, document_id, str(e))
        return JSONResponse(status_code=500, content={"error": str(e)})

    # Small ack by design: no embeddings, no markdown. The caller already knows
    # the filename and does not need the content back — it is in the database.
    return {
        "document_id": document_id,
        "chunk_count": len(chunks),
        "status": "ready",
    }


class EmbedRequest(BaseModel):
    text: str
    input_type: Literal["query", "document"] = "query"


@app.post("/embed")
async def embed_endpoint(
    payload: EmbedRequest = Body(...),
    authorization: str | None = Header(default=None),
):
    """Embed a single string. Used by the agent to embed user queries."""
    _check_auth(authorization)
    # After the token check, so an unauthenticated caller learns nothing about
    # the cap; before Voyage, so an over-long text costs nothing.
    if len(payload.text) > MAX_EMBED_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Text longer than {MAX_EMBED_CHARS} characters",
        )
    [vector] = await _embed([payload.text], input_type=payload.input_type)
    return {"embedding": vector, "model": VOYAGE_MODEL, "dim": EMBED_DIM}
