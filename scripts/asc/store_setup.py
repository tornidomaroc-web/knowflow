#!/usr/bin/env python3
"""
Step S7d: the App Store Connect settings of version 1.0 through the ASC API
(.github/workflows/asc-store-setup.yml runs this; docs/store/ASC_ANSWERS.md and
ASC_ANSWERS_EN.md hold the answers). Python standard library only.

MODES
  read         prints the state, writes nothing: the app (primary locale,
               content rights), its App Info localizations, version 1.0 (state,
               attached build), its version localizations and their screenshot
               sets, the price schedule, the availability by territory.
  settings     price Free (the USA base price point of 0), every territory
               available except mainland China (CHN) and new territories on,
               content rights "does not use third-party content". Idempotent:
               only what differs is written. Ends with a read-back that fails
               unless all three hold.
  screenshots  the five approved PNGs of each language
               (docs/store/screenshots-designed/{ar,en}/01..05) into the
               APP_IPHONE_67 set (the 6.9-inch slot: 1320 x 2868) of the ar and
               en-US version localizations, in order. Idempotent: a set that
               already holds the five (same file names and MD5 checksums in
               order, all COMPLETE) is left alone, no write; any other set is
               emptied and uploaded again, and a missing set is created; each
               upload must reach COMPLETE with Apple's checksum equal to the
               file's MD5. A language whose version localization does not
               exist is reported and skipped, never created here.
  arabic-appinfo
               the owner-approved Arabic name and subtitle (docs/store/
               ASC_ANSWERS.md section 4.2, read from the file) into the ar-SA
               App Info localization, those two fields and nothing else; the
               read-back compares them byte for byte.
  english      the en-US App Info localization (name, subtitle, privacy URL)
               and version localization (description, keywords, promotional
               text, support URL) from docs/store/ASC_ANSWERS_EN.md, only when
               docs/store/ASC_ANSWERS_EN.approved holds that file's SHA-256.
  check-en     the English text's limits, dashes and wording, offline.

NOT IN THE API. The availability of the iPhone app on Macs with Apple silicon
and on Apple Vision Pro: App Store Connect API 4.5.1 has no field for it (the
only fields of those names, iosBuildsAvailableForAppleSiliconMac and
iosBuildsAvailableForAppleVision, belong to TestFlight beta groups). The read
says so; the settings mode does not pretend.

TRANSPORTS
  --live            sends every call.
  (default) dry     sends the reads, prints every write exactly (method, path,
                    JSON body) and sends none.
  --offline FILE    no network: the reads come from FILE (path -> body), every
                    write is printed. The local proof.

NEVER WRITTEN, IN ANY MODE: the review details (the reviewer account lives
there), a build of the version, a submission, users, testers. `Api.call`
refuses such a path before anything is sent.

THE LOG IS PUBLIC. Printed: HTTP statuses, ids, states, locales, counts,
field names, file names, checksums, the store text (public once live), and in
dry or offline mode the write bodies. Never printed: the token (it is read
from a file), the presigned upload URLs and their headers.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = 'https://api.appstoreconnect.apple.com'
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EN_FILE = os.path.join(ROOT, 'docs', 'store', 'ASC_ANSWERS_EN.md')
AR_FILE = os.path.join(ROOT, 'docs', 'store', 'ASC_ANSWERS.md')
AR_APPROVAL = 'Approved by the owner on 2026-10-10'
EN_FLAG = os.path.join(ROOT, 'docs', 'store', 'ASC_ANSWERS_EN.approved')
SHOTS = os.path.join(ROOT, 'docs', 'store', 'screenshots-designed')
WORDING = os.path.join(ROOT, 'scripts', 'lib', 'app-wording.mjs')
VERSION = '1.0'
DISPLAY = 'APP_IPHONE_67'
NO_CHINA = 'CHN'
BASE_TERRITORY = 'USA'
RIGHTS = 'DOES_NOT_USE_THIRD_PARTY_CONTENT'
# Version-localization locale -> folder of approved PNGs.
SHOT_TARGETS = [('ar', 'ar'), ('en-US', 'en')]
EN_FIELDS = {'name': 30, 'subtitle': 30, 'keywords': 100, 'promotionalText': 170, 'description': 4000, 'supportUrl': 255, 'privacyPolicyUrl': 255}
FORBIDDEN = re.compile(r'appStoreReviewDetail|/build\b|/builds|reviewSubmission|appStoreVersionSubmission|betaTester|betaGroup|/users|userInvitation|/relationships/build')


class Failed(Exception):
    pass


def say(msg):
    print(msg, flush=True)


class Api:
    def __init__(self, transport, auth_file=None, fixtures=None):
        self.transport = transport
        self.header = None
        if transport != 'offline':
            line = open(auth_file, encoding='utf-8').read().strip()
            if not line.startswith('Authorization: Bearer '):
                raise Failed('the auth header file is not "Authorization: Bearer <token>"')
            self.header = line.split(': ', 1)[1]
        self.fixtures = json.load(open(fixtures, encoding='utf-8')) if fixtures else {}
        self.writes = 0
        self.fake = 0

    def call(self, method, path, body=None):
        if method != 'GET' and FORBIDDEN.search(path):
            raise Failed(f'REFUSED: {method} {path} is never written by this script')
        if method != 'GET' and self.transport != 'live':
            self.writes += 1
            self.fake += 1
            say(f'WOULD {method} {path}' + (f' {json.dumps(body, ensure_ascii=False, separators=(",", ":"))}' if body is not None else ''))
            data = (body or {}).get('data') or {}
            fake = {'data': {'type': data.get('type') if isinstance(data, dict) else None, 'id': f'DRY-{self.fake}',
                             'attributes': dict((data.get('attributes') or {}) if isinstance(data, dict) else {})}}
            return (201 if method == 'POST' else 204 if method == 'DELETE' else 200), fake
        if self.transport == 'offline':
            key = path.split('?', 1)[0]
            if key in self.fixtures:
                return 200, self.fixtures[key]
            return 404, {'errors': [{'status': '404', 'code': 'NOT_FOUND', 'title': 'offline fixture missing'}]}
        url = path if path.startswith('http') else BASE + path
        if not url.startswith(BASE + '/'):
            raise Failed('refusing a URL outside the App Store Connect API')
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(url, data=data, method=method, headers={'Authorization': self.header, 'Content-Type': 'application/json'})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    raw = r.read()
                    code = r.status
            except urllib.error.HTTPError as e:
                raw, code = e.read(), e.code
            except urllib.error.URLError as e:
                raw, code = json.dumps({'errors': [{'status': '000', 'code': 'NETWORK', 'title': str(e.reason)[:120]}]}).encode(), 0
            if method == 'GET' and code in (0, 429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(3 * (attempt + 1))
                continue
            break
        if method != 'GET':
            self.writes += 1
        try:
            return code, (json.loads(raw) if raw else {})
        except ValueError:
            return code, {}

    def need(self, method, path, body=None, ok=(200,)):
        code, js = self.call(method, path, body)
        label = path.split('?', 1)[0]
        # A write in dry or offline mode gets a made-up status from call();
        # say so, or a reader takes the 200 for Apple's answer.
        say(f'  {method} {label}: {code}' + (f' ({self.transport}, not sent)' if method != 'GET' and self.transport != 'live' else ''))
        if code not in ok:
            for e in (js.get('errors') or [])[:5]:
                say(f"    error: {e.get('status')} {e.get('code')} {e.get('title')}: {(e.get('detail') or '')[:240]}")
            raise Failed(f'{method} {label} answered {code}')
        return js

    def get(self, path, allow404=False):
        code, js = self.call('GET', path)
        if allow404 and code == 404:
            return None
        if code != 200:
            for e in (js.get('errors') or [])[:5]:
                say(f"    error: {e.get('status')} {e.get('code')} {e.get('title')}: {(e.get('detail') or '')[:240]}")
            raise Failed(f"GET {path.split('?', 1)[0]} answered {code}")
        return js

    def all(self, path, allow404=False):
        out, included, nxt, pages = [], [], path, 0
        while nxt and pages < 30:
            js = self.get(nxt, allow404=allow404 and pages == 0)
            if js is None:
                return None, None
            out += js.get('data') or []
            included += js.get('included') or []
            nxt = (js.get('links') or {}).get('next')
            pages += 1
        return out, included


# ---------------------------------------------------------------- reading

def version_of(api, app):
    vs, _ = api.all(f'/v1/apps/{app}/appStoreVersions?filter[platform]=IOS&filter[versionString]={VERSION}&fields[appStoreVersions]=versionString,appVersionState,platform&limit=5')
    if len(vs) != 1:
        raise Failed(f'expected exactly one iOS version {VERSION}, found {len(vs)}')
    return vs[0]


def version_locs(api, vid):
    locs, _ = api.all(f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50')
    return locs


def editable_app_info(api, app):
    infos, _ = api.all(f'/v1/apps/{app}/appInfos?limit=10')
    live = ('READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO')
    edit = [i for i in infos if (i.get('attributes') or {}).get('state') not in live and (i.get('attributes') or {}).get('appStoreState') not in live]
    return (edit or infos or [None])[0]


def shot_set(api, lid):
    sets, _ = api.all(f'/v1/appStoreVersionLocalizations/{lid}/appScreenshotSets?filter[screenshotDisplayType]={DISPLAY}&limit=10')
    return sets[0] if sets else None


def shots_in(api, sid):
    shots, _ = api.all(f'/v1/appScreenshotSets/{sid}/appScreenshots?fields[appScreenshots]=fileName,fileSize,sourceFileChecksum,assetDeliveryState&limit=50')
    return shots


def price_state(api, app):
    sched = api.get(f'/v1/apps/{app}/appPriceSchedule', allow404=True)
    sid = ((sched or {}).get('data') or {}).get('id')
    if not sid:
        return None
    # With no price set, Apple still answers the relationship with an id (the
    # app's own) whose base territory and prices are 404 (read run
    # 38665885040): that is "no schedule".
    base = api.get(f'/v1/appPriceSchedules/{sid}/baseTerritory', allow404=True)
    if not base or not base.get('data'):
        return None
    prices, inc = api.all(f'/v1/appPriceSchedules/{sid}/manualPrices?include=appPricePoint,territory&fields[appPricePoints]=customerPrice&limit=200', allow404=True)
    if prices is None:
        return None
    points = {i['id']: (i.get('attributes') or {}).get('customerPrice') for i in inc if i.get('type') == 'appPricePoints'}
    rows = []
    for p in prices:
        a = p.get('attributes') or {}
        rel = p.get('relationships') or {}
        pp = ((rel.get('appPricePoint') or {}).get('data') or {}).get('id')
        terr = ((rel.get('territory') or {}).get('data') or {}).get('id')
        rows.append({'territory': terr, 'customerPrice': points.get(pp), 'startDate': a.get('startDate'), 'endDate': a.get('endDate')})
    return {'id': sid, 'base': ((base.get('data') or {}).get('id')), 'manual': rows}


def is_free(state):
    if not state or state['base'] != BASE_TERRITORY:
        return False
    current = [r for r in state['manual'] if r['territory'] in (BASE_TERRITORY, None) and not r['endDate']]
    return bool(current) and all(r['customerPrice'] is not None and float(r['customerPrice']) == 0 for r in current)


def availability_state(api, app):
    av = api.get(f'/v1/apps/{app}/appAvailabilityV2', allow404=True)
    aid = ((av or {}).get('data') or {}).get('id')
    if not aid:
        return None
    attrs = ((av or {}).get('data') or {}).get('attributes') or {}
    tas, inc = api.all(f'/v2/appAvailabilities/{aid}/territoryAvailabilities?include=territory&fields[territoryAvailabilities]=available,territory&limit=200', allow404=True)
    if tas is None:
        return None
    rows = {}
    for t in tas:
        terr = (((t.get('relationships') or {}).get('territory') or {}).get('data') or {}).get('id')
        rows[terr] = {'id': t['id'], 'available': (t.get('attributes') or {}).get('available')}
    return {'id': aid, 'new': attrs.get('availableInNewTerritories'), 'territories': rows}


def read_all(api, app):
    say('== read')
    a = api.get(f'/v1/apps/{app}?fields[apps]=name,primaryLocale,contentRightsDeclaration,bundleId')['data']['attributes']
    say(f"app {app}: bundle {a.get('bundleId')}, primary locale {a.get('primaryLocale')}, content rights {a.get('contentRightsDeclaration') or 'not set'}")
    info = editable_app_info(api, app)
    if info:
        ia = info.get('attributes') or {}
        say(f"app info {info['id']}: state {ia.get('state') or ia.get('appStoreState')}")
        ils, _ = api.all(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")
        for l in ils:
            la = l.get('attributes') or {}
            say(f"  app info localization {la.get('locale')}: name {len(la.get('name') or '')} chars, subtitle {len(la.get('subtitle') or '')} chars, privacy URL {'set' if la.get('privacyPolicyUrl') else 'empty'}")
    v = version_of(api, app)
    say(f"version {VERSION}: id {v['id']}, state {v['attributes'].get('appVersionState')}")
    b = api.get(f"/v1/appStoreVersions/{v['id']}/build", allow404=True)
    say(f"  build attached: {'yes, ' + b['data']['id'] if b and b.get('data') else 'none'}")
    for l in version_locs(api, v['id']):
        la = l.get('attributes') or {}
        fields = ', '.join(f"{k} {'set' if la.get(k) else 'empty'}" for k in ('description', 'keywords', 'promotionalText', 'supportUrl', 'marketingUrl'))
        say(f"  version localization {la.get('locale')} ({l['id']}): {fields}")
        sets, _ = api.all(f"/v1/appStoreVersionLocalizations/{l['id']}/appScreenshotSets?limit=50")
        if not sets:
            say('    screenshot sets: none')
        for s in sets:
            shots = shots_in(api, s['id'])
            say(f"    screenshot set {s['attributes'].get('screenshotDisplayType')}: {len(shots)} screenshot(s)")
            for sh in shots:
                sa = sh.get('attributes') or {}
                say(f"      {sa.get('fileName')}: {((sa.get('assetDeliveryState') or {}).get('state'))}, checksum {sa.get('sourceFileChecksum')}")
    p = price_state(api, app)
    if not p:
        say('price schedule: none')
    else:
        say(f"price schedule {p['id']}: base territory {p['base']}, manual prices {len(p['manual'])}: " + '; '.join(f"{r['territory'] or 'base'} {r['customerPrice']} from {r['startDate'] or 'now'}" for r in p['manual'][:5]) + f" -> free: {'yes' if is_free(p) else 'no'}")
    av = availability_state(api, app)
    if not av:
        say('availability: none set up')
    else:
        rows = av['territories']
        on = sorted(k for k, r in rows.items() if r['available'])
        off = sorted(k for k, r in rows.items() if not r['available'])
        say(f"availability {av['id']}: {len(on)} available, {len(off)} not ({', '.join(off[:12]) or 'none'}); {NO_CHINA} {'available' if rows.get(NO_CHINA, {}).get('available') else 'not available'}; new territories {av['new']}")
    say('Mac (Apple silicon) and Apple Vision Pro availability: not in the App Store Connect API (4.5.1); read and set in the App Store Connect web page, Pricing and Availability')
    return {'app': a, 'version': v, 'price': p, 'availability': av}


# ---------------------------------------------------------------- settings

def settings(api, app):
    say('== settings')
    a = api.get(f'/v1/apps/{app}?fields[apps]=contentRightsDeclaration')['data']['attributes']
    if a.get('contentRightsDeclaration') == RIGHTS:
        say(f'content rights: already {RIGHTS}')
    else:
        api.need('PATCH', f'/v1/apps/{app}', {'data': {'type': 'apps', 'id': app, 'attributes': {'contentRightsDeclaration': RIGHTS}}})
    p = price_state(api, app)
    if is_free(p):
        say('price: already free in the base territory USA')
    else:
        free, page = None, f'/v1/apps/{app}/appPricePoints?filter[territory]={BASE_TERRITORY}&fields[appPricePoints]=customerPrice&limit=200'
        for _ in range(10):
            js = api.get(page)
            free = next((pp for pp in js.get('data') or [] if float((pp.get('attributes') or {}).get('customerPrice') or 1) == 0), None)
            page = (js.get('links') or {}).get('next')
            if free or not page:
                break
        if not free:
            raise Failed('no price point of 0 in USA')
        say(f"price: the USA price point of 0 is {free['id']}, customerPrice {(free.get('attributes') or {}).get('customerPrice')!r} as Apple returned it")
        free = free['id']
        api.need('POST', '/v1/appPriceSchedules', {
            'data': {'type': 'appPriceSchedules', 'relationships': {
                'app': {'data': {'type': 'apps', 'id': app}},
                'baseTerritory': {'data': {'type': 'territories', 'id': BASE_TERRITORY}},
                'manualPrices': {'data': [{'type': 'appPrices', 'id': '${price-usa}'}]}}},
            'included': [{'type': 'appPrices', 'id': '${price-usa}', 'attributes': {'startDate': None},
                          'relationships': {'appPricePoint': {'data': {'type': 'appPricePoints', 'id': free}}}}]}, ok=(201,))
    av = availability_state(api, app)
    if not av:
        terrs, _ = api.all('/v1/territories?limit=200')
        ids = sorted(t['id'] for t in terrs)
        if NO_CHINA not in ids or (api.transport != 'offline' and len(ids) < 100):
            raise Failed(f'the territory list looks wrong ({len(ids)} territories)')
        say(f'availability: none yet; creating it for {len(ids)} territories, all but {NO_CHINA}')
        api.need('POST', '/v2/appAvailabilities', {
            'data': {'type': 'appAvailabilities', 'attributes': {'availableInNewTerritories': True}, 'relationships': {
                'app': {'data': {'type': 'apps', 'id': app}},
                'territoryAvailabilities': {'data': [{'type': 'territoryAvailabilities', 'id': f'${{ta-{t}}}'} for t in ids]}}},
            'included': [{'type': 'territoryAvailabilities', 'id': f'${{ta-{t}}}', 'attributes': {'available': t != NO_CHINA},
                          'relationships': {'territory': {'data': {'type': 'territories', 'id': t}}}} for t in ids]}, ok=(201,))
    else:
        wrong = {k: r for k, r in av['territories'].items() if bool(r['available']) != (k != NO_CHINA)}
        say(f'availability: exists; {len(wrong)} territory setting(s) to change')
        for k, r in sorted(wrong.items()):
            api.need('PATCH', f"/v1/territoryAvailabilities/{r['id']}", {'data': {'type': 'territoryAvailabilities', 'id': r['id'], 'attributes': {'available': k != NO_CHINA}}})
        if av['new'] is not True:
            say('::warning::availableInNewTerritories is not true and the API has no update for it; set it in the web page if new storefronts should get the app')
    say('Mac (Apple silicon) and Apple Vision Pro: NOT SET HERE (not in the API); a web-page step, see the read')
    if api.transport != 'live':
        say(f'{api.writes} write(s) printed, none sent')
        return
    say('== read-back')
    a = api.get(f'/v1/apps/{app}?fields[apps]=contentRightsDeclaration')['data']['attributes']
    p = price_state(api, app)
    av = availability_state(api, app)
    read_back_sha('contentRightsDeclaration', a.get('contentRightsDeclaration'))
    for r in (p or {}).get('manual') or []:
        read_back_sha(f"customerPrice {r['territory'] or 'base'}", r['customerPrice'])
    checks = [
        (a.get('contentRightsDeclaration') == RIGHTS, f"content rights {a.get('contentRightsDeclaration')}"),
        (is_free(p), f"price free in USA: {p and p['manual'][:3]}"),
        (bool(av) and all(bool(r['available']) == (k != NO_CHINA) for k, r in av['territories'].items()) and len(av['territories']) >= 100,
         f"availability: {sum(1 for r in (av or {}).get('territories', {}).values() if r['available'])} available, {NO_CHINA} {'not available' if av and not av['territories'].get(NO_CHINA, {}).get('available') else 'AVAILABLE'}"),
        (bool(av) and av['new'] is True, f"availableInNewTerritories {(av or {}).get('new')!r}"),
    ]
    return verdict(checks)


def read_back_sha(label, value):
    """A value as Apple returned it, as its SHA-256: the log proves the live text without printing it."""
    s = '' if value is None else str(value)
    say(f"  read back {label}: {len(s)} chars, utf-8 sha256 {hashlib.sha256(s.encode('utf-8')).hexdigest()}")


def verdict(checks):
    bad = 0
    for ok, msg in checks:
        say(('ok   ' if ok else 'FAIL ') + msg)
        bad += 0 if ok else 1
    if bad:
        raise Failed(f'{bad} read-back check(s) failed')


# ---------------------------------------------------------------- screenshots

def md5(path):
    return hashlib.md5(open(path, 'rb').read()).hexdigest()


def put_parts(path, ops):
    data = open(path, 'rb').read()
    for op in ops:
        chunk = data[op['offset']:op['offset'] + op['length']]
        req = urllib.request.Request(op['url'], data=chunk, method=op.get('method') or 'PUT', headers={h['name']: h['value'] for h in op.get('requestHeaders') or []})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                code = r.status
        except urllib.error.HTTPError as e:
            code = e.code
        if code not in (200, 201, 204):
            raise Failed(f'an upload part of {os.path.basename(path)} answered {code}')
    return len(ops)


def held(shots):
    """What a set holds, as (fileName, sourceFileChecksum, delivery state) in Apple's order."""
    return [((g.get('attributes') or {}).get('fileName'), (g.get('attributes') or {}).get('sourceFileChecksum'),
             ((g.get('attributes') or {}).get('assetDeliveryState') or {}).get('state')) for g in shots]


def wanted(files):
    return [(os.path.basename(f), md5(f), 'COMPLETE') for f in files]


def screenshots(api, app):
    say('== screenshots')
    v = version_of(api, app)
    locs = version_locs(api, v['id'])
    pending, done, kept = [], [], []
    for prefix, folder in SHOT_TARGETS:
        files = sorted(glob.glob(os.path.join(SHOTS, folder, '0[1-5]-*.png')))
        if len(files) != 5:
            raise Failed(f'{folder}: expected the five approved PNGs, found {len(files)}')
        loc = next((l for l in locs if (l['attributes'].get('locale') or '') == prefix or (prefix == 'ar' and (l['attributes'].get('locale') or '').startswith('ar'))), None)
        if not loc:
            say(f'{prefix}: no version localization yet; SKIPPED (the english mode creates en-US once its text is approved)')
            pending.append(prefix)
            continue
        locale = loc['attributes']['locale']
        say(f'{locale} ({loc["id"]}): {len(files)} files from docs/store/screenshots-designed/{folder}')
        s = shot_set(api, loc['id'])
        if s:
            # Compare before any DELETE: the approved five already in place, in
            # order and COMPLETE, are not deleted for nothing (the ar-SA set,
            # run 38770955611). A set with any other name, checksum, count or
            # delivery state is emptied and uploaded again.
            old = shots_in(api, s['id'])
            have = held(old)
            if have == wanted(files):
                say(f'{locale}: already the approved five, unchanged')
                kept.append(locale)
                done.append((locale, s['id'], files))
                continue
            say(f'  {DISPLAY} set {s["id"]}: {len(old)} existing screenshot(s) differ from the files, removed first')
            for name, sum_, state in have:
                say(f'    had {name}: {state}, checksum {sum_}')
            for o in old:
                api.need('DELETE', f"/v1/appScreenshots/{o['id']}", ok=(204,))
            sid = s['id']
        else:
            js = api.need('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': DISPLAY},
                                                                    'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': loc['id']}}}}}, ok=(201,))
            sid = js['data']['id']
        ids = []
        for f in files:
            name, size, sum_ = os.path.basename(f), os.path.getsize(f), md5(f)
            js = api.need('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots', 'attributes': {'fileName': name, 'fileSize': size},
                                                                 'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': sid}}}}}, ok=(201,))
            shot = js['data']['id']
            ids.append(shot)
            ops = (js['data'].get('attributes') or {}).get('uploadOperations') or []
            if api.transport == 'live':
                say(f'  {name}: {size} bytes in {put_parts(f, ops)} part(s)')
            else:
                say(f'  WOULD PUT {name}: {size} bytes to the reserved upload operations (presigned, not printed)')
            api.need('PATCH', f'/v1/appScreenshots/{shot}', {'data': {'type': 'appScreenshots', 'id': shot, 'attributes': {'uploaded': True, 'sourceFileChecksum': sum_}}})
            if api.transport == 'live':
                state = None
                for _ in range(60):
                    a = api.get(f'/v1/appScreenshots/{shot}?fields[appScreenshots]=assetDeliveryState,sourceFileChecksum')['data']['attributes']
                    state = (a.get('assetDeliveryState') or {}).get('state')
                    if state in ('COMPLETE', 'FAILED'):
                        break
                    time.sleep(5)
                if state != 'COMPLETE':
                    errs = [e.get('code') for e in ((a.get('assetDeliveryState') or {}).get('errors') or [])]
                    raise Failed(f'{name}: delivery state {state} {errs}')
                say(f'  {name}: COMPLETE')
        api.need('PATCH', f'/v1/appScreenshotSets/{sid}/relationships/appScreenshots', {'data': [{'type': 'appScreenshots', 'id': i} for i in ids]}, ok=(200, 204))
        done.append((locale, sid, files))
    if api.transport != 'live':
        say(f'{api.writes} write(s) printed, none sent; unchanged: {kept or "none"}; pending: {pending or "none"}')
        return
    say('== read-back')
    checks = []
    for locale, sid, files in done:  # the kept sets too: the read-back verifies every locale, not only the written ones
        have, want = held(shots_in(api, sid)), wanted(files)
        for (wn, wm, _), (hn, hm, st) in zip(want, have):
            say(f'  {locale} {hn}: {st}, checksum {"=" if hm == wm else "!="} file MD5 {wm}')
        checks.append((have == want, f'{locale}: {len(have)} screenshots in order 01 to 05, all COMPLETE, checksums equal to the files'
                       + (' (unchanged)' if locale in kept else '')))
    for p in pending:
        say(f'pending: {p} (no version localization)')
    verdict(checks)


# ---------------------------------------------------------------- english

def en_text():
    src = open(EN_FILE, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    out = {}
    for k in EN_FIELDS:
        m = re.search(r'<!-- asc-en:' + k + r':begin -->\s*```\n(.*?)\n```\s*<!-- asc-en:' + k + r':end -->', src, re.S)
        if not m:
            raise Failed(f'{k}: its markers are not in {os.path.relpath(EN_FILE, ROOT)}')
        out[k] = m.group(1)
    return out


def wording(text):
    js = ("import { kfWording } from " + json.dumps('file://' + WORDING.replace(os.sep, '/')) + ";"
          "let t='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>t+=d).on('end',()=>console.log(JSON.stringify(kfWording(t))));")
    r = subprocess.run(['node', '--input-type=module', '-e', js], input=text, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise Failed('the wording rule did not run: ' + r.stderr[:200])
    return json.loads(r.stdout)


def check_en():
    say('== check-en')
    t = en_text()
    bad = 0
    for k, lim in EN_FIELDS.items():
        v = t[k]
        probs = []
        if not v.strip():
            probs.append('empty')
        if len(v) > lim:
            probs.append(f'over the limit by {len(v) - lim}')
        if '—' in v or '–' in v:
            probs.append('an em or en dash')
        w = [] if k.endswith('Url') else wording(v)
        if w:
            probs.append(f'wording {w}')
        if k.endswith('Url') and not v.startswith('https://tryknowflow.com/en/'):
            probs.append('not an /en page of tryknowflow.com')
        say(('ok   ' if not probs else 'FAIL ') + f'{k}: {len(v)} of {lim}' + (f' ({"; ".join(probs)})' if probs else ''))
        bad += 1 if probs else 0
    if bad:
        raise Failed(f'{bad} English field(s) fail the rules')
    return t


def en_digest():
    """SHA-256 of the English file with LF line ends, as git stores it."""
    return hashlib.sha256(open(EN_FILE, 'rb').read().replace(b'\r\n', b'\n')).hexdigest()


def approved(flag_path=EN_FLAG):
    digest = en_digest()
    if not os.path.exists(flag_path):
        say(f'REFUSED: {os.path.relpath(flag_path, ROOT)} does not exist; the English text is a draft (sha256 {digest})')
        return False
    flag = open(flag_path, encoding='utf-8').read().split()
    if digest not in flag:
        say(f'REFUSED: the approval flag names another version of the file (the file is sha256 {digest})')
        return False
    say(f'approved: the flag holds the file\'s sha256 {digest}')
    return True


def english(api, app, flag_path=EN_FLAG):
    t = check_en()
    say('== english')
    if not approved(flag_path):
        raise Failed('the English text is not approved')
    info = editable_app_info(api, app)
    if not info:
        raise Failed('no App Info to localize')
    ils, _ = api.all(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")
    cur = next((l for l in ils if l['attributes'].get('locale') == 'en-US'), None)
    ia = {'name': t['name'], 'subtitle': t['subtitle'], 'privacyPolicyUrl': t['privacyPolicyUrl']}
    # The ids are said either way: a live run must be traceable to the record
    # it created or found (run 38795422677 created one and never named it).
    if cur:
        api.need('PATCH', f"/v1/appInfoLocalizations/{cur['id']}", {'data': {'type': 'appInfoLocalizations', 'id': cur['id'], 'attributes': ia}})
        say(f"  en-US App Info localization found: {cur['id']}")
    else:
        js = api.need('POST', '/v1/appInfoLocalizations', {'data': {'type': 'appInfoLocalizations', 'attributes': dict(ia, locale='en-US'),
                                                                  'relationships': {'appInfo': {'data': {'type': 'appInfos', 'id': info['id']}}}}}, ok=(201,))
        say(f"  en-US App Info localization created: {(js.get('data') or {}).get('id')}")
    v = version_of(api, app)
    # Read again after the App Info write: App Store Connect creates the
    # version localization of a new locale itself (run 38795422677 found
    # 62a4db70 right after the POST, where the dry run had found none).
    vl = next((l for l in version_locs(api, v['id']) if l['attributes'].get('locale') == 'en-US'), None)
    va = {'description': t['description'], 'keywords': t['keywords'], 'promotionalText': t['promotionalText'], 'supportUrl': t['supportUrl']}
    if vl:
        api.need('PATCH', f"/v1/appStoreVersionLocalizations/{vl['id']}", {'data': {'type': 'appStoreVersionLocalizations', 'id': vl['id'], 'attributes': va}})
        say(f"  en-US version localization found: {vl['id']}")
    else:
        js = api.need('POST', '/v1/appStoreVersionLocalizations', {'data': {'type': 'appStoreVersionLocalizations', 'attributes': dict(va, locale='en-US'),
                                                                          'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': v['id']}}}}}, ok=(201,))
        say(f"  en-US version localization created: {(js.get('data') or {}).get('id')}")
    if api.transport != 'live':
        say(f'{api.writes} write(s) printed, none sent')
        return
    say('== read-back')
    ils, _ = api.all(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")
    cur = next((l['attributes'] for l in ils if l['attributes'].get('locale') == 'en-US'), {})
    vl = next((l['attributes'] for l in version_locs(api, v['id']) if l['attributes'].get('locale') == 'en-US'), {})
    for k in ia:
        read_back_sha(f'app info en-US {k}', cur.get(k))
    for k in va:
        read_back_sha(f'version en-US {k}', vl.get(k))
    verdict([(cur.get(k) == ia[k], f'app info en-US {k}: {"equal" if cur.get(k) == ia[k] else "DIFFERENT"}') for k in ia]
            + [(vl.get(k) == va[k], f'version en-US {k}: {"equal" if vl.get(k) == va[k] else "DIFFERENT"}') for k in va])


def ar_text():
    """The Arabic name and subtitle exactly as section 4.2 of ASC_ANSWERS.md holds them."""
    src = open(AR_FILE, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    m = re.search(r'^### 4\.2 Arabic \(ar-SA\)\n(.*?)(?=^##)', src, re.S | re.M)
    if not m:
        raise Failed('section 4.2 Arabic (ar-SA) is not in docs/store/ASC_ANSWERS.md')
    sec = m.group(1)
    if AR_APPROVAL not in sec:
        raise Failed(f'section 4.2 does not carry "{AR_APPROVAL}"')
    out = {}
    for key, label in (('name', 'Name'), ('subtitle', 'Subtitle')):
        f = re.search(r'^\*\*' + label + r'\*\* \((\d+) of 30\)\n\n```\n(.*?)\n```', sec, re.S | re.M)
        if not f:
            raise Failed(f'the {label} block of section 4.2 is not found')
        v = f.group(2)
        if '\n' in v or not v.strip() or len(v) > 30 or len(v) != int(f.group(1)):
            raise Failed(f'{label}: {len(v)} characters, the file says {f.group(1)} (limit 30)')
        if '\u2014' in v or '\u2013' in v:
            raise Failed(f'{label}: an em or en dash')
        out[key] = v
        say(f"{key}: {len(v)} of 30, UTF-8 sha256 {hashlib.sha256(v.encode('utf-8')).hexdigest()[:16]}: {v}")
    return out


def arabic_appinfo(api, app):
    say('== arabic-appinfo')
    t = ar_text()
    info = editable_app_info(api, app)
    if not info:
        raise Failed('no App Info to write')
    ils, _ = api.all(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")
    cur = next((l for l in ils if l['attributes'].get('locale') == 'ar-SA'), None)
    if not cur:
        raise Failed('no ar-SA App Info localization (this mode only edits the one that exists)')
    ca = cur.get('attributes') or {}
    same = {k: ca.get(k) == v for k, v in t.items()}
    for k in t:
        say(f"  now {k}: {len(ca.get(k) or '')} characters, {'already the approved text' if same[k] else 'differs'}")
    if all(same.values()):
        say('nothing to write')
    else:
        api.need('PATCH', f"/v1/appInfoLocalizations/{cur['id']}", {'data': {'type': 'appInfoLocalizations', 'id': cur['id'], 'attributes': t}})
    if api.transport != 'live':
        say(f'{api.writes} write(s) printed, none sent')
        return
    say('== read-back')
    got = api.get(f"/v1/appInfoLocalizations/{cur['id']}")['data']['attributes']
    for k, v in t.items():
        read_back_sha(f'ar-SA {k}', got.get(k))
        say(f"  section 4.2 {k}: {len(v)} chars, utf-8 sha256 {hashlib.sha256(v.encode('utf-8')).hexdigest()}")
    verdict([((got.get(k) or '').encode('utf-8') == v.encode('utf-8'),
              f"ar-SA {k}: {'byte for byte equal to' if (got.get(k) or '').encode('utf-8') == v.encode('utf-8') else 'DIFFERENT from'} section 4.2 ({len((got.get(k) or '').encode('utf-8'))} vs {len(v.encode('utf-8'))} bytes)") for k, v in t.items()])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['read', 'settings', 'screenshots', 'english', 'arabic-appinfo', 'check-en'])
    ap.add_argument('--app', default=os.environ.get('ASC_APP_APPLE_ID', ''))
    ap.add_argument('--auth', help='file holding "Authorization: Bearer <token>"')
    ap.add_argument('--live', action='store_true', help='send the writes')
    ap.add_argument('--offline', help='fixtures file: no network at all')
    ap.add_argument('--require-approval', action='store_true', help='check-en: fail unless the approval flag matches')
    ap.add_argument('--flag', default=EN_FLAG, help='the approval flag (local proofs only; the workflow never passes it)')
    a = ap.parse_args()
    try:
        if a.mode == 'check-en':
            check_en()
            ok = approved(a.flag)
            return 1 if (a.require_approval and not ok) else 0
        if not re.fullmatch(r'\d+', a.app or ''):
            raise Failed('the app id (ASC_APP_APPLE_ID) is missing')
        transport = 'offline' if a.offline else ('live' if a.live else 'dry')
        if a.offline and a.live:
            raise Failed('--offline and --live together')
        api = Api(transport, a.auth, a.offline)
        say(f'mode {a.mode}, transport {transport}' + ('' if transport == 'live' else ' (no write is sent)'))
        if a.mode == 'read':
            read_all(api, a.app)
        else:
            if a.mode == 'english':
                english(api, a.app, a.flag)
            else:
                {'settings': settings, 'screenshots': screenshots, 'arabic-appinfo': arabic_appinfo}[a.mode](api, a.app)
            if transport == 'live':
                read_all(api, a.app)
        return 0
    except Failed as e:
        say(f'FAIL: {e}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
