# Sign in with Apple (big item 4f, PR 1): strings (APPROVED, moved)

**Status: APPROVED by the owner 2026-11-20 (PR #341).** The five strings this
file held as drafts (`auth.appleUnfinished` and the four Apple keys of
`dashboard.settings.deleteAccount`) were replaced by the owner's approved set,
recorded in `docs/copy/ARABIC_STRINGS_app_v14.md`, which
`scripts/verify-arabic-copy.mjs` and `scripts/verify-apple-signin.mjs` hold the
code to byte for byte. Only `appleStep` changed from the draft. The iPhone
Settings path in `appleNotRevoked` is still marked VERIFY ON BUILD 9 there. No
draft remains here. A later change is a `_fix` batch under `docs/copy/` and
one edit in each place that file names.
