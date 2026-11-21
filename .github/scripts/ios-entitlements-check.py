#!/usr/bin/env python3
"""
Universal links (item 4g): the signed archive's entitlements, as
`codesign -d --entitlements - --xml` printed them (ios-testflight.yml), must
carry com.apple.developer.associated-domains with exactly
applinks:tryknowflow.com and webcredentials:tryknowflow.com.

Read as a property list, so what is checked is that key's value, not a
substring somewhere in the file. Exit 1 with the reason, before the upload,
when the file is not a property list, the key is missing, or its value is
anything else: automatic signing fetched a profile without the capability,
which means Associated Domains is not ticked on the App ID.

Usage: python3 .github/scripts/ios-entitlements-check.py entitlements.xml
"""
import plistlib
import sys

KEY = "com.apple.developer.associated-domains"
WANT = ["applinks:tryknowflow.com", "webcredentials:tryknowflow.com"]
FIX = "tick Associated Domains on the App ID first (Identifiers, com.knowflow.app)"


def main(path):
    try:
        with open(path, "rb") as f:
            ent = plistlib.load(f)
    except Exception as e:
        print(f"FAIL: the signed entitlements are not a property list ({type(e).__name__}: {e}); {FIX}")
        return 1
    got = ent.get(KEY) if isinstance(ent, dict) else None
    if not (isinstance(got, list) and all(isinstance(v, str) for v in got) and sorted(got) == sorted(WANT)):
        print(f"FAIL: the archived app is signed with {KEY} = {got!r}, not {WANT}; {FIX}")
        return 1
    print(f"signed entitlements carry {KEY} = {got}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: ios-entitlements-check.py <entitlements.xml>")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
