#!/usr/bin/env python3
"""
The privacy-manifest check of a built iOS app (Apple ITMS-91053), run by
ios-smoke.yml on an unsigned Release device build and by ios-testflight.yml on
the archive it uploads.

1. The app's own PrivacyInfo.xcprivacy is in the bundle, is a valid plist,
   declares no tracking and no tracking domain, and declares the six
   collected data types the account and the service collect (e-mail, name,
   other user content, user id, product interaction, other diagnostic data),
   each linked, none for tracking, with the purposes the App Privacy label
   declares.
2. Every Mach-O binary in the bundle (the app's executable, each framework's,
   each dylib) is read with `nm -u` (the symbols it imports) and `strings`
   (Objective-C selectors and Swift names), and each required-reason API it
   reaches is matched to Apple's category. Each category found must be
   declared, with at least one reason, in that framework's own manifest or in
   the app's. A category found and declared nowhere is the ITMS-91053
   rejection, and fails here first.

The table it prints is the audit.

Usage: python3 .github/scripts/ios-privacy-check.py <path/to/App.app>
"""
import os
import plistlib
import re
import subprocess
import sys

app = sys.argv[1].rstrip('/')
fails = []


def need(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


# Apple's required-reason APIs ("Describing use of required reason API"),
# as the names a binary carries. C functions are matched as imported symbols
# (leading underscore, whole name); Foundation API by its selector or Swift name.
CATEGORIES = {
    'NSPrivacyAccessedAPICategoryUserDefaults': {
        'sym': [],
        'str': [r'NSUserDefaults', r'UserDefaults'],
    },
    'NSPrivacyAccessedAPICategoryFileTimestamp': {
        'sym': ['_stat', '_fstat', '_lstat', '_fstatat', '_getattrlist', '_getattrlistbulk', '_fgetattrlist', '_getattrlistat'],
        'str': [r'\bcreationDate\b', r'\bmodificationDate\b', r'fileModificationDate', r'contentModificationDateKey', r'creationDateKey', r'NSFileCreationDate', r'NSFileModificationDate'],
    },
    'NSPrivacyAccessedAPICategorySystemBootTime': {
        'sym': ['_mach_absolute_time'],
        'str': [r'systemUptime'],
    },
    'NSPrivacyAccessedAPICategoryDiskSpace': {
        'sym': ['_statfs', '_statvfs', '_fstatfs', '_fstatvfs'],
        'str': [r'volumeAvailableCapacity', r'volumeTotalCapacity', r'NSFileSystemFreeSize', r'NSFileSystemSize', r'systemFreeSize'],
    },
    'NSPrivacyAccessedAPICategoryActiveKeyboards': {
        'sym': [],
        'str': [r'activeInputModes'],
    },
}


def load(path):
    with open(path, 'rb') as f:
        return plistlib.load(f)


def declared(manifest):
    out = {}
    for item in (manifest or {}).get('NSPrivacyAccessedAPITypes', []) or []:
        out[item.get('NSPrivacyAccessedAPIType')] = item.get('NSPrivacyAccessedAPITypeReasons') or []
    return out


# 1. The app's own manifest.
app_manifest_path = os.path.join(app, 'PrivacyInfo.xcprivacy')
need(os.path.isfile(app_manifest_path), f'the app bundle carries PrivacyInfo.xcprivacy ({app_manifest_path})')
app_manifest = load(app_manifest_path) if os.path.isfile(app_manifest_path) else {}
need(app_manifest.get('NSPrivacyTracking') is False, f'NSPrivacyTracking is false: {app_manifest.get("NSPrivacyTracking")}')
need(app_manifest.get('NSPrivacyTrackingDomains') == [], f'no tracking domain: {app_manifest.get("NSPrivacyTrackingDomains")}')
collected = {d.get('NSPrivacyCollectedDataType'): d for d in app_manifest.get('NSPrivacyCollectedDataTypes', []) or []}
# The six types and the purposes the App Privacy label declares
# (docs/store/ASC_ANSWERS.md section 1): the manifest and the label must say
# the same thing, so the expected purposes are spelled out per type.
EXPECTED = {
    'EmailAddress': ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    'Name': ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    'OtherUserContent': ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    'UserID': ['NSPrivacyCollectedDataTypePurposeAppFunctionality', 'NSPrivacyCollectedDataTypePurposeAnalytics'],
    'ProductInteraction': ['NSPrivacyCollectedDataTypePurposeAppFunctionality', 'NSPrivacyCollectedDataTypePurposeAnalytics'],
    'OtherDiagnosticData': ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
}
need(set(collected) == {'NSPrivacyCollectedDataType' + t for t in EXPECTED}, f'exactly the six declared types: {sorted(collected)}')
for t, purposes in EXPECTED.items():
    d = collected.get('NSPrivacyCollectedDataType' + t)
    need(bool(d) and d.get('NSPrivacyCollectedDataTypeLinked') is True and d.get('NSPrivacyCollectedDataTypeTracking') is False
         and d.get('NSPrivacyCollectedDataTypePurposes') == purposes,
         f'collected {t}: linked, not tracking, purposes {", ".join(p.replace("NSPrivacyCollectedDataTypePurpose", "") for p in purposes)}')
app_declared = declared(app_manifest)

# Every manifest in the bundle, by the folder that holds it.
manifests = {}
for dirpath, _, files in os.walk(app):
    if 'PrivacyInfo.xcprivacy' in files:
        manifests[dirpath] = load(os.path.join(dirpath, 'PrivacyInfo.xcprivacy'))
print('manifests in the bundle: ' + ', '.join(os.path.relpath(p, app) or '.' for p in sorted(manifests)))

# 2. The binaries.
binaries = []
info = load(os.path.join(app, 'Info.plist'))
binaries.append((os.path.join(app, info['CFBundleExecutable']), app))
fw_dir = os.path.join(app, 'Frameworks')
if os.path.isdir(fw_dir):
    for name in sorted(os.listdir(fw_dir)):
        p = os.path.join(fw_dir, name)
        if name.endswith('.framework'):
            fi = os.path.join(p, 'Info.plist')
            exe = load(fi).get('CFBundleExecutable') if os.path.isfile(fi) else name[:-len('.framework')]
            binaries.append((os.path.join(p, exe), p))
        elif name.endswith('.dylib'):
            binaries.append((p, None))

print('\n| binary | category | evidence | declared in |')
print('|---|---|---|---|')
for path, bundle in binaries:
    need(os.path.isfile(path), f'binary exists: {os.path.relpath(path, app)}')
    if not os.path.isfile(path):
        continue
    syms = set(subprocess.run(['nm', '-u', path], capture_output=True, text=True).stdout.split())
    strs = subprocess.run(['strings', '-a', path], capture_output=True, text=True).stdout
    own = declared(manifests.get(bundle)) if bundle and bundle != app else {}
    found_any = False
    for cat, rule in CATEGORIES.items():
        ev = [s for s in rule['sym'] if s in syms]
        ev += sorted({m.group(0) for r in rule['str'] for m in re.finditer(r, strs)})
        if not ev:
            continue
        found_any = True
        where = []
        if own.get(cat):
            where.append('its own manifest')
        if app_declared.get(cat):
            where.append('the app manifest')
        print(f'| {os.path.relpath(path, app)} | {cat} | {", ".join(ev[:6])} | {" + ".join(where) or "NOWHERE"} |')
        need(bool(where), f'{os.path.relpath(path, app)}: {cat} is declared with a reason')
    if not found_any:
        print(f'| {os.path.relpath(path, app)} | none | - | - |')

print(f'\n{len(binaries)} binaries read; {len(fails)} failure(s)')
sys.exit(1 if fails else 0)
