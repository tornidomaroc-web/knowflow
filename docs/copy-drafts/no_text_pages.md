# No-text pages copy (Option C): agent drafts for the owner

**Status: DRAFT. Not approved.** Written 2026-11-03 for the no-text-pages PR.
Both keys are NEW. They are in `src/lib/i18n/locales/ar.ts` and `en.ts` so the
screens can be reviewed, but no batch under `docs/copy/` asserts them yet. On
approval, the approved wording moves into a batch file there
(`ARABIC_STRINGS_app_v4.md`) and this file is retired, as `redesign_v2.md` was.

Why here and not under `docs/copy/`: `scripts/verify-arabic-copy.mjs` reads
every `.md` there as an approved batch, and fails on any other name. A draft
there would either be asserted as approved or break the check.

| Key | Arabic draft | English draft | Shown |
|---|---|---|---|
| `dashboard.subjectDetail.someNoTextLine` | صفحات بلا نص: {n} من {total}. | Pages with no text: {n} of {total}. | Material card and upload result, when SOME pages of a PDF have no text |
| `dashboard.subjectDetail.noTextFix` | لاستخراج النص بهاتفك: صوّر الصفحات أو امسحها ضوئيًا، وافتحها في Google Drive أو Google Docs، ثم احفظها بصيغة وورد وارفع ذلك الملف. | To get the text with your phone: photograph or scan the pages, open them in Google Drive or Google Docs, then save as Word and upload that file. | Under the count line, and under the existing no-text line (card and upload result) |

Unchanged and still the approved text: `statusNoText` (بلا نص) and
`noTextLine` (لا نص في هذا الملف. ارفع نسخة فيها نص.). The no-text state is
"improved" by the fix line under it, not by rewording an approved string.

Notes for the decision:

- **The count line's form.** The brief asked for "N من M صفحات بلا نص". In MSA
  the counted noun follows the number: صفحات after 3 to 10, but صفحة after 11
  and up ("12 صفحة"), so the brief's form is wrong for most real files. With a
  colon the number ends the sentence and no agreement is needed, for any N and M.
- **Latin inside Arabic.** Only the product names Google Drive and Google Docs.
  Each is joined by a no-break space (`Google Drive`) in both languages:
  the first CI render at 440 pt broke "Google" and "Drive" across two lines.
  "Word" is written وورد, as the approved file-type label already is
  (`fileTypes.docx`).
- **No em dash, no price, plan, upgrade or "free" wording**, Western digits:
  checked by `scripts/verify-no-text-pages.mjs`.
- **Does the fix work on a phone?** Google's help page "Convert PDF and photo
  files to text" (support.google.com/drive/answer/176692) gives the steps as
  "On your computer, go to drive.google.com", then right-click, then "Open
  with Google Docs". It also asks for files of 2 MB or less. Nothing in this PR
  proves the conversion from the Drive or Docs phone app. A student who has
  only a phone may not be able to follow the line as written.
