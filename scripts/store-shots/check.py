#!/usr/bin/env python3
"""
The checks on the designed App Store screenshots (docs/store/screenshots-designed),
standard library only.

1. Every PNG given is exactly 1320 x 2868, 8 bits per sample, colour type 2
   (RGB), so no alpha channel (App Store Connect refuses alpha).
2. The font the pages use, Rubik (fonts/rubik/Rubik[wght].ttf), has a glyph for
   every letter of every caption in captions.json, read from the font's own
   cmap table, so no caption letter can fall back to another font. Chrome
   shapes Arabic through the font's GSUB table, which the file carries.
3. The licence file sits next to the font.
4. No caption carries a dash, a price or a plan word.

Usage: python3 scripts/store-shots/check.py <png> [<png> ...]
"""
import json
import os
import re
import struct
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DESIGNED = os.path.join(ROOT, 'docs', 'store', 'screenshots-designed')
FONT = os.path.join(DESIGNED, 'fonts', 'rubik', 'Rubik[wght].ttf')
fails = []


def need(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def png_header(path):
    with open(path, 'rb') as f:
        d = f.read(33)
    if d[:8] != b'\x89PNG\r\n\x1a\n' or d[12:16] != b'IHDR':
        return None
    w, h, depth, ctype = struct.unpack('>IIBB', d[16:26])
    return w, h, depth, ctype


def cmap_codepoints(path):
    d = open(path, 'rb').read()
    n = struct.unpack('>H', d[4:6])[0]
    tables = {d[12 + 16 * i:16 + 16 * i].decode('latin1'): struct.unpack('>II', d[20 + 16 * i:28 + 16 * i]) for i in range(n)}
    off, ln = tables['cmap']
    c = d[off:off + ln]
    cov = set()
    for i in range(struct.unpack('>H', c[2:4])[0]):
        _pid, _eid, so = struct.unpack('>HHI', c[4 + 8 * i:12 + 8 * i])
        fmt = struct.unpack('>H', c[so:so + 2])[0]
        if fmt == 4:
            segx2 = struct.unpack('>H', c[so + 6:so + 8])[0]
            seg = segx2 // 2
            ends = struct.unpack('>%dH' % seg, c[so + 14:so + 14 + segx2])
            starts = struct.unpack('>%dH' % seg, c[so + 16 + segx2:so + 16 + 2 * segx2])
            for s, e in zip(starts, ends):
                if s != 0xFFFF:
                    cov.update(range(s, e + 1))
        elif fmt == 12:
            for g in range(struct.unpack('>I', c[so + 12:so + 16])[0]):
                s, e, _ = struct.unpack('>III', c[so + 16 + 12 * g:so + 28 + 12 * g])
                cov.update(range(s, e + 1))
    return cov, set(tables)


# 1. The PNGs.
pngs = sys.argv[1:]
need(len(pngs) > 0, 'at least one PNG to check')
for p in pngs:
    hdr = png_header(p)
    rel = os.path.relpath(p, ROOT)
    need(hdr is not None, f'{rel}: a PNG')
    if hdr:
        w, h, depth, ctype = hdr
        need((w, h) == (1320, 2868), f'{rel}: 1320 x 2868 (got {w} x {h})')
        need(depth == 8 and ctype == 2, f'{rel}: 8-bit RGB with no alpha channel (depth {depth}, colour type {ctype})')

# 2. The font covers every caption letter; 3. the licence is there; 4. the words.
captions = json.load(open(os.path.join(DESIGNED, 'captions.json'), encoding='utf-8'))
cov, tables = cmap_codepoints(FONT)
need('GSUB' in tables and 'GPOS' in tables, 'Rubik carries GSUB and GPOS (Arabic shaping and positioning)')
need(os.path.isfile(os.path.join(os.path.dirname(FONT), 'OFL.txt')), 'OFL.txt sits next to the font')
forbidden = re.compile(r'—|–|\$|\bfree\b|\bpro\b|\bplan\b|upgrade|price|مجان|الترقية|باقة|سعر', re.I)
for locale in ('en', 'ar'):
    for entry in captions[locale]:
        text = entry['caption'].replace('|', '')
        missing = sorted({ch for ch in text if not ch.isspace() and ord(ch) not in cov})
        need(not missing, f'{locale}/{entry["file"]}: every caption letter has a Rubik glyph (missing: {missing})')
        need(not forbidden.search(text), f'{locale}/{entry["file"]}: no dash, price or plan word in the caption')
        need(len(text.split()) <= 6, f'{locale}/{entry["file"]}: caption is short ({len(text.split())} words)')

print(f'\n{len(fails)} failure(s)')
sys.exit(1 if fails else 0)
