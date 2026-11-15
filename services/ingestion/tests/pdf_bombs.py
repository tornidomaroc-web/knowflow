"""Small PDFs that expand into huge memory or time in the converter.

Built at test time, never committed: each is a few hundred KB on disk, well
inside the 4 MiB upload limit, because the payload is one FlateDecode content
stream of highly repetitive bytes (deflate reaches about 1000:1 on them).

  operand_flood   "0 0 0 ..." with no operator: pdfminer's content parser
                  keeps every operand on its stack until an operator comes.
                  Measured: a 300 MB jump, then about 2.7 MB/s, for many
                  minutes; the time bound is what stops it.
  glyph_flood     one Tj of millions of letters: every letter becomes an
                  LTChar object in layout analysis, about 1 KB each.
  inflate_zeros   a stream of spaces: zlib.decompress materialises all of it,
                  once per pass that reads the page.
  dense_text      a LEGITIMATE dense PDF: many pages of ordinary text lines,
                  for measuring how long a real large PDF takes.
"""
from __future__ import annotations

import zlib


def _deflate_repeat(unit: bytes, total: int, level: int = 9) -> bytes:
    """zlib-compress `unit` repeated to `total` bytes, without holding them."""
    co = zlib.compressobj(level)
    block = unit * max(1, (1 << 20) // len(unit))
    out = []
    left = total
    while left > 0:
        piece = block if left >= len(block) else block[:left]
        out.append(co.compress(piece))
        left -= len(piece)
    out.append(co.flush())
    return b"".join(out)


def _pdf(pages_streams: list[tuple[bytes, bool, int]]) -> bytes:
    """A minimal valid PDF. Each page: (stream bytes, is_flate, decoded length)."""
    objs: list[bytes] = []
    n_pages = len(pages_streams)
    # 1 catalog, 2 pages, 3 font, then (page, content) pairs.
    kids = " ".join(f"{4 + 2 * i} 0 R" for i in range(n_pages))
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode())
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for i, (data, flate, _n) in enumerate(pages_streams):
        content_id = 5 + 2 * i
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>".encode()
        )
        filt = b" /Filter /FlateDecode" if flate else b""
        objs.append(b"<< /Length " + str(len(data)).encode() + filt + b" >>\nstream\n" + data + b"\nendstream")
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def operand_flood(tokens: int = 150_000_000) -> bytes:
    return _pdf([(_deflate_repeat(b"0 ", 2 * tokens), True, 2 * tokens)])


def glyph_flood(letters: int = 40_000_000) -> bytes:
    head = b"BT /F1 1 Tf 0 0 Td ("
    tail = b") Tj ET"
    co = zlib.compressobj(9)
    body = co.compress(head)
    block = b"A" * (1 << 20)
    left = letters
    while left > 0:
        piece = block if left >= len(block) else block[:left]
        body += co.compress(piece)
        left -= len(piece)
    body += co.compress(tail) + co.flush()
    return _pdf([(body, True, len(head) + letters + len(tail))])


def inflate_zeros(n_bytes: int = 1536 * 1024 * 1024) -> bytes:
    return _pdf([(_deflate_repeat(b" ", n_bytes), True, n_bytes)])


def dense_text(pages: int, lines_per_page: int = 60, flate: bool = True) -> bytes:
    """Ordinary text pages: `lines_per_page` lines of prose per page."""
    line = "Supply and demand meet where the market clears, and price follows it."
    streams = []
    for p in range(pages):
        ops = ["BT /F1 9 Tf 40 760 Td 11 TL"]
        for k in range(lines_per_page):
            ops.append(f"({line} p{p} l{k}) Tj T*")
        ops.append("ET")
        raw = "\n".join(ops).encode("latin-1")
        streams.append((zlib.compress(raw, 9) if flate else raw, flate, len(raw)))
    return _pdf(streams)
