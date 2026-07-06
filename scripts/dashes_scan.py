# -*- coding: utf-8 -*-
"""User-facing dash scanner - pre-commit guard against em/en dashes in UI copy.

The founder rule: an em dash (U+2014) or en dash (U+2013) must NEVER appear in
anything the user sees (a top tell of AI-written text). This blocks them at
commit time so the later text-fix pass runs under a guard instead of by eye.

Deliberately narrow. It flags dashes ONLY in user-facing source, and ONLY when
they sit in string literals or JSX text - NOT in code comments. Planning docs,
*.md, comments, *.sql, *.py, *.css, and config keep their ~194 legitimate
dashes and must stay green, or the guard gets noisy and disabled.

Scope (path-based - honest and maintainable; a full TS/JSX AST parse would be
over-engineered for a commit hook, and naive line-grep would red on comment
dashes that legitimately live in these same files):
  - src/lib/i18n/locales/*.ts           (the Arabic/English UI copy)
  - src/app/**/page.tsx, **/layout.tsx  (route text + <title> strings)
  - src/components/dashboard/StudentHome.tsx  (renders the ghost "-" streak
    placeholder to screen; the founder wants that caught)

Comment/string discrimination is done by a small lexer (below), NOT regex, so:
  - a dash inside //... or /* ... */ (incl. JSX {/* ... */}) is IGNORED, and
  - a "//" inside a string/URL does NOT falsely start a comment.
Identifiers and arithmetic never contain U+2014/U+2013 (JS uses ASCII '-'), so
whatever survives comment-stripping and lands in code/string/JSX text is real.

Usage:
  python scripts/dashes_scan.py            # scan the whole in-scope set (CI / audit)
  python scripts/dashes_scan.py --staged   # scan only staged in-scope files (pre-commit)
"""
import fnmatch
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The two dashes the rule forbids in user-facing text.
DASHES = {"—": "em dash", "–": "en dash"}

# Explicit user-facing files (rendered component outside src/app).
SCOPE_FILES = {"src/components/dashboard/StudentHome.tsx"}


def in_scope(rel: str) -> bool:
    """True if `rel` (posix path from repo root) holds user-facing copy."""
    if fnmatch.fnmatch(rel, "src/lib/i18n/locales/*.ts"):
        return True
    if rel.startswith("src/app/") and (rel.endswith("/page.tsx") or rel.endswith("/layout.tsx")):
        return True
    if rel in SCOPE_FILES:
        return True
    return False


def scan_text(text: str):
    """Return [(line_no, kind)] for each forbidden dash NOT inside a comment.

    A minimal lexer over TS/TSX: it tracks line comments, block comments (which
    also covers JSX `{/* ... */}`), and string literals (', ", `). A dash is a
    finding while in normal (code / JSX text) or string state, and ignored while
    in either comment state.
    """
    findings = []
    i, n = 0, len(text)
    state = "normal"  # normal | line_comment | block_comment | string
    quote = ""
    line = 1
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if c == "\n":
            line += 1
            if state == "line_comment":
                state = "normal"
            i += 1
            continue

        if state == "line_comment":
            i += 1
            continue

        if state == "block_comment":
            if c == "*" and nxt == "/":
                state = "normal"
                i += 2
                continue
            i += 1
            continue

        if state == "string":
            if c == "\\":            # escape: skip the next char verbatim
                if nxt == "\n":
                    line += 1
                i += 2
                continue
            if c == quote:
                state = "normal"
                i += 1
                continue
            if c in DASHES:
                findings.append((line, DASHES[c]))
            i += 1
            continue

        # normal state (code, JSX tags, JSX text)
        if c == "/" and nxt == "/":
            state = "line_comment"
            i += 2
            continue
        if c == "/" and nxt == "*":
            state = "block_comment"
            i += 2
            continue
        if c in ("'", '"', "`"):
            state = "string"
            quote = c
            i += 1
            continue
        if c in DASHES:
            findings.append((line, DASHES[c]))
        i += 1

    return findings


def staged_files() -> list[Path]:
    out = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
                         capture_output=True, text=True, cwd=ROOT)
    return [ROOT / line for line in out.stdout.splitlines() if line.strip()]


def all_scope_files() -> list[Path]:
    files = []
    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue
        rel = p.relative_to(ROOT).as_posix()
        if in_scope(rel):
            files.append(p)
    return files


def main() -> int:
    # Findings quote Arabic UI copy; the default Windows console codec (cp1252)
    # cannot encode it and would crash on print. Emit UTF-8 (never on the hot
    # path: --staged with no in-scope file staged prints only the clean line).
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    if "--staged" in sys.argv:
        targets = [f for f in staged_files() if in_scope(f.relative_to(ROOT).as_posix())]
    else:
        targets = all_scope_files()

    findings = []
    for f in targets:
        if not f.exists():
            continue
        rel = f.relative_to(ROOT).as_posix()
        lines = f.read_text(encoding="utf-8", errors="ignore").splitlines()
        text = "\n".join(lines)
        for line_no, kind in scan_text(text):
            snippet = lines[line_no - 1].strip() if 0 < line_no <= len(lines) else ""
            findings.append(f"{rel}:{line_no}  [{kind}]  {snippet}")

    if findings:
        em = sum(1 for f in findings if "[em dash]" in f)
        en = sum(1 for f in findings if "[en dash]" in f)
        print("DASH SCAN FAILED - em/en dash in user-facing text (replace with comma, period, or ASCII '-'):")
        for f in findings:
            print("  " + f)
        print(f"  -> {len(findings)} finding(s): {em} em, {en} en, across {len(targets)} scanned file(s).")
        return 1
    print(f"dash scan clean ({len(targets)} user-facing files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
