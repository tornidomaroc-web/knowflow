#!/usr/bin/env python3
"""
The native plugins, for the iOS jobs that run no npm (ios-testflight.yml,
ios-signed-in.yml).

`cap sync` writes each Capacitor plugin into ios/App/CapApp-SPM/Package.swift as
a LOCAL package at ../../../node_modules/<name>. Those jobs never run npm, so
that folder does not exist there. This script makes exactly those folders and
nothing else: for each local path in Package.swift it takes the package's
`resolved` URL and `integrity` from the committed package-lock.json, downloads
the tarball from registry.npmjs.org, refuses it unless its sha512 is the
lockfile's, and unpacks it with no lifecycle script, no install step and no
other package. A path in Package.swift that the lockfile does not pin, a
tarball from another host, an entry that is a link or escapes its folder, or
a version that is not the lockfile's: each one stops the job.

Usage: python3 .github/scripts/fetch-native-plugins.py   (from the repository root)
"""
import base64
import hashlib
import io
import json
import os
import re
import sys
import tarfile
import urllib.request

ROOT = os.getcwd()
PACKAGE_SWIFT = os.path.join(ROOT, 'ios/App/CapApp-SPM/Package.swift')
LOCK = os.path.join(ROOT, 'package-lock.json')


def fail(msg):
    print('FAIL: ' + msg)
    sys.exit(1)


swift = open(PACKAGE_SWIFT, encoding='utf-8').read()
names = re.findall(r'path:\s*"\.\./\.\./\.\./node_modules/([^"]+)"', swift)
if not names:
    print('no local plugin package in Package.swift: nothing to fetch')
    sys.exit(0)

lock = json.load(open(LOCK, encoding='utf-8'))['packages']
for name in names:
    if not re.fullmatch(r'(@[a-z0-9._-]+/)?[a-z0-9._-]+', name):
        fail(f'unexpected package name in Package.swift: {name}')
    entry = lock.get(f'node_modules/{name}')
    if not entry:
        fail(f'{name} is in Package.swift but not pinned in package-lock.json')
    url, integrity, version = entry.get('resolved', ''), entry.get('integrity', ''), entry.get('version', '')
    if not url.startswith('https://registry.npmjs.org/'):
        fail(f'{name}: resolved URL is not the npm registry: {url}')
    if not integrity.startswith('sha512-'):
        fail(f'{name}: no sha512 integrity in the lockfile')
    with urllib.request.urlopen(url, timeout=60) as r:
        blob = r.read()
    got = 'sha512-' + base64.b64encode(hashlib.sha512(blob).digest()).decode()
    if got != integrity:
        fail(f'{name}: tarball sha512 differs from package-lock.json')
    dest = os.path.join(ROOT, 'node_modules', *name.split('/'))
    if os.path.exists(dest):
        fail(f'{dest} already exists; this job must start without node_modules')
    count = 0
    with tarfile.open(fileobj=io.BytesIO(blob), mode='r:gz') as tar:
        for m in tar.getmembers():
            if not m.name.startswith('package/'):
                fail(f'{name}: tar entry outside package/: {m.name}')
            rel = m.name[len('package/'):]
            if not rel:
                continue
            if m.issym() or m.islnk() or m.isdev():
                fail(f'{name}: tar entry is a link or device: {m.name}')
            target = os.path.normpath(os.path.join(dest, rel))
            if not target.startswith(dest + os.sep):
                fail(f'{name}: tar entry escapes its folder: {m.name}')
            if m.isdir():
                os.makedirs(target, exist_ok=True)
                continue
            if not m.isfile():
                fail(f'{name}: unexpected tar entry type: {m.name}')
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, 'wb') as out:
                out.write(tar.extractfile(m).read())
            count += 1
    pkg = json.load(open(os.path.join(dest, 'package.json'), encoding='utf-8'))
    if pkg.get('version') != version:
        fail(f'{name}: unpacked version {pkg.get("version")} is not the lockfile\'s {version}')
    if not os.path.isfile(os.path.join(dest, 'Package.swift')):
        fail(f'{name}: the package has no Package.swift')
    print(f'{name} {version}: sha512 matches package-lock.json, {count} files, no script run')
