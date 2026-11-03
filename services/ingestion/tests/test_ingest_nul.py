"""U+0000 in converted text must never reach the chunk insert (22P05).

Production, 2026-11-03: an upload failed with Postgres 22P05 "\\u0000 cannot be
converted to text" on the chunk insert, after conversion and after Voyage.
These tests drive the real /ingest endpoint with the real MarkItDown conversion
and the real chunker; only the network edges (Supabase, Voyage) are replaced,
and the rows handed to _persist are captured. On main 9e32ae3 the captured
content holds "\\x00" and both tests fail; with _strip_nul they pass.

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

# Visible text that must come through untouched: Arabic with harakat and
# shadda, tatweel, RLM, LRM, ALM, ZWJ and ZWNJ.
ARABIC = "الْعَرَبِيَّةُ مـــرحبا ‏نص‎ ؜كلمة‍حرف‌حرف"


@pytest.fixture
def captured(monkeypatch):
    seen: dict = {}

    async def fake_user_client(token):
        return object()

    async def fake_load(sb, document_id, kb_id):
        return {"id": document_id, "kb_id": kb_id}

    async def fake_embed(texts, input_type):
        seen["embedded"] = list(texts)
        return [[0.0] * main.EMBED_DIM for _ in texts]

    async def fake_persist(sb, document_id, kb_id, markdown_text, chunks):
        seen["markdown"] = markdown_text
        seen["chunks"] = [c["content"] for c in chunks]

    async def fake_mark_error(sb, document_id, message):
        seen["error"] = message

    monkeypatch.setattr(main, "_user_client", fake_user_client)
    monkeypatch.setattr(main, "_load_owned_document", fake_load)
    monkeypatch.setattr(main, "_embed", fake_embed)
    monkeypatch.setattr(main, "_persist", fake_persist)
    monkeypatch.setattr(main, "_mark_error", fake_mark_error)
    return seen


def _ingest(name: str, data: bytes, mime: str):
    client = TestClient(main.app)
    return client.post(
        "/ingest",
        headers={"Authorization": "Bearer test-token", "X-Supabase-Token": "user"},
        data={"document_id": "doc-1", "kb_id": "kb-1"},
        files={"file": (name, data, mime)},
    )


def _assert_no_nul(seen: dict) -> None:
    assert "error" not in seen, seen.get("error")
    assert "\x00" not in seen["markdown"]
    assert seen["chunks"], "no chunks produced"
    for text in seen["chunks"] + seen["embedded"]:
        assert "\x00" not in text
    # Chunk content and what was embedded are the same strings.
    assert seen["chunks"] == seen["embedded"]


def test_txt_with_nul_keeps_visible_text(captured):
    original = f"Lecture 1\x00 notes\n{ARABIC}\x00\n"
    resp = _ingest("notes.txt", original.encode("utf-8"), "text/plain")
    assert resp.status_code == 200, resp.text
    _assert_no_nul(captured)
    expected = original.replace("\x00", "")
    assert captured["markdown"] == expected
    assert captured["chunks"] == [expected]  # short text: one chunk, whole


def _pdf_with_nul_glyph() -> bytes:
    """A one-page PDF whose ToUnicode CMap maps byte 'B' to <0000>.

    pdfminer turns that mapping into "\\x00", which is how a real PDF puts a
    NUL into MarkItDown's output (reproduced with markitdown 0.1.5 and
    pdfminer.six 20260107). 'A' maps to A, 'x' has no mapping (kept as x),
    'D' maps to U+0644 (Arabic lam).
    """
    cmap = (
        b"/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n"
        b"/CMapName /T def /CMapType 2 def\n"
        b"1 begincodespacerange <00> <FF> endcodespacerange\n"
        b"3 beginbfchar\n<41> <0041>\n<42> <0000>\n<44> <0644>\nendbfchar\n"
        b"endcmap CMapName currentdict /CMap defineresource pop end end\n"
    )
    content = b"BT /F1 24 Tf 72 700 Td (AxBxD) Tj ET\n"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R"
        b" /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"endstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode 6 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(cmap) + cmap + b"endstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objs) + 1,
        xref,
    )
    return bytes(out)


def test_pdf_fixture_really_yields_nul(tmp_path):
    """Guards the fixture: if pdfminer stops emitting NUL, the PDF test is vacuous."""
    pdf = tmp_path / "nul.pdf"
    pdf.write_bytes(_pdf_with_nul_glyph())
    raw = main.MarkItDown().convert(str(pdf)).text_content
    assert "\x00" in raw


def test_pdf_with_nul_glyph(captured):
    resp = _ingest("slides.pdf", _pdf_with_nul_glyph(), "application/pdf")
    assert resp.status_code == 200, resp.text
    _assert_no_nul(captured)
    assert "Ax" in captured["markdown"] and "ل" in captured["markdown"]
