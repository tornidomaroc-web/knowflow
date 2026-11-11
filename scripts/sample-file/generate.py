"""The sample file's chunks and embeddings, made by the PRODUCTION ingestion code.

For each language this runs the functions /ingest itself runs
(services/ingestion/main.py: _convert_to_markdown, _strip_nul, _has_no_text,
_chunk_text, _page_layout, _assign_pages, _embed), in the same order, on the
committed PDF (data/sample-file/cell.<lang>.pdf), and writes
data/sample-file/cell.<lang>.json: what /ingest would have stored as chunks.
The later /api/sample route copies those rows for each student, so no student's
sample costs an ingestion or an embedding call.

BEFORE ANY EMBEDDING it asserts all of this for both languages; one failure
and nothing is embedded and no JSON is written:
  * the PDF's sha256 is the one in data/sample-file/manifest.json;
  * the model, dimensions, CHUNK_TOKENS and CHUNK_OVERLAP in main.py are the
    manifest's;
  * the PDF has exactly 2 pages, and the extracted text has 2 form-feed pages;
  * each page's extracted text equals the APPROVED text of that page
    (docs/copy-drafts/sample_file_cell.md), whitespace normalized. For Arabic
    that is the logical (reading) order: a reversed line cannot pass;
  * every chunk has a page label.

--extract-only does everything except the embedding call and writes no JSON:
no key needed. It prints page count, each page's first and last 40 characters
to a UTF-8 report file (never Arabic to a terminal), chunk and token counts.

The key: VOYAGE_API_KEY in the environment, read by main.py. It is never
printed, never written, and no request or response body is logged.

Usage (repo root, services/ingestion/requirements.txt installed):
  python scripts/sample-file/generate.py --extract-only --report out.txt
  VOYAGE_API_KEY=... python scripts/sample-file/generate.py
"""
import argparse
import asyncio
import hashlib
import io
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "sample-file"
SOURCE = ROOT / "docs" / "copy-drafts" / "sample_file_cell.md"
LANGS = ("ar", "en")

os.environ.setdefault("INGESTION_TOKEN", "not-used-by-this-script")
sys.path.insert(0, str(ROOT / "services" / "ingestion"))

import main  # noqa: E402  (the production ingestion module)
from fastapi import UploadFile  # noqa: E402


def norm(s: str) -> str:
    return " ".join(s.split())


def approved_pages() -> dict[str, list[str]]:
    blocks = re.findall(r"```text\n(.*?)```", SOURCE.read_text(encoding="utf-8"), re.S)
    if len(blocks) != 4:
        raise SystemExit(f"FAIL: expected 4 text blocks in {SOURCE.name}, found {len(blocks)}")
    return {"ar": [blocks[0], blocks[1]], "en": [blocks[2], blocks[3]]}


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL: {msg}")


def check_settings(manifest: dict) -> None:
    got = {
        "model": main.VOYAGE_MODEL,
        "dimensions": main.EMBED_DIM,
        "chunk_tokens": main.CHUNK_TOKENS,
        "chunk_overlap": main.CHUNK_OVERLAP,
    }
    for k, v in got.items():
        if manifest[k] != v:
            fail(f"main.py {k} is {v!r}, the manifest says {manifest[k]!r}")
    if main.EMBEDDING_PROVIDER != "voyage":
        fail(f"EMBEDDING_PROVIDER is {main.EMBEDDING_PROVIDER!r}, expected 'voyage'")


def extract(lang: str, manifest: dict, approved: list[str], report: list[str], errors: list[str]) -> tuple[str, list[dict]]:
    pdf = DATA / f"cell.{lang}.pdf"
    data = pdf.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != manifest["pdf_sha256"][lang]:
        fail(f"{pdf.name} sha256 is {digest}, the manifest says {manifest['pdf_sha256'][lang]}")

    # Exactly /ingest's steps (main.py, ingest()).
    text, pages = main._convert_to_markdown(UploadFile(file=io.BytesIO(data), filename=pdf.name))
    text = main._strip_nul(text)
    if pages is None or pages.total != 2 or pages.no_text != 0:
        fail(f"{pdf.name}: page counts {pages}, expected 2 pages, none without text")
    segments = text.split("\f")
    if len(segments) == 3 and not segments[-1].strip():
        segments = segments[:-1]
    if len(segments) != 2:
        fail(f"{pdf.name}: the text has {len(segments)} form-feed pages, expected 2")
    equal = []
    for i, (got, want) in enumerate(zip(segments, approved), start=1):
        g, w = norm(got), norm(want)
        equal.append(g == w)
        if g != w:
            at = next((k for k in range(min(len(g), len(w))) if g[k] != w[k]), min(len(g), len(w)))
            report.append(f"{lang} page {i} MISMATCH at character {at} of {len(w)}:\n  extracted: {g[max(0, at - 30):at + 30]}\n  approved:  {w[max(0, at - 30):at + 30]}")
            errors.append(f"{pdf.name} page {i}: the extracted text is not the approved text (first difference at character {at} of {len(w)}; see the report file)")
    if main._has_no_text(text, pages):
        fail(f"{pdf.name}: read as a file without text")

    chunks = main._chunk_text(text)
    main._assign_pages(text, chunks, main._page_layout(text, pages, pdf.name))
    if not chunks:
        fail(f"{pdf.name}: no chunks")
    for c in chunks:
        if c.get("page_kind") != "page" or not c.get("page_start") or not c.get("page_end"):
            fail(f"{pdf.name}: chunk {c['chunk_index']} has no page label")

    report.append(f"== {lang}: {pdf.name}, sha256 {digest}")
    report.append(f"pages: {pages.total} (without text: {pages.no_text}); characters: {len(text)}")
    for i, seg in enumerate(segments, start=1):
        n = norm(seg)
        report.append(f"page {i} first 40: {n[:40]}")
        report.append(f"page {i} last 40:  {n[-40:]}")
        report.append(f"page {i} equals the approved text (whitespace normalized): {'yes' if equal[i - 1] else 'NO'}")
    report.append(f"chunks: {len(chunks)}; token counts: {[c['token_count'] for c in chunks]}; pages: {[(c['page_start'], c['page_end']) for c in chunks]}")
    return digest, chunks


async def run(extract_only: bool, report_path: Path | None) -> None:
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    check_settings(manifest)
    approved = approved_pages()
    report: list[str] = [
        f"model {main.VOYAGE_MODEL}, dimensions {main.EMBED_DIM}, CHUNK_TOKENS {main.CHUNK_TOKENS}, CHUNK_OVERLAP {main.CHUNK_OVERLAP}"
    ]
    results = {}
    errors: list[str] = []
    try:
        for lang in LANGS:
            results[lang] = extract(lang, manifest, approved[lang], report, errors)
    finally:
        if report_path:
            report_path.write_text("\n".join(report) + "\n", encoding="utf-8", newline="\n")
    for lang, (digest, chunks) in results.items():
        print(f"{lang}: 2 pages, {len(chunks)} chunk(s), tokens {[c['token_count'] for c in chunks]}, pages {[(c['page_start'], c['page_end']) for c in chunks]}")
    if errors:
        for e in errors:
            print(f"FAIL: {e}")
        raise SystemExit("FAIL: nothing embedded, no JSON written")
    print("both languages: the extracted text equals the approved text")
    if extract_only:
        print("extract only: nothing embedded, no JSON written")
        return

    if not main.VOYAGE_API_KEY:
        fail("VOYAGE_API_KEY is not set")
    for lang, (digest, chunks) in results.items():
        embeddings = await main._embed([c["content"] for c in chunks], input_type="document")
        if len(embeddings) != len(chunks) or any(len(e) != main.EMBED_DIM for e in embeddings):
            fail(f"{lang}: {len(embeddings)} embeddings for {len(chunks)} chunks, or a wrong dimension")
        out = {
            "lang": lang,
            "model": main.VOYAGE_MODEL,
            "dimensions": main.EMBED_DIM,
            "chunk_tokens": main.CHUNK_TOKENS,
            "chunk_overlap": main.CHUNK_OVERLAP,
            "pdf_sha256": digest,
            "chunks": [
                {
                    "chunk_index": c["chunk_index"],
                    "content": c["content"],
                    "token_count": c["token_count"],
                    "page_start": c["page_start"],
                    "page_end": c["page_end"],
                    "page_kind": c["page_kind"],
                    "embedding": e,
                }
                for c, e in zip(chunks, embeddings)
            ],
        }
        target = DATA / f"cell.{lang}.json"
        target.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
        print(f"wrote {target.relative_to(ROOT).as_posix()}: {len(chunks)} chunk(s) with {main.EMBED_DIM}-number embeddings")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract-only", action="store_true")
    ap.add_argument("--report", type=Path, default=None, help="UTF-8 file for the page readings")
    a = ap.parse_args()
    asyncio.run(run(a.extract_only, a.report))
