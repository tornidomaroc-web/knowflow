#!/usr/bin/env python3
"""
The captions of the iOS 1.1 App Store screenshots (item 4i, PR 1), built BY
SCRIPT from the file the owner approved on 2026-11-23 11:32Z, never typed.

  build <approved file>  checks the file's SHA-256 against APPROVED_SHA256,
                         copies it byte for byte to
                         docs/store/screenshots-designed/captions-1.1.approved.json
                         and writes captions-1.1.json from it.
  check                  the committed copy still has APPROVED_SHA256; the
                         captions-1.1.json built from it again equals the
                         committed one byte for byte (so every caption is the
                         approved one, byte for byte); the lines marked as kept
                         from 1.0.1 equal a caption of captions.json byte for
                         byte; the file names and their order are the six of
                         the plan. Standard library only.

The 1.0.1 captions.json and its PNGs are history and are not touched.
"""
import hashlib
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DESIGNED = os.path.join(ROOT, 'docs', 'store', 'screenshots-designed')
COPY = os.path.join(DESIGNED, 'captions-1.1.approved.json')
OUT = os.path.join(DESIGNED, 'captions-1.1.json')
OLD = os.path.join(DESIGNED, 'captions.json')

# The owner's approval of 2026-11-23 11:32Z (the file D:\Temp\kf-research\
# screens-captions\captions_1.1.json on the owner's PC).
APPROVED_SHA256 = '6d52f7c9aefe75639a3be366729dca48f647312fe33461b2ce2e2efa7f2ad280'
FILES = ['01-subjects.png', '02-material.png', '03-camera.png', '04-summary.png', '05-ask.png', '06-quiz.png']
# Lines carried over unchanged from the 1.0.1 set (approved 2026-10-12).
KEPT = {'en': {'01-subjects.png', '02-material.png', '04-summary.png'},
        'ar': {'01-subjects.png', '02-material.png', '04-summary.png', '05-ask.png'}}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def built(raw):
    src = json.loads(raw.decode('utf-8'))
    out = {
        '_about': ('The iOS 1.1 App Store screenshot set (item 4i), design C light, six screens per language in '
                   'upload order. Built by scripts/store-shots/captions_1_1.py from captions-1.1.approved.json, the '
                   'owner-approved file, copied byte for byte (its SHA-256 is `source.sha256`); never edit by hand. '
                   '`caption` is the whole line; the part between the two | markers is set in gold. `approved` '
                   'records the owner approval of each line: lines kept from 1.0.1 keep their 2026-10-12 date. '
                   'The 1.0.1 set is captions.json, kept as history.'),
        'source': {'file': 'captions-1.1.approved.json', 'sha256': APPROVED_SHA256},
    }
    for loc in ('en', 'ar'):
        out[loc] = [{'file': e['file'], 'caption': e['caption'],
                     'approved': 'owner 2026-10-12' if e['file'] in KEPT[loc] else 'owner 2026-11-23'}
                    for e in src[loc]]
    return (json.dumps(out, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


fails = []


def need(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def check(raw, out_bytes):
    need(sha(raw) == APPROVED_SHA256, f'the approved copy has the approved SHA-256 ({sha(raw)})')
    need(built(raw) == out_bytes, 'captions-1.1.json is exactly what the script builds from the approved copy (every caption byte for byte)')
    cur = json.loads(out_bytes.decode('utf-8'))
    old = json.load(open(OLD, encoding='utf-8'))
    for loc in ('en', 'ar'):
        need([e['file'] for e in cur[loc]] == FILES, f'{loc}: the six files of the plan, in order')
        olds = {e['caption'] for e in old[loc]}
        for e in cur[loc]:
            if e['file'] in KEPT[loc]:
                need(e['caption'] in olds and e['approved'] == 'owner 2026-10-12',
                     f'{loc}/{e["file"]}: kept from 1.0.1, the same bytes as a captions.json line, dated 2026-10-12')
            else:
                need(e['caption'] not in olds and e['approved'] == 'owner 2026-11-23',
                     f'{loc}/{e["file"]}: a new line, dated 2026-11-23')


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
    if mode == 'build':
        raw = open(sys.argv[2], 'rb').read()
        if sha(raw) != APPROVED_SHA256:
            sys.exit(f'FAIL {sys.argv[2]} has SHA-256 {sha(raw)}, not the approved {APPROVED_SHA256}; nothing written')
        open(COPY, 'wb').write(raw)
        open(OUT, 'wb').write(built(raw))
        print(f'wrote {os.path.relpath(COPY, ROOT)} and {os.path.relpath(OUT, ROOT)}')
    elif mode == 'check':
        check(open(COPY, 'rb').read(), open(OUT, 'rb').read())
        # Negative control: one changed byte in a caption must be caught.
        raw = open(COPY, 'rb').read()
        doctored = built(raw).replace('one place'.encode(), 'one placE'.encode(), 1)
        before = len(fails)
        print('     negative control (a caption with one changed byte):')
        check(raw, doctored)
        caught = len(fails) > before
        del fails[before:]
        need(caught, 'negative control: a caption changed by one byte is caught')
        print(f'\n{len(fails)} failure(s)')
        sys.exit(1 if fails else 0)
    else:
        sys.exit('usage: captions_1_1.py build <approved file> | check')
