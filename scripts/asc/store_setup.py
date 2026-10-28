#!/usr/bin/env python3
"""
Step S7d: the App Store Connect settings of version 1.0, and since ASO-1.0.1
the listing of version 1.0.1, through the ASC API
(.github/workflows/asc-store-setup.yml runs this; docs/store/ASC_ANSWERS.md,
ASC_ANSWERS_EN.md and ASC_ANSWERS_{AR,GB,FR}.md hold the answers). Python
standard library only.

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
               APP_IPHONE_67 set (the 6.9-inch slot: 1320 x 2868) of the ar,
               en-US and en-GB version localizations, in order. Idempotent: a
               set that already holds the five (same file names and MD5
               checksums in order, all COMPLETE) is left alone, no write.
               Any other set RESUMES (run 40780425121 stopped half way):
               each approved image already there is kept when COMPLETE and
               waited for when Apple is still processing it; only what is not
               an approved image, has another checksum, is a second copy, is
               FAILED or never finished uploading is deleted, in that set
               alone; the missing images are uploaded; then every pending
               image is waited for together (SHOT_WAIT, one budget), and the
               set is put in the order 01 to 05. A missing set is created.
               Each image must reach COMPLETE with Apple's checksum equal to
               the file's MD5. A language whose version localization does not
               exist is reported and skipped, never created here.

--key-file lets a run re-sign its token (openssl, as the workflow does) when
it has less than five minutes left, so a long screenshot wait never calls
Apple with an expired one.
  english      the en-US App Info localization (name, subtitle, privacy URL)
               and version localization (description, keywords, promotional
               text, support URL) from docs/store/ASC_ANSWERS_EN.md, only when
               docs/store/ASC_ANSWERS_EN.approved holds that file's SHA-256.
  arabic       version 1.0.1: the ar-SA subtitle (App Info) and keywords
               (version localization) from docs/store/ASC_ANSWERS_AR.md, those
               two fields only, and only when ASC_ANSWERS_AR.approved holds
               that file's SHA-256. The ar-SA localizations must exist.
  en-gb, fr-fr version 1.0.1: the en-GB or fr-FR App Info localization (name,
               subtitle, privacy URL) and version localization (description,
               keywords, promotional text, support URL) from
               docs/store/ASC_ANSWERS_GB.md or _FR.md, created when missing,
               only when the file's .approved flag holds its SHA-256.
               The three locale modes refuse before any write unless the
               version is in an editable state and an App Info that is not
               live exists (both appear when version 1.0.1 is created in App
               Store Connect); they write only the fields that differ and read
               every written field back byte for byte.
  check-en     the English text's limits, dashes and wording, offline.
  check-locales
               the same rules for the ar-SA, en-GB and fr-FR files (French
               wording too), the en-GB promotional text and description equal
               to en-US, and the three approval flags; offline.

--version (default 1.0) names the App Store version every mode reads and
writes; the workflow passes its `version` input. The tool never creates a
version: that is the "+" in App Store Connect's web page.
  builds       prints, writes nothing: every build of version 1.0 (number,
               processingState, expired, usesNonExemptEncryption, minOsVersion,
               buildAudienceType, uploadedDate, its preReleaseVersion and its
               buildBetaDetail states), one line per build, and the build
               version 1.0 has attached. GET only, by construction: the mode
               marks the Api read-only, so call() refuses any other method
               before the network, in every transport, and --live is refused.
               buildAudienceType INTERNAL_ONLY is a build exported with
               testFlightInternalTestingOnly, which version 1.0 cannot take.

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
import base64
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
EN_FLAG = os.path.join(ROOT, 'docs', 'store', 'ASC_ANSWERS_EN.approved')
SHOTS = os.path.join(ROOT, 'docs', 'store', 'screenshots-designed')
WORDING = os.path.join(ROOT, 'scripts', 'lib', 'app-wording.mjs')
VERSION = '1.0'  # --version replaces it
DISPLAY = 'APP_IPHONE_67'
NO_CHINA = 'CHN'
BASE_TERRITORY = 'USA'
RIGHTS = 'DOES_NOT_USE_THIRD_PARTY_CONTENT'
# Version-localization locale -> folder of approved PNGs. en-GB takes the
# English five; fr-FR has none of its own (the app has no French screens), so
# the store shows the primary language's (ar-SA).
SHOT_TARGETS = [('ar', 'ar'), ('en-US', 'en'), ('en-GB', 'en')]
EN_FIELDS = {'name': 30, 'subtitle': 30, 'keywords': 100, 'promotionalText': 170, 'description': 4000, 'supportUrl': 255, 'privacyPolicyUrl': 255}
APP_INFO_FIELDS = ('name', 'subtitle', 'privacyPolicyUrl')
VERSION_FIELDS = ('description', 'keywords', 'promotionalText', 'supportUrl')


def _store(name):
    return os.path.join(ROOT, 'docs', 'store', name)


# The version-1.0.1 locale modes: file, marker tag, the fields the mode
# writes, and whether it may create the localization. ar-SA writes two fields
# and creates nothing: its name, promotional text and description are the
# approved 1.0 text (ASC_ANSWERS.md section 4.2), which App Store Connect
# copies into a new version.
LOCALE_MODES = {
    'arabic': {'locale': 'ar-SA', 'file': _store('ASC_ANSWERS_AR.md'), 'flag': _store('ASC_ANSWERS_AR.approved'), 'tag': 'asc-ar',
               'app_info': ('subtitle',), 'version': ('keywords',), 'create': False},
    'en-gb': {'locale': 'en-GB', 'file': _store('ASC_ANSWERS_GB.md'), 'flag': _store('ASC_ANSWERS_GB.approved'), 'tag': 'asc-en-gb',
              'app_info': APP_INFO_FIELDS, 'version': VERSION_FIELDS, 'create': True},
    'fr-fr': {'locale': 'fr-FR', 'file': _store('ASC_ANSWERS_FR.md'), 'flag': _store('ASC_ANSWERS_FR.approved'), 'tag': 'asc-fr',
              'app_info': APP_INFO_FIELDS, 'version': VERSION_FIELDS, 'create': True},
}
# A version whose metadata App Store Connect accepts edits to.
EDITABLE = ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY')
# The wording rule's French half, for the store text only: the app has no
# French interface, so kfWording (which the app's own probe runs) stays as it
# is. Case-insensitive, on word boundaries (Python's \b is Unicode-aware).
FR_WORDING = [
    ('gratuit', r'\bgratuit(?:e|s|es|ement)?\b'),
    ('abonnement', r'\babonn(?:e|é|ée|és|ées|er|ement|ements)\b'),
    ('prix', r'\bprix\b'),
    ('tarif', r'\btarif(?:s|aire|aires)?\b'),
    ('payant', r'\bpayant(?:e|s|es)?\b'),
    ('forfait', r'\bforfaits?\b'),
    ('offre', r'\boffres?\b'),
    ('essai', r'\bessais?\b'),
    ('achat', r'\bachats?\b|\bachet(?:er|é|ée)\b'),
    ('mise à niveau', r'\b(?:mise|mett\w*|met|pass\w*) à niveau\b'),
    ('par mois', r'\bpar mois\b|\bmensuel(?:le|s|les)?\b'),
    ('euro', r'€|\beuros?\b'),
]
FORBIDDEN = re.compile(r'appStoreReviewDetail|/build\b|/builds|reviewSubmission|appStoreVersionSubmission|betaTester|betaGroup|/users|userInvitation|/relationships/build')


class Failed(Exception):
    pass


def say(msg):
    print(msg, flush=True)


# The clock and the pause, as module names so the offline proofs can run a
# fifteen-minute wait in no time.
NOW = time.time
SLEEP = time.sleep
TOKEN_LIFETIME = 1200  # seconds: Apple's maximum, as the workflow mints it
TOKEN_REFRESH = 300    # re-sign when the token has less than this left


def b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def der_to_raw(der):
    """An ECDSA signature in DER (a SEQUENCE of two INTEGERs) as the 64 raw bytes of JWS ES256."""
    if len(der) < 8 or der[0] != 0x30:
        raise Failed('the signature is not a DER sequence')
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7f)
    out = b''
    for _ in range(2):
        if der[i] != 0x02:
            raise Failed('the signature is not two integers')
        n = der[i + 1]
        v = der[i + 2:i + 2 + n].lstrip(b'\x00')
        i += 2 + n
        if len(v) > 32:
            raise Failed('a signature integer is longer than 32 bytes')
        out += v.rjust(32, b'\x00')
    return out


def token_exp(token):
    """The exp claim of a JWT, read without printing anything of it; None when unreadable."""
    try:
        part = token.split('.')[1]
        return int(json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))['exp'])
    except (IndexError, ValueError, KeyError, TypeError):
        return None


class Signer:
    """Mints App Store Connect tokens as the workflow does (ES256 by openssl, the
    DER signature laid out as raw r||s), so a run longer than one token's twenty
    minutes, a screenshot wait for instance, never calls Apple with an expired
    one. The key file stays where the workflow wrote it; nothing here prints a
    token."""

    def __init__(self, key_file, key_id, issuer):
        if not (key_file and key_id and issuer):
            raise Failed('re-signing needs the key file, the key id and the issuer id')
        self.key_file, self.key_id, self.issuer = key_file, key_id, issuer

    def mint(self, now):
        head = b64url(json.dumps({'alg': 'ES256', 'kid': self.key_id, 'typ': 'JWT'}, separators=(',', ':')).encode())
        body = b64url(json.dumps({'iss': self.issuer, 'iat': int(now), 'exp': int(now) + TOKEN_LIFETIME, 'aud': 'appstoreconnect-v1'}, separators=(',', ':')).encode())
        signing = f'{head}.{body}'
        r = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', self.key_file, '-binary'], input=signing.encode(), capture_output=True)
        if r.returncode != 0 or not r.stdout:
            raise Failed('openssl could not sign a new token')
        return f'{signing}.{b64url(der_to_raw(r.stdout))}'


class Api:
    def __init__(self, transport, auth_file=None, fixtures=None, signer=None):
        self.transport = transport
        self.header = None
        self.exp = None
        self.signer = signer
        self.warned = False
        if transport != 'offline':
            line = open(auth_file, encoding='utf-8').read().strip()
            if not line.startswith('Authorization: Bearer '):
                raise Failed('the auth header file is not "Authorization: Bearer <token>"')
            self.header = line.split(': ', 1)[1]
            self.exp = token_exp(self.header.split(' ', 1)[-1])
        self.fixtures = json.load(open(fixtures, encoding='utf-8')) if fixtures else {}
        self.writes = 0
        self.fake = 0
        self.read_only = False

    def fresh(self):
        """Re-sign before a request when the token has less than TOKEN_REFRESH seconds left."""
        if self.exp is None or self.exp - NOW() >= TOKEN_REFRESH:
            return
        if not self.signer:
            if not self.warned:
                say(f'::warning::the token expires in {int(self.exp - NOW())} s and no key was given to re-sign it')
                self.warned = True
            return
        token = self.signer.mint(NOW())
        if os.environ.get('GITHUB_ACTIONS') == 'true':
            say(f'::add-mask::{token}')  # the runner hides the value from every later line; the command itself is not shown
        self.header, self.exp = f'Bearer {token}', token_exp(token)
        say(f'  token re-signed: expires in {int(self.exp - NOW())} s')

    def call(self, method, path, body=None):
        if method != 'GET' and self.read_only:
            raise Failed(f'REFUSED: {method} {path} in a read-only mode')
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
        self.fresh()
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
    # The filter is Apple's; the check is ours, so an ignored filter (or an
    # offline fixture) can never hand a write mode version 1.0 for 1.0.1.
    vs = [v for v in vs if (v.get('attributes') or {}).get('versionString') == VERSION]
    if len(vs) != 1:
        raise Failed(f'expected exactly one iOS version {VERSION}, found {len(vs)}')
    return vs[0]


def version_locs(api, vid):
    locs, _ = api.all(f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50')
    return locs


LIVE_INFO = ('READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'REPLACED_WITH_NEW_INFO')


def editable_app_info(api, app):
    infos, _ = api.all(f'/v1/apps/{app}/appInfos?limit=10')
    edit = [i for i in infos if (i.get('attributes') or {}).get('state') not in LIVE_INFO and (i.get('attributes') or {}).get('appStoreState') not in LIVE_INFO]
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


# ---------------------------------------------------------------- builds

BUILD_FIELDS = 'version,processingState,expired,usesNonExemptEncryption,minOsVersion,buildAudienceType,uploadedDate,preReleaseVersion,buildBetaDetail'


def builds(api, app):
    if not api.read_only:
        raise Failed('the builds mode runs only on a read-only Api')
    say('== builds')
    v = version_of(api, app)
    b = api.get(f"/v1/appStoreVersions/{v['id']}/build", allow404=True)
    say(f"version {VERSION}: id {v['id']}, state {v['attributes'].get('appVersionState')}, build attached: {'yes, ' + b['data']['id'] if b and b.get('data') else 'none'}")
    rows, inc = api.all(f'/v1/builds?filter[app]={app}&filter[preReleaseVersion.version]={VERSION}&filter[preReleaseVersion.platform]=IOS'
                        f'&sort=-uploadedDate&fields[builds]={BUILD_FIELDS}&include=preReleaseVersion,buildBetaDetail'
                        '&fields[preReleaseVersions]=version,platform&fields[buildBetaDetails]=internalBuildState,externalBuildState&limit=50')
    by = {(i.get('type'), i.get('id')): i.get('attributes') or {} for i in inc or []}

    def rel(row, name):
        d = ((row.get('relationships') or {}).get(name) or {}).get('data') or {}
        return by.get((d.get('type'), d.get('id'))) if d else None

    say(f'builds of version {VERSION}: {len(rows)}')
    for row in rows:
        a = row.get('attributes') or {}
        pre, beta = rel(row, 'preReleaseVersion'), rel(row, 'buildBetaDetail')
        say(f"  build {a.get('version')} ({row.get('id')}): processingState {a.get('processingState')}, expired {a.get('expired')}, "
            f"usesNonExemptEncryption {a.get('usesNonExemptEncryption')}, minOsVersion {a.get('minOsVersion')}, "
            f"buildAudienceType {a.get('buildAudienceType')}, uploadedDate {a.get('uploadedDate')}, "
            f"preReleaseVersion {(pre or {}).get('version')} {(pre or {}).get('platform')}, "
            f"beta internal {(beta or {}).get('internalBuildState')} external {(beta or {}).get('externalBuildState')}")
    return rows


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


SHOT_WAIT = 900  # seconds: one budget for every image still processing, all locales together
SHOT_POLL = 10
SHOT_FIELDS = 'fields[appScreenshots]=fileName,fileSize,sourceFileChecksum,assetDeliveryState'


def shot_state(g):
    """(fileName, sourceFileChecksum, delivery state, error codes) of one screenshot record."""
    a = g.get('attributes') or {}
    st = a.get('assetDeliveryState') or {}
    return a.get('fileName'), a.get('sourceFileChecksum'), st.get('state'), [e.get('code') for e in st.get('errors') or []]


def plan_set(old, files):
    """What to do with a set's screenshots, against the approved files.

    keep    an approved file (same name, same MD5) that Apple finished: COMPLETE;
    wait    an approved file Apple is still processing (UPLOAD_COMPLETE, no
            error): deleting it would throw away an upload that is on its way
            (run 40780425121 stopped on one);
    delete  anything else: another name or checksum, a second copy, FAILED or an
            error, or a reservation whose upload never finished;
    upload  every approved file that is neither kept nor waited for.
    Returns (keep, wait, delete, upload): the first three as (record, reason),
    upload as file paths, all in the approved order where that applies.
    """
    want = {os.path.basename(f): md5(f) for f in files}
    claimed, keep, wait, delete = set(), [], [], []
    for g in old:
        name, sum_, state, errs = shot_state(g)
        if name not in want:
            delete.append((g, 'not one of the approved files'))
        elif sum_ != want[name]:
            delete.append((g, f'checksum {sum_} is not the file\'s {want[name]}'))
        elif name in claimed:
            delete.append((g, 'a second copy'))
        elif errs or state == 'FAILED':
            delete.append((g, f'{state} {errs}'))
        elif state == 'COMPLETE':
            keep.append((g, 'COMPLETE'))
            claimed.add(name)
        elif state == 'UPLOAD_COMPLETE':
            wait.append((g, 'UPLOAD_COMPLETE, Apple is still processing it'))
            claimed.add(name)
        else:
            delete.append((g, f'delivery state {state}: its upload never finished'))
    upload = [f for f in files if os.path.basename(f) not in claimed]
    return keep, wait, delete, upload


def wait_processed(api, pending):
    """Polls every pending screenshot (id -> label) until all are COMPLETE: fails at once on
    FAILED or an error, and after SHOT_WAIT seconds names the ones still processing."""
    left = dict(pending)
    if not left:
        return
    deadline = NOW() + SHOT_WAIT
    say(f'== waiting for {len(left)} screenshot(s) to finish processing, up to {SHOT_WAIT} s together: {", ".join(left.values())}')
    while True:
        for sid, label in list(left.items()):
            name, sum_, state, errs = shot_state(api.get(f'/v1/appScreenshots/{sid}?{SHOT_FIELDS}')['data'])
            if errs or state == 'FAILED':
                raise Failed(f'{label}: delivery state {state} {errs}')
            if state == 'COMPLETE':
                say(f'  {label}: COMPLETE')
                del left[sid]
        if not left:
            return
        if NOW() >= deadline:
            raise Failed(f'still processing after {SHOT_WAIT} s, not FAILED: {", ".join(left.values())}. '
                         'A later run keeps them, waits again and uploads nothing twice.')
        SLEEP(SHOT_POLL)


def screenshots(api, app):
    say('== screenshots')
    v = version_of(api, app)
    locs = version_locs(api, v['id'])
    pending, done, kept, waiting, orders = [], [], [], {}, []
    for prefix, folder in SHOT_TARGETS:
        files = sorted(glob.glob(os.path.join(SHOTS, folder, '0[1-5]-*.png')))
        if len(files) != 5:
            raise Failed(f'{folder}: expected the five approved PNGs, found {len(files)}')
        loc = next((l for l in locs if (l['attributes'].get('locale') or '') == prefix or (prefix == 'ar' and (l['attributes'].get('locale') or '').startswith('ar'))), None)
        if not loc:
            say(f'{prefix}: no version localization yet; SKIPPED (the english, en-gb and fr-fr modes create theirs)')
            pending.append(prefix)
            continue
        locale = loc['attributes']['locale']
        say(f'{locale} ({loc["id"]}): {len(files)} files from docs/store/screenshots-designed/{folder}')
        s = shot_set(api, loc['id'])
        old = shots_in(api, s['id']) if s else []
        if s and held(old) == wanted(files):
            # The approved five, in order and COMPLETE: no write at all (the
            # ar-SA set, run 38770955611; ar-SA and en-US on 1.0.1).
            say(f'{locale}: already the approved five, unchanged')
            kept.append(locale)
            done.append((locale, s['id'], files))
            continue
        keep, wait, delete, upload = plan_set(old, files)
        for g, why in keep:
            say(f'  keep    {shot_state(g)[0]}: {why}, checksum {shot_state(g)[1]}')
        for g, why in wait:
            say(f'  wait    {shot_state(g)[0]}: {why}')
        for g, why in delete:
            say(f'  delete  {shot_state(g)[0]}: {why}')
        for f in upload:
            say(f'  upload  {os.path.basename(f)}: {os.path.getsize(f)} bytes, MD5 {md5(f)}')
        if s:
            sid = s['id']
        else:
            js = api.need('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': DISPLAY},
                                                                    'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': loc['id']}}}}}, ok=(201,))
            sid = js['data']['id']
        # Deletes are of this locale's set only, and only what plan_set named.
        for g, _ in delete:
            api.need('DELETE', f"/v1/appScreenshots/{g['id']}", ok=(204,))
        ids = {shot_state(g)[0]: g['id'] for g, _ in keep + wait}
        for g, _ in wait:
            waiting[g['id']] = f'{locale} {shot_state(g)[0]}'
        for f in upload:
            name, size, sum_ = os.path.basename(f), os.path.getsize(f), md5(f)
            js = api.need('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots', 'attributes': {'fileName': name, 'fileSize': size},
                                                                 'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': sid}}}}}, ok=(201,))
            shot = js['data']['id']
            ids[name] = shot
            ops = (js['data'].get('attributes') or {}).get('uploadOperations') or []
            if api.transport == 'live':
                say(f'  {name}: {size} bytes in {put_parts(f, ops)} part(s)')
            else:
                say(f'  WOULD PUT {name}: {size} bytes to the reserved upload operations (presigned, not printed)')
            api.need('PATCH', f'/v1/appScreenshots/{shot}', {'data': {'type': 'appScreenshots', 'id': shot, 'attributes': {'uploaded': True, 'sourceFileChecksum': sum_}}})
            waiting[shot] = f'{locale} {name}'
        order = [ids[os.path.basename(f)] for f in files]
        now_order = [g['id'] for g in old if g['id'] in set(order)]
        if upload or delete or now_order != order:
            say(f'  reorder {os.path.basename(files[0])} to {os.path.basename(files[-1])} once every image is COMPLETE')
            orders.append((sid, order))
        else:
            say('  order already 01 to 05')
        done.append((locale, sid, files))
    if api.transport != 'live':
        if waiting:
            say(f'WOULD wait up to {SHOT_WAIT} s together for: {", ".join(waiting.values())}')
        for sid, order in orders:
            api.need('PATCH', f'/v1/appScreenshotSets/{sid}/relationships/appScreenshots', {'data': [{'type': 'appScreenshots', 'id': i} for i in order]}, ok=(200, 204))
        say(f'{api.writes} write(s) printed, none sent; unchanged: {kept or "none"}; pending: {pending or "none"}')
        return
    wait_processed(api, waiting)
    for sid, order in orders:
        api.need('PATCH', f'/v1/appScreenshotSets/{sid}/relationships/appScreenshots', {'data': [{'type': 'appScreenshots', 'id': i} for i in order]}, ok=(200, 204))
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

def marked(path, tag, keys):
    """The fields between `<!-- tag:key:begin -->` and `<!-- tag:key:end -->`, each in one code block."""
    src = open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    out = {}
    for k in keys:
        m = re.search(r'<!-- ' + re.escape(tag) + ':' + k + r':begin -->\s*```\n(.*?)\n```\s*<!-- ' + re.escape(tag) + ':' + k + r':end -->', src, re.S)
        if not m:
            raise Failed(f'{k}: its markers are not in {os.path.relpath(path, ROOT)}')
        out[k] = m.group(1)
    return out


def en_text():
    return marked(EN_FILE, 'asc-en', EN_FIELDS)


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


def en_digest(path=EN_FILE):
    """SHA-256 of a store text file with LF line ends, as git stores it."""
    return hashlib.sha256(open(path, 'rb').read().replace(b'\r\n', b'\n')).hexdigest()


def approved(flag_path=EN_FLAG, path=EN_FILE):
    digest = en_digest(path)
    if not os.path.exists(flag_path):
        say(f'REFUSED: {os.path.relpath(flag_path, ROOT)} does not exist; {os.path.relpath(path, ROOT)} is a draft (sha256 {digest})')
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


def fr_wording(text):
    return [name for name, rx in FR_WORDING if re.search(rx, text, re.I)]


def locale_text(mode):
    m = LOCALE_MODES[mode]
    return marked(m['file'], m['tag'], m['app_info'] + m['version'])


def check_locale(mode):
    """One locale file against the rules; raises on any failure, returns its fields."""
    m = LOCALE_MODES[mode]
    say(f"-- {m['locale']} ({os.path.relpath(m['file'], ROOT)})")
    t = locale_text(mode)
    bad = 0
    for k, v in t.items():
        lim = EN_FIELDS[k]
        probs = []
        if not v.strip():
            probs.append('empty')
        if v != v.strip() or '\n' in v and k not in ('description', 'promotionalText'):
            probs.append('stray white space or a line break')
        if len(v) > lim:
            probs.append(f'over the limit by {len(v) - lim}')
        if '—' in v or '–' in v:
            probs.append('an em or en dash')
        if k.endswith('Url'):
            if not v.startswith('https://tryknowflow.com/en/'):
                probs.append('not an /en page of tryknowflow.com')
        else:
            w = wording(v) + (fr_wording(v) if m['locale'].startswith('fr') else [])
            if w:
                probs.append(f'wording {w}')
        if k == 'keywords' and (', ' in v or ',,' in v or v.endswith(',')):
            probs.append('a space after a comma, or an empty keyword')
        say(('ok   ' if not probs else 'FAIL ') + f'{k}: {len(v)} of {lim}' + (f' ({"; ".join(probs)})' if probs else ''))
        bad += 1 if probs else 0
    if mode == 'en-gb':
        en = en_text()
        for k in ('promotionalText', 'description'):
            same = t[k].encode('utf-8') == en[k].encode('utf-8')
            say(('ok   ' if same else 'FAIL ') + f'{k}: {"byte for byte the approved en-US text" if same else "DIFFERENT from the approved en-US text"}')
            bad += 0 if same else 1
    if bad:
        raise Failed(f"{bad} {m['locale']} check(s) fail the rules")
    return t


def check_locales(flags=None):
    say('== check-locales')
    ok = True
    for mode, m in LOCALE_MODES.items():
        check_locale(mode)
        ok = approved((flags or {}).get(mode) or m['flag'], m['file']) and ok
    return ok


def editable_app_info_only(api, app):
    """The one App Info that is not live (it exists while a new version is in preparation), or a refusal."""
    infos, _ = api.all(f'/v1/apps/{app}/appInfos?limit=10')
    edit = [i for i in infos if (i.get('attributes') or {}).get('state') not in LIVE_INFO and (i.get('attributes') or {}).get('appStoreState') not in LIVE_INFO]
    if len(edit) != 1:
        raise Failed(f'{len(edit)} App Info record(s) that are not live, of {len(infos)}; a new version must be in preparation (create {VERSION} in App Store Connect)')
    return edit[0]


def write_fields(api, label, rtype, cur, want, create_path, create_body):
    """PATCH the fields of `want` that differ from `cur`, or POST a new record; returns the record id or None (dry create)."""
    if cur:
        ca = cur.get('attributes') or {}
        diff = {}
        for k, v in want.items():
            same = (ca.get(k) or '').encode('utf-8') == v.encode('utf-8')
            say(f"  {label} {k}: now {len(ca.get(k) or '')} chars, {'already the approved text' if same else 'differs, written'}")
            if not same:
                diff[k] = v
        say(f"  {label} found: {cur['id']}")
        if diff:
            api.need('PATCH', f"{create_path}/{cur['id']}", {'data': {'type': rtype, 'id': cur['id'], 'attributes': diff}})
        return cur['id']
    if create_body is None:
        raise Failed(f'no {label} (this mode only edits the one that exists)')
    js = api.need('POST', create_path, create_body, ok=(201,))
    rid = (js.get('data') or {}).get('id')
    say(f'  {label} created: {rid}')
    return rid


def locale_write(api, app, mode, flag=None):
    m = LOCALE_MODES[mode]
    loc = m['locale']
    say('== check')
    t = check_locale(mode)
    say(f'== {mode}')
    if not approved(flag or m['flag'], m['file']):
        raise Failed(f'the {loc} text is not approved')
    v = version_of(api, app)
    state = v['attributes'].get('appVersionState')
    say(f"version {VERSION}: id {v['id']}, state {state}")
    if state not in EDITABLE:
        raise Failed(f'version {VERSION} is {state}, which App Store Connect does not let anyone edit; nothing written')
    info = editable_app_info_only(api, app)
    say(f"app info {info['id']}: state {(info.get('attributes') or {}).get('state')}")
    ia = {k: t[k] for k in m['app_info']}
    va = {k: t[k] for k in m['version']}
    ils, _ = api.all(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")
    cur = next((l for l in ils if l['attributes'].get('locale') == loc), None)
    write_fields(api, f'{loc} App Info localization', 'appInfoLocalizations', cur, ia, '/v1/appInfoLocalizations',
                 {'data': {'type': 'appInfoLocalizations', 'attributes': dict(ia, locale=loc),
                           'relationships': {'appInfo': {'data': {'type': 'appInfos', 'id': info['id']}}}}} if m['create'] else None)
    # Read again after the App Info write: App Store Connect creates the
    # version localization of a new locale itself (run 38795422677).
    vl = next((l for l in version_locs(api, v['id']) if l['attributes'].get('locale') == loc), None)
    write_fields(api, f'{loc} version localization', 'appStoreVersionLocalizations', vl, va, '/v1/appStoreVersionLocalizations',
                 {'data': {'type': 'appStoreVersionLocalizations', 'attributes': dict(va, locale=loc),
                           'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': v['id']}}}}} if m['create'] else None)
    if api.transport != 'live':
        say(f'{api.writes} write(s) printed, none sent')
        return
    say('== read-back')
    ils, _ = api.all(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=50")
    got_i = next((l['attributes'] for l in ils if l['attributes'].get('locale') == loc), {})
    got_v = next((l['attributes'] for l in version_locs(api, v['id']) if l['attributes'].get('locale') == loc), {})
    checks = []
    for where, got, want in (('app info', got_i, ia), ('version', got_v, va)):
        for k, val in want.items():
            read_back_sha(f'{where} {loc} {k}', got.get(k))
            eq = (got.get(k) or '').encode('utf-8') == val.encode('utf-8')
            checks.append((eq, f"{where} {loc} {k}: {'byte for byte equal to' if eq else 'DIFFERENT from'} {os.path.basename(m['file'])}"))
    verdict(checks)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['read', 'builds', 'settings', 'screenshots', 'english', *LOCALE_MODES, 'check-en', 'check-locales'])
    ap.add_argument('--app', default=os.environ.get('ASC_APP_APPLE_ID', ''))
    ap.add_argument('--auth', help='file holding "Authorization: Bearer <token>"')
    ap.add_argument('--key-file', help='the .p8 key, to re-sign the token before it expires; the key id and the issuer id come from ASC_REVIEW_KEY_ID and ASC_REVIEW_ISSUER_ID')
    ap.add_argument('--live', action='store_true', help='send the writes')
    ap.add_argument('--offline', help='fixtures file: no network at all')
    ap.add_argument('--version', default='1.0', help='the App Store version to read or write (the workflow passes its input)')
    ap.add_argument('--require-approval', action='store_true', help='check-en, check-locales: fail unless the approval flags match')
    ap.add_argument('--flag', help='the approval flag of an english or locale mode (local proofs only; the workflow never passes it)')
    a = ap.parse_args()
    global VERSION
    try:
        if not re.fullmatch(r'\d+\.\d+(?:\.\d+)?', a.version):
            raise Failed(f'--version {a.version!r} is not a version string such as 1.0.1')
        VERSION = a.version
        if a.mode == 'check-en':
            check_en()
            ok = approved(a.flag or EN_FLAG)
            return 1 if (a.require_approval and not ok) else 0
        if a.mode == 'check-locales':
            ok = check_locales()
            return 1 if (a.require_approval and not ok) else 0
        if not re.fullmatch(r'\d+', a.app or ''):
            raise Failed('the app id (ASC_APP_APPLE_ID) is missing')
        transport = 'offline' if a.offline else ('live' if a.live else 'dry')
        if a.offline and a.live:
            raise Failed('--offline and --live together')
        if a.mode == 'builds' and a.live:
            raise Failed('the builds mode is read-only; --live is refused')
        signer = Signer(a.key_file, os.environ.get('ASC_REVIEW_KEY_ID'), os.environ.get('ASC_REVIEW_ISSUER_ID')) if a.key_file else None
        api = Api(transport, a.auth, a.offline, signer)
        api.read_only = a.mode in ('read', 'builds')
        say(f'mode {a.mode}, version {VERSION}, transport {transport}' + ('' if transport == 'live' else ' (no write is sent)'))
        if a.mode == 'read':
            read_all(api, a.app)
        elif a.mode == 'builds':
            builds(api, a.app)
        else:
            if a.mode == 'english':
                english(api, a.app, a.flag or EN_FLAG)
            elif a.mode in LOCALE_MODES:
                locale_write(api, a.app, a.mode, a.flag)
            else:
                {'settings': settings, 'screenshots': screenshots}[a.mode](api, a.app)
            if transport == 'live':
                read_all(api, a.app)
        return 0
    except Failed as e:
        say(f'FAIL: {e}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
