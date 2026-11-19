#!/usr/bin/env python3
"""Proof 7, purpose strings (the owner's review of PR #340 at 3b2fe21).

The built app's voice permission texts, read from the bundle itself, must be
the owner's approved values in docs/copy/ARABIC_STRINGS_app_v13.md, byte for
byte: NSMicrophoneUsageDescription and NSSpeechRecognitionUsageDescription in

  * Info.plist (English),
  * en.lproj/InfoPlist.strings (English),
  * ar.lproj/InfoPlist.strings (Arabic).

Before this, ios-smoke only checked that the keys exist and are non-empty, so
a text edited in ios/ alone (or a stale build) would ship unnoticed.

The files are parsed, not grepped: Info.plist with plistlib (XML or binary),
each InfoPlist.strings with plistlib when Xcode compiled it to a binary plist
(the build default), else as the old-style text format of the source tree.

Usage: ios-purpose-strings-check.py <App.app> <ARABIC_STRINGS_app_v13.md>
Exit 0 when all six match; 1 with the first differing byte of each mismatch.
"""
import plistlib
import re
import sys
from pathlib import Path

KEYS = ("NSMicrophoneUsageDescription", "NSSpeechRecognitionUsageDescription")


def approved(md_path):
    """The `(en)` and `(ar)` lines of the two keys, as the batch file stores them."""
    out = {}
    for line in Path(md_path).read_text(encoding="utf-8").splitlines():
        m = re.match(r"^- `(\w+)` \((en|ar)\): (.*)$", line)
        if m and m.group(1) in KEYS:
            out[(m.group(1), m.group(2))] = m.group(3)
    missing = [f"{k} ({l})" for k in KEYS for l in ("en", "ar") if (k, l) not in out]
    if missing:
        sys.exit(f"FAIL: the approved file holds no line for {', '.join(missing)}")
    return out


_ESC = {'"': '"', "\\": "\\", "n": "\n", "t": "\t", "r": "\r", "'": "'"}


def _unescape(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c != "\\":
            out.append(c)
            i += 1
            continue
        n = s[i + 1] if i + 1 < len(s) else ""
        if n in ("U", "u") and re.match(r"[0-9A-Fa-f]{4}", s[i + 2:i + 6]):
            out.append(chr(int(s[i + 2:i + 6], 16)))
            i += 6
        elif n in _ESC:
            out.append(_ESC[n])
            i += 2
        else:
            raise ValueError(f"unknown escape \\{n}")
    return "".join(out)


def read_strings(path):
    """An InfoPlist.strings: a binary or XML plist (compiled), else the text format."""
    raw = Path(path).read_bytes()
    try:
        d = plistlib.loads(raw)
        if isinstance(d, dict):
            return d
    except Exception:
        pass
    for enc in ("utf-8", "utf-16"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"{path}: not UTF-8 or UTF-16")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    pairs = re.findall(r'"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;', text)
    return {_unescape(k): _unescape(v) for k, v in pairs}


def first_diff(a, b):
    ab, bb = a.encode("utf-8"), b.encode("utf-8")
    for i, (x, y) in enumerate(zip(ab, bb)):
        if x != y:
            return f"byte {i}: built 0x{x:02x}, approved 0x{y:02x}"
    return f"lengths differ: built {len(ab)} bytes, approved {len(bb)} bytes"


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    app, md = Path(sys.argv[1]), sys.argv[2]
    want = approved(md)
    with open(app / "Info.plist", "rb") as f:
        info = plistlib.load(f)
    sources = {
        "Info.plist": ("en", info),
        "en.lproj/InfoPlist.strings": ("en", read_strings(app / "en.lproj" / "InfoPlist.strings")),
        "ar.lproj/InfoPlist.strings": ("ar", read_strings(app / "ar.lproj" / "InfoPlist.strings")),
    }
    bad = 0
    for where, (lang, d) in sources.items():
        for k in KEYS:
            got, ok = d.get(k), want[(k, lang)]
            if isinstance(got, str) and got.encode("utf-8") == ok.encode("utf-8"):
                print(f"ok   7. {where} {k} is the approved ({lang}) text, byte for byte ({len(ok.encode('utf-8'))} bytes)")
            else:
                bad += 1
                why = "missing" if not isinstance(got, str) else first_diff(got, ok)
                print(f"FAIL 7. {where} {k} is not the approved ({lang}) text in {md}: {why}")
    if bad:
        sys.exit(1)
    print("PURPOSE STRINGS OK: six of six are the approved v13 texts")


if __name__ == "__main__":
    main()
