"""The AI allowance prices an upload and a question from Voyage AI's own count.

Voyage answers every embeddings request with `usage.total_tokens`. Until this
change the service read the vectors and dropped the count, so the web app
could only estimate what an upload or a question cost. Now `/embed` and
`/ingest` report `voyage_tokens`: the sum over every batch, or null when any
batch came back without a count (the web app then uses its stated
conservative estimate, src/lib/ai-allowance.ts). A failed ingestion that
already paid Voyage reports the count on its 500 too, so the spend is still
recorded.

These tests drive the real endpoints, the real converter, the real chunker and
the real `_embed_voyage`; only the HTTP client to Voyage and the Supabase
edges are replaced. On f6f3632 all but the last fail (no `voyage_tokens`);
the last guards the content-cap 422, whose body must stay exactly as it was.

Run from the repo root, with services/ingestion/requirements.txt installed:
    python -m pytest services/ingestion/tests -q
"""
import os
import sys
from pathlib import Path

import pytest

os.environ.setdefault("INGESTION_TOKEN", "test-token")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

AUTH = {"Authorization": "Bearer test-token"}


class FakeVoyage:
    """Stands in for httpx.AsyncClient. Each batch costs 7 tokens per input,
    unless `usage` is False, when the response carries no `usage` at all."""

    calls: list[int] = []
    usage = True
    fail_after = None  # fail every batch after this many

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, json=None):
        n = len(json["input"])
        if FakeVoyage.fail_after is not None and len(FakeVoyage.calls) >= FakeVoyage.fail_after:
            class E:
                status_code = 500

            return E()
        FakeVoyage.calls.append(n)
        body = {"data": [{"embedding": [0.0] * main.EMBED_DIM} for _ in range(n)]}
        if FakeVoyage.usage:
            body["usage"] = {"total_tokens": 7 * n}

        class R:
            status_code = 200

            def json(self_inner):
                return body

        return R()


@pytest.fixture
def voyage(monkeypatch):
    FakeVoyage.calls = []
    FakeVoyage.usage = True
    FakeVoyage.fail_after = None
    monkeypatch.setattr(main, "VOYAGE_API_KEY", "voyage-test")
    monkeypatch.setattr(main, "EMBEDDING_PROVIDER", "voyage")
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeVoyage)
    return FakeVoyage


@pytest.fixture
def supabase_edges(monkeypatch):
    seen: dict = {}

    async def fake_user_client(token):
        return object()

    async def fake_load(sb, document_id, kb_id):
        return {"id": document_id, "kb_id": kb_id}

    async def fake_persist(sb, document_id, kb_id, markdown_text, chunks):
        seen["persisted"] = len(chunks)
        if seen.get("persist_fails"):
            raise RuntimeError("persist failed after the embedding was paid")

    async def fake_mark_error(sb, document_id, message):
        seen["error"] = message

    monkeypatch.setattr(main, "_user_client", fake_user_client)
    monkeypatch.setattr(main, "_load_owned_document", fake_load)
    monkeypatch.setattr(main, "_persist", fake_persist)
    monkeypatch.setattr(main, "_mark_error", fake_mark_error)
    return seen


def _ingest(text: str):
    return TestClient(main.app).post(
        "/ingest",
        headers={**AUTH, "X-Supabase-Token": "user"},
        data={"document_id": "doc-1", "kb_id": "kb-1"},
        files={"file": ("notes.txt", text.encode("utf-8"), "text/plain")},
    )


# Long enough for more than 128 chunks, so the sum runs over two batches.
LONG = " ".join(f"word{i} sentence about the subject." for i in range(20000))


def test_embed_reports_voyage_tokens(voyage):
    r = TestClient(main.app).post("/embed", headers=AUTH, json={"text": "ما الفكرة؟"})
    assert r.status_code == 200
    assert r.json()["voyage_tokens"] == 7
    assert len(r.json()["embedding"]) == main.EMBED_DIM


def test_embed_reports_null_without_a_count(voyage):
    voyage.usage = False
    r = TestClient(main.app).post("/embed", headers=AUTH, json={"text": "question"})
    assert r.status_code == 200
    assert r.json()["voyage_tokens"] is None


def test_ingest_ack_sums_every_batch(voyage, supabase_edges):
    r = _ingest(LONG)
    assert r.status_code == 200, r.text
    ack = r.json()
    assert len(voyage.calls) >= 2, "the fixture must span two Voyage batches"
    assert ack["chunk_count"] == sum(voyage.calls)
    assert ack["voyage_tokens"] == 7 * ack["chunk_count"]


def test_ingest_ack_is_null_when_a_batch_has_no_count(voyage, supabase_edges):
    voyage.usage = False
    r = _ingest(LONG)
    assert r.status_code == 200, r.text
    assert r.json()["voyage_tokens"] is None


def test_ingest_without_text_reports_zero(voyage, supabase_edges):
    r = _ingest("   ")
    assert r.status_code == 200, r.text
    assert voyage.calls == []
    assert r.json()["voyage_tokens"] == 0


def test_failed_ingest_after_voyage_still_reports_the_count(voyage, supabase_edges):
    supabase_edges["persist_fails"] = True
    r = _ingest("A short material about photosynthesis. " * 50)
    assert r.status_code == 500
    assert r.json()["voyage_tokens"] == 7 * sum(voyage.calls)
    assert sum(voyage.calls) >= 1


def test_voyage_failing_mid_file_reports_the_batches_already_paid(voyage, supabase_edges):
    voyage.fail_after = 1
    r = _ingest(LONG)
    assert r.status_code == 502
    assert voyage.calls == [128]
    assert r.json()["voyage_tokens"] == 7 * 128
    assert "Embedding provider error" in r.json()["detail"]


def test_content_cap_refusal_body_is_unchanged(voyage, supabase_edges):
    r = _ingest("x" * (main.MAX_CONVERTED_CHARS + 1))
    assert r.status_code == 422
    assert set(r.json()) == {"detail"}
    assert voyage.calls == []
