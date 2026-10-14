#!/usr/bin/env python3
"""
Step Store-Fix-3: the proof of ocr_scan.py's reader change, on capture
38646534381's framed set (.github/workflows/ocr-proof.yml frames it first).

  1. The line that produced "$4": ar/04 read with `eng` (the old reader) as
     Tesseract's TSV, the line holding a currency figure printed with its box;
     then the same box read with `ara+eng` (the new reader) and with `eng`.
  2. The whole framed set passes ocr_scan.py (Arabic set ara+eng, English eng).
  3. Planted, each must fail ocr_scan.py on its own rule (for مجاني: the
     Arabic stems line names مجاني, exact or dot-blind):
       ar/04 with "$4.99" drawn in the app screen      -> the price rule
       en/04 with "$4.99" drawn in the app screen      -> the price rule
       ar/01 with "مجاني" drawn in the app screen      -> the Arabic stems
     The text is drawn by Chrome (shaped Arabic), on a card of the app's
     colours, 72 px, inside the screen.

Usage: python3 scripts/store-shots/ocr_proof.py DESIGNED_DIR OUT_DIR
Needs tesseract (eng, ara), google-chrome, Node, Pillow.
"""
import csv
import io
import os
import shutil
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
designed, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
fails = 0


def need(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    fails += 0 if cond else 1


def tess(path, lang, psm, fmt=None):
    cmd = ['tesseract', path, '-', '-l', lang, '--psm', str(psm)] + ([fmt] if fmt else [])
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit(f'FAIL tesseract {lang}: {r.stderr[:300]}')
    return r.stdout


# 1. The "$4" line, before and after.
ar04 = os.path.join(designed, 'ar', '04-ask.png')
rows = list(csv.DictReader(io.StringIO(tess(ar04, 'eng', 11, 'tsv')), delimiter='\t', quoting=csv.QUOTE_NONE))
lines = {}
for r in rows:
    if r.get('level') == '5' and (r.get('text') or '').strip():
        lines.setdefault((r['block_num'], r['par_num'], r['line_num']), []).append(r)
hits = [ws for ws in lines.values() if any(w['text'].lstrip().startswith(('$', '€')) and any(c.isdigit() for c in w['text']) for w in ws)]
need(bool(hits), f'before: the old reader (eng) finds a currency figure on ar/04 ({len(hits)} line(s))')
im = Image.open(ar04).convert('RGB')
for ws in hits:
    x0 = min(int(w['left']) for w in ws); y0 = min(int(w['top']) for w in ws)
    x1 = max(int(w['left']) + int(w['width']) for w in ws); y1 = max(int(w['top']) + int(w['height']) for w in ws)
    print(f"     before (eng, whole picture): {' '.join(w['text'] for w in ws)!r} at x {x0}-{x1}, y {y0}-{y1}")
    # The whole row of the picture at that height: the line as drawn.
    crop = os.path.join(out, f'line-{y0}.png')
    im.crop((0, max(0, y0 - 16), im.width, min(im.height, y1 + 16))).save(crop)
    print(f"     that row read alone, eng:     {tess(crop, 'eng', 7).strip()!r}")
    print(f"     that row read alone, ara+eng: {tess(crop, 'ara+eng', 7).strip()!r}")
after = tess(ar04, 'ara+eng', 11)
cur = [l for l in after.splitlines() if any(c in l for c in '$€')]
need(not cur, f'after: the new reader (ara+eng) reads no $ or € anywhere on ar/04 ({cur or "none"})')

# 2. The whole framed set.
scan = [sys.executable, os.path.join(HERE, 'ocr_scan.py')]
pngs = sorted(os.path.join(designed, loc, f) for loc in ('ar', 'en') for f in os.listdir(os.path.join(designed, loc)) if f.endswith('.png'))
r = subprocess.run(scan + pngs, capture_output=True, text=True, encoding='utf-8')
print(r.stdout)
need(r.returncode == 0 and len(pngs) == 10, f'the framed set of capture 38646534381 passes ocr_scan.py ({len(pngs)} PNGs, exit {r.returncode})')


# 3. The plants.
def label(text, rtl, path):
    html = os.path.join(out, 'label.html')
    with open(html, 'w', encoding='utf-8') as f:
        f.write(f'<!doctype html><meta charset="utf-8"><body style="margin:0;background:#2a241c">'
                f'<div dir="{"rtl" if rtl else "ltr"}" style="font:700 72px \'DejaVu Sans\',sans-serif;color:#f5f0e8;padding:28px 40px">{text}</div></body>')
    subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', f'--screenshot={path}',
                    '--window-size=900,160', 'file://' + os.path.abspath(html)], check=True, capture_output=True)
    return Image.open(path).convert('RGB')


PLANTS = [
    ('price-ar', 'ar', '04-ask.png', '$4.99', False, 'no price, plan, upgrade or free word ($4.99'),
    ('price-en', 'en', '04-quiz.png', '$4.99', False, 'no price, plan, upgrade or free word ($4.99'),
    ('free-ar', 'ar', '01-subjects.png', 'مجاني', True, "no Arabic plan, subscription, upgrade, price or free word (the app-wording.mjs stems"),
]
for key, loc, fname, text, rtl, want in PLANTS:
    d = os.path.join(out, key, loc)
    os.makedirs(d, exist_ok=True)
    shot = Image.open(os.path.join(designed, loc, fname)).convert('RGB')
    lab = label(text, rtl, os.path.join(out, f'{key}-label.png'))
    shot.paste(lab, ((shot.width - lab.width) // 2, 1500))
    dst = os.path.join(d, fname)
    shot.save(dst)
    # What the reader makes of the plant: the label alone, and the shot's words
    # at the plant's height, in each language and layout mode.
    lab_path = os.path.join(out, f'{key}-label.png')
    for lg in ('ara', 'ara+eng', 'eng'):
        for psm in (7, 11):
            print(f'     {key} label alone, -l {lg} --psm {psm}: {tess(lab_path, lg, psm).strip()!r}')
    for lg, psm in (('ara+eng', 11), ('ara+eng', 3), ('ara', 11), ('ara', 3)):
        tsv = list(csv.DictReader(io.StringIO(tess(dst, lg, psm, 'tsv')), delimiter='\t', quoting=csv.QUOTE_NONE))
        near = [w['text'] for w in tsv if w.get('level') == '5' and (w.get('text') or '').strip() and 1480 <= int(w['top']) <= 1680]
        print(f'     {key} shot at y 1480-1680, -l {lg} --psm {psm}: {near!r}')
    r = subprocess.run(scan + [dst], capture_output=True, text=True, encoding='utf-8')
    fl = [l for l in r.stdout.splitlines() if l.startswith('FAIL ')]
    print(f'     planted {key}: ' + (' | '.join(fl) or 'no FAIL line'))
    need(r.returncode == 1 and any(want in l and (not rtl or text in l) for l in fl), f'planted {text!r} in {loc}/{fname} fails ocr_scan.py on its rule')

print(f'\n{fails} failure(s)')
sys.exit(1 if fails else 0)
