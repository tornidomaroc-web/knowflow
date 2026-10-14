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
unchanged and apply to both readings. The Arabic reading is also held to the
app's own Arabic stems (باقة, اشتراك, ترقية, مجان, سعر, احتراف, خطة,
شهريا), taken from scripts/lib/app-wording.mjs through Node, one source, so a
planted مجاني fails.

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
WORDING = os.path.join(ROOT, 'scripts', 'lib', 'app-wording.mjs')
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+\s?@\s?[A-Za-z0-9-]+\s?\.\s?[A-Za-z]{2,}')
MARKERS = re.compile(r'tornido|kf0928|kf0929|kf1004|@gmail|\+kf\d', re.I)
WORDS = re.compile(r'\bfree\b|\bupgrade\b|\bprice\b|\bpricing\b|\bplan\b|\bpro\b|[$€]\s?\d+[.,]\d{2}|\d\s?(usd|eur|mad)\b|/\s?(mo|month|year)\b|per (month|year)', re.I)
# A bare currency figure counts only on a line with other text: the Settings
# tab's gear icon reads as a line holding only "$3" (run 38242025815).
CURRENCY = re.compile(r'[$€]\s?\d')
ARABIC = re.compile(r'[؀-ۿ]')
fails = 0


def need(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    fails += 0 if cond else 1


def lang_of(path):
    return 'ara+eng' if os.path.basename(os.path.dirname(os.path.abspath(path))) == 'ar' else 'eng'


def read(path, lang='eng'):
    r = subprocess.run(['tesseract', path, '-', '-l', lang, '--psm', '11'], capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f'FAIL tesseract -l {lang} on {path}: {r.stderr.strip()[:300]}')
    return r.stdout


def arabic_hits(text):
    """The rules of the app's wording rule whose names are Arabic."""
    js = ("import { kfWording } from " + json.dumps('file://' + WORDING.replace(os.sep, '/')) + ";"
          "let t='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>t+=d).on('end',()=>console.log(JSON.stringify(kfWording(t))));")
    r = subprocess.run(['node', '--input-type=module', '-e', js], input=text, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f'FAIL the wording rule did not run: {r.stderr.strip()[:300]}')
    return [h for h in json.loads(r.stdout) if ARABIC.search(h)]


with tempfile.TemporaryDirectory() as tmp:
    control = os.path.join(tmp, 'control.png')
    im = Image.new('RGB', (1320, 400), (20, 17, 13))
    ImageDraw.Draw(im).text((60, 150), 'someone.test@example.com', fill=(245, 240, 232), font=ImageFont.load_default(size=72))
    im.save(control)
    need(bool(EMAIL.search(read(control))), 'control: an email address drawn on a test image is read and caught')
need(arabic_hits('هذه الخدمة مجانية') == ['مجاني'] and arabic_hits('ملخص التنفس الخلوي') == [], 'control: the Arabic stems catch مجانية and pass a clean line')

for p in sys.argv[1:]:
    lang = lang_of(p)
    text = read(p, lang)
    name = '/'.join(p.replace('\\', '/').split('/')[-2:])
    print(f'     {name}: read with -l {lang}')
    need('knowflow' in text.lower().replace(' ', ''), f'{name}: the reader sees the KnowFlow mark')
    hit = EMAIL.search(text) or MARKERS.search(text)
    need(not hit, f'{name}: no email address or test account marker ({hit.group(0) if hit else "none"})')
    w = WORDS.search(text) or next((m for line in text.splitlines() if line.strip() and not re.fullmatch(r'\s*[$€]\s?\d+\s*', line)
                                     for m in [CURRENCY.search(line)] if m), None)
    ctx = w.string[max(0, w.start() - 40):w.end() + 40].replace('\n', ' | ') if w else ''
    need(not w, f'{name}: no price, plan, upgrade or free word ({w.group(0) if w else "none"}{": " + repr(ctx) if w else ""})')
    if lang.startswith('ara'):
        a = arabic_hits(text)
        need(not a, f'{name}: no Arabic plan, subscription, upgrade, price or free word (the app-wording.mjs stems: {a or "none"})')

print(f'\n{fails} failure(s)')
sys.exit(1 if fails else 0)
