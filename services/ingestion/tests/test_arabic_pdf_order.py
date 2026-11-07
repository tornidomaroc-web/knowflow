"""Arabic PDF text is stored in logical (reading) order, not visual order.

pdfminer writes a line's characters in the order the PDF draws them, left to
right, so an Arabic line came out reversed: "تنتج جزيئة" was stored as
"ةئيزج جتنت" (open finding (a), PROGRESS 2026-11-07). These tests run real
PDFs through the real conversion (_convert_to_markdown: MarkItDown, then the
page count) and compare with the true text:

  * fixtures/arabic-weasyprint.pdf: two pages, each line one text run;
  * fixtures/arabic-libreoffice.pdf: one page, where LibreOffice draws the
    digits and Latin words of an Arabic line as separate runs, so pdfminer
    returns them as separate lines;
  * fixtures/expected.txt: the true text, pages split by a line "---".

Run from the repo root, with services/ingestion/requirements.txt installed:
    python -m pytest services/ingestion/tests -q
"""
import io
import os
import sys
from pathlib import Path

import pytest

os.environ.setdefault("INGESTION_TOKEN", "test-token")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import main  # noqa: E402
from fastapi import UploadFile  # noqa: E402
from markitdown import MarkItDown  # noqa: E402
from test_no_text_pages import _pdf  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _norm(s: str) -> str:
    return " ".join(s.split())


def _expected_pages() -> list[list[str]]:
    text = (FIXTURES / "expected.txt").read_text(encoding="utf-8")
    pages, cur = [], []
    for line in text.splitlines():
        if line.strip() == "---":
            pages.append(cur)
            cur = []
        elif line.strip():
            cur.append(_norm(line))
    pages.append(cur)
    return pages


def _convert(data: bytes, name: str):
    return main._convert_to_markdown(UploadFile(file=io.BytesIO(data), filename=name))


def _segments(text: str, total: int) -> list[str]:
    """The page segments exactly as _page_layout cuts them."""
    segs = text.split("\f")
    if len(segs) == total + 1 and not segs[-1].strip():
        segs = segs[:-1]
    return segs


def _lines(segment: str) -> set[str]:
    return {_norm(line) for line in segment.split("\n") if line.strip()}


def _missing(text: str, want: list[str]) -> list[str]:
    have = _lines(text)
    return [w for w in want if w not in have]


def test_weasyprint_lines_in_reading_order_on_their_pages():
    data = (FIXTURES / "arabic-weasyprint.pdf").read_bytes()
    text, pages = _convert(data, "arabic-weasyprint.pdf")
    expected = _expected_pages()
    assert pages is not None and pages.total == len(expected) == 2
    segs = _segments(text, pages.total)
    assert len(segs) == pages.total, repr(text)
    assert main._page_layout(text, pages, "arabic-weasyprint.pdf") is not None
    for n, (seg, want) in enumerate(zip(segs, expected), 1):
        assert not _missing(seg, want), f"page {n} is missing {_missing(seg, want)}; got:\n{seg}"


def test_libreoffice_split_runs_join_into_whole_lines():
    """LibreOffice draws "30", "ATP", "3-4", "1665" and "Mitochondria" as runs of
    their own; pdfminer returns each as its own line. They are joined back to
    their Arabic line by position (same baseline, touching edges)."""
    data = (FIXTURES / "arabic-libreoffice.pdf").read_bytes()
    text, pages = _convert(data, "arabic-libreoffice.pdf")
    assert pages is not None and pages.total == 1
    assert main._page_layout(text, pages, "arabic-libreoffice.pdf") is not None
    want = [line for page in _expected_pages() for line in page]
    assert not _missing(text, want), f"missing {_missing(text, want)}; got:\n{text}"


def test_lam_alef_stays_in_order():
    """The lam-alef ligature is one glyph whose text is already "لا" in reading
    order; reversing it letter by letter would turn "إلا" into "إال"."""
    data = (FIXTURES / "arabic-weasyprint.pdf").read_bytes()
    text, _ = _convert(data, "arabic-weasyprint.pdf")
    for word in ("إلا", "الأكسجين", "الامتحان", "الآلة", "والإجابة"):
        assert word in text, word
    for broken in ("إال", "األكسجين", "اإلجابة"):
        assert broken not in text, broken


@pytest.mark.parametrize("pages", [
    ["The cell is the basic unit of life. Robert Hooke described cells in 1665."],
    ["Page one (with brackets) and 3-4 digits.", "Page two, ATP and 30 to 32."],
])
def test_english_pdf_is_byte_identical(tmp_path, pages):
    """A PDF with no Arabic letter: the stored text is MarkItDown's, unchanged."""
    data = _pdf(pages)
    path = tmp_path / "english.pdf"
    path.write_bytes(data)
    before = MarkItDown().convert(str(path)).text_content
    after, counts = _convert(data, "english.pdf")
    assert after == before
    assert counts is not None and counts.total == len(pages)


@pytest.mark.parametrize("visual, logical", [
    # one run, reversed
    ("ةئيزج جتنت", "تنتج جزيئة"),
    # digits, a digit range and a Latin word keep their own order; the full stop
    # at the left edge ends the line
    (".ATP ةئيزج 32 ىلإ 30 وحن", "نحو 30 إلى 32 جزيئة ATP."),
    # Unicode bidi W2/W4: after an Arabic word a hyphen does not join two
    # numbers, so a browser (WeasyPrint) draws "3-4" as "4-3"; a full stop does
    ("4-3 تاحفصلا", "الصفحات 3-4"),
    ("3.5 ةميق", "قيمة 3.5"),
    ("%10 ةبسن", "نسبة 10%"),
    # a number after a Latin word reads with it
    ("ATP-3 مسا", "اسم ATP-3"),
    # brackets that come out the right way round after the reversal stay as they are
    (")يناثلا لصفلا(", "(الفصل الثاني)"),
    # brackets whose glyphs were taken at their drawn shape are mirrored back
    ("(يناثلا لصفلا)", "(الفصل الثاني)"),
    # a mostly-English line keeps its order; only the Arabic word turns round
    ("The word ةيلخلا means cell", "The word الخلية means cell"),
    ("No Arabic here (3-4)", "No Arabic here (3-4)"),
])
def test_visual_to_logical(visual, logical):
    assert main._visual_to_logical(list(visual)) == logical


def test_ligature_unit_is_not_split():
    # "إلا" drawn as [lam-alef ligature "لا"][alef with hamza below "إ"]
    assert main._visual_to_logical(["لا", "إ"]) == "إلا"
