# Arabic copy, app v5: the upload tile (design "C", PR 3)

Approved by Abo Jad on 2026-11-05 for PR #303.
- `fromDevice`: "ملف من جهازك", the first choice of the approved upload-sheet artboard (`upload-sheet.dc.html`, sha256 c470e949df22ca7c3dc809a5a752f7983c645fd90aad85b112ed75931f054e84). English twin approved in the review of #303: "A file from your device".
- `fromDeviceDesc`: the owner's own line from the review of #303, replacing the artboard's "PDF أو شرائح أو ملاحظات. كلّها تنفع." (it named three kinds of file; the tile takes all six, and the new line has no Latin word inside the Arabic sentence). English: "Any study file works."

The owner's ruling of the same day put the sheet's choice on the subject page as a tile, with no sheet in 1.0 (a one-choice sheet is an extra tap); the sheet returns in 1.1 with the scan choice.
Both keys are NEW (added by #303), so the "Old Arabic" column says so; the proof asserts the new value only. The agent drafts for them in `docs/copy-drafts/design_c_pr3.md` are retired by this batch.
Shown on the upload tile of a subject page, in both shells (src/components/upload/DropZone.tsx): the title, and the line under it.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.upload.fromDevice` | ملف من جهازك | (new key) |
| `dashboard.upload.fromDeviceDesc` | كل ملفات الدراسة تنفع. | (new key) |
