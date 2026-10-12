#!/usr/bin/env python3
"""
Step Redesign-2: the side-by-side of each mockup (docs/design/redesign-mockups)
with the built screen (docs/design/redesign-built), mockup on the left, built
on the right, each 1320 x 2868 scaled to half, a caption strip above. Written
to docs/design/redesign-built/side-by-side/<mockup name>.png.

Usage: python3 scripts/redesign-built/compare.py [built dir] [out dir]
Needs Pillow (pinned in the workflow).
"""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MOCK = os.path.join(ROOT, 'docs', 'design', 'redesign-mockups')
BUILT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs', 'design', 'redesign-built')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BUILT, 'side-by-side')
SCREEN = {'1-home': 'home', '2-subjects': 'subjects', '3-subject': 'subject', '4-ask': 'ask', '5-summary': 'summary', '6-settings': 'settings'}

os.makedirs(OUT, exist_ok=True)
made = 0
for f in sorted(os.listdir(MOCK)):
    if not f.endswith('.png'):
        continue
    locale, theme, rest = f[:-4].split('-', 2)
    built_name = f'{locale}-{theme}-{SCREEN[rest]}.png'
    bp = os.path.join(BUILT, built_name)
    if not os.path.exists(bp):
        print(f'skip {f}: no {built_name}')
        continue
    a = Image.open(os.path.join(MOCK, f)).convert('RGB').resize((660, 1434), Image.LANCZOS)
    b = Image.open(bp).convert('RGB').resize((660, 1434), Image.LANCZOS)
    sheet = Image.new('RGB', (660 * 2 + 30, 1434 + 60), (88, 84, 78))
    d = ImageDraw.Draw(sheet)
    d.text((16, 20), f'mockup  {f}', fill=(245, 240, 232))
    d.text((660 + 30 + 16, 20), f'built  {built_name}', fill=(245, 240, 232))
    sheet.paste(a, (0, 60))
    sheet.paste(b, (660 + 30, 60))
    sheet.save(os.path.join(OUT, f))
    made += 1
print(f'{made} side-by-side sheets')
