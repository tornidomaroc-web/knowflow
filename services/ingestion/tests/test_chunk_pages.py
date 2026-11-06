"""G2: every chunk carries the pages (PDF) or slides (.pptx) its text lies on.

These tests drive the real /ingest endpoint with the real MarkItDown
conversion and the real page count (only Supabase and Voyage are replaced),
and the real _persist against a fake table that refuses the page columns, as
production does until the owner adds them. On main 8ac7948 the chunks carry no
page keys and _persist sends none, so the page tests fail; on the branch they
pass, and the chunk boundaries are the ones _chunk_text cuts today.

Run from the repo root, with services/ingestion/requirements.txt installed:
    python -m pytest services/ingestion/tests -q
"""
import asyncio
import io
import os
import sys
from pathlib import Path

import pytest

os.environ.setdefault("INGESTION_TOKEN", "test-token")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import main  # noqa: E402
from postgrest.exceptions import APIError  # noqa: E402
from test_no_text_pages import _pdf, _ingest  # noqa: E402

PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


def _words(tag: str, n: int) -> str:
    """n distinct words, so each page holds about n tokens of its own."""
    return " ".join(f"{tag}w{i}" for i in range(n))


def _pptx(slides: list[tuple[str, str]]) -> bytes:
    from pptx import Presentation

    prs = Presentation()
    for title, body in slides:
        s = prs.slides.add_slide(prs.slide_layouts[1])
        s.shapes.title.text = title
        s.placeholders[1].text = body
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


@pytest.fixture
def chunks_seen(monkeypatch):
    seen: dict = {}

    async def fake_user_client(token):
        return object()

    async def fake_load(sb, document_id, kb_id):
        return {"id": document_id, "kb_id": kb_id}

    async def fake_embed(texts, input_type):
        return [[0.0] * main.EMBED_DIM for _ in texts]

    async def fake_persist(sb, document_id, kb_id, markdown_text, chunks):
        seen["markdown"] = markdown_text
        seen["chunks"] = [dict(c) for c in chunks]

    async def fake_mark_error(sb, document_id, message):
        seen["error"] = message

    async def fake_record_pages(sb, document_id, pages):
        seen["pages"] = tuple(pages)

    monkeypatch.setattr(main, "_user_client", fake_user_client)
    monkeypatch.setattr(main, "_load_owned_document", fake_load)
    monkeypatch.setattr(main, "_embed", fake_embed)
    monkeypatch.setattr(main, "_persist", fake_persist)
    monkeypatch.setattr(main, "_mark_error", fake_mark_error)
    monkeypatch.setattr(main, "_record_pages", fake_record_pages)
    return seen


def _pages_of(chunks):
    return [(c.get("page_start"), c.get("page_end"), c.get("page_kind")) for c in chunks]


def _same_cut(seen):
    """The chunks are exactly what _chunk_text cuts from the same text."""
    want = main._chunk_text(seen["markdown"])
    got = [{k: c[k] for k in ("chunk_index", "content", "token_count")} for c in seen["chunks"]]
    assert got == want


def test_three_page_pdf_short_pages_is_one_chunk_on_pages_1_to_3(chunks_seen):
    pdf = _pdf(["Mitochondria make ATP for the cell.", "Ribosomes build proteins from RNA.", "The nucleus holds the DNA."])
    resp = _ingest("cells.pdf", pdf, "application/pdf")
    assert resp.status_code == 200, resp.text
    assert _pages_of(chunks_seen["chunks"]) == [(1, 3, "page")]
    _same_cut(chunks_seen)


def test_three_page_pdf_long_pages_gives_each_chunk_its_own_range(chunks_seen):
    pages = [_words("p1", 330), _words("p2", 330), _words("p3", 330)]
    resp = _ingest("long.pdf", _pdf(pages), "application/pdf")
    assert resp.status_code == 200, resp.text
    chunks = chunks_seen["chunks"]
    assert len(chunks) >= 3
    _same_cut(chunks_seen)
    segments = chunks_seen["markdown"].split("\f")
    for c in chunks:
        assert c["page_kind"] == "page"
        assert 1 <= c["page_start"] <= c["page_end"] <= 3
        body = c["content"].strip()
        # The chunk's first and last words are on its first and last pages.
        assert body.split()[0][:4] in segments[c["page_start"] - 1]
        assert body.split()[-1][:4] in segments[c["page_end"] - 1]
    assert chunks[0]["page_start"] == 1 and chunks[-1]["page_end"] == 3
    assert any(c["page_start"] < c["page_end"] for c in chunks)  # a chunk across a page break is a range
    assert [c["page_start"] for c in chunks] == sorted(c["page_start"] for c in chunks)


def test_pdf_page_numbers_count_pages_without_text(chunks_seen):
    """#297: a picture page keeps its place; the text after it is on page 3."""
    pdf = _pdf([_words("a", 330), "IMAGE", _words("c", 330)])
    resp = _ingest("scan.pdf", pdf, "application/pdf")
    assert resp.status_code == 200, resp.text
    assert resp.json()["pages_total"] == 3 and resp.json()["pages_no_text"] == 1
    chunks = chunks_seen["chunks"]
    assert chunks[0]["page_start"] == 1 and chunks[-1]["page_end"] == 3
    assert all(c["page_start"] != 2 for c in chunks)  # no chunk begins on the picture page


def test_pdf_with_no_text_still_gets_no_chunks(chunks_seen):
    resp = _ingest("pictures.pdf", _pdf(["IMAGE", "IMAGE+Page 2"]), "application/pdf")
    assert resp.status_code == 200, resp.text
    assert chunks_seen["chunks"] == []


def test_two_slide_pptx_gives_slide_numbers(chunks_seen):
    data = _pptx([("Cell biology", "The mitochondrion makes ATP for the cell."), ("Photosynthesis", "Chloroplasts turn light into sugar.")])
    resp = _ingest("lecture.pptx", data, PPTX_MIME)
    assert resp.status_code == 200, resp.text
    assert _pages_of(chunks_seen["chunks"]) == [(1, 2, "slide")]
    _same_cut(chunks_seen)


def test_two_long_slides_give_each_chunk_its_slides(chunks_seen):
    data = _pptx([("One", _words("s1", 330)), ("Two", _words("s2", 330))])
    resp = _ingest("deck.pptx", data, PPTX_MIME)
    assert resp.status_code == 200, resp.text
    chunks = chunks_seen["chunks"]
    assert len(chunks) >= 2
    assert chunks[0]["page_start"] == 1 and chunks[-1]["page_start"] == 2 and chunks[-1]["page_end"] == 2
    assert all(c["page_kind"] == "slide" for c in chunks)
    _same_cut(chunks_seen)


def test_other_files_stay_null(chunks_seen):
    resp = _ingest("notes.txt", ("Photosynthesis turns light into sugar.\f" * 3).encode(), "text/plain")
    assert resp.status_code == 200, resp.text
    assert _pages_of(chunks_seen["chunks"]) == [(None, None, None)]


def test_a_pdf_whose_text_does_not_match_its_pages_gets_no_numbers():
    text = "one\ftwo"  # two segments
    assert main._page_layout(text, main.PageCounts(3, 0), "x.pdf") is None
    assert main._page_layout("one\ftwo\fthree\f", main.PageCounts(3, 0), "x.pdf").numbers == [1, 2, 3]


def test_nul_is_stripped_before_the_pages_are_read():
    raw = "page one text\fpage\x00 two text\fpage three"
    text = main._strip_nul(raw)
    chunks = main._chunk_text(text)
    main._assign_pages(text, chunks, main._page_layout(text, main.PageCounts(3, 0), "x.pdf"))
    assert "\x00" not in chunks[0]["content"]
    assert _pages_of(chunks) == [(1, 3, "page")]


# ── _persist: safe before the migration ─────────────────────────────────────


class FakeTable:
    def __init__(self, db, name):
        self.db, self.name, self.op = db, name, None

    def delete(self):
        self.op = ("delete",)
        return self

    def insert(self, rows):
        self.op = ("insert", rows)
        return self

    def update(self, values):
        self.op = ("update", values)
        return self

    def eq(self, *a):
        return self

    async def execute(self):
        kind = self.op[0]
        if kind == "insert":
            rows = self.op[1]
            self.db.attempts.append([sorted(r) for r in rows])
            if self.db.refuse and any(k in r for r in rows for k in main.PAGE_COLUMNS):
                raise APIError({"code": self.db.refuse, "message": "Could not find the 'page_end' column of 'chunks' in the schema cache"})
            self.db.rows.extend(rows)
        return type("R", (), {"data": [{"id": "doc-1"}]})()


class FakeDB:
    def __init__(self, refuse=None):
        self.refuse, self.rows, self.attempts = refuse, [], []

    def table(self, name):
        return FakeTable(self, name)


def _chunks(n, pages=True):
    return [
        {"chunk_index": i, "content": f"c{i}", "token_count": 1, "embedding": [0.0],
         **({"page_start": i + 1, "page_end": i + 1, "page_kind": "page"} if pages else {})}
        for i in range(n)
    ]


def test_persist_writes_the_page_columns_when_they_exist():
    db = FakeDB()
    asyncio.run(main._persist(db, "doc-1", "kb-1", "md", _chunks(3)))
    assert [(r["page_start"], r["page_kind"]) for r in db.rows] == [(1, "page"), (2, "page"), (3, "page")]


def test_persist_without_the_columns_stores_every_chunk_without_pages():
    db = FakeDB(refuse="PGRST204")
    asyncio.run(main._persist(db, "doc-1", "kb-1", "md", _chunks(main.CHUNK_INSERT_BATCH + 5)))
    assert len(db.rows) == main.CHUNK_INSERT_BATCH + 5
    assert not any(k in r for r in db.rows for k in main.PAGE_COLUMNS)
    # One refused batch, then every batch without the columns (no second refusal).
    assert len(db.attempts) == 3


def test_persist_of_a_file_without_pages_sends_no_page_keys():
    db = FakeDB(refuse="PGRST204")
    chunks = _chunks(2, pages=False)
    for c in chunks:
        c.update({"page_start": None, "page_end": None, "page_kind": None})
    asyncio.run(main._persist(db, "doc-1", "kb-1", "md", chunks))
    assert len(db.attempts) == 1 and not any(k in r for r in db.rows for k in main.PAGE_COLUMNS)


def test_persist_still_raises_any_other_refusal():
    db = FakeDB(refuse="23514")  # a check violation is a real error, not a missing column
    with pytest.raises(APIError):
        asyncio.run(main._persist(db, "doc-1", "kb-1", "md", _chunks(1)))
