"""Step Store-Fix-1, item 2: under the iPhone's status bar the app shows the
page's own colour and nothing else.

For every render render-fix.mjs made (its audit.json), every pixel of the
rows under the emulated top inset (62 pt = 186 px at 3x) must be the page's
background colour (body's computed background-color), within 2 per channel.
The summary renders scroll the page under the status bar first (the reading
proves text lies there), so a scrim that let anything through fails here.

RED BEFORE THE FIX: the old scrim was opaque for only its top 55%, so the
rows below about 39 pt held the page's text (capture 38579234295: ar/03).

Usage: python3 scripts/redesign-built/scrim_check.py DIR   (DIR/audit.json)
"""
import json
import os
import re
import sys

from PIL import Image

d = sys.argv[1]
rows = json.load(open(os.path.join(d, 'audit.json'), encoding='utf-8'))
fails = 0
for r in rows:
    m = re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', r['scrim']['page'])
    want = tuple(int(x) for x in m.groups())
    im = Image.open(os.path.join(d, r['file'])).convert('RGB')
    h = r['scrim']['rows']
    band = im.crop((0, 0, im.width, h))
    lo = [e[0] for e in band.getextrema()]
    hi = [e[1] for e in band.getextrema()]
    worst = max(max(abs(lo[i] - want[i]), abs(hi[i] - want[i])) for i in range(3))
    ok = worst <= 2
    fails += 0 if ok else 1
    print(('ok   ' if ok else 'FAIL ') + f"{r['file']}: rows 0-{h - 1} are the page colour {want} (worst channel off by {worst})")
print(f'\n{fails} failure(s) of {len(rows)} renders')
sys.exit(1 if fails else 0)
