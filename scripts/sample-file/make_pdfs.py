"""Make the two sample PDFs from the APPROVED text, exactly.

The text is read from docs/copy-drafts/sample_file_cell.md (approved by the
owner 2026-11-11): the four ```text blocks, in order Arabic page 1, Arabic
page 2, English page 1, English page 2. Nothing is typed again here.

Output: data/sample-file/cell.ar.pdf and cell.en.pdf, two pages each, and
data/sample-file/SHA256SUMS. The committed PDFs are the source of truth: this
script is how they were made, it is not run in CI (WeasyPrint's output is not
promised byte-identical across versions). After a regeneration, the sha256 in
data/sample-file/manifest.json must be updated and the embeddings regenerated
(scripts/sample-file/generate.py); scripts/verify-sample-file.mjs fails until
they agree.

Font: DejaVu Sans, the face the #309 fixture uses
(services/ingestion/tests/fixtures/arabic-weasyprint.pdf). Free (Bitstream
Vera and DejaVu licence, embedding allowed), shapes Arabic, and WeasyPrint
embeds the subset used. DejaVu Sans (regular and bold) must be INSTALLED on
the machine that runs this; the script fails if any other face ends up in a PDF
(read back with PyMuPDF). The font files are not committed.

Layout rules, chosen so the text extracts back unchanged:
  * a paragraph is a block of lines between blank lines;
  * a one-line block that is short and does not end with a full stop is a
    heading (the first block of page 1 is the title);
  * a "- " line stays plain text with its dash: no list markup, so the dash is
    in the extracted text exactly as approved;
  * no hyphenation, no justification, one column;
  * EVERY block starts at the LEFT margin, in Arabic too (direction stays
    right-to-left, only the alignment is left). pdfminer orders text boxes by
    a mix of height and left edge, so a short right-aligned Arabic heading sank
    below the paragraph after it (measured 2026-11-11 with four fonts and three
    line heights; left alignment was the one layout that kept the order). The
    file is never shown as a page in the app, only read for its text.

Usage (repo root):
  python scripts/sample-file/make_pdfs.py
"""
import argparse
import hashlib
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs" / "copy-drafts" / "sample_file_cell.md"
OUT = ROOT / "data" / "sample-file"


def approved_pages() -> dict[str, list[str]]:
    blocks = re.findall(r"```text\n(.*?)```", SOURCE.read_text(encoding="utf-8"), re.S)
    if len(blocks) != 4:
        sys.exit(f"expected 4 text blocks in {SOURCE}, found {len(blocks)}")
    return {"ar": [blocks[0], blocks[1]], "en": [blocks[2], blocks[3]]}


def is_heading(block: str) -> bool:
    lines = block.split("\n")
    return len(lines) == 1 and len(block) <= 45 and not block.startswith("- ") and not block.rstrip().endswith(".")


def page_html(text: str, first_page: bool) -> str:
    out = []
    blocks = [b for b in re.split(r"\n\s*\n", text.strip()) if b.strip()]
    for i, block in enumerate(blocks):
        if is_heading(block):
            tag = "h1" if first_page and i == 0 else "h2"
            out.append(f"<{tag}>{html.escape(block)}</{tag}>")
        else:
            for line in block.split("\n"):
                out.append(f"<p>{html.escape(line)}</p>")
    return "\n".join(out)


def document(lang: str, pages: list[str]) -> str:
    direction = "rtl" if lang == "ar" else "ltr"
    body = "\n".join(
        f'<section class="page">{page_html(p, i == 0)}</section>' for i, p in enumerate(pages)
    )
    return f"""<!doctype html>
<html lang="{lang}" dir="{direction}">
<head>
<meta charset="utf-8">
<style>
@page {{ size: A4; margin: 22mm 20mm; }}
html {{ font-family: "DejaVu Sans"; font-size: 12.5pt; line-height: 1.45; color: #1c1917; hyphens: none; }}
body {{ margin: 0; text-align: left; }}
section.page + section.page {{ break-before: page; }}
h1 {{ font-size: 20pt; margin: 0 0 10pt; }}
h2 {{ font-size: 14pt; margin: 14pt 0 4pt; }}
p {{ margin: 0 0 6pt; }}
</style>
</head>
<body>
{body}
</body>
</html>"""


def main() -> None:
    argparse.ArgumentParser(description=__doc__.splitlines()[0]).parse_args()
    from weasyprint import HTML  # imported here: only this tool needs it
    import fitz  # PyMuPDF, to read the embedded faces back

    OUT.mkdir(parents=True, exist_ok=True)
    sums = []
    for lang, pages in approved_pages().items():
        target = OUT / f"cell.{lang}.pdf"
        HTML(string=document(lang, pages), base_url=str(ROOT)).write_pdf(str(target))
        doc = fitz.open(str(target))
        faces = sorted({f[3].split("+")[-1] for page in doc for f in page.get_fonts()})
        if len(doc) != 2 or any(not f.startswith("DejaVu-Sans") for f in faces):
            sys.exit(f"{target.name}: {len(doc)} pages, faces {faces}; expected 2 pages in DejaVu Sans only")
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        sums.append(f"{digest}  {target.name}")
        print(f"wrote {target.relative_to(ROOT).as_posix()} ({target.stat().st_size} bytes, faces {faces}) sha256 {digest}")
    (OUT / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
