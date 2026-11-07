import bisect
import hmac
import os
import re
import shutil
import tempfile
import unicodedata
from typing import Literal, NamedTuple

import httpx
import tiktoken
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Body
from fastapi.responses import JSONResponse
from markitdown import MarkItDown
from pdfminer.converter import PDFPageAggregator
from pdfminer.layout import LAParams, LTChar, LTContainer, LTText, LTTextBox, LTTextLine
from pdfminer.pdfinterp import PDFPageInterpreter, PDFResourceManager
from pdfminer.pdfpage import PDFPage
from postgrest.exceptions import APIError
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

# A page "has text" when it holds at least this many LETTERS (Unicode category
# L*: Latin, Arabic, any script; digits, punctuation, spaces and diacritics do
# not count). The furniture a scanned or photographed page still carries as
# real text sits under it: "Page 12" has 4 letters, "Page 12 of 40" 6,
# "Slide 7 of 30" 7, "صفحة 3 من 20" 5, "الصفحة 12 من 40" 8, "- 12 -" 0. The
# shortest real content seen on a slide sits at or over it ("Conclusion" 10,
# "Introduction" 12), and a page with a sentence has dozens. The table is held
# against _letters in tests/test_no_text_pages.py. A page under it counts as a
# page with no text. It errs towards "has text": a scanned page with a running
# header of 10 letters or more is not caught.
MIN_PAGE_LETTERS = 10

# pdfminer writes a glyph it cannot map to Unicode as "(cid:123)". That is not
# text a student can read or Ask can use, and its "cid" must not count as 3
# letters.
_UNMAPPED_GLYPH = re.compile(r"\(cid:\d+\)")

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


def _strip_nul(text: str) -> str:
    """Remove U+0000 from converted text, and nothing else.

    Postgres `text` cannot hold U+0000: the chunk insert fails with 22P05
    ("\\u0000 cannot be converted to text"), after Voyage has already been paid
    for every chunk. Extraction can emit it, e.g. a PDF whose ToUnicode CMap
    maps a glyph to <0000> (pdfminer turns that into "\\x00"), or a .txt with a
    NUL byte. Applied once, before chunking, so the stored markdown, the chunks
    and their embeddings all see the same text. Every other character is
    kept: Arabic diacritics, tatweel, bidi marks and other control characters
    are all valid in Postgres text.
    """
    return text.replace("\x00", "")


def _letters(text: str) -> int:
    """How many letters `text` holds, in any script (see MIN_PAGE_LETTERS)."""
    return sum(1 for ch in _UNMAPPED_GLYPH.sub("", text) if unicodedata.category(ch).startswith("L"))


class PageCounts(NamedTuple):
    total: int
    no_text: int


def _pdf_page_counts(path: str) -> PageCounts | None:
    """Per page of a PDF, whether it has text: (pages, pages with no text).

    Reads the characters pdfminer places on each page, with no layout analysis
    (laparams=None), the cheap part of what MarkItDown already does with the
    same library. Text inside a form XObject (an LTFigure) counts, and so does
    an invisible OCR layer, as it should: Ask can use it.

    Never raises: a PDF pdfminer cannot walk (encrypted, broken) returns None,
    and the upload goes on as before, measured as a whole.
    """
    def letters_in(obj) -> int:
        if isinstance(obj, LTChar):
            return _letters(obj.get_text())
        if isinstance(obj, LTContainer):
            return sum(letters_in(child) for child in obj)
        return 0

    try:
        rsrc = PDFResourceManager()
        device = PDFPageAggregator(rsrc, laparams=None)
        interpreter = PDFPageInterpreter(rsrc, device)
        total = no_text = 0
        with open(path, "rb") as fp:
            for page in PDFPage.get_pages(fp):
                interpreter.process_page(page)
                total += 1
                if letters_in(device.get_result()) < MIN_PAGE_LETTERS:
                    no_text += 1
        return PageCounts(total, no_text)
    except Exception as e:  # noqa: BLE001 - a measure, never a reason to fail an upload
        print(f"page count failed: {type(e).__name__}", flush=True)
        return None


# Arabic PDFs: pdfminer writes each line's characters in the order the PDF
# draws them, left to right (visual order), so an Arabic line came out
# reversed ("تنتج جزيئة" stored as "ةئيزج جتنت"). _pdf_logical_text redoes
# MarkItDown's own pdfminer pass and turns every line that holds an Arabic or
# Hebrew letter back into reading order; every other line is written exactly
# as before. It is used only when the same pass, left unturned, reproduces
# MarkItDown's text byte for byte, so it can never change anything else.
_RTL = ("R", "AL")
_MIRROR = str.maketrans("()[]{}<>«»", ")(][}{><»«")
_BRACKETS = {")": "(", "]": "[", "}": "{"}


def _has_rtl(text: str) -> bool:
    return any(unicodedata.bidirectional(ch) in _RTL for ch in text)


def _unit_class(unit: str) -> str:
    """R for an Arabic or Hebrew glyph, L for a Latin letter or a digit, N else."""
    for ch in unit:
        c = unicodedata.bidirectional(ch)
        if c in _RTL:
            return "R"
        if c in ("L", "EN", "AN"):
            return "L"
    return "N"


def _is_letter(unit: str) -> bool:
    """A left-to-right letter (Latin and the like), not a digit."""
    return any(unicodedata.bidirectional(ch) == "L" for ch in unit)


def _joins_digits(gap: list[str]) -> bool:
    """Whether the neutrals between two numbers keep them one number.

    Unicode bidi (UAX #9, W2 and W4): a number after an Arabic letter is an
    Arabic number, and two of them stay one only across a single comma, full
    stop, colon or slash ("3.5", "1,000", "3/4"). Across a hyphen they are two,
    and a browser draws the Arabic "3-4" as "4-3" (WeasyPrint does).
    """
    text = "".join(gap)
    return text == "" or (len(text) == 1 and unicodedata.bidirectional(text) == "CS")


def _balanced(text: str) -> bool:
    stack = []
    for ch in text:
        if ch in "([{":
            stack.append(ch)
        elif ch in _BRACKETS:
            if not stack or stack.pop() != _BRACKETS[ch]:
                return False
    return not stack


def _rtl_span(units: list[str], classes: list[str]) -> tuple[str, str]:
    """A right-to-left stretch, given in visual order: (as read, brackets mirrored).

    Left-to-right runs keep their order: Latin words with the neutrals between
    them ("ATP", "Robert Hooke"), a number ("1665", "3.5"), and a number that
    follows a Latin word in the same run ("ATP-3"). Everything else is right
    to left. The runs are put back in reading order and each right-to-left run
    is reversed unit by unit, so a ligature's text ("لا", already in reading
    order) stays whole.
    """
    runs: list[tuple[bool, list[str]]] = []
    i, n = 0, len(units)
    while i < n:
        if classes[i] == "L":
            j = last = i
            seen_letter = _is_letter(units[i])
            while j < n and classes[j] != "R":
                if classes[j] == "L" and j > last:
                    if _is_letter(units[j]):
                        if not _is_letter(units[last]) and not seen_letter and j > last + 1:
                            break  # a number, a space, a Latin word: two runs
                        seen_letter = True
                    elif not seen_letter and not _joins_digits(units[last + 1:j]):
                        break
                    last = j
                j += 1
            runs.append((True, units[i:last + 1]))
            i = last + 1
        else:
            j = i
            while j < n and classes[j] != "L":
                j += 1
            runs.append((False, units[i:j][::-1]))
            i = j
    runs.reverse()
    plain = "".join("".join(u) for _, u in runs)
    mirrored = "".join("".join(u) if ltr else "".join(u).translate(_MIRROR) for ltr, u in runs)
    return plain, mirrored


def _visual_to_logical(units: list[str]) -> str:
    """One line's glyph texts, left to right as drawn, in reading order.

    A line with at least as many right-to-left glyphs as Latin letters reads
    right to left as a whole. Otherwise it reads left to right and only each
    stretch from a right-to-left glyph to the last one before the next Latin
    letter is turned. Brackets are mirrored only when the plain result leaves
    them unbalanced and mirroring balances them: some generators map a
    bracket glyph to the character it means, others to the shape drawn.
    """
    classes = [_unit_class(u) for u in units]
    is_letter = _is_letter
    rtl = classes.count("R")
    ltr = sum(1 for u, c in zip(units, classes) if c == "L" and is_letter(u))
    if rtl == 0:
        return "".join(units)
    if rtl >= ltr:
        spans = [(True, units, classes)]
    else:
        spans, i, n = [], 0, len(units)
        while i < n:
            if classes[i] != "R":
                spans.append((False, [units[i]], None))
                i += 1
                continue
            j = last = i
            while j < n and not (classes[j] == "L" and is_letter(units[j])):
                if classes[j] == "R":
                    last = j
                j += 1
            spans.append((True, units[i:last + 1], classes[i:last + 1]))
            i = last + 1
    plain, mirrored = [], []
    for turned, us, cs in spans:
        if turned:
            p, m = _rtl_span(us, cs)
        else:
            p = m = "".join(us)
        plain.append(p)
        mirrored.append(m)
    p, m = "".join(plain), "".join(mirrored)
    return m if not _balanced(p) and _balanced(m) else p


def _line_units(line: LTTextLine) -> list[str]:
    """The line's glyph texts, left to right, without its closing newline.

    A combining mark (a haraka) is joined to the glyph it sits over, so it
    stays after its letter when the line is turned.
    """
    items = [c for c in line if isinstance(c, LTText)]
    if items and items[-1].get_text() == "\n":
        items = items[:-1]
    units: list[str] = []
    prev: LTChar | None = None
    pending = ""  # marks drawn before the glyph they sit over
    for idx, c in enumerate(items):
        t = c.get_text()
        if isinstance(c, LTChar) and t and all(unicodedata.category(ch) == "Mn" for ch in t):
            mid = (c.x0 + c.x1) / 2
            nxt = next((o for o in items[idx + 1:] if isinstance(o, LTChar)), None)
            over_prev = prev is not None and prev.x0 <= mid <= prev.x1
            over_next = nxt is not None and nxt.x0 <= mid <= nxt.x1
            if over_next and not over_prev:
                pending += t
            elif units:
                units[-1] += t
            else:
                pending += t
            continue
        units.append(t + pending)
        pending = ""
        if isinstance(c, LTChar):
            prev = c
    if pending:
        units.append(pending)
    return units


def _same_row(a: LTTextLine, b: LTTextLine) -> tuple[bool, float]:
    """Whether b continues a on the same baseline, touching it on the right."""
    h = max(a.height, b.height, 1.0)
    gap = b.x0 - a.x1
    same = abs(a.y0 - b.y0) <= 0.2 * h and abs(a.y1 - b.y1) <= 0.2 * h and -0.5 <= gap <= 0.25 * h
    return same, gap / h


def _pdf_logical_text(path: str) -> tuple[str, str]:
    """(raw, logical): pdfminer.high_level.extract_text's output for `path`, and
    the same with every right-to-left line in reading order.

    The walk is TextConverter.receive_layout's (pdfminer 20260107) with the
    default LAParams, as MarkItDown calls it: each text line's characters,
    a newline after each text box, a form feed after each page. For the
    logical text, lines on one baseline whose edges touch (a generator that
    draws the digits or Latin words of an Arabic line as runs of their own)
    are joined first, when one of them holds a right-to-left letter.
    """
    rsrc = PDFResourceManager(caching=True)
    device = PDFPageAggregator(rsrc, laparams=LAParams())
    interpreter = PDFPageInterpreter(rsrc, device)
    raw: list[str] = []
    out: list[str] = []
    with open(path, "rb") as fp:
        for page in PDFPage.get_pages(fp, caching=True):
            interpreter.process_page(page)
            pieces: list = []

            def render(item) -> None:
                if isinstance(item, LTTextLine):
                    pieces.append(item)
                elif isinstance(item, LTContainer):
                    for child in item:
                        render(child)
                elif isinstance(item, LTText):
                    pieces.append(item.get_text())
                if isinstance(item, LTTextBox):
                    pieces.append("\n")

            render(device.get_result())
            pieces.append("\f")

            i = 0
            while i < len(pieces):
                p = pieces[i]
                if isinstance(p, str):
                    raw.append(p)
                    out.append(p)
                    i += 1
                    continue
                # A row: this line, then lines that continue it, with only box
                # newlines between them.
                row, gaps, skipped, j = [p], [], [], i + 1
                while True:
                    k = j
                    while k < len(pieces) and pieces[k] == "\n":
                        k += 1
                    if k < len(pieces) and isinstance(pieces[k], LTTextLine):
                        same, gap = _same_row(row[-1], pieces[k])
                        if same:
                            skipped.append(pieces[j:k])
                            gaps.append(gap)
                            row.append(pieces[k])
                            j = k + 1
                            continue
                    break
                if not any(_has_rtl(ln.get_text()) for ln in row):
                    # No right-to-left letter: written exactly as pdfminer does.
                    raw.append(p.get_text())
                    out.append(p.get_text())
                    i += 1
                    continue
                for n_, ln in enumerate(row):
                    raw.append(ln.get_text())
                    if n_ < len(row) - 1:
                        raw.extend(skipped[n_])
                units: list[str] = []
                for n_, ln in enumerate(row):
                    part = _line_units(ln)
                    if len(row) > 1 and not _has_rtl("".join(part)):
                        # A run drawn on its own ("3-4", "ATP"): drawn in its
                        # own reading order, so it moves as one piece.
                        part = ["".join(part)] if part else part
                    if n_ and units and part and gaps[n_ - 1] > 0.15 \
                            and not units[-1].endswith(" ") and not part[0].startswith(" "):
                        units.append(" ")
                    units.extend(part)
                out.append(_visual_to_logical(units) + "\n")
                i = j
    return "".join(raw), "".join(out)


def _markitdown_pdf_post(text: str) -> str:
    """What MarkItDown 0.1.5 does to pdfminer's text before handing it back."""
    from markitdown.converters._pdf_converter import _merge_partial_numbering_lines

    text = _merge_partial_numbering_lines(text)
    text = "\n".join(line.rstrip() for line in re.split(r"\r?\n", text))
    return re.sub(r"\n{3,}", "\n\n", text)


def _pdf_in_reading_order(path: str, markdown_text: str) -> str:
    """MarkItDown's text of a PDF, with right-to-left lines in reading order.

    A PDF without a right-to-left letter is returned untouched, with no second
    pass. Otherwise the logical text replaces MarkItDown's only when the
    unturned pass equals it byte for byte; a PDF MarkItDown read another way
    (its form-style table path) keeps MarkItDown's text, as before. Never raises.
    """
    if not _has_rtl(markdown_text):
        return markdown_text
    try:
        raw, logical = _pdf_logical_text(path)
        if _markitdown_pdf_post(raw) != markdown_text:
            print("rtl order: kept MarkItDown's text (passes differ)", flush=True)
            return markdown_text
        return _markitdown_pdf_post(logical)
    except Exception as e:  # noqa: BLE001 - a better order, never a reason to fail an upload
        print(f"rtl order failed: {type(e).__name__}", flush=True)
        return markdown_text


def _has_no_text(markdown_text: str, pages: PageCounts | None) -> bool:
    """True when the file holds nothing a student could study from.

    A PDF: every page is a page with no text, even if their page numbers
    together add up to more than MIN_PAGE_LETTERS. Any other file, or a PDF
    that could not be counted: the whole text holds fewer letters than one
    page needs. Such a file gets no chunks, so it ends `ready` with
    `chunk_count` 0, which the app already reads as "no text"
    (src/lib/material-text.ts, hasNoText) on every page and in Ask.
    """
    if pages is not None and pages.total > 0:
        return pages.no_text == pages.total
    return _letters(markdown_text) < MIN_PAGE_LETTERS


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


# G2: page and slide numbers for each chunk. The chunks are cut exactly as
# before (_chunk_text, token windows over the whole text); each one is then
# given the pages its own text lies on, read from the converted text itself:
#   * a PDF: MarkItDown's PDF text puts a form feed (U+000C) between pages, so
#     page N is the N-th form-feed-separated segment. Used only when the
#     segments match pdfminer's own page count (_pdf_page_counts), so a PDF
#     whose text came out another way gets no numbers rather than wrong ones;
#   * a .pptx: MarkItDown writes "<!-- Slide number: N -->" before each
#     slide, so a chunk's slides are the markers its text lies after.
# Every other file, and anything that does not match, stays NULL: the app
# then shows the file name alone, as today.
PAGE_COLUMNS = ("page_start", "page_end", "page_kind")
_SLIDE_MARK = re.compile(r"<!-- Slide number: (\d+) -->")


class PageLayout(NamedTuple):
    starts: list[int]  # character offset where each page or slide begins, ascending
    numbers: list[int]  # its number (1-based page, or the slide's own number)
    kind: str  # "page" or "slide"


def _page_layout(text: str, pages: "PageCounts | None", filename: str | None) -> PageLayout | None:
    """Where each page (PDF) or slide (.pptx) begins in `text`, or None."""
    if pages is not None and pages.total > 0:
        segments = text.split("\f")
        # A trailing form feed leaves an empty last segment, not a page.
        if len(segments) == pages.total + 1 and not segments[-1].strip():
            segments = segments[:-1]
        if len(segments) != pages.total:
            return None
        starts, at = [], 0
        for seg in segments:
            starts.append(at)
            at += len(seg) + 1
        return PageLayout(starts, list(range(1, pages.total + 1)), "page")
    if (filename or "").lower().endswith(".pptx"):
        marks = list(_SLIDE_MARK.finditer(text))
        if marks:
            return PageLayout([m.start() for m in marks], [int(m.group(1)) for m in marks], "slide")
    return None


def _assign_pages(text: str, chunks: list[dict], layout: PageLayout | None) -> None:
    """Give each chunk page_start, page_end and page_kind (all None when unknown).

    The chunk's span in `text` comes from the same token list _chunk_text cut
    (tiktoken's decode_with_offsets gives each token's character offset); its
    first and last non-space characters name its first and last page.
    """
    for c in chunks:
        c["page_start"] = c["page_end"] = c["page_kind"] = None
    if layout is None or not chunks:
        return
    tokens = ENCODER.encode(text)
    _, offsets = ENCODER.decode_with_offsets(tokens)
    step = CHUNK_TOKENS - CHUNK_OVERLAP

    def page_at(pos: int) -> int | None:
        i = bisect.bisect_right(layout.starts, pos) - 1
        return layout.numbers[i] if i >= 0 else None

    for c in chunks:
        t0 = c["chunk_index"] * step
        t1 = t0 + c["token_count"]
        a = offsets[t0] if t0 < len(offsets) else len(text)
        b = offsets[t1] if t1 < len(offsets) else len(text)
        span = text[a:b]
        lead = len(span) - len(span.lstrip())
        trail = len(span.rstrip())
        if trail <= lead:
            continue
        first, last = page_at(a + lead), page_at(a + trail - 1)
        if first is None or last is None or last < first:
            continue
        c["page_start"], c["page_end"], c["page_kind"] = first, last, layout.kind


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

    # G2: the page columns are written only when some chunk has a page, so
    # every other file inserts exactly the rows it always did.
    with_pages = any(c.get("page_kind") for c in chunks)
    rows = [
        {
            "document_id": document_id,
            "kb_id": kb_id,
            "chunk_index": c["chunk_index"],
            "content": c["content"],
            "token_count": c["token_count"],
            "embedding": c["embedding"],
            **({k: c.get(k) for k in PAGE_COLUMNS} if with_pages else {}),
        }
        for c in chunks
    ]
    for i in range(0, len(rows), CHUNK_INSERT_BATCH):
        batch = rows[i : i + CHUNK_INSERT_BATCH]
        try:
            await sb.table("chunks").insert(batch).execute()
        except APIError as e:
            # Railway deploys this service on every push to main, so it can run
            # before the owner adds the page columns. PostgREST then refuses the
            # unknown columns (PGRST204) and inserts nothing; the batch is sent
            # again without them, and so is every later batch. The upload is
            # what it was before G2, with no page numbers.
            if not with_pages or getattr(e, "code", None) not in ("PGRST204", "42703"):
                raise
            print(f"chunk page columns refused ({e.code}); storing chunks without pages for {document_id}", flush=True)
            with_pages = False
            rows = [{k: v for k, v in r.items() if k not in PAGE_COLUMNS} for r in rows]
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


def _convert_to_markdown(file: UploadFile) -> tuple[str, PageCounts | None]:
    """The file's text, and for a PDF its page counts (None for any other file).

    Only a PDF has pages this service can read one by one. A .pptx has slides
    (MarkItDown marks each), but they are not counted here; a .docx has no
    fixed pages (Word lays them out when it opens the file); .xlsx, .txt and
    .md have none. Those are measured as a whole by _has_no_text.
    """
    fd, tmp_path = tempfile.mkstemp(suffix=f"_{_safe_basename(file.filename)}")
    os.close(fd)
    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        md = MarkItDown()
        result = md.convert(tmp_path)
        text = result.text_content or ""
        if _is_pdf(tmp_path):
            return _pdf_in_reading_order(tmp_path, text), _pdf_page_counts(tmp_path)
        return text, None
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def _is_pdf(path: str) -> bool:
    """By content, not by name: a PDF carries %PDF- in its first 1 KB."""
    with open(path, "rb") as fp:
        return b"%PDF-" in fp.read(1024)


async def _record_pages(sb: AsyncClient, document_id: str, pages: PageCounts) -> None:
    """Best-effort write of a PDF's page counts. Never raises.

    Its own update, after the ready write, so an upload never depends on it.
    The two columns (pages_total, pages_no_text) exist only once the owner has
    added them; until then PostgREST refuses the unknown columns, this logs one
    line, and the upload is unchanged.
    """
    try:
        await (
            sb.table("documents")
            .update({"pages_total": pages.total, "pages_no_text": pages.no_text})
            .eq("id", document_id)
            .execute()
        )
    except Exception as e:  # noqa: BLE001 - diagnostics only
        print(f"_record_pages failed for {document_id}: {type(e).__name__}", flush=True)


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
        markdown_text, pages = _convert_to_markdown(file)
        markdown_text = _strip_nul(markdown_text)
        # A file whose pages hold nothing but page numbers has no text: no
        # chunks, nothing sent to Voyage, chunk_count 0.
        chunks = [] if _has_no_text(markdown_text, pages) else _chunk_text(markdown_text)
        _assign_pages(markdown_text, chunks, _page_layout(markdown_text, pages, file.filename))
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
    # After the ready write and outside the try, so it cannot turn a stored
    # document into an error.
    if pages is not None:
        await _record_pages(sb, document_id, pages)

    return {
        "document_id": document_id,
        "chunk_count": len(chunks),
        "status": "ready",
        # A PDF's pages and how many have no text; null for any other file.
        "pages_total": pages.total if pages is not None else None,
        "pages_no_text": pages.no_text if pages is not None else None,
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
