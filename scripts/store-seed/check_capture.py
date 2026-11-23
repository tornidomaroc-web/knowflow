"""Item 4i, PR 2: the checks on an App Store capture for iOS 1.1 (ios-signed-in.yml,
scenario screenshots), from the harness's readings, the PNG sizes and the PNGs
themselves. Step Store-Shots-1 wrote the first version (the 1.0.1 set).

  - both sets signed in and finished: twelve shots, six per language, in the
    order of captions-1.1.json, every PNG exactly 1320 x 2868;
  - every shot: signed in, no Google button, no purchase word or link and no
    [data-kf-iap] element (the app's probe), and its own readings
    (capture_steps.py `R=`): data-theme light, no [data-kf-iap] element, no
    platform word (Apple, iPhone, iPad, iOS, Google, Android, App Store,
    Play Store), no e-mail text, no keyboard, no alert, no open dialog (03:
    the camera sheet and nothing else), not Settings, login, sign-up or the
    paywall, and no subject or file name of the other language's account;
  - the status bar: in the top band of every PNG the bar's ink is DARKER than
    the page under it, by at least 4.5:1 (a light bar on the light page
    vanishes);
  - 03: the camera sheet holds three pages numbered 1, 2, 3, the read button
    is there, no message, the system picker was asked for and blocked, and
    nothing was sent (0 requests to the page reader or storage, also after
    the sheet was closed);
  - 04: the summary's heading sits fully below any bar;
  - 05: the answer's sources are on screen (the first source inside the
    list), the question starts the shot (not cut), the microphone is in the
    composer and in view;
  - 06: the quiz from question 1, nothing picked, not graded, and the route
    answered `cached: true` (the stored quiz: no AI call);
  - each set ended signed out; every page step (nav, login, sign-out) left
    the page it started on and reached its own (scripts/ios/page_steps.py).

Usage: python3 scripts/store-seed/check_capture.py smoke-shots.jsonl sizes.txt steps-ar.json steps-en.json [--png-root DIR]
       python3 scripts/store-seed/check_capture.py --self-test
           a clean synthetic capture must pass; one planted failure per rule
           must fail (each caught by its own rule); a light status bar on a
           light page and a dark page must fail the status-bar rule
       python3 scripts/store-seed/check_capture.py --status-bar PNG...
           the status-bar reading of real PNGs (local proof)
KF_LATE_OK=1 (the frame mode, re-checking a capture it reuses) passes a page
step that arrived on its own page after its limit; see page_steps.py.
Standard library only (the macOS runner has no Pillow).
"""
import copy
import json
import os
import re
import struct
import sys
import tempfile
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'ios'))
from page_steps import page_step_checks  # noqa: E402
CAPTIONS = json.load(open(os.path.join(ROOT, 'docs', 'store', 'screenshots-designed', 'captions-1.1.json'), encoding='utf-8'))
W, H = 1320, 2868
# The status bar's band at 1320 wide (Pro Max at 3x: the bar's text and
# icons sit in the top 54 pt); scaled to the image width.
BAND = 160
MIN_RATIO = 4.5
QUIET = False  # the self-test judges the same capture thirty times


# ---------------------------------------------------------------- PNG, stdlib
def png_band(path, rows):
    """The first `rows` rows of a PNG (8-bit RGB or RGBA, not interlaced) as
    a list of rows of (r, g, b), and the image size."""
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'{path}: not a PNG')
    pos, idat, ihdr = 8, [], None
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if kind == b'IHDR':
            ihdr = struct.unpack('>IIBBBBB', body)
        elif kind == b'IDAT':
            idat.append(body)
        elif kind == b'IEND':
            break
        pos += 12 + n
    w, h, depth, ctype, _, _, interlace = ihdr
    if depth != 8 or ctype not in (2, 6) or interlace:
        raise ValueError(f'{path}: depth {depth}, colour type {ctype}, interlace {interlace} (8-bit RGB or RGBA expected)')
    bpp = 3 if ctype == 2 else 4
    stride = w * bpp
    rows = min(rows, h)
    raw = zlib.decompressobj().decompress(b''.join(idat), (stride + 1) * rows)
    out, prev = [], bytearray(stride)
    for y in range(rows):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out.append([tuple(line[x * bpp:x * bpp + 3]) for x in range(w)])
        prev = line
    return out, (w, h)


def png_write(path, w, h, pixel):
    """A small RGB PNG for the self-test; pixel(x, y) -> (r, g, b)."""
    raw = b''.join(b'\x00' + bytes(c for x in range(w) for c in pixel(x, y)) for y in range(h))
    chunk = lambda k, b: struct.pack('>I', len(b)) + k + b + struct.pack('>I', zlib.crc32(k + b) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) +
                           chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def ratio(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def status_bar(path):
    """The page colour of the top band (its most frequent colour) and the
    bar's ink on either side of it (the median of the darkest and of the
    lightest 0.3 % of the band, the Dynamic Island left out). The ink must be
    the dark side, >= 4.5:1."""
    head = open(path, 'rb').read(33)
    w = struct.unpack('>I', head[16:20])[0]
    band = max(8, round(BAND * w / W))
    rows, (w, h) = png_band(path, band)
    # The simulator draws the Dynamic Island, a black pill, in the middle of
    # the band; it is no ink of the bar, so only the time's side and the
    # icons' side are read (the outer third on each side).
    rows = [row[:w // 3] + row[w - w // 3:] for row in rows]
    counts, ls = {}, []
    for row in rows:
        for c in row:
            q = (c[0] >> 3, c[1] >> 3, c[2] >> 3)
            counts[q] = counts.get(q, 0) + 1
    bgq = max(counts, key=counts.get)
    bg = lum(tuple(v * 8 + 4 for v in bgq))
    for row in rows:
        for c in row:
            ls.append(lum(c))
    ls.sort()
    k = max(1, len(ls) * 3 // 1000)
    dark, light = ls[k // 2], ls[-1 - k // 2]
    rd, rl = ratio(dark, bg), ratio(light, bg)
    ok = dark < bg and rd >= MIN_RATIO and rd >= rl
    why = (f'page L {bg:.3f}, darkest ink L {dark:.3f} ({rd:.2f}:1), lightest ink L {light:.3f} ({rl:.2f}:1)')
    return ok, why, (w, h)


# ------------------------------------------------------------- the readings
def reading(res):
    """(what the shot did, the R= readings dict or None)."""
    m = re.search(r' \| R=(\{.*\})$', res)
    if not m:
        return res, None
    try:
        return res[:m.start()], json.loads(m.group(1))
    except ValueError:
        return res[:m.start()], None


def shot_checks(name, res, probe, loc):
    """Every rule of one shot, as (ok, rule, message)."""
    out = []
    add = lambda ok, rule, msg: out.append((bool(ok), rule, f'{name}: {msg}'))
    did, R = reading(str(res))
    pur = (probe or {}).get('purchase') or {}
    add(not did.startswith('no ') and 'not open' not in did, 'did', did[:200])
    add(R is not None, 'readings', 'the shot returned its readings')
    R = R or {}
    add(R.get('theme') == 'light', 'theme', f"data-theme is light: {R.get('theme')}")
    add(R.get('iap') == 0 and not pur.get('marked'), 'iap', f"no [data-kf-iap] element: page {R.get('iap')}, probe {pur.get('marked')}")
    add(not pur.get('words') and not pur.get('hrefs'), 'purchase', f'no price, plan, upgrade, free or pro word or link (the app probe): {pur}')
    add(R.get('platform') == [], 'platform', f"no Apple, iPhone, Google or Android word: {R.get('platform')}")
    add(R.get('mail') is False, 'mail', f"no e-mail text: {R.get('mail')}")
    add(R.get('keyboard') is False, 'keyboard', f"no keyboard (no focused field): {R.get('keyboard')}")
    add(R.get('alerts') == 0, 'alert', f"no alert or refusal on screen: {R.get('alerts')}")
    want = ['camera'] if name.endswith('-03-camera') else []
    add(R.get('dialogs') == want, 'dialog', f"open dialogs {R.get('dialogs')} (want {want}: no consent sheet, no other sheet)")
    add(R.get('other') == [], 'purity', f"no subject or file name of the other language's account: {R.get('other')}")
    add(not re.search(r'/dashboard/(settings|pro)\b|/(login|signup)$', str(R.get('path', ''))), 'screen', f"not Settings, the paywall, login or sign-up: {R.get('path')}")
    add((probe or {}).get('signedIn') is True and (probe or {}).get('google') == 0, 'signed-in', 'signed in, no Google button')
    if name.endswith('-03-camera'):
        m = re.search(r'pages (\d+); numbers ([\d,]*); read button (\w+); message (\S+); picker calls blocked (\S+); sent (\S+)', did)
        add(m and m.group(1) == '3' and m.group(2) == '1,2,3', 'camera-pages', f'three pages numbered 1, 2, 3: {did[:160]}')
        add(m and m.group(3) in ('enabled', 'disabled') and m.group(4) == 'none', 'camera-state', f'the read button there, no message: {did[:160]}')
        add(m and m.group(5) not in ('0', '?'), 'camera-control', f'opened by its real control (the picker asked for and blocked): {did[:160]}')
        add(m and m.group(6) == '0', 'camera-sent', f'nothing sent: {did[:160]}')
    if name.endswith('-04-summary'):
        m = re.search(r'heading top (-?\d+), bar bottom (\d+)', did)
        add(m and int(m.group(1)) >= int(m.group(2)) + 4, 'summary', f'the heading sits fully below any bar: {did[:120]}')
    if name.endswith('-05-ask'):
        m = re.search(r'sources: (yes|no); question top (-?\d+) of list (\d+); first source bottom (-?\d+|none); all sources bottom (-?\d+|none); list at end (yes|no); mic (.+)$', did)
        add(m and m.group(1) == 'yes', 'sources', f'the answer shows its sources: {did[:220]}')
        add(m and m.group(4) != 'none' and int(m.group(4)) <= int(m.group(3)), 'sources-in-view', f"the first source is on screen inside the list: {did[:220]}")
        add(m and int(m.group(2)) >= 0 and (int(m.group(2)) <= 40 or m.group(6) == 'yes'), 'question', f'the question starts the shot, not cut: {did[:220]}')
        add(m and m.group(7) == 'in the composer, in view', 'mic', f"the microphone is in the composer and in view: {m.group(7) if m else did[:200]}")
        if m and m.group(5) != 'none' and not QUIET:
            print(f"note {name}: the whole sources row {'fits' if int(m.group(5)) <= int(m.group(3)) else 'runs past the list by ' + str(int(m.group(5)) - int(m.group(3))) + ' px'}")
    if name.endswith('-06-quiz'):
        m = re.search(r'quiz in view from question 1; phase (\S+); question 1 top (-?\d+), bar bottom (\d+); picked (\d+); route (\S+) cached (yes|no)', did)
        add(m and m.group(1) == 'taking' and m.group(4) == '0', 'quiz', f'the quiz from question 1, nothing picked, not graded: {did[:200]}')
        add(m and int(m.group(2)) >= int(m.group(3)) + 4, 'quiz-top', f'question 1 sits below any bar: {did[:200]}')
        add(m and m.group(5) == '200' and m.group(6) == 'yes', 'quiz-stored', f'the stored quiz (route 200, cached: no AI call): {did[:200]}')
    return out


def judge(rows, sizes, steps_lists, png_root=None, late_ok=False):
    """Every rule of a capture, as (ok, rule, message)."""
    by = {}
    for r in rows:
        by.setdefault(r['step'], r)
    out = []
    add = lambda ok, rule, msg: out.append((bool(ok), rule, msg))
    for loc in ('ar', 'en'):
        want = [f"shot-{loc}-{e['file'][:-4]}" for e in CAPTIONS[loc]]
        got = [r['step'] for r in rows if r['step'].startswith(f'shot-{loc}-')]
        add(got == want, 'order', f'{loc}: the six shots in caption order: {got}')
        add(by.get('login', {}).get('result') == 'submitted', 'login', f'{loc}: the login form was submitted')
        for name in want:
            r = by.get(name, {})
            out += shot_checks(name, r.get('result', ''), r.get('probe'), loc)
        close = str(by.get(f'camera-{loc}-close', {}).get('result', ''))
        add(close.endswith('sent 0'), 'camera-sent', f'{loc}: nothing sent by the time the camera sheet closed: {close[:120]}')
        q = str(by.get(f'quiz-{loc}-open', {}).get('result', ''))
        add(q.startswith('clicked quiz on '), 'quiz-card', f"{loc}: the quiz opened on the plan file's own card: {q[:120]}")
        add(by.get(f'ask-{loc}-send', {}).get('result') == 'sent', 'ask-sent', f"{loc}: the question was sent (one Ask call): {by.get(f'ask-{loc}-send', {}).get('result')}")
        add(by.get(f'signout-{loc}', {}).get('result') == 'signed out', 'signout', f'{loc}: the set ends signed out')
    add(len(steps_lists) == 2, 'steps', f'both steps files given ({len(steps_lists)})')
    for ok, msg in page_step_checks(rows, steps_lists, late_ok=late_ok):
        add(ok, 'page-step', msg)
    add(len(sizes) == 12 and all(f' {W} x {H},' in l for l in sizes), 'sizes', f'twelve PNGs, every one {W} x {H} ({len(sizes)} files)')
    if png_root is not None:
        files = sorted(os.path.join(png_root, loc, f) for loc in ('ar', 'en') if os.path.isdir(os.path.join(png_root, loc))
                       for f in os.listdir(os.path.join(png_root, loc)) if f.endswith('.png'))
        add(len(files) == 12, 'sizes', f'twelve PNG files under {png_root} ({len(files)})')
        for f in files:
            try:
                ok, why, (w, h) = status_bar(f)
            except ValueError as e:
                ok, why, (w, h) = False, str(e), (0, 0)
            rel = os.path.relpath(f, png_root).replace('\\', '/')
            add((w, h) == (W, H), 'sizes', f'{rel}: {w} x {h} read from the file')
            add(ok, 'status-bar', f'{rel}: the status bar ink is dark on the page, >= {MIN_RATIO}:1: {why}')
    return out


def report(results):
    fails = 0
    for ok, rule, msg in results:
        print(('ok   ' if ok else 'FAIL ') + msg)
        fails += 0 if ok else 1
    return fails


# ------------------------------------------------------------- the self-test
def fixture(tmp):
    """A clean capture as the harness would record it: rows, sizes, steps."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import capture_steps
    steps = {loc: capture_steps.steps(loc) for loc in ('ar', 'en')}
    R = lambda path, dialogs=(): {'theme': 'light', 'path': path, 'iap': 0, 'platform': [], 'mail': False,
                                   'dialogs': list(dialogs), 'keyboard': False, 'alerts': 0, 'other': []}
    did = {
        '01-subjects': '/{l}/dashboard/knowledge',
        '02-material': '/{l}/dashboard/knowledge/00000000-0000-0000-0000-000000000001',
        '03-camera': 'camera sheet; pages 3; numbers 1,2,3; read button enabled; message none; picker calls blocked 1; sent 0',
        '04-summary': 'summary in view; heading top 146, bar bottom 138',
        '05-ask': 'answer shown; sources: yes; question top 16 of list 444; first source bottom 420; all sources bottom 470; list at end no; mic in the composer, in view',
        '06-quiz': 'quiz in view from question 1; phase taking; question 1 top 190, bar bottom 138; picked 0; route 200 cached yes',
    }
    rows = []
    probe = {'signedIn': True, 'google': 0, 'purchase': {'words': [], 'hrefs': [], 'marked': 0, 'outside': False}}
    for loc in ('ar', 'en'):
        for s in steps[loc]:
            n = s['name']
            row = {'step': n, 'probe': copy.deepcopy(probe)}
            if n.startswith('shot-'):
                k = n.split('-', 2)[2]
                path = '/' + loc + ('/dashboard/agent' if k == '05-ask' else '/dashboard/knowledge' if k == '01-subjects' else '/dashboard/knowledge/00000000-0000-0000-0000-000000000001')
                row['result'] = did[k].format(l=loc) + ' | R=' + json.dumps(R(path, ['camera'] if k == '03-camera' else []))
            elif n == 'login':
                row['result'] = 'submitted'
            elif n.startswith('signout-'):
                row['result'] = 'signed out'
            elif n.startswith('ask-'):
                row['result'] = 'sent'
            elif n.startswith('quiz-'):
                row['result'] = 'clicked quiz on x'
            elif n.endswith('-close'):
                row['result'] = 'closed the camera sheet; sent 0'
            else:
                row['result'] = 'ok'
            if 'until' in s:
                # page_steps.py: left the start page and matched `until`.
                to = {'to-login': f'https://tryknowflow.com/{loc}/login', 'login': f'https://tryknowflow.com/{loc}/dashboard',
                      f'nav-{loc}-subjects': f'https://tryknowflow.com/{loc}/dashboard/knowledge',
                      f'nav-{loc}-subject': f'https://tryknowflow.com/{loc}/dashboard/knowledge/00000000-0000-0000-0000-000000000001',
                      f'nav-{loc}-back': f'https://tryknowflow.com/{loc}/dashboard/knowledge/00000000-0000-0000-0000-000000000001',
                      f'nav-{loc}-ask': f'https://tryknowflow.com/{loc}/dashboard/agent?kb=00000000-0000-0000-0000-000000000001',
                      f'nav-{loc}-settings': f'https://tryknowflow.com/{loc}/dashboard/settings',
                      f'signout-{loc}': f'https://tryknowflow.com/{loc}/login'}[n]
                row['nav'] = {'start': f'https://tryknowflow.com/{loc}/start', 'arrived': True, 'ms': 900}
                row['probe']['href'] = to
            rows.append(row)
    root = os.path.join(tmp, 'store')
    sizes = []
    for loc in ('ar', 'en'):
        os.makedirs(os.path.join(root, loc))
        for e in CAPTIONS[loc]:
            sizes.append(f"{loc}/{e['file']}: {W} x {H}, 1000 bytes")
    return rows, sizes, [steps['ar'], steps['en']], root


PAGE, INK, WHITE, DARKPAGE = (244, 237, 225), (20, 18, 14), (255, 255, 255), (20, 17, 13)


def bar_png(path, page, ink, w=330, h=717):
    """A light (or dark) page with a status bar drawn in `ink` (scaled 1/4)."""
    band = round(BAND * w / W)

    def px(x, y):
        if 14 <= y <= band - 14 and (18 <= x <= 58 or 250 <= x <= 300):
            return ink
        return page
    png_write(path, w, h, px)


def self_test():
    global QUIET
    QUIET = True
    fails = 0
    with tempfile.TemporaryDirectory() as tmp:
        rows, sizes, steps_lists, root = fixture(tmp)
        for loc in ('ar', 'en'):
            for e in CAPTIONS[loc]:
                bar_png(os.path.join(root, loc, e['file']), PAGE, INK)
        # The page step rule wants the probe href too; check what it reads.
        base = judge(rows, sizes, steps_lists, png_root=None)
        bad = [m for ok, _, m in base if not ok]
        # The synthetic PNGs are 330 x 717, so the size rule is judged on
        # sizes.txt here and the pixel rule separately below.
        print(f"clean synthetic capture: {len(base) - len(bad)} rules ok, {len(bad)} failed")
        for m in bad:
            print('  FAIL ' + m)
        fails += len(bad)

        def plant(label, rule, mutate, png=None):
            r2, s2 = copy.deepcopy(rows), list(sizes)
            mutate(r2, s2)
            res = judge(r2, s2, steps_lists, png_root=png)
            hit = [m for ok, ru, m in res if not ok and ru == rule]
            print(('ok   ' if hit else 'FAIL ') + f'plant {label}: caught by "{rule}"' + (f': {hit[0][:150]}' if hit else ' (NOT caught)'))
            return 0 if hit else 1

        def setR(step, key, val):
            def m(r2, s2):
                for r in r2:
                    if r['step'] == step:
                        did, R = reading(r['result'])
                        R[key] = val
                        r['result'] = did + ' | R=' + json.dumps(R)
            return m

        def setDid(step, old, new):
            def m(r2, s2):
                for r in r2:
                    if r['step'] == step:
                        assert old in r['result'], (step, old)
                        r['result'] = r['result'].replace(old, new, 1)
            return m

        def setProbe(step, f):
            def m(r2, s2):
                for r in r2:
                    if r['step'] == step:
                        f(r['probe'])
            return m

        P = [
            ('theme dark', 'theme', setR('shot-en-01-subjects', 'theme', 'dark')),
            ('a data-kf-iap element in the page', 'iap', setR('shot-ar-02-material', 'iap', 1)),
            ('a data-kf-iap element (probe)', 'iap', setProbe('shot-en-04-summary', lambda p: p['purchase'].update(marked=1))),
            ('a price word (probe)', 'purchase', setProbe('shot-ar-06-quiz', lambda p: p['purchase'].update(words=['pro']))),
            ('"iPhone" in the page', 'platform', setR('shot-en-05-ask', 'platform', ['iphone'])),
            ('e-mail text', 'mail', setR('shot-ar-01-subjects', 'mail', True)),
            ('the keyboard open', 'keyboard', setR('shot-en-05-ask', 'keyboard', True)),
            ('a refusal alert', 'alert', setR('shot-ar-05-ask', 'alerts', 1)),
            ('the consent sheet over Ask', 'dialog', setR('shot-en-05-ask', 'dialogs', ['consent'])),
            ('the consent sheet over the camera sheet', 'dialog', setR('shot-ar-03-camera', 'dialogs', ['camera', 'consent'])),
            ('the camera sheet closed', 'dialog', setR('shot-en-03-camera', 'dialogs', [])),
            ('the other account\'s subject', 'purity', setR('shot-en-02-material', 'other', ['x'])),
            ('a shot of Settings', 'screen', setR('shot-ar-04-summary', 'path', '/ar/dashboard/settings')),
            ('a shot of the paywall', 'screen', setR('shot-en-06-quiz', 'path', '/en/dashboard/pro')),
            ('two pages only', 'camera-pages', setDid('shot-ar-03-camera', 'pages 3; numbers 1,2,3', 'pages 2; numbers 1,2')),
            ('a camera message', 'camera-state', setDid('shot-en-03-camera', 'message none', 'message other')),
            ('the picker never asked for', 'camera-control', setDid('shot-ar-03-camera', 'picker calls blocked 1', 'picker calls blocked 0')),
            ('a page sent to the reader', 'camera-sent', setDid('shot-en-03-camera', 'sent 0', 'sent 1')),
            ('summary heading under the bar', 'summary', setDid('shot-ar-04-summary', 'heading top 146', 'heading top 120')),
            ('no sources', 'sources', setDid('shot-en-05-ask', 'sources: yes', 'sources: no')),
            ('the first source below the list', 'sources-in-view', setDid('shot-ar-05-ask', 'first source bottom 420', 'first source bottom 470')),
            ('the question cut', 'question', setDid('shot-en-05-ask', 'question top 16', 'question top -30')),
            ('no microphone', 'mic', setDid('shot-ar-05-ask', 'mic in the composer, in view', 'mic none')),
            ('the microphone out of view', 'mic', setDid('shot-en-05-ask', 'mic in the composer, in view', 'mic in the composer, out of view')),
            ('an answer picked', 'quiz', setDid('shot-en-06-quiz', 'picked 0', 'picked 1')),
            ('the quiz graded', 'quiz', setDid('shot-ar-06-quiz', 'phase taking', 'phase result')),
            ('a new quiz generated (not cached)', 'quiz-stored', setDid('shot-en-06-quiz', 'cached yes', 'cached no')),
            ('shots out of order', 'order', lambda r2, s2: r2.reverse()),
            ('eleven PNGs', 'sizes', lambda r2, s2: s2.pop()),
            ('a PNG at 1206 x 2622', 'sizes', lambda r2, s2: s2.__setitem__(0, s2[0].replace(f'{W} x {H}', '1206 x 2622'))),
        ]
        for label, rule, mut in P:
            fails += plant(label, rule, mut)

        # The status bar, from pixels.
        good = os.path.join(tmp, 'good.png')
        bar_png(good, PAGE, INK)
        isl = os.path.join(tmp, 'island.png')
        band = round(BAND * 330 / W)
        png_write(isl, 330, 717, lambda x, y: (0, 0, 0) if 8 <= y <= band - 8 and 125 <= x <= 205 else (WHITE if 14 <= y <= band - 14 and (18 <= x <= 58 or 250 <= x <= 300) else PAGE))
        ok, why, _ = status_bar(isl)
        print(('ok   ' if not ok else 'FAIL ') + f"status bar, white ink beside the black Dynamic Island: {'passes' if ok else 'fails'} ({why})")
        fails += 0 if not ok else 1
        cases = [('dark ink on the light page', PAGE, INK, True), ('white ink on the light page', PAGE, WHITE, False),
                 ('a dark page, white ink (the 1.0.1 dark app)', DARKPAGE, WHITE, False),
                 ('no bar at all', PAGE, PAGE, False), ('mid-grey ink on the light page (3:1)', PAGE, (122, 118, 112), False)]
        for label, page, ink, want in cases:
            p = os.path.join(tmp, 'bar.png')
            bar_png(p, page, ink)
            ok, why, _ = status_bar(p)
            good_case = ok == want
            print(('ok   ' if good_case else 'FAIL ') + f"status bar, {label}: {'passes' if ok else 'fails'} ({why})")
            fails += 0 if good_case else 1
        # And through judge(): one light bar among twelve dark ones.
        bad = os.path.join(root, 'en', '05-ask.png')
        bar_png(bad, PAGE, WHITE)
        res = judge(rows, sizes, steps_lists, png_root=root)
        hit = [m for ok, ru, m in res if not ok and ru == 'status-bar']
        print(('ok   ' if len(hit) == 1 else 'FAIL ') + f'plant a light status bar in en/05: {len(hit)} status-bar failure(s): {hit[:1]}')
        fails += 0 if len(hit) == 1 else 1
    print(f'\nself-test: {fails} failure(s)')
    return fails


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    if a[:1] == ['--self-test']:
        sys.exit(1 if self_test() else 0)
    if a[:1] == ['--judge-rows']:
        # The CI proof on preview pages (prove_steps.mjs): each row is one
        # shot's reading and the rule it must break (null: none may break).
        bad = 0
        for l in open(a[1], encoding='utf-8'):
            if not l.strip():
                continue
            r = json.loads(l)
            res = shot_checks(r['step'], r['result'], r['probe'], r['step'].split('-')[1])
            broke = sorted({ru for ok, ru, m in res if not ok})
            want = r.get('expect')
            ok = (not broke) if want is None else (want in broke)
            print(('ok   ' if ok else 'FAIL ') + f"{r.get('label', r['step'])}: " + ('every rule holds' if not broke else 'broke ' + ', '.join(broke)) + (f' (expected {want})' if want else ''))
            if not ok:
                for o, ru, m in res:
                    if not o:
                        print('       ' + m[:300])
            bad += 0 if ok else 1
        print(f'\n{bad} failure(s)')
        sys.exit(1 if bad else 0)
    if a[:1] == ['--status-bar']:
        bad = 0
        for f in a[1:]:
            ok, why, size = status_bar(f)
            print(('ok   ' if ok else 'FAIL ') + f'{f}: {size[0]} x {size[1]}; {why}')
            bad += 0 if ok else 1
        sys.exit(1 if bad else 0)
    png_root = a[a.index('--png-root') + 1] if '--png-root' in a else None
    pos = [x for i, x in enumerate(a) if x != '--png-root' and (i == 0 or a[i - 1] != '--png-root')]
    rows = [json.loads(l) for l in open(pos[0], encoding='utf-8') if l.strip()]
    sizes = open(pos[1], encoding='utf-8').read().splitlines()
    steps_lists = [json.load(open(p, encoding='utf-8')) for p in pos[2:]]
    fails = report(judge(rows, sizes, steps_lists, png_root=png_root, late_ok=os.environ.get('KF_LATE_OK') == '1'))
    print(f'\n{fails} failure(s)')
    sys.exit(1 if fails else 0)
