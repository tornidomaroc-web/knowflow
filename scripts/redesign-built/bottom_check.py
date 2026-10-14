"""Step Store-Fix-2, item 4 (the web half): at the end of Settings the bottom
of the screen is the page's colour.

For every render of render-fix2.mjs that names `bottom` in its audit.json
(the settings-end renders), every pixel of the bottom rows (the iPhone's
home-indicator inset, 34 pt = 102 px at 3x) must be the page's background
colour, within 2 per channel. On the phone those rows lay outside the page and
showed the web view's white (relay runs 38592947638 and 38610848524); the
native half is checked on the device by ios-signed-in.yml.

Usage: python3 scripts/redesign-built/bottom_check.py DIR   (DIR/audit.json)
"""
import json
import os
import re
import sys

from PIL import Image

d = sys.argv[1]
rows = [r for r in json.load(open(os.path.join(d, 'audit.json'), encoding='utf-8')) if r.get('bottom')]
fails = 0 if rows else 1
for r in rows:
    want = tuple(int(x) for x in re.match(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', r['bottom']['page']).groups())
    im = Image.open(os.path.join(d, r['file'])).convert('RGB')
    h = r['bottom']['rows']
    band = im.crop((0, im.height - h, im.width, im.height))
    ext = band.getextrema()
    worst = max(max(abs(ext[i][0] - want[i]), abs(ext[i][1] - want[i])) for i in range(3))
    ok = worst <= 2
    fails += 0 if ok else 1
    print(('ok   ' if ok else 'FAIL ') + f"{r['file']}: the bottom {h} rows are the page colour {want} (worst channel off by {worst})")
print(f'\n{fails} failure(s) of {len(rows)} renders')
sys.exit(1 if fails else 0)
