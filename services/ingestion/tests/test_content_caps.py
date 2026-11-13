"""A 4 MiB upload must not expand into unbounded text, or into an unbounded archive.

A .docx, .pptx or .xlsx is a zip. The upload route caps the FILE at 4 MiB
(src/lib/upload-limits.ts) and this service at 8 MiB (MAX_INGEST_BYTES), but
nothing capped what the file turns into: a highly compressible 4 MiB .docx
expands to hundreds of megabytes of XML in the converter, and to millions of
characters of text that were chunked and sent to Voyage AI in full.

These tests drive the real /ingest endpoint with the real MarkItDown conversion
and the real chunker. Only the network edges (Supabase, Voyage) are replaced,
exactly as in test_ingest_nul.py. On 71b1b46 the three refusal tests fail
(the text is embedded, or the archive is handed to the converter); with the
caps they pass. The at-cap .txt test passes on both: the cap never refuses the
largest plain-text upload the app accepts today.

Run from the repo root, with services/ingestion/requirements.txt installed:
    python -m pytest services/ingestion/tests -q
"""
import io
import os
import sys
import zipfile
from pathlib import Path

import pytest

os.environ.setdefault("INGESTION_TOKEN", "test-token")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# The largest plain-text file the upload route accepts (MAX_UPLOAD_BYTES,
# src/lib/upload-limits.ts). One byte is at least one character, so a .txt
# within the upload limit can never convert to more characters than this.
FOUR_MIB = 4 * 1024 * 1024


@pytest.fixture
def seen(monkeypatch):
    out: dict = {"converted": 0}

    async def fake_user_client(token):
        return object()

    async def fake_load(sb, document_id, kb_id):
        return {"id": document_id, "kb_id": kb_id}

    async def fake_embed(texts, input_type):
        out["embedded"] = len(texts)
        return [[0.0] * main.EMBED_DIM for _ in texts]

    async def fake_persist(sb, document_id, kb_id, markdown_text, chunks):
        out["persisted_chunks"] = len(chunks)

    async def fake_mark_error(sb, document_id, message):
        out["error"] = message

    real_md = main.MarkItDown

    class CountingMarkItDown(real_md):
        def convert(self, *a, **k):
            out["converted"] += 1
            return super().convert(*a, **k)

    monkeypatch.setattr(main, "_user_client", fake_user_client)
    monkeypatch.setattr(main, "_load_owned_document", fake_load)
    monkeypatch.setattr(main, "_embed", fake_embed)
    monkeypatch.setattr(main, "_persist", fake_persist)
    monkeypatch.setattr(main, "_mark_error", fake_mark_error)
    monkeypatch.setattr(main, "MarkItDown", CountingMarkItDown)
    return out


def _ingest(name: str, data: bytes, mime: str):
    client = TestClient(main.app)
    return client.post(
        "/ingest",
        headers={"Authorization": "Bearer test-token", "X-Supabase-Token": "user"},
        data={"document_id": "doc-1", "kb_id": "kb-1"},
        files={"file": (name, data, mime)},
    )


def _docx(paragraphs: list[str], extra: dict[str, bytes] | None = None) -> bytes:
    """A minimal valid .docx: the three parts Word and mammoth need."""
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body}</w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document)
        for k, v in (extra or {}).items():
            zf.writestr(k, v)
    return buf.getvalue()


def test_caps_are_the_documented_numbers():
    assert main.MAX_CONVERTED_CHARS == FOUR_MIB
    assert main.MAX_ARCHIVE_BYTES == 64 * 1024 * 1024
    assert main.MAX_ARCHIVE_ENTRIES == 10_000


def test_docx_over_the_text_cap_is_refused_before_voyage(seen):
    # 4.4 million characters of text in a .docx that is well under 4 MiB on
    # disk: repetitive prose compresses far better than 4:1, which is exactly
    # the expansion the cap exists for.
    para = "The elasticity of demand measures how quantity responds to price. " * 20
    n = (FOUR_MIB + 200_000) // len(para) + 1
    data = _docx([para] * n)
    assert len(data) < FOUR_MIB, f"fixture is {len(data)} bytes, must fit the upload limit"

    resp = _ingest("big.docx", data, DOCX_MIME)

    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"].startswith("text_too_long:")
    assert seen.get("error", "").startswith("text_too_long:"), seen
    assert "embedded" not in seen, "Voyage was called for a refused document"
    assert "persisted_chunks" not in seen


def test_zip_bomb_is_refused_before_the_converter(seen):
    # 80 MiB of zeros deflates to about 80 KB. The converter would inflate all
    # of it into memory; the archive check reads only the central directory.
    zeros = b"\0" * (80 * 1024 * 1024)
    data = _docx(["x"], extra={"word/media/pad.bin": zeros})
    assert len(data) < 1024 * 1024

    resp = _ingest("bomb.docx", data, DOCX_MIME)

    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"].startswith("archive_too_large:")
    assert seen.get("error", "").startswith("archive_too_large:"), seen
    assert seen["converted"] == 0, "the converter opened the archive"
    assert "embedded" not in seen


def test_archive_with_too_many_entries_is_refused(seen):
    data = _docx(["x"], extra={f"word/media/{i}.bin": b"" for i in range(10_001)})

    resp = _ingest("many.docx", data, DOCX_MIME)

    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"].startswith("archive_too_large:")
    assert seen["converted"] == 0
    assert "embedded" not in seen


def test_txt_at_the_upload_limit_still_ingests(seen):
    # The largest .txt the app accepts today (owner-measured on production,
    # 2026-09-23: 4,194,304 bytes, 1,845 chunks). It must not be refused.
    line = "Supply and demand meet where the market clears, and price follows.\n"
    text = (line * (FOUR_MIB // len(line) + 1))[:FOUR_MIB]
    assert len(text) == FOUR_MIB

    resp = _ingest("max.txt", text.encode("ascii"), "text/plain")

    assert resp.status_code == 200, resp.text
    assert "error" not in seen, seen.get("error")
    assert seen["embedded"] == seen["persisted_chunks"] > 0


def test_ordinary_docx_still_ingests(seen):
    resp = _ingest("notes.docx", _docx(["Lecture 1: supply and demand.", "مرونة الطلب السعرية"]), DOCX_MIME)

    assert resp.status_code == 200, resp.text
    assert "error" not in seen, seen.get("error")
    assert seen["converted"] == 1
    assert seen["embedded"] == 1
