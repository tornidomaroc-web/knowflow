# Arabic copy, app v4: pages with no text (Option C, no OCR)

Approved by Abo Jad on 2026-11-03 for PR #297. `someNoTextLine` approved as drafted in `docs/copy-drafts/no_text_pages.md` (retired by this batch); `noTextFix` REPLACED by the owner's own text, because Google Drive's photo-to-text conversion is computer-only. English: "Pages with no text: {n} of {total}." / "To get the text with your phone: photograph the page and copy its text with Google Lens, then paste it into a Google Docs document, save it as Word, and upload that file."
Both keys are NEW (added by #297), so the "Old Arabic" column says so; the proof asserts the new value only.
"Google Lens" and "Google Docs" are joined by a NO-BREAK SPACE (U+00A0), here and in ar.ts and en.ts (written `\u00a0` there), so a product name never splits across two lines. The cells below hold the U+00A0 character itself: an editor that turns it into a plain space breaks this proof.
Shown: on a material card and in the upload result (src/components/materials/MaterialCard.tsx, src/components/upload/DropZone.tsx). The count line when SOME pages of a PDF have no text; the fix line under it, and under the approved no-text line (`noTextLine`, unchanged).

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.subjectDetail.someNoTextLine` | صفحات بلا نص: {n} من {total}. | (new key, carries {n} and {total}) |
| `dashboard.subjectDetail.noTextFix` | لاستخراج النص بهاتفك: صوّر الصفحة وانسخ نصها بأداة Google Lens، ثم الصقه في مستند Google Docs واحفظه بصيغة وورد، وارفع ذلك الملف. | (new key) |
