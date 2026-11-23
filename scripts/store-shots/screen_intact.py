#!/usr/bin/env python3
"""
Proves that nothing the design adds (caption, mark, glow, rings) covers the app
screen in any designed screenshot: the screen area of each PNG is compared
with its raw capture from docs/store/screenshots, scaled the way the page
scales it (1320 x 2868 into 1000 x 2173 at x 160, y 612, render.mjs), inside
the screen's rounded corners. More than 0.5 % of those pixels differing by
more than 48 of 255 fails the file. A negative control first paints a caption
sized block onto one screen and must be caught, so a blind check cannot pass.

The set of designed PNGs must equal the entries of captions.json, ten in all.

Usage: python3 scripts/store-shots/screen_intact.py <dir with en/ and ar/>
Needs Pillow (pinned in .github/workflows/store-shots.yml).
"""
import json
import os
import sys
from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(ROOT, 'docs', 'store', 'screenshots')
CAPTIONS = os.path.join(ROOT, 'docs', 'store', 'screenshots-designed', 'captions.json')
X, Y, SW, SH, RADIUS = 160, 612, 1000, 2173, 140
BOUND = 0.005

mask = Image.new('L', (SW, SH), 0)
ImageDraw.Draw(mask).rounded_rectangle((6, 6, SW - 7, SH - 7), RADIUS - 6, fill=255)
inside = mask.histogram()[255]


def changed(designed, raw_path):
    d = designed.convert('RGB').crop((X, Y, X + SW, Y + SH))
    r = Image.open(raw_path).convert('RGB').resize((SW, SH), Image.LANCZOS)
    diff = ImageChops.difference(d, r).convert('L').point(lambda v: 255 if v > 48 else 0)
    hit = ImageChops.multiply(diff, mask)
    return hit.histogram()[255] / inside


def layout_mode(root):
    """The 1.1 set (item 4i): the geometry and the raw capture of each render
    come from its layout file (<root>/_layout/<locale>-<file>.json, written by
    scripts/store-shots/frame-1.1.mjs), at either size; the renders must be
    exactly the twelve entries of captions-1.1.json."""
    caps = json.load(open(os.path.join(ROOT, 'docs', 'store', 'screenshots-designed', 'captions-1.1.json'), encoding='utf-8'))
    fails = 0
    expected = {f'{loc}/{e["file"]}' for loc in ('en', 'ar') for e in caps[loc]}
    found = {f'{loc}/{f}' for loc in ('en', 'ar') if os.path.isdir(os.path.join(root, loc))
             for f in os.listdir(os.path.join(root, loc)) if f.endswith('.png')}
    ok = found == expected and len(expected) == 12
    print(('ok   ' if ok else 'FAIL ') + f'{root}: the PNGs are exactly the twelve entries of captions-1.1.json (missing {sorted(expected - found)}, extra {sorted(found - expected)})')
    fails += 0 if ok else 1

    def changed11(im, d):
        g = d['geometry']['screen']
        x, y, w, h, r = g['x'], g['y'], g['w'], g['h'], g['r']
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle((6, 6, w - 7, h - 7), max(1, r - 6), fill=255)
        crop = im.convert('RGB').crop((x, y, x + w, y + h))
        raw = Image.open(os.path.join(ROOT, d['raw'])).convert('RGB').resize((w, h), Image.LANCZOS)
        diff = ImageChops.difference(crop, raw).convert('L').point(lambda v: 255 if v > 48 else 0)
        return ImageChops.multiply(diff, m).histogram()[255] / m.histogram()[255]

    lays = {}
    for key in sorted(expected & found):
        loc, name = key.split('/')
        lays[key] = json.load(open(os.path.join(root, '_layout', f'{loc}-{name}.json'), encoding='utf-8'))
    if lays:
        first = sorted(lays)[0]
        loc, name = first.split('/')
        d = lays[first]
        g = d['geometry']['screen']
        control = Image.open(os.path.join(root, loc, name)).convert('RGB')
        ImageDraw.Draw(control).rectangle((g['x'] + g['w'] // 5, g['y'] + g['h'] // 5, g['x'] + g['w'] * 4 // 5, g['y'] + g['h'] // 5 + 120), fill=(122, 88, 14))
        ratio = changed11(control, d)
        ok = ratio > BOUND
        print(('ok   ' if ok else 'FAIL ') + f'negative control: a block painted on {first} is caught ({ratio:.4%} > {BOUND:.1%})')
        fails += 0 if ok else 1
    for key, d in lays.items():
        loc, name = key.split('/')
        im = Image.open(os.path.join(root, loc, name))
        ok_size = list(im.size) == d['size']
        ratio = changed11(im, d)
        ok = ok_size and ratio <= BOUND
        print(('ok   ' if ok else 'FAIL ') + f"{d['size'][0]}x{d['size'][1]} {key}: the app screen is uncovered ({ratio:.4%} of screen pixels differ from {d['raw']})")
        fails += 0 if ok else 1
    print(f'\n{fails} failure(s)')
    sys.exit(1 if fails else 0)


if sys.argv[1] == '--layout':
    layout_mode(sys.argv[2])

root = sys.argv[1]
captions = json.load(open(CAPTIONS, encoding='utf-8'))
fails = 0
expected = {f'{loc}/{e["file"]}' for loc in ('en', 'ar') for e in captions[loc]}
found = {f'{loc}/{f}' for loc in ('en', 'ar') if os.path.isdir(os.path.join(root, loc))
         for f in os.listdir(os.path.join(root, loc)) if f.endswith('.png')}
ok = found == expected and len(expected) == 10
print(('ok   ' if ok else 'FAIL ') + f'{root}: the PNGs are exactly the ten entries of captions.json (missing {sorted(expected - found)}, extra {sorted(found - expected)})')
fails += 0 if ok else 1

first = sorted(expected)[0]
loc, name = first.split('/')
control = Image.open(os.path.join(root, loc, name)).convert('RGB')
ImageDraw.Draw(control).rectangle((X + 200, Y + 400, X + 800, Y + 520), fill=(212, 165, 72))
ratio = changed(control, os.path.join(RAW, loc, name))
ok = ratio > BOUND
print(('ok   ' if ok else 'FAIL ') + f'negative control: a 600 x 120 block painted on {first} is caught ({ratio:.4%} > {BOUND:.1%})')
fails += 0 if ok else 1

for key in sorted(expected & found):
    loc, name = key.split('/')
    ratio = changed(Image.open(os.path.join(root, loc, name)), os.path.join(RAW, loc, name))
    ok = ratio <= BOUND
    print(('ok   ' if ok else 'FAIL ') + f'{key}: the app screen is uncovered ({ratio:.4%} of screen pixels differ from the raw capture)')
    fails += 0 if ok else 1

print(f'\n{fails} failure(s)')
sys.exit(1 if fails else 0)
