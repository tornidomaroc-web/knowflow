#!/usr/bin/env python3
"""
Reads every designed screenshot with Tesseract and refuses any that shows
an email address, a test account marker, or a price, plan, upgrade or free
word anywhere in the picture, the app screen included, not only the caption.
Two controls keep the reader honest: each screenshot must yield the word
"KnowFlow" (the mark above the caption), and a synthetic image carrying an
email address must be caught.

THE LANGUAGE OF THE READER (Step Store-Fix-3). A shot of the Arabic set (its
folder is `ar`) is read with Tesseract's Arabic model plus English
(`ara+eng`), the English set with `eng` alone. Read with `eng` only, Arabic
glyphs came out as Latin garbage, and capture 38646534381's ar/04 failed on a
"$4" that is not in the picture. The English, email and currency rules are
unchanged and apply to every reading. The Arabic set is read twice: the
whole picture, and the picture in overlapping bands 240 px tall (every 120
px), because Tesseract's layout pass skipped a planted word on the busy
Subjects screen that the bands read (ocr-proof run 38651347103). Its readings
are also held to the app's own Arabic stems (باقة, اشتراك, ترقية, مجان, سعر,
احتراف, خطة, شهريا), from scripts/lib/app-wording.mjs through
scripts/store-shots/arabic-stems.mjs, exactly and dot-blind (the Arabic model
read a planted مجاني as محانى), so a planted مجاني fails.

Usage: python3 scripts/store-shots/ocr_scan.py <png> [<png> ...]
Needs the tesseract binary with its eng and ara models (apt tesseract-ocr,
tesseract-ocr-eng, tesseract-ocr-ara), Node and Pillow.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STEMS = os.path.join(ROOT, 'scripts', 'store-shots', 'arabic-stems.mjs')
BAND, STEP = 240, 120
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+\s?@\s?[A-Za-z0-9-]+\s?\.\s?[A-Za-z]{2,}')
MARKERS = re.compile(r'tornido|kf0928|kf0929|kf1004|@gmail|\+kf\d', re.I)
WORDS = re.compile(r'\bfree\b|\bupgrade\b|\bprice\b|\bpricing\b|\bplan\b|\bpro\b|[$€]\s?\d+[.,]\d{2}|\d\s?(usd|eur|mad)\b|/\s?(mo|month|year)\b|per (month|year)', re.I)
# A bare currency figure counts only on a line with other text: the Settings
# tab's gear icon reads as a line holding only "$3" (run 38242025815).
CURRENCY = re.compile(r'[$€]\s?\d')
# The Arabic model wraps runs in invisible bidi marks (LRM, RLM, ALM and the
# embedding and isolate controls); they are removed before any rule, so the
# gear's lone "$3" line is still a lone figure ('\u200e$3', store-shots run
# 38656380280). They carry no letter, so no rule is loosened by it.
BIDI = re.compile(r'[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]')
fails = 0


def need(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    fails += 0 if cond else 1


def lang_of(path):
    return 'ara+eng' if os.path.basename(os.path.dirname(os.path.abspath(path))) == 'ar' else 'eng'


def models():
    r = subprocess.run(['tesseract', '--list-langs'], capture_output=True, text=True, encoding='utf-8')
    return set(l.strip() for l in (r.stdout + r.stderr).splitlines()[1:] if l.strip())


def read(path, lang='eng'):
    r = subprocess.run(['tesseract', path, '-', '-l', lang, '--psm', '11'], capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f'FAIL tesseract -l {lang} on {path}: {r.stderr.strip()[:300]}')
    return BIDI.sub('', r.stdout)


def bands(path, lang):
    """The picture read in overlapping horizontal bands."""
    im = Image.open(path).convert('RGB')
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        for top in range(0, max(1, im.height - BAND + STEP), STEP):
            b = os.path.join(tmp, f'band-{top}.png')
            im.crop((0, top, im.width, min(im.height, top + BAND))).save(b)
            out.append(read(b, lang))
    return '\n'.join(out)


def stems(text):
    """The app's Arabic stems on `text`: {"exact": [...], "dotBlind": [...]}."""
    r = subprocess.run(['node', STEMS], input=text, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f'FAIL the Arabic stems did not run: {r.stderr.strip()[:300]}')
    return json.loads(r.stdout)


# A missing model is a failure, never a fallback: without `ara` installed,
# `-l ara+eng` prints a warning, reads with English alone and still exits 0
# (store-shots run 38655549707 read the Arabic set that way).
need_models = {'eng'} | ({'ara'} if any(lang_of(p) != 'eng' for p in sys.argv[1:]) else set())
have = models()
need(need_models <= have, f"the reader has its models: needs {sorted(need_models)}, has {sorted(have)}")
if not need_models <= have:
    sys.exit(1)

with tempfile.TemporaryDirectory() as tmp:
    control = os.path.join(tmp, 'control.png')
    im = Image.new('RGB', (1320, 400), (20, 17, 13))
    ImageDraw.Draw(im).text((60, 150), 'someone.test@example.com', fill=(245, 240, 232), font=ImageFont.load_default(size=72))
    im.save(control)
    need(bool(EMAIL.search(read(control))), 'control: an email address drawn on a test image is read and caught')
need(stems('هذه الخدمة مجانية') == {'exact': ['مجاني'], 'dotBlind': ['مجاني']} and stems('محانى')['dotBlind'] == ['مجاني']
     and stems('ملخص التنفس الخلوي') == {'exact': [], 'dotBlind': []},
     'control: the Arabic stems catch مجانية exactly and محانى dot-blind, and pass a clean line')

for p in sys.argv[1:]:
    lang = lang_of(p)
    arabic = lang.startswith('ara')
    whole = read(p, lang)
    name = '/'.join(p.replace('\\', '/').split('/')[-2:])
    print(f'     {name}: read with -l {lang}' + (', whole and in bands' if arabic else ''))
    need('knowflow' in whole.lower().replace(' ', ''), f'{name}: the reader sees the KnowFlow mark')
    text = whole + ('\n' + bands(p, lang) if arabic else '')
    hit = EMAIL.search(text) or MARKERS.search(text)
    need(not hit, f'{name}: no email address or test account marker ({hit.group(0) if hit else "none"})')
    w = WORDS.search(text) or next((m for line in text.splitlines() if line.strip() and not re.fullmatch(r'\s*[$€]\s?\d+\s*', line)
                                     for m in [CURRENCY.search(line)] if m), None)
    ctx = w.string[max(0, w.start() - 40):w.end() + 40].replace('\n', ' | ') if w else ''
    need(not w, f'{name}: no price, plan, upgrade or free word ({w.group(0) if w else "none"}{": " + repr(ctx) if w else ""})')
    if arabic:
        s = stems(text)
        need(not s['exact'] and not s['dotBlind'], f"{name}: no Arabic plan, subscription, upgrade, price or free word (the app-wording.mjs stems, exact: {s['exact'] or 'none'}, dot-blind: {s['dotBlind'] or 'none'})")

print(f'\n{fails} failure(s)')
sys.exit(1 if fails else 0)
