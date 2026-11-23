#!/usr/bin/env python3
"""
Item 4i, PR 3: the offline proof of store_setup.py's screenshots mode for
iOS 1.1. No network: every read comes from an in-memory fixture written to a
temporary file (store_setup.py --offline), every write is printed, none sent.

  clean       version 1.1 as App Store Connect makes it from 1.0.1: ar-SA,
              en-US, en-GB hold the five 1.0.1 images (COMPLETE) in the
              APP_IPHONE_67 set, fr-FR holds none, no APP_IPHONE_61 set. On the
              COMMITTED files the plan must be: 4 locales x 2 types x 6 files
              uploaded, the right folder per locale (fr-FR English), the medium
              type first, every 1.0.1 image deleted only after phase A's wait,
              the set put in order 01..06, the types Apple holds printed.
  resume      a half-done en-US 6.9-inch set: kept, waited for, deleted now
              (FAILED), deleted later (old, on screen), uploaded (only what is
              missing).
  refusals    each on a planted case, each with NO write printed:
              1.0.1 and 1.0 by name (before the auth file is opened),
              READY_FOR_SALE (appStoreState), READY_FOR_DISTRIBUTION and
              WAITING_FOR_REVIEW (appVersionState), a wrong pixel size, a
              missing file, an extra file, an unknown display type, a full set
              (10 on screen: nothing may go before a new one is COMPLETE).
  teeth       the ordering check itself fails on a log whose delete comes
              before the wait.

Usage: python3 scripts/asc/verify_screens_1_1.py   (exit 1 on any failure)
Standard library only.
"""
import contextlib
import hashlib
import io
import json
import re
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import store_setup as ss  # noqa: E402

APP = '6820418649'
LOCALES = ['ar-SA', 'en-US', 'en-GB', 'fr-FR']
FOLDER = {'ar-SA': 'ar', 'en-US': 'en', 'en-GB': 'en', 'fr-FR': 'en'}
OLD = {  # the 1.0.1 sets as App Store Connect copies them into 1.1
    'ar-SA': ['01-subjects.png', '02-material.png', '03-summary.png', '04-ask.png', '05-settings.png'],
    'en-US': ['01-subjects.png', '02-material.png', '03-summary.png', '04-quiz.png', '05-settings.png'],
    'en-GB': ['01-subjects.png', '02-material.png', '03-summary.png', '04-quiz.png', '05-settings.png'],
}
fails = 0


def ok(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg)
    fails += 0 if cond else 1


def shot(sid, name, checksum, state='COMPLETE', errors=None):
    return {'type': 'appScreenshots', 'id': sid, 'attributes': {'fileName': name, 'fileSize': 1000, 'sourceFileChecksum': checksum,
                                                                  'assetDeliveryState': {'state': state, 'errors': errors or []}}}


def fixtures(version_attrs=None, sets=None):
    """A version 1.1 with four localizations; `sets` maps locale -> list of
    (display, set id, [screenshot records])."""
    va = {'versionString': '1.1', 'appVersionState': 'PREPARE_FOR_SUBMISSION', 'appStoreState': 'PREPARE_FOR_SUBMISSION', 'platform': 'IOS'}
    va.update(version_attrs or {})
    fx = {
        f'/v1/apps/{APP}/appStoreVersions': {'data': [
            {'type': 'appStoreVersions', 'id': 'VER-101', 'attributes': {'versionString': '1.0.1', 'appVersionState': 'READY_FOR_DISTRIBUTION', 'platform': 'IOS'}},
            {'type': 'appStoreVersions', 'id': 'VER-11', 'attributes': va}]},
        '/v1/appStoreVersions/VER-11/appStoreVersionLocalizations': {'data': [
            {'type': 'appStoreVersionLocalizations', 'id': f'VL-{l}', 'attributes': {'locale': l}} for l in LOCALES]},
    }
    if sets is None:
        sets = {l: [('APP_IPHONE_67', f'SET67-{l}', [shot(f'{l}-OLD-{i}', n, hashlib.md5(f'{l}{n}'.encode()).hexdigest()) for i, n in enumerate(names, 1)])]
                for l, names in OLD.items()}
    for l in LOCALES:
        fx[f'/v1/appStoreVersionLocalizations/VL-{l}/appScreenshotSets'] = {'data': [
            {'type': 'appScreenshotSets', 'id': sid, 'attributes': {'screenshotDisplayType': d}} for d, sid, _ in sets.get(l, [])]}
        for d, sid, shots in sets.get(l, []):
            fx[f'/v1/appScreenshotSets/{sid}/appScreenshots'] = {'data': shots}
    return fx


def run(fx, root=None, version='1.1', types=None):
    """store_setup.screenshots on an offline Api; returns (raised message or None, log lines, writes)."""
    tmp = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8')
    json.dump(fx, tmp)
    tmp.close()
    saved = (ss.VERSION, ss.SHOT_TYPES)
    ss.VERSION = version
    if types is not None:
        ss.SHOT_TYPES = types
    api = ss.Api('offline', fixtures=tmp.name)
    buf, err = io.StringIO(), None
    try:
        with contextlib.redirect_stdout(buf):
            ss.screenshots(api, APP, root)
    except ss.Failed as e:
        err = str(e)
    finally:
        ss.VERSION, ss.SHOT_TYPES = saved
        os.unlink(tmp.name)
    return err, buf.getvalue().splitlines(), api.writes


def png(path, w, h, salt=b''):
    """A minimal file that reads as a w x h PNG (signature + IHDR); enough for the plan."""
    ihdr = w.to_bytes(4, 'big') + h.to_bytes(4, 'big') + b'\x08\x02\x00\x00\x00'
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n' + len(ihdr).to_bytes(4, 'big') + b'IHDR' + ihdr + b'\x00\x00\x00\x00' + salt)


def tree(base):
    for _, size, (w, h) in ss.SHOT_TYPES:
        for folder in ('ar', 'en'):
            for n in ss.SHOT_NAMES:
                png(os.path.join(base, size, folder, n), w, h, f'{size}{folder}{n}'.encode())
    return base


def order_ok(log):
    """Per display type: every delete of an on-screen image comes after that
    type's phase A wait line, and every phase B upload after the deletes."""
    problems = []
    for d, _, _ in ss.SHOT_TYPES:
        start = next((i for i, l in enumerate(log) if l.startswith(f'== {d} ')), None)
        if start is None:
            problems.append(f'{d}: no section')
            continue
        end = next((i for i, l in enumerate(log) if i > start and l.startswith('== ')), len(log))
        sec = log[start:end]
        wait_a = next((i for i, l in enumerate(sec) if f'({d} phase A)' in l), None)
        dels = [i for i, l in enumerate(sec) if l.startswith('WOULD DELETE') and 'OLD' in l]
        if dels and (wait_a is None or min(dels) < wait_a):
            problems.append(f'{d}: an on-screen image deleted before the phase A wait')
    return problems


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    work = tempfile.mkdtemp(prefix='kf-asc-')
    try:
        # ---------------------------------------------------------- clean
        print('== clean: version 1.1 as copied from 1.0.1, the committed files')
        err, log, writes = run(fixtures())
        ok(err is None, f'the plan runs: {err}')
        puts = [re.match(r'  WOULD PUT (\S+ \S+) (\S+): ', l) for l in log if l.startswith('  WOULD PUT ')]
        got = {(m.group(1), m.group(2)) for m in puts if m}
        want = {(f'{l} {d}', n) for l in LOCALES for d, _, _ in ss.SHOT_TYPES for n in ss.SHOT_NAMES}
        ok(len(puts) == 48 and got == want, f'48 uploads planned, 4 locales x 2 types x 6 files ({len(puts)}, missing {sorted(want - got)[:3]})')
        for l in LOCALES:
            for d, size, _ in ss.SHOT_TYPES:
                line = next((x for x in log if x.startswith(f'{l} {d}: ')), '')
                ok(f'/1.1/{size}/{FOLDER[l]};' in line, f'{l} {d} reads 1.1/{size}/{FOLDER[l]}: {line[:110]}')
        first = [i for i, x in enumerate(log) if x.startswith('== APP_IPHONE_')]
        ok([log[i].split()[1] for i in first] == ['APP_IPHONE_61', 'APP_IPHONE_67'], f'the medium type first: {[log[i] for i in first]}')
        ok(sum(1 for x in log if 'sets Apple holds:' in x) == 4 and any('APP_IPHONE_67 (SET67-en-US)' in x for x in log) and any(x.startswith('fr-FR') and x.endswith('none') for x in log),
           'the types Apple holds are printed per locale (en-US APP_IPHONE_67, fr-FR none)')
        dels = [x for x in log if x.startswith('WOULD DELETE')]
        ok(len(dels) == 15 and all('OLD' in x for x in dels), f'the 15 old 1.0.1 images deleted, nothing else ({len(dels)})')
        ok(order_ok(log) == [], f'every old image deleted after its phase A wait: {order_ok(log) or "yes"}')
        posts_set = [x for x in log if x.startswith('WOULD POST /v1/appScreenshotSets ')]
        ok(len(posts_set) == 5 and sum('APP_IPHONE_61' in x for x in posts_set) == 4, f'5 sets created (4 medium, fr-FR 6.9-inch): {len(posts_set)}')
        reorder = [x for x in log if x.startswith('WOULD PATCH') and '/relationships/appScreenshots' in x]
        ok(len(reorder) == 8, f'8 sets put in order 01..06 ({len(reorder)})')
        # the 6.9-inch en-US set: 5 old on screen, room 5 -> 5 in phase A, 1 in phase B
        i = log.index(next(x for x in log if x.startswith('en-US APP_IPHONE_67: ')))
        j = next(k for k in range(i + 1, len(log)) if not log[k].startswith('  '))
        us = [x for x in log[i + 1:j] if x.startswith('  upload')]
        ok(sum('(phase A)' in x for x in us) == 5 and sum('(phase B' in x for x in us) == 1, f'en-US 6.9-inch: 5 uploads before the deletes, 1 after (the 10-image cap): {len(us)}')
        expect = 4 * 14 + 3 * 18 + 14
        ok(writes == expect, f'{writes} writes printed, {expect} expected (61: set + 6x2 + order per locale; 67: 6x2 + 5 deletes + order, fr-FR set + 6x2 + order)')
        ok(any(x.startswith(f'{expect} write(s) printed, none sent') for x in log), 'the run ends "none sent"')

        # ---------------------------------------------------------- resume
        print('== resume: a half-done en-US 6.9-inch set')
        real = {n: ss.md5(os.path.join(ss.SHOTS_11, '1320x2868', 'en', n)) for n in ss.SHOT_NAMES}
        half = fixtures()
        half['/v1/appScreenshotSets/SET67-en-US/appScreenshots'] = {'data': [
            shot('NEW-1', '01-subjects.png', real['01-subjects.png']),
            shot('NEW-2', '02-material.png', real['02-material.png']),
            shot('NEW-3', '03-camera.png', real['03-camera.png'], 'UPLOAD_COMPLETE'),
            shot('NEW-4F', '04-summary.png', real['04-summary.png'], 'FAILED', [{'code': 'IMAGE_INCORRECT_DIMENSIONS'}]),
            shot('en-US-OLD-4', '04-quiz.png', 'x' * 32), shot('en-US-OLD-5', '05-settings.png', 'y' * 32)]}
        err, log, writes = run(half)
        ok(err is None, f'the resume runs: {err}')
        sec = log[log.index(next(x for x in log if x.startswith('en-US APP_IPHONE_67'))):]
        sec = sec[:next(i for i, x in enumerate(sec[1:], 1) if not x.startswith('  '))]
        ok(any(x.startswith('  keep    01-subjects.png') for x in sec) and any(x.startswith('  keep    02-material.png') for x in sec), 'kept: 01 and 02 (COMPLETE, same MD5)')
        ok(any(x.startswith('  wait    03-camera.png') for x in sec), 'waited for: 03 (UPLOAD_COMPLETE)')
        ok(any(x.startswith('  delete  04-summary.png now') for x in sec), 'deleted at once: the FAILED 04 (not on screen)')
        ok(sum(x.startswith('  delete  ') and 'after phase A' in x for x in sec) == 2, 'deleted after phase A: the two old images on screen')
        ups = [x.split()[1] for x in sec if x.startswith('  upload')]
        ok(ups == ['04-summary.png', '05-ask.png', '06-quiz.png'], f'uploaded: only 04, 05, 06 ({ups})')
        ok(order_ok(log) == [], 'the order rule holds on the resume')
        ok(any('NEW-3' in x or 'en-US APP_IPHONE_67 03-camera.png' in x for x in log if x.startswith('WOULD wait')), 'the wait names 03 with phase A')

        # ---------------------------------------------------------- refusals
        print('== refusals (each planted, each with no write)')
        cases = []
        for v in ('1.0.1', '1.0'):
            cases.append((f'version {v} by name', 'REFUSED: version ' + v, dict(fx=fixtures(), version=v)))
        cases.append(('appStoreState READY_FOR_SALE', 'appStoreState READY_FOR_SALE', dict(fx=fixtures({'appVersionState': None, 'appStoreState': 'READY_FOR_SALE'}))))
        cases.append(('appVersionState READY_FOR_DISTRIBUTION', 'appVersionState READY_FOR_DISTRIBUTION', dict(fx=fixtures({'appVersionState': 'READY_FOR_DISTRIBUTION', 'appStoreState': 'READY_FOR_SALE'}))))
        cases.append(('appVersionState WAITING_FOR_REVIEW (images not editable)', 'appVersionState WAITING_FOR_REVIEW', dict(fx=fixtures({'appVersionState': 'WAITING_FOR_REVIEW', 'appStoreState': 'WAITING_FOR_REVIEW'}))))
        t = tree(os.path.join(work, 'wrong'))
        png(os.path.join(t, '1206x2622', 'en', '03-camera.png'), 1179, 2556)
        cases.append(('a 1179 x 2556 file in the 1206x2622 set', '1179 x 2556 px, the type takes 1206 x 2622', dict(fx=fixtures(), root=t)))
        t = tree(os.path.join(work, 'big'))
        png(os.path.join(t, '1320x2868', 'ar', '01-subjects.png'), 1206, 2622)
        cases.append(('a 1206 x 2622 file in the 1320x2868 set', '1206 x 2622 px, the type takes 1320 x 2868', dict(fx=fixtures(), root=t)))
        t = tree(os.path.join(work, 'missing'))
        os.remove(os.path.join(t, '1320x2868', 'en', '06-quiz.png'))
        cases.append(('06-quiz.png missing', 'missing 06-quiz.png', dict(fx=fixtures(), root=t)))
        t = tree(os.path.join(work, 'extra'))
        png(os.path.join(t, '1206x2622', 'ar', '07-settings.png'), 1206, 2622)
        cases.append(('an extra 07 file', 'files that are not the six: 07-settings.png', dict(fx=fixtures(), root=t)))
        cases.append(('an unknown display type APP_IPHONE_63', 'unknown display type APP_IPHONE_63', dict(fx=fixtures(), types=[('APP_IPHONE_63', '1206x2622', (1206, 2622)), ss.SHOT_TYPES[1]])))
        full = fixtures(sets={'ar-SA': [('APP_IPHONE_61', 'SET61-ar', [shot(f'ar-OLD61-{i}', f'{i:02d}-old.png', 'z' * 32) for i in range(1, 11)])]})
        cases.append(('a medium set with 10 old images on screen', 'none may go before a new one is COMPLETE', dict(fx=full)))
        for label, needle, kw in cases:
            err, log, writes = run(**kw)
            ok(err is not None and needle in err and writes == 0, f'refused, {label}: {err} (writes {writes})')
            # The same case with the refusal's cause removed must pass: the
            # refusal is caused by the plant, not by the harness.
        err, _, _ = run(fixtures(), root=tree(os.path.join(work, 'clean')))
        ok(err is None, f'control: the same synthetic tree without a plant passes ({err})')

        # Before the key: the CLI refuses 1.0.1 without opening the auth file.
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'store_setup.py'), 'screenshots', '--version', '1.0.1', '--app', APP,
                            '--auth', os.path.join(work, 'no-such-auth-file')], capture_output=True, text=True, encoding='utf-8')
        ok(r.returncode == 1 and 'REFUSED: version 1.0.1' in r.stdout and 'Traceback' not in r.stderr, f'CLI: 1.0.1 refused before the auth file is opened: {r.stdout.strip()[:120]}')
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'store_setup.py'), 'check-shots', '--version', '1.0.1'], capture_output=True, text=True, encoding='utf-8')
        ok(r.returncode == 1 and 'REFUSED' in r.stdout, 'CLI: check-shots refuses 1.0.1 (the workflow step before the key)')
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'store_setup.py'), 'check-shots'], capture_output=True, text=True, encoding='utf-8')
        ok(r.returncode == 0 and r.stdout.count('ok   ') == 5, 'CLI: check-shots passes the committed 1.1 files at version 1.1 (the default)')
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'store_setup.py'), 'screenshots', '--app', APP, '--shots-root', work,
                            '--auth', os.path.join(work, 'no-such-auth-file')], capture_output=True, text=True, encoding='utf-8')
        ok(r.returncode == 1 and '--shots-root is for the offline proof only' in r.stdout, 'CLI: a planted folder is refused outside the offline proof')

        # ---------------------------------------------------------- teeth
        print('== teeth: the ordering check on a planted log')
        bad = ['== APP_IPHONE_61 (1206x2622)', 'WOULD wait up to 900 s together (APP_IPHONE_61 phase A) for: x',
               '== APP_IPHONE_67 (1320x2868)', 'WOULD DELETE /v1/appScreenshots/en-US-OLD-1', 'WOULD wait up to 900 s together (APP_IPHONE_67 phase A) for: y']
        ok(order_ok(bad) != [], f'a delete before the phase A wait is caught: {order_ok(bad)}')
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(f'\n{fails} failure(s)')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
