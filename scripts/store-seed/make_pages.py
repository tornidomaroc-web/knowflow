"""Item 4i, PR 2: the three page photos the App Store capture feeds to the
camera sheet (shot 03), one set per language, made BY SCRIPT from the notes
the screenshot accounts already hold (docs/store/screenshot-content/<l>/, the
file plan.json names for the summary). Each page is a plain printed study
page: the note's title and one or two of its sections set in Rubik, black on
off-white, no handwriting, no person's name, no logo.

  python scripts/store-seed/make_pages.py                 writes the six JPEGs
                                                          and pages.json (their
                                                          SHA-256)
  python scripts/store-seed/make_pages.py --check         CI: every JPEG has
                                                          the SHA-256 pages.json
                                                          pins, 480 x 640,
                                                          grayscale, inside the
                                                          size budget
  python scripts/store-seed/make_pages.py --check-render  the committed JPEGs
                                                          are what the script
                                                          makes HERE (decoded
                                                          pixels within a small
                                                          tolerance; same OS
                                                          only: Chrome shapes
                                                          and hints Arabic
                                                          differently on Linux)

Needs Chrome (CHROME, default the Windows path) and Pillow. The capture
carries the JPEGs inside its steps (capture_steps.py), so they are kept
small: 480 x 640, grayscale, quality 60, at most PAGE_BUDGET bytes each.
"""
import html
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTENT = os.path.join(ROOT, 'docs', 'store', 'screenshot-content')
OUT = os.path.join(CONTENT, 'pages')
FONT = os.path.join(ROOT, 'docs', 'store', 'screenshots-designed', 'fonts', 'rubik', 'Rubik[wght].ttf')
PLAN = json.load(open(os.path.join(CONTENT, 'plan.json'), encoding='utf-8'))
W, H = 480, 640
PAGE_BUDGET = 24000


def sections(locale):
    """The summary note of the locale, as (title, [section blocks])."""
    name = PLAN[locale]['summary']['file']
    text = open(os.path.join(CONTENT, locale, name), encoding='utf-8').read()
    title = re.search(r'^# (.+)$', text, re.M).group(1).strip()
    parts = re.split(r'^## ', text, flags=re.M)[1:]
    return title, [p.strip() for p in parts]


def block_html(block):
    head, _, body = block.partition('\n')
    lines = []
    for ln in body.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        ln = html.escape(re.sub(r'\*\*(.+?)\*\*', r'\1', ln))
        lines.append(f'<p>{ln}</p>')
    return f'<h2>{html.escape(head.strip())}</h2>' + ''.join(lines)


def page_html(locale, title, blocks, n):
    rtl = locale == 'ar'
    font = 'file:///' + FONT.replace('\\', '/')
    return f"""<!doctype html><html lang="{locale}" dir="{'rtl' if rtl else 'ltr'}"><head><meta charset="utf-8"><style>
@font-face {{ font-family: R; src: url("{font}"); }}
html, body {{ margin: 0; width: {W}px; height: {H}px; overflow: hidden; background: #f6f4ee; }}
body {{ font-family: R; color: #1d1d1b; padding: 34px 36px; box-sizing: border-box; }}
h1 {{ font-size: 21px; font-weight: 700; margin: 0 0 14px; }}
h2 {{ font-size: 15px; font-weight: 700; margin: 16px 0 6px; }}
p {{ font-size: 12.5px; line-height: 1.55; margin: 0 0 6px; font-weight: 400; }}
.n {{ position: absolute; bottom: 18px; {'left' if rtl else 'right'}: 36px; font-size: 11px; color: #666; }}
</style></head><body>{f'<h1>{html.escape(title)}</h1>' if n == 1 else ''}{''.join(block_html(b) for b in blocks)}<div class="n">{n}</div></body></html>"""


def pages(locale):
    title, secs = sections(locale)
    # Three pages, the sections in order, cut where each page holds about a
    # third of the text (the title counts on page 1).
    n = len(secs)
    if n < 3:
        raise SystemExit(f'{locale}: the note has {n} sections, three pages need three')
    size = lambda a, b: sum(len(s) for s in secs[a:b]) + (len(title) * 2 if a == 0 else 0)
    # The two cuts that make the fullest page as light as possible.
    i, j = min(((i, j) for i in range(1, n - 1) for j in range(i + 1, n)),
               key=lambda c: max(size(0, c[0]), size(c[0], c[1]), size(c[1], n)))
    return [(title, secs[:i], 1), (title, secs[i:j], 2), (title, secs[j:], 3)]


def render(locale, spec, tmp):
    from PIL import Image
    chrome = os.environ.get('CHROME', r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    title, blocks, n = spec
    h = os.path.join(tmp, f'{locale}-{n}.html')
    open(h, 'w', encoding='utf-8').write(page_html(locale, title, blocks, n))
    png = os.path.join(tmp, f'{locale}-{n}.png')
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                    f'--window-size={W},{H}', '--virtual-time-budget=3000', f'--screenshot={png}', 'file:///' + h.replace('\\', '/')],
                   check=True, capture_output=True, timeout=90)
    return Image.open(png).convert('L')


def jpeg_path(locale, n):
    return os.path.join(OUT, locale, f'page-{n}.jpg')


def pinned_check():
    import hashlib
    from PIL import Image
    pins = json.load(open(os.path.join(OUT, 'pages.json'), encoding='utf-8'))
    fails = 0
    for locale in ('en', 'ar'):
        for n in (1, 2, 3):
            p = jpeg_path(locale, n)
            rel = f'{locale}/page-{n}.jpg'
            b = open(p, 'rb').read()
            im = Image.open(p)
            ok = hashlib.sha256(b).hexdigest() == pins.get(rel) and im.size == (W, H) and im.mode == 'L' and len(b) <= PAGE_BUDGET
            print(('ok   ' if ok else 'FAIL ') + f'pages/{rel}: sha256 {hashlib.sha256(b).hexdigest()[:16]}... (pinned {str(pins.get(rel))[:16]}...), {im.size[0]} x {im.size[1]} {im.mode}, {len(b)} bytes')
            fails += 0 if ok else 1
    if len(pins) != 6:
        print(f'FAIL pages.json pins {len(pins)} files, 6 expected')
        fails += 1
    sys.exit(1 if fails else 0)


def main():
    if '--check' in sys.argv:
        pinned_check()
    check = '--check-render' in sys.argv
    from PIL import Image, ImageChops
    import hashlib
    fails = 0
    pins = {}
    with tempfile.TemporaryDirectory() as tmp:
        for locale in ('en', 'ar'):
            for spec in pages(locale):
                img = render(locale, spec, tmp)
                p = jpeg_path(locale, spec[2])
                if check:
                    a = Image.open(p).convert('L')
                    diff = ImageChops.difference(a, img).point(lambda v: 255 if v > 40 else 0)
                    bad = diff.histogram()[255] / (W * H)
                    size = os.path.getsize(p)
                    ok = a.size == (W, H) and bad <= 0.02 and size <= PAGE_BUDGET
                    print(('ok   ' if ok else 'FAIL ') + f'{os.path.relpath(p, ROOT)}: {a.size[0]} x {a.size[1]}, {size} bytes, {bad:.2%} of pixels off the fresh page')
                    fails += 0 if ok else 1
                else:
                    os.makedirs(os.path.dirname(p), exist_ok=True)
                    img.save(p, 'JPEG', quality=60, optimize=True)
                    pins[f'{locale}/page-{spec[2]}.jpg'] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
                    print(f'wrote {os.path.relpath(p, ROOT)} ({os.path.getsize(p)} bytes)')
                    if os.path.getsize(p) > PAGE_BUDGET:
                        fails += 1
                        print(f'FAIL over the budget of {PAGE_BUDGET} bytes')
    if not check:
        with open(os.path.join(OUT, 'pages.json'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(pins, indent=1, sort_keys=True) + '\n')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
