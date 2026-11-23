#!/usr/bin/env python3
"""
Check (iii) of the 1.1 screenshot frame (item 4i): the caption's ink and its
gold phrase reach a contrast of at least 4.5:1 on the ground behind them,
read from the RENDERED PIXELS, not from the CSS. For each word box the
layout probe wrote (<out>/_layout/<locale>-<file>.json, by
scripts/store-shots/frame-1.1.mjs), the text colour is the mean of its
darkest 3 % of pixels (the cores of the strokes) and the ground the mean of
its brightest 30 %; the WCAG 2 ratio of the two must be >= 4.5 for every
box. 4.5, not the 3:1 large-text allowance: the 1206 x 2622 render is the
smaller one, and the store shrinks both again.

  contrast.py <out dir>                  every render must pass
  contrast.py --expect-fail <plants dir> every plant under it whose layout
                                         says expect=contrast must FAIL
                                         (the old gold #d4a548 on the light
                                         ground, the ink made light)

Needs Pillow (pinned in .github/workflows/store-shots.yml).
"""
import glob
import json
import os
import sys
from PIL import Image

MIN = 4.5


def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def ratio(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def box_contrast(im, r):
    x, y, w, h = r['x'], r['y'], r['w'], r['h']
    crop = im.crop((max(0, x), max(0, y), min(im.width, x + w), min(im.height, y + h)))
    px = list(crop.get_flattened_data() if hasattr(crop, 'get_flattened_data') else crop.getdata())
    if len(px) < 50:
        return None, None, None
    px.sort(key=lum)
    k = max(1, len(px) * 3 // 100)
    dark = px[:k]
    light = px[-max(1, len(px) * 30 // 100):]
    mean = lambda s: tuple(sum(c[i] for c in s) / len(s) for i in range(3))
    ink, ground = mean(dark), mean(light)
    return ratio(ink, ground), ink, ground


def worst(png, layout):
    im = Image.open(png).convert('RGB')
    out = {}
    for kind in ('inkRects', 'goldRects'):
        best = None
        for r in layout['layout'][kind]:
            c, ink, ground = box_contrast(im, r)
            if c is not None and (best is None or c < best[0]):
                best = (c, ink, ground)
        out[kind] = best
    return out


def fmt(c):
    return '#%02x%02x%02x' % tuple(round(v) for v in c)


def scan(root):
    """(name, kind, result) for every render with a layout file under root."""
    rows = []
    for lay in sorted(glob.glob(os.path.join(root, '**', '_layout', '*.json'), recursive=True)):
        d = json.load(open(lay, encoding='utf-8'))
        png = os.path.join(os.path.dirname(os.path.dirname(lay)), d['locale'], d['file'])
        rows.append((d, png, worst(png, d)))
    return rows


if __name__ == '__main__':
    expect_fail = sys.argv[1] == '--expect-fail'
    root = sys.argv[2] if expect_fail else sys.argv[1]
    fails = 0
    rows = scan(root)
    if not rows:
        print(f'FAIL no layout file under {root}')
        sys.exit(1)
    for d, png, res in rows:
        name = f"{d['size'][0]}x{d['size'][1]} {d['locale']}/{d['file']}"
        if expect_fail:
            if d.get('expect') != 'contrast':
                continue
            low = [k for k, v in res.items() if v and v[0] < MIN]
            ok = bool(low)
            print(('ok   ' if ok else 'FAIL ') + f"plant {d.get('plant')} ({name}): caught, " +
                  ', '.join(f"{k[:-5]} {v[0]:.2f}:1 ({fmt(v[1])} on {fmt(v[2])})" for k, v in res.items() if v))
        else:
            ok = all(v and v[0] >= MIN for v in res.values() if v is not None) and res['inkRects'] and res['goldRects']
            print(('ok   ' if ok else 'FAIL ') + f'{name}: ' +
                  ', '.join(f"{k[:-5]} {v[0]:.2f}:1 ({fmt(v[1])} on {fmt(v[2])})" if v else f'{k[:-5]} none' for k, v in res.items()))
        fails += 0 if ok else 1
    if expect_fail and not any(d.get('expect') == 'contrast' for d, _, _ in rows):
        print('FAIL no contrast plant found')
        fails += 1
    print(f'\n{fails} failure(s)')
    sys.exit(1 if fails else 0)
