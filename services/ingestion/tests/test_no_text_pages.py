"""Pages with no text are counted, and a file with no text gets no chunks.

Option C (2026-11-03, no OCR): the student is told when pages of a file have
no text. These tests drive the real /ingest endpoint with the real MarkItDown
conversion and the real page count; only the network edges (Supabase, Voyage)
are replaced. On main 2c49ec5 the ack has no page counts and a file of page
numbers is chunked as text, so the endpoint tests fail; on the branch they pass.

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

PARAGRAPH = (
    "Newton's second law states that the force on a body equals its mass "
    "times its acceleration."
)


def _pdf(pages: list[str]) -> bytes:
    """A PDF with one page per entry, built by hand (no PDF library needed).

    "IMAGE" is a page holding only a picture, as a photographed or scanned page
    does: a 2x2 grey image drawn over the page, no text operators at all.
    "IMAGE+<label>" is that picture with <label> written as real text at the
    foot, like a page number a scanner app stamps. Any other entry is written
    as real text with Helvetica.
    """
    objs: list[bytes] = []

    def add(body: bytes) -> int:
        objs.append(body)
        return len(objs)

    catalog = add(b"")  # filled in at the end
    pages_obj = add(b"")
    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    image = add(
        b"<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray"
        b" /BitsPerComponent 8 /Length 4 >>\nstream\n\x20\x80\x80\x20\nendstream"
    )
    kids = []
    for entry in pages:
        ops = b""
        text = entry
        if entry.startswith("IMAGE"):
            ops += b"q 612 0 0 792 0 0 cm /Im1 Do Q\n"
            text = entry[len("IMAGE+"):] if entry.startswith("IMAGE+") else ""
        if text:
            safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            ops += b"BT /F1 11 Tf 72 40 Td (" + safe.encode("latin-1") + b") Tj ET\n"
        content = add(b"<< /Length %d >>\nstream\n" % len(ops) + ops + b"endstream")
        kids.append(
            add(
                b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] /Contents %d 0 R"
                b" /Resources << /Font << /F1 %d 0 R >> /XObject << /Im1 %d 0 R >> >> >>"
                % (pages_obj, content, font, image)
            )
        )
    objs[catalog - 1] = b"<< /Type /Catalog /Pages %d 0 R >>" % pages_obj
    objs[pages_obj - 1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (
        b" ".join(b"%d 0 R" % k for k in kids),
        len(kids),
    )
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objs) + 1,
        catalog,
        xref,
    )
    return bytes(out)


@pytest.fixture
def captured(monkeypatch):
    seen: dict = {"pages_written": []}

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

    async def fake_record_pages(sb, document_id, pages):
        seen["pages_written"].append((document_id, tuple(pages)))

    monkeypatch.setattr(main, "_user_client", fake_user_client)
    monkeypatch.setattr(main, "_load_owned_document", fake_load)
    monkeypatch.setattr(main, "_embed", fake_embed)
    monkeypatch.setattr(main, "_persist", fake_persist)
    monkeypatch.setattr(main, "_mark_error", fake_mark_error)
    # raising=False: on main there is no _record_pages, and the test must fail
    # on its assertions, not on the fixture.
    monkeypatch.setattr(main, "_record_pages", fake_record_pages, raising=False)
    return seen


def _ingest(name: str, data: bytes, mime: str):
    client = TestClient(main.app)
    return client.post(
        "/ingest",
        headers={"Authorization": "Bearer test-token", "X-Supabase-Token": "user"},
        data={"document_id": "doc-1", "kb_id": "kb-1"},
        files={"file": (name, data, mime)},
    )


def test_mixed_pdf_counts_pages_without_text(captured):
    """Text, a picture, a page number alone, a picture with a page number, text."""
    pdf = _pdf([PARAGRAPH, "IMAGE", "Page 3", "IMAGE+Page 4 of 5", PARAGRAPH])
    resp = _ingest("lecture.pdf", pdf, "application/pdf")
    assert resp.status_code == 200, resp.text
    ack = resp.json()
    assert ack["pages_total"] == 5
    assert ack["pages_no_text"] == 3
    assert captured["pages_written"] == [("doc-1", (5, 3))]
    # The pages with text still reach Ask, as before.
    assert ack["chunk_count"] >= 1
    assert "Newton" in "".join(captured["chunks"])


def test_pdf_of_pictures_and_page_numbers_has_no_text(captured):
    """Every page under the threshold: no chunks, nothing embedded, chunk_count 0,
    even though the page labels together hold more than 10 letters."""
    labels = [f"IMAGE+Page {n} of 6" for n in range(1, 7)]
    pdf = _pdf(labels)
    resp = _ingest("scan.pdf", pdf, "application/pdf")
    assert resp.status_code == 200, resp.text
    ack = resp.json()
    assert (ack["pages_total"], ack["pages_no_text"], ack["chunk_count"]) == (6, 6, 0)
    assert captured["chunks"] == []
    assert "embedded" not in captured  # Voyage is not called


def test_pdf_with_only_a_page_number_has_no_text(captured):
    """The 2026-10-30 near-empty file: a PDF holding only "Page 12" was ready."""
    resp = _ingest("p12.pdf", _pdf(["Page 12"]), "application/pdf")
    assert resp.status_code == 200, resp.text
    ack = resp.json()
    assert (ack["pages_total"], ack["pages_no_text"], ack["chunk_count"]) == (1, 1, 0)


def test_pdf_with_text_on_every_page_is_unchanged(captured):
    resp = _ingest("notes.pdf", _pdf([PARAGRAPH, PARAGRAPH]), "application/pdf")
    assert resp.status_code == 200, resp.text
    ack = resp.json()
    assert (ack["pages_total"], ack["pages_no_text"]) == (2, 0)
    assert ack["chunk_count"] >= 1


def test_txt_with_only_a_page_number_has_no_text(captured):
    resp = _ingest("p12.txt", b"Page 12\n", "text/plain")
    assert resp.status_code == 200, resp.text
    ack = resp.json()
    assert ack["chunk_count"] == 0
    # Not a PDF: no pages to count, and nothing written for them.
    assert ack["pages_total"] is None and ack["pages_no_text"] is None
    assert captured["pages_written"] == []


def test_short_real_txt_still_has_text(captured):
    resp = _ingest("t.txt", "قانون نيوتن الثاني".encode("utf-8"), "text/plain")
    assert resp.status_code == 200, resp.text
    assert resp.json()["chunk_count"] == 1


# The threshold's evidence (main.MIN_PAGE_LETTERS = 10): page furniture is
# under it, the shortest real slide content is at or over it.
FURNITURE = ["Page 12", "Page 12 of 40", "Slide 7 of 30", "صفحة 3 من 20", "الصفحة 12 من 40", "- 12 -", "12", "(cid:12)(cid:40)(cid:7)(cid:9)"]
CONTENT = ["Conclusion", "Introduction", "قانون نيوتن", "الْفِيزِيَاءُ الحديثة", PARAGRAPH]


@pytest.mark.parametrize("text", FURNITURE)
def test_page_furniture_is_under_the_threshold(text):
    assert main._letters(text) < main.MIN_PAGE_LETTERS, (text, main._letters(text))


@pytest.mark.parametrize("text", CONTENT)
def test_real_content_reaches_the_threshold(text):
    assert main._letters(text) >= main.MIN_PAGE_LETTERS, (text, main._letters(text))


def test_unreadable_pdf_is_not_counted_and_does_not_fail():
    assert main._pdf_page_counts(os.devnull) is None
