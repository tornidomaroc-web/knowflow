"""Design "C", PR 1: one side-by-side per screen, BEFORE on the left, AFTER on
the right, each at its full page height, with a plain label band above.

Usage: python3 scripts/design-c/compose.py DIR   (DIR holds before/ and after/)
Writes DIR/side-by-side/<name>.png and prints one line per screen with the
share of pixels that changed where the two overlap (a measure, not a gate).
"""
import glob
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

root = sys.argv[1]
out = os.path.join(root, 'side-by-side')
os.makedirs(out, exist_ok=True)
font = ImageFont.load_default()
names = sorted(os.path.basename(p) for p in glob.glob(os.path.join(root, 'after', '*.png')))
for n in names:
    a = Image.open(os.path.join(root, 'before', n)).convert('RGB')
    b = Image.open(os.path.join(root, 'after', n)).convert('RGB')
    gap, band = 24, 36
    w, h = a.width + gap + b.width, max(a.height, b.height) + band
    img = Image.new('RGB', (w, h), (128, 128, 128))
    img.paste(a, (0, band))
    img.paste(b, (a.width + gap, band))
    d = ImageDraw.Draw(img)
    d.text((12, 10), f'BEFORE (main)  {n}', fill=(255, 255, 255), font=font)
    d.text((a.width + gap + 12, 10), f'AFTER (this PR)  {n}', fill=(255, 255, 255), font=font)
    img.save(os.path.join(out, n), optimize=True)
    hh, ww = min(a.height, b.height), min(a.width, b.width)
    diff = ImageChops.difference(a.crop((0, 0, ww, hh)), b.crop((0, 0, ww, hh))).convert('L').point(lambda v: 255 if v > 24 else 0)
    share = diff.histogram()[255] / (ww * hh)
    print(f'{n}: before {a.size}, after {b.size}, {share:.1%} of the overlapping pixels changed')
print(f'{len(names)} side-by-sides in {out}')
