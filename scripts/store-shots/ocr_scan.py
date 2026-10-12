#!/usr/bin/env python3
"""
Reads every designed screenshot with Tesseract (eng) and refuses any that shows
an email address, a test account marker, or a price, plan, upgrade or free
word anywhere in the picture, the app screen included, not only the caption.
Two controls keep the reader honest: each screenshot must yield the word
"KnowFlow" (the mark above the caption), and a synthetic image carrying an
email address must be caught.

Usage: python3 scripts/store-shots/ocr_scan.py <png> [<png> ...]
Needs the tesseract binary (apt tesseract-ocr) and Pillow.
"""
import os
import re
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

EMAIL = re.compile(r'[A-Za-z0-9._%+-]+\s?@\s?[A-Za-z0-9-]+\s?\.\s?[A-Za-z]{2,}')
MARKERS = re.compile(r'tornido|kf0928|kf0929|kf1004|@gmail|\+kf\d', re.I)
WORDS = re.compile(r'\bfree\b|\bupgrade\b|\bprice\b|\bpricing\b|\bplan\b|\bpro\b|[$€]\s?\d+[.,]\d{2}|\d\s?(usd|eur|mad)\b|/\s?(mo|month|year)\b|per (month|year)', re.I)
# A bare currency figure counts only on a line with other text: the Settings
# tab's gear icon reads as a line holding only "$3" (run 38242025815).
CURRENCY = re.compile(r'[$€]\s?\d')
fails = 0


def need(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    fails += 0 if cond else 1


def read(path):
    r = subprocess.run(['tesseract', path, '-', '-l', 'eng', '--psm', '11'], capture_output=True, text=True)
    return r.stdout


with tempfile.TemporaryDirectory() as tmp:
    control = os.path.join(tmp, 'control.png')
    im = Image.new('RGB', (1320, 400), (20, 17, 13))
    ImageDraw.Draw(im).text((60, 150), 'someone.test@example.com', fill=(245, 240, 232), font=ImageFont.load_default(size=72))
    im.save(control)
    need(bool(EMAIL.search(read(control))), 'control: an email address drawn on a test image is read and caught')

for p in sys.argv[1:]:
    text = read(p)
    name = '/'.join(p.replace('\\', '/').split('/')[-2:])
    need('knowflow' in text.lower().replace(' ', ''), f'{name}: the reader sees the KnowFlow mark')
    hit = EMAIL.search(text) or MARKERS.search(text)
    need(not hit, f'{name}: no email address or test account marker ({hit.group(0) if hit else "none"})')
    w = WORDS.search(text) or next((m for line in text.splitlines() if line.strip() and not re.fullmatch(r'\s*[$€]\s?\d+\s*', line)
                                     for m in [CURRENCY.search(line)] if m), None)
    ctx = w.string[max(0, w.start() - 40):w.end() + 40].replace('\n', ' | ') if w else ''
    need(not w, f'{name}: no price, plan, upgrade or free word ({w.group(0) if w else "none"}{": " + repr(ctx) if w else ""})')

print(f'\n{fails} failure(s)')
sys.exit(1 if fails else 0)
