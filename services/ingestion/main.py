import os
import shutil
import tempfile
from typing import Literal

import httpx
import tiktoken
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Body
from fastapi.responses import JSONResponse
from markitdown import MarkItDown
from pydantic import BaseModel

app = FastAPI()

INGESTION_TOKEN = os.environ.get("INGESTION_TOKEN")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")
VOYAGE_MODEL = os.environ.get("VOYAGE_MODEL", "voyage-3-large")
VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
EMBED_DIM = 1024

# Embedding provider seam (PIVOT_PLAN.md §4): swap providers with one env var, no
# schema change. Default 'voyage' (the only provisioned path); 'bge_m3' is a
# documented stub. Normalized so trailing space / casing can't cause a silent miss.
EMBEDDING_PROVIDER = os.environ.get("EMBEDDING_PROVIDER", "voyage").strip().lower()

CHUNK_TOKENS = 512
CHUNK_OVERLAP = 64

# tiktoken's cl100k_base is a reasonable proxy for chunk sizing across languages
# even though the embedding model uses its own tokenizer.
ENCODER = tiktoken.get_encoding("cl100k_base")


def _check_auth(authorization: str | None) -> None:
    if not INGESTION_TOKEN:
        raise HTTPException(status_code=503, detail="Service not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if authorization.removeprefix("Bearer ").strip() != INGESTION_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")


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


@app.get("/health")
async def health():
    return {
        "ok": True,
        "embed_provider": EMBEDDING_PROVIDER,
        "embed_model": VOYAGE_MODEL,
        "embed_dim": EMBED_DIM,
    }


@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    """Convert a document to markdown, chunk it, and return chunks with embeddings."""
    _check_auth(authorization)

    fd, tmp_path = tempfile.mkstemp(suffix=f"_{file.filename or 'upload'}")
    os.close(fd)
    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        md = MarkItDown()
        result = md.convert(tmp_path)
        markdown_text = result.text_content or ""

        chunks = _chunk_text(markdown_text)
        if chunks:
            embeddings = await _embed([c["content"] for c in chunks], input_type="document")
            for c, emb in zip(chunks, embeddings):
                c["embedding"] = emb

        return {
            "markdown": markdown_text,
            "filename": file.filename,
            "chunks": chunks,
        }
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


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
    [vector] = await _embed([payload.text], input_type=payload.input_type)
    return {"embedding": vector, "model": VOYAGE_MODEL, "dim": EMBED_DIM}
