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
    have = {_norm(line) for line in text.split("\n") if line.strip()}
    missing = [w for w in want if w not in have]
    assert not missing, f"missing {missing}; got:\n{text}"
    assert "|" not in text, text


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
    """The logical text replaces MarkItDown's only when both read the same
    letters, whatever the arrangement; marks, spaces and pipes do not count."""
    assert main._same_letters("ab | c" + FATHA, "c ba")
    assert not main._same_letters("abc", "abd")
    assert not main._same_letters("abc", "abcc")
