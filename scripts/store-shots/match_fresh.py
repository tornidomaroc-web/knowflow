#!/usr/bin/env python3
"""
The committed framed screenshots must be the script's output (item 4i, PR 2;
the 1.0.1 rule of store-shots.yml, extended to the 1.1 set at both sizes).

  match_fresh.py COMMITTED FRESH --expect N
      every PNG under COMMITTED (recursive; folders starting with _ skipped)
      has its twin at the same relative path under FRESH and differs from it
      only by rendering noise: at most 1.5 % of the pixels differing by more
      than 24 of 255 on any channel; the same files on both sides; exactly N.
  match_fresh.py --self-test DIR
      negative controls on the PNGs of DIR (any renders): a copy matches;
      one image with a block painted over it, one image missing, and one
      extra image must each FAIL.

Pillow (store-shots.yml pins it).
"""
import os
import shutil
import sys
import tempfile

from PIL import Image, ImageChops, ImageDraw

LIMIT = 0.015


def pngs(root):
    out = []
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if not x.startswith('_'))
        out += [os.path.relpath(os.path.join(d, f), root).replace('\\', '/') for f in sorted(files) if f.endswith('.png')]
    return sorted(out)


def compare(committed, fresh, expect, quiet=False):
    say = (lambda m: None) if quiet else print
    a, b = pngs(committed), pngs(fresh)
    fails = 0
    if len(a) != expect:
        say(f'FAIL {committed}: {len(a)} PNGs, {expect} expected')
        fails += 1
    for rel in sorted(set(a) - set(b)):
        say(f'FAIL {rel}: committed, but the fresh render has no such file')
        fails += 1
    for rel in sorted(set(b) - set(a)):
        say(f'FAIL {rel}: rendered fresh, but not committed')
        fails += 1
    for rel in sorted(set(a) & set(b)):
        x = Image.open(os.path.join(committed, rel)).convert('RGB')
        y = Image.open(os.path.join(fresh, rel)).convert('RGB')
        if x.size != y.size:
            say(f'FAIL {rel}: {x.size} committed, {y.size} fresh')
            fails += 1
            continue
        diff = ImageChops.difference(x, y).convert('L').point(lambda v: 255 if v > 24 else 0)
        ratio = diff.histogram()[255] / (x.width * x.height)
        ok = ratio <= LIMIT
        say(('ok   ' if ok else 'FAIL ') + f'{rel}: {ratio:.4%} of pixels differ from the fresh render')
        fails += 0 if ok else 1
    return fails


def self_test(src):
    files = pngs(src)
    if len(files) < 2:
        sys.exit(f'FAIL --self-test needs at least two PNGs under {src}')
    fails = 0
    with tempfile.TemporaryDirectory() as tmp:
        def copy(name):
            d = os.path.join(tmp, name)
            for rel in files:
                os.makedirs(os.path.dirname(os.path.join(d, rel)), exist_ok=True)
                shutil.copy(os.path.join(src, rel), os.path.join(d, rel))
            return d
        a = copy('a')
        cases = []
        b = copy('same')
        cases.append(('an identical copy', b, 0))
        c = copy('painted')
        im = Image.open(os.path.join(c, files[0])).convert('RGB')
        ImageDraw.Draw(im).rectangle([0, 0, im.width // 3, im.height // 10], fill=(255, 0, 255))
        im.save(os.path.join(c, files[0]))
        cases.append((f'{files[0]} with a block painted over it', c, 1))
        d = copy('missing')
        os.remove(os.path.join(d, files[-1]))
        cases.append((f'{files[-1]} missing from the fresh render', d, 1))
        e = copy('extra')
        shutil.copy(os.path.join(e, files[0]), os.path.join(e, os.path.dirname(files[0]), 'zz-extra.png'))
        cases.append(('an extra fresh file', e, 1))
        for label, other, want_fail in cases:
            n = compare(a, other, len(files), quiet=True)
            ok = (n > 0) == bool(want_fail)
            print(('ok   ' if ok else 'FAIL ') + f"negative control, {label}: {'caught' if n else 'passes'} ({n} failure(s))")
            fails += 0 if ok else 1
    return fails


if __name__ == '__main__':
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(1 if self_test(sys.argv[2]) else 0)
    if len(sys.argv) != 5 or sys.argv[3] != '--expect':
        sys.exit('usage: match_fresh.py COMMITTED FRESH --expect N | --self-test DIR')
    n = compare(sys.argv[1], sys.argv[2], int(sys.argv[4]))
    print(f'\n{n} failure(s)')
    sys.exit(1 if n else 0)
