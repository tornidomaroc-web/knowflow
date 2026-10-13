"""Step Store-Shots-1: the checks on an App Store capture (ios-signed-in.yml,
scenario screenshots), from the harness's readings and the PNG sizes.

  - both sets signed in and finished: ten shots, five per language, in the
    order of captions.json;
  - every shot signed in, no Google button, no plan, price, upgrade or
    checkout word or link (the app's probe), and its own reading clean;
  - no shot shows a subject or file name of the other language's account;
  - the Arabic Ask shot shows its sources; the English quiz is on screen;
  - Settings: no e-mail text, the reminder on at 19:00;
  - each set ended signed out; every PNG exactly 1320 x 2868.

  - every page step (nav, login, sign-out) left the page it started on and
    reached its own (scripts/ios/page_steps.py): a slow load fails the
    capture instead of being photographed as the page before it.

Usage: python3 scripts/store-seed/check_capture.py smoke-shots.jsonl sizes.txt steps-ar.json steps-en.json
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'ios'))
from page_steps import page_step_checks  # noqa: E402
CAPTIONS = json.load(open(os.path.join(ROOT, 'docs', 'store', 'screenshots-designed', 'captions.json'), encoding='utf-8'))

rows = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
sizes = open(sys.argv[2], encoding='utf-8').read().splitlines()
by = {}
for r in rows:
    by.setdefault(r['step'], r)
fails = []


def need(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


for loc in ('ar', 'en'):
    want = [f"shot-{loc}-{e['file'][:-4]}" for e in CAPTIONS[loc]]
    got = [r['step'] for r in rows if r['step'].startswith(f'shot-{loc}-')]
    need(got == want, f'{loc}: the five shots in caption order: {got}')
    need(by.get('login', {}).get('result') == 'submitted', f"{loc}: the login form was submitted")
    for name in want:
        r = by.get(name, {})
        res = str(r.get('result', ''))
        p = r.get('probe') or {}
        pur = p.get('purchase') or {}
        need(not pur.get('words') and not pur.get('hrefs'), f'{name}: no price, plan, upgrade or checkout word or link: {pur}')
        need(p.get('signedIn') is True and p.get('google') == 0, f'{name}: signed in, no Google button')
        need(not res.startswith('no '), f'{name}: {res[:160]}')
        need(res.endswith('other language: none'), f"{name}: no subject or file name of the other language's account: {res[-120:]}")
    s5 = str(by.get(f'shot-{loc}-05-settings', {}).get('result', ''))
    need('e-mail text left in page: false' in s5, f'Settings ({loc}) has no e-mail text left')
    need('reminder on 19:00' in s5, f'Settings ({loc}) shows the reminder on at 19:00: {s5[:200]}')
    s3 = str(by.get(f'shot-{loc}-03-summary', {}).get('result', ''))
    m = re.search(r'heading top (-?\d+), bar bottom (\d+)', s3)
    need(bool(m) and int(m.group(1)) >= int(m.group(2)) + 4, f'Summary ({loc}): the heading sits fully below any bar: {s3[:120]}')
    need(by.get(f'signout-{loc}', {}).get('result') == 'signed out', f'{loc}: the set ends signed out')

need(str(by.get('quiz-open', {}).get('result', '')).startswith('clicked quiz on '), f"Quiz (en): opened on the seeded file's own card: {by.get('quiz-open', {}).get('result')}")
need('sources: yes' in str(by.get('shot-ar-04-ask', {}).get('result', '')), 'Ask (ar): the answer shows its sources under المصادر')
need(str(by.get('shot-en-04-quiz', {}).get('result', '')).startswith('quiz in view'), 'Quiz (en): the stored quiz is on screen from question 1')
steps_lists = [json.load(open(p, encoding='utf-8')) for p in sys.argv[3:]]
need(len(steps_lists) == 2, f'both steps files given ({len(steps_lists)})')
for ok, msg in page_step_checks(rows, steps_lists):
    need(ok, msg)
need(len(sizes) == 10 and all(' 1320 x 2868,' in l for l in sizes), f'every PNG is 1320 x 2868 ({len(sizes)} files)')
print(f'\n{len(fails)} failure(s)')
sys.exit(1 if fails else 0)
