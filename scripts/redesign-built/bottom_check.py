"""Step Store-Fix-2, item 4 (the web half): at the end of Settings the bottom
of the screen is the page's colour.

For every render of render-fix2.mjs that names `bottom` in its audit.json
(the settings-end renders), no pixel of the bottom rows (the iPhone's
home-indicator inset, 34 pt = 102 px at 3x) may be lighter than the page's
background colour by more than 2 on any channel, and none darker by more than
24: the floating tab bar's drop shadow reaches into those rows and darkens
them (by up to 7, run 38639956428), which is the page's own paint. On the phone those rows lay outside
the page and showed the web view's white (relay runs 38592947638 and 38610848524); the
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
    lighter = max(ext[i][1] - want[i] for i in range(3))
    darker = max(want[i] - ext[i][0] for i in range(3))
    ok = lighter <= 2 and darker <= 24
    fails += 0 if ok else 1
    print(('ok   ' if ok else 'FAIL ') + f"{r['file']}: the bottom {h} rows are the page colour {want}, nothing lighter (lightest +{lighter}, darkest -{darker}, the tab bar's shadow)")
print(f'\n{fails} failure(s) of {len(rows)} renders')
sys.exit(1 if fails else 0)
