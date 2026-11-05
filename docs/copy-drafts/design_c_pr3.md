# Design "C" PR 3 copy: agent drafts for the owner

**Status: DRAFT, awaiting the owner.** Nothing here is approved. The app ships these lines so the tile can be looked at, as earlier drafts did (`redesign_v1.md`, `redesign_v2.md`); the owner approves, replaces or rejects each one, and the approved Arabic is then recorded as a batch under `docs/copy/`.

Where: the upload tile on a subject page, in the app and on the web (src/components/upload/DropZone.tsx). Its title is the approved "ملف من جهازك" (`docs/copy/ARABIC_STRINGS_app_v5.md`); under the tile, the approved lines for the accepted types and the size limit stay as they were.

| Key | Arabic (draft) | English (draft) | Source |
|---|---|---|---|
| `dashboard.upload.fromDevice` | (approved: ملف من جهازك) | A file from your device | the English twin of the approved title |
| `dashboard.upload.fromDeviceDesc` | PDF أو شرائح أو ملاحظات. كلّها تنفع. | PDF, slides or notes. They all work. | the artboard's line under that choice (upload-sheet.dc.html), not yet approved as copy |

Note for the owner: "PDF أو شرائح أو ملاحظات" names three kinds of file; the tile also accepts Word, Excel, text and Markdown files, which the approved types line under the tile lists. If the description should not suggest a narrower list, a shorter draft is "كل ملفات الدراسة تنفع." / "Any study file works."
