# Arabic copy, app v5: the upload tile's title (design "C", PR 3)

Approved by Abo Jad on 2026-11-05 in the design "C" PR 3 brief: "ملف من جهازك", the first choice of the approved upload-sheet artboard (`upload-sheet.dc.html`, sha256 c470e949df22ca7c3dc809a5a752f7983c645fd90aad85b112ed75931f054e84). The owner's ruling of the same day put that choice on the subject page as a tile, with no sheet in 1.0 (a one-choice sheet is an extra tap); the sheet returns in 1.1 with the scan choice.
The key is NEW (added by this PR), so the "Old Arabic" column says so; the proof asserts the new value only.
The English twin ("A file from your device") and the tile's description line, in both languages, are agent drafts awaiting the owner in `docs/copy-drafts/design_c_pr3.md`; they are not in this batch.
Shown as the upload tile's title on a subject page, in both shells (src/components/upload/DropZone.tsx).

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.upload.fromDevice` | ملف من جهازك | (new key) |
