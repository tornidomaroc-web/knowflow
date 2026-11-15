"""A small upload must not take the service's memory, or its time.

Two defects, both measured on main (ccc2b63):

1. LEGITIMATE PDFs. MarkItDown 0.1.5 reads a PDF with pdfplumber and never
   closes a page; pdfplumber keeps every page's characters until it is closed.
   About 9.4 MiB per page of ordinary text: a 300-page text PDF peaked at
   3.05 GB in the web process. test_pdfplumber_pass_does_not_hold_pages and
   test_closing_pages_changes_no_text cover it, on every platform.

2. BOMBS. A few hundred KB of PDF can expand without bound in the converter
   (tests/pdf_bombs.py). The conversion ran in the web process, so it took the
   whole service with it. The bounded tests drive /ingest in a separate
   process (tests/_ingest_harness.py) that a deadline can kill; each expects
   the stable refusal, the row marked error, Voyage never called, the web
   process's own memory untouched, and the next upload in the same process
   served. They need Linux (forkserver, /proc, RLIMIT_AS), which is what
   Railway runs and what CI's ingestion-image job runs them in; elsewhere
   they skip.

On main every test here fails (or is killed at its deadline); with the guard
they pass.
"""
import io
import json
import os
import subprocess
import sys
import tempfile
import tracemalloc
from pathlib import Path

import pytest

os.environ.setdefault("INGESTION_TOKEN", "test-token")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import main  # noqa: E402
import pdf_bombs  # noqa: E402

FIXTURES = HERE / "fixtures"
LINUX = sys.platform.startswith("linux")
needs_linux = pytest.mark.skipif(not LINUX, reason="the bounds need Linux (forkserver, /proc, RLIMIT_AS)")

# The web process's own peak may not grow by more than this while a bomb is
# converted: the bomb lives and dies in the child. Its baseline (Python,
# FastAPI, MarkItDown, magika, tiktoken) is about 230 MB.
PARENT_PEAK_LIMIT_KB = 700 * 1024


def _tmp_pdf(data: bytes) -> str:
    fd, path = tempfile.mkstemp(suffix=".pdf")
    os.write(fd, data)
    os.close(fd)
    return path


def test_pdfplumber_pass_does_not_hold_pages():
    # 30 dense pages: on main MarkItDown's pdfplumber pass holds them all
    # (about 280 MB traced); closed one by one it stays at a few MB.
    path = _tmp_pdf(pdf_bombs.dense_text(30))
    try:
        md = main.MarkItDown()
        tracemalloc.start()
        try:
            text = md.convert(path).text_content
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
    finally:
        os.remove(path)
    assert len(text) > 100_000
    assert peak < 60 * 1024 * 1024, f"MarkItDown's PDF pass peaked at {peak >> 20} MiB traced"


@pytest.mark.parametrize("name", ["arabic-libreoffice.pdf", "arabic-weasyprint.pdf", "arabic-marks-weasyprint.pdf", None])
def test_closing_pages_changes_no_text(name):
    data = (FIXTURES / name).read_bytes() if name else pdf_bombs.dense_text(5)
    path = _tmp_pdf(data)
    shim = main._md_pdf.pdfplumber
    try:
        closed = main.MarkItDown().convert(path).text_content
        main._md_pdf.pdfplumber = shim._real
        try:
            held = main.MarkItDown().convert(path).text_content
        finally:
            main._md_pdf.pdfplumber = shim
    finally:
        os.remove(path)
    assert closed == held


def _harness(kind: str, deadline: float, timeout_s: float | None = None) -> dict:
    cmd = [sys.executable, str(HERE / "_ingest_harness.py"), kind]
    if timeout_s is not None:
        cmd.append(str(timeout_s))
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=deadline)
    except subprocess.TimeoutExpired as e:
        pytest.fail(f"{kind}: /ingest still busy after {deadline:g} s (the conversion is unbounded)\n"
                    f"{(e.stdout or b'')[-2000:]}")
    steps = {}
    for line in out.stdout.splitlines():
        if line.startswith("{"):
            d = json.loads(line)
            steps[d["step"]] = d
    assert "self" in steps, f"harness died (code {out.returncode}):\n{out.stdout[-2000:]}\n{out.stderr[-3000:]}"
    return steps


def _assert_refused(steps: dict, reason: str):
    bomb = steps["bomb"]
    assert bomb["status"] == 422, bomb
    detail = bomb["body"]["detail"] if isinstance(bomb["body"], dict) else bomb["body"]
    assert detail.startswith(f"{main.FILE_TOO_HEAVY}: {reason}"), detail
    assert bomb["error_row"] == detail, "the row was not marked error with the same line"
    assert bomb["embedded"] == 0, "Voyage was called for a refused file"
    nxt = steps["next"]
    assert nxt["status"] == 200 and nxt["embedded"] == 1, f"the next upload was not served: {nxt}"
    assert steps["self"]["maxrss_kb"] < PARENT_PEAK_LIMIT_KB, (
        f"the web process itself peaked at {steps['self']['maxrss_kb'] >> 10} MiB")


@needs_linux
def test_operand_flood_is_refused_and_the_service_lives():
    _assert_refused(_harness("operand_flood", deadline=120), "memory")


@needs_linux
def test_glyph_flood_is_refused_and_the_service_lives():
    _assert_refused(_harness("glyph_flood", deadline=120), "memory")


@needs_linux
def test_inflate_bomb_is_refused_and_the_service_lives():
    _assert_refused(_harness("inflate_zeros", deadline=120), "memory")


@needs_linux
def test_slow_conversion_is_stopped_at_the_time_bound():
    # A legitimate 200-page text PDF takes about 26 s to convert (0.13 s a page, measured); with the
    # bound set to 3 s for this run it is stopped, and the process goes on.
    _assert_refused(_harness("dense_text", deadline=90, timeout_s=3), "time")


@needs_linux
def test_ordinary_pdf_passes_the_bounds_with_its_text():
    # The bounded path returns exactly what the conversion returns in process.
    path = _tmp_pdf((FIXTURES / "arabic-weasyprint.pdf").read_bytes())
    try:
        isolated = main._run_converter(path)
        direct = main._convert_path(path)
    finally:
        os.remove(path)
    assert isolated == direct


def test_a_converter_error_is_reported_as_before(monkeypatch):
    # Not a bound: a file the converter cannot read still fails as it did,
    # a 500 with the converter's own message, never file_too_heavy.
    from fastapi.testclient import TestClient

    seen = {}

    async def fake_user_client(token):
        return object()

    async def fake_load(sb, document_id, kb_id):
        return {}

    async def fake_mark_error(sb, document_id, message):
        seen["error"] = message

    async def fake_embed(texts, input_type):
        seen["embedded"] = True
        return []

    monkeypatch.setattr(main, "_user_client", fake_user_client)
    monkeypatch.setattr(main, "_load_owned_document", fake_load)
    monkeypatch.setattr(main, "_mark_error", fake_mark_error)
    monkeypatch.setattr(main, "_embed", fake_embed)
    resp = TestClient(main.app).post(
        "/ingest",
        headers={"Authorization": "Bearer test-token", "X-Supabase-Token": "user"},
        data={"document_id": "doc-1", "kb_id": "kb-1"},
        files={"file": ("broken.pdf", b"%PDF-1.4\n" + b"\x00garbage" * 50, "application/pdf")},
    )
    assert resp.status_code == 500, resp.text
    assert main.FILE_TOO_HEAVY not in resp.text
    assert seen.get("error") and main.FILE_TOO_HEAVY not in seen["error"]
    assert "embedded" not in seen


def test_health_reports_the_bounds():
    from fastapi.testclient import TestClient

    body = TestClient(main.app).get("/health").json()
    c = body["convert"]
    assert c["max_rss_bytes"] == main.CONVERT_MAX_RSS_BYTES
    assert c["timeout_s"] == main.CONVERT_TIMEOUT_S
    assert c["concurrency"] == main.CONVERT_CONCURRENCY
    assert c["isolated"] is LINUX
