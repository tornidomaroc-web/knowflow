# -*- coding: utf-8 -*-
"""Rasw secrets scanner — pre-commit hook and CI tripwire (defense-in-depth next to gitleaks).

Scans tracked/working files for credential patterns. Exit 1 on any finding.
Usage:
  python scripts/secrets_scan.py            # scan the whole working tree
  python scripts/secrets_scan.py --staged   # scan only git-staged files (pre-commit)
"""
import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PATTERNS = [
    ("anthropic key", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("openai key", re.compile(r"sk-(?:proj-)?[A-Za-z0-9_\-]{32,}")),
    ("aws access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("github token", re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}")),
    ("jwt (supabase service/anon)", re.compile(r"eyJ[A-Za-z0-9_\-]{30,}\.[A-Za-z0-9_\-]{30,}\.[A-Za-z0-9_\-]{10,}")),
    ("voyage key", re.compile(r"pa-[A-Za-z0-9_\-]{24,}")),
    ("paddle key", re.compile(r"pdl_(?:live|sdbx)_[A-Za-z0-9]{10,}")),
    ("private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("generic assignment", re.compile(r"""(?i)(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-/+]{24,}['"]""")),
]

# REVIEWED EXCEPTIONS, pinned to (path, sha256-of-the-exact-match).
#
# WHY A HASH AND NOT A BETTER PATTERN. A Supabase ANON key and a Supabase
# SERVICE-ROLE key are both JWTs and are INDISTINGUISHABLE BY SHAPE. No refinement
# of the regex can admit the publishable one while still rejecting the dangerous
# one, which is why the rule above is deliberately coarse and stays that way.
# Pinning a single sha256 admits exactly one literal: every other JWT -- a
# service-role key, a rotated key, a key from another project -- still trips. The
# control loses nothing measurable, and the exception is one line a reviewer can
# evaluate whole.
#
# WHY THE PATH IS PART OF THE KEY. The same literal pasted anywhere else has not
# been reviewed, so it still trips and a human looks.
#
# WHY THE HASH AND NOT THE VALUE. So this scanner holds no credential of its own.
#
# ROTATION IS ENFORCED, NOT HOPED FOR. Change the key and the scan fails until the
# pin is updated in the same commit; the two cannot drift apart silently.
#
# DELETE THIS ENTRY WHEN the watcher migrates from the anon JWT to a Supabase
# PUBLISHABLE key (sb_publishable_...), which is not a JWT and matches nothing
# here, at which point the exception is unnecessary rather than merely justified.
# That is the condition, not an aspiration -- an exception with no stated end is
# how a tripwire rots.
ALLOWED_MATCHES = {
    # The Supabase ANON key, which already ships in the public site's browser
    # bundle. It buys one boolean. The workflow header states why the
    # service-role key was rejected and why an Actions secret was rejected too.
    (".github/workflows/deletion-orphan-watch.yml",
     "ca92a0db2b97706b6f1aa89e2ad2a2d07bb7c56f6a4368f65a7260eae8820642"),
}

SKIP_DIRS = {".git", "node_modules", ".venv", "__pycache__", ".next", "dist"}
SKIP_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".woff", ".woff2", ".ico", ".zip", ".csv"}
# This scanner and its docs legitimately contain pattern text.
SKIP_FILES = {"scripts/secrets_scan.py"}


def staged_files() -> list[Path]:
    out = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
                         capture_output=True, text=True, cwd=ROOT)
    return [ROOT / line for line in out.stdout.splitlines() if line.strip()]


def all_files() -> list[Path]:
    files = []
    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        files.append(p)
    return files


def main() -> int:
    targets = staged_files() if "--staged" in sys.argv else all_files()
    findings = []
    for f in targets:
        rel = f.relative_to(ROOT).as_posix()
        if rel in SKIP_FILES or f.suffix.lower() in SKIP_SUFFIXES or not f.exists():
            continue
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for name, pat in PATTERNS:
            for m in pat.finditer(text):
                if (rel, hashlib.sha256(m.group(0).encode("utf-8")).hexdigest()) in ALLOWED_MATCHES:
                    continue
                line_no = text.count("\n", 0, m.start()) + 1
                findings.append(f"{rel}:{line_no}  [{name}]")

    if findings:
        print("SECRETS SCAN FAILED — potential credentials found (values not shown):")
        for f in findings:
            print("  " + f)
        return 1
    print(f"secrets scan clean ({len(targets)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
