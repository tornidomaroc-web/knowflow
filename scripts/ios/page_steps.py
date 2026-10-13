"""The page steps of the iOS harness runs (ios-smoke.yml, ios-signed-in.yml):
did each step that opens a page actually leave the page it started on and
reach its own?

A page step is a step whose JSON names `until`, the pattern its URL must
match. The harness (MainViewController.swift, Smoke.runNext) reads the URL
before the step's script, then waits until the URL differs from that start,
matches `until` and the document is complete, up to `timeout` ms (20 s by
default), and only then lets the step's `wait` run and takes the reading. The
reading carries `nav`: {start, until, arrived, ms}.

A page step FAILS here, never skips, when:
  - it has no reading at all;
  - the harness says it did not arrive before the timeout;
  - its reading is still on the URL it started from;
  - its reading is on a URL its `until` does not match.

Readings from before `nav` existed (run 38426358277 and earlier) are judged
the same way, with the previous reading's URL as the start.

Usage: python3 scripts/ios/page_steps.py smoke.jsonl steps.json [steps.json ...]
(several steps files when the readings of several sets were concatenated, as
in the App Store capture). Exit 1 on any failure. Other checks import
`page_step_checks`.
"""
import json
import re
import sys


def page_step_checks(rows, steps_lists):
    """Return [(ok, message)] for every page step in the steps lists."""
    until = {}
    for steps in steps_lists:
        for s in steps:
            if s.get('until'):
                until[s['name']] = s['until']
    out = []
    seen = set()
    prev_href = None
    for r in rows:
        name = r.get('step')
        href = (r.get('probe') or {}).get('href') or ''
        if name in until:
            seen.add(name)
            nav = r.get('nav')
            start = nav.get('start') if nav else prev_href
            arrived = nav.get('arrived') if nav else True
            ms = f"{nav.get('ms')} ms" if nav else 'no nav record'
            ok = bool(arrived) and href != (start or '') and re.search(until[name], href) is not None
            out.append((ok, f"page step {name} left {start} for {until[name]} ({ms}): {href}"))
        prev_href = href or prev_href
    for name in until:
        if name not in seen:
            out.append((False, f"page step {name} has no reading"))
    return out


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit('usage: page_steps.py smoke.jsonl steps.json [steps.json ...]')
    sys.stdout.reconfigure(encoding='utf-8')
    rows = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
    lists = [json.load(open(p, encoding='utf-8')) for p in sys.argv[2:]]
    checks = page_step_checks(rows, lists)
    for ok, msg in checks:
        print(('ok   ' if ok else 'FAIL ') + msg)
    bad = sum(1 for ok, _ in checks if not ok)
    print(f"\n{bad} page step failure(s) of {len(checks)}")
    sys.exit(1 if bad else 0)
