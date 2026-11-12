"""Arabic marks (harakat, tanween, shadda) stay on their letter and in reading order.

Two faults, measured 2026-11-12 on main 82cdcb6 (seven producers, report
mark-rule-82cdcb6):

  * every mark glyph is zero-width in pdfminer, so _line_units' box test put
    about half of them on the neighbouring letter, and the space pdfminer
    measures after a zero-width mark split the word in two;
  * with marks, MarkItDown takes its borderless-table path (pdfplumber cuts
    marked words into fragments), so its text differs from pdfminer's and
    #309 kept MarkItDown's: the whole text reversed, with table pipes.

fixtures/arabic-marks-weasyprint.pdf: WeasyPrint 70 with DejaVu Sans (the
sample file's own setup), the marked 22-word text as three paragraphs;
fixtures/arabic-marks-weasyprint.txt: the same three paragraphs as typed.

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

import main  # noqa: E402
from fastapi import UploadFile  # noqa: E402
from pdfminer.layout import LTAnno, LTChar  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _norm(s: str) -> str:
    return " ".join(s.split())


def test_marked_weasyprint_lines_whole_and_in_reading_order():
    data = (FIXTURES / "arabic-marks-weasyprint.pdf").read_bytes()
    text, pages = main._convert_to_markdown(
        UploadFile(file=io.BytesIO(data), filename="arabic-marks-weasyprint.pdf"))
    assert pages is not None and pages.total == 1
    want = [_norm(line) for line in
            (FIXTURES / "arabic-marks-weasyprint.txt").read_text(encoding="utf-8").splitlines()
            if line.strip()]
    assert len(want) == 3
    assert "|" not in text, text
    # Each paragraph wraps onto two lines in the PDF, so the whole text is
    # compared: every letter and mark of every source line, in reading order,
    # and nothing else (whitespace, line breaks and the page's form feed aside).
    assert _norm(text) == " ".join(want), f"got:\n{text}"


def _char(text: str, x0: float, x1: float) -> LTChar:
    """A drawn glyph as pdfminer gives it; only what _line_units reads is set."""
    c = LTChar.__new__(LTChar)
    c._text = text
    c.x0, c.x1, c.y0, c.y1 = x0, x1, 0.0, 10.0
    return c


FATHA = "َ"
BA, TA = "ب", "ت"


def test_mark_on_a_shared_edge_joins_the_glyph_drawn_after_it():
    """HarfBuzz and Skia draw an RTL cluster's mark just before its base. A
    zero-width fatha on the edge ta|ba belongs to ba, drawn next."""
    line = [_char(TA, 0.0, 6.0), _char(FATHA, 6.0, 6.0), _char(BA, 6.0, 12.0)]
    assert main._line_units(line) == [TA, BA + FATHA]


def test_space_measured_after_a_mark_is_not_a_word_gap():
    """pdfminer inserts a space (LTAnno) after a zero-width mark whose next
    glyph looks far from it; the mark and its base are one cluster."""
    line = [_char(TA, 0.0, 6.0), _char(FATHA, 6.0, 6.0), LTAnno(" "), _char(BA, 7.5, 13.5)]
    assert main._line_units(line) == [TA, BA + FATHA]


def test_real_space_without_a_mark_is_kept():
    line = [_char(TA, 0.0, 6.0), LTAnno(" "), _char(BA, 9.0, 15.0)]
    assert main._line_units(line) == [TA, " ", BA]


def test_mark_last_on_the_line_stays_on_the_glyph_before_it():
    """No glyph follows: the mark keeps its letter rather than standing alone."""
    line = [_char(TA, 0.0, 6.0), _char(FATHA, 6.0, 6.0)]
    assert main._line_units(line) == [TA + FATHA]


def test_same_letters_rule():
    """Same letters, each as often, whatever the arrangement; marks, spaces
    and pipes do not count."""
    assert main._same_letters("ab | c" + FATHA, "c ba")
    assert not main._same_letters("abc", "abd")
    assert not main._same_letters("abc", "abcc")


def test_orphan_mark():
    assert not main._has_orphan_mark(BA + FATHA + " " + TA + "ّ" + FATHA)
    assert main._has_orphan_mark(BA + " " + FATHA + TA)
    assert main._has_orphan_mark(FATHA + BA)
    assert main._has_orphan_mark(BA + "\n" + FATHA)


LOGICAL = TA + FATHA + BA + "\n"
RAW = BA + TA + FATHA + "\n"
VISUAL_TABLE = "| " + BA + " | " + TA + FATHA + " |"


@pytest.mark.parametrize("raw, logical, md, want", [
    # MarkItDown's table path, same letters, clean reading: the logical text
    (RAW, LOGICAL, VISUAL_TABLE, TA + FATHA + BA + "\n"),
    # MarkItDown read a letter pdfminer did not: kept
    (RAW, LOGICAL, VISUAL_TABLE + "ج", VISUAL_TABLE + "ج"),
    # a glyph pdfminer could not map: kept
    (RAW + "(cid:3)", LOGICAL + "(cid:3)", VISUAL_TABLE + "(cid:3)", VISUAL_TABLE + "(cid:3)"),
    # a mark cut off from its letter in the logical text: kept
    (RAW, TA + "\n" + FATHA + BA + "\n", VISUAL_TABLE, VISUAL_TABLE),
    # presentation forms (here final ba, U+FE90), not letters yet: kept
    (RAW + "ﺐ", LOGICAL + "ﺐ", VISUAL_TABLE + "ﺐ", VISUAL_TABLE + "ﺐ"),
])
def test_passes_differ_rule(monkeypatch, raw, logical, md, want):
    monkeypatch.setattr(main, "_pdf_logical_text", lambda path: (raw, logical))
    assert main._pdf_in_reading_order("unused.pdf", md) == want


def test_passes_differ_never_raises(monkeypatch):
    def boom(path):
        raise ValueError("bad pdf")
    monkeypatch.setattr(main, "_pdf_logical_text", boom)
    assert main._pdf_in_reading_order("unused.pdf", VISUAL_TABLE) == VISUAL_TABLE
