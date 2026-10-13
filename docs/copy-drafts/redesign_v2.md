# Redesign copy, v2: agent drafts awaiting the owner's approval (Step Redesign-3)

**Status: AGENT DRAFTS, NOT APPROVED.** Written 2026-10-13 by the agent for
the owner's approval. Live in `ar.ts` and `en.ts` so the rebuilt screens have
their words, but not in `docs/copy/`: the batch files there are the owner's
approved record. When the owner approves (or rewrites) these lines, they land
as the next `docs/copy/ARABIC_STRINGS_app_v<N>.md` and this file is retired,
as `redesign_v1` was by `app_v2`.

Arabic: Modern Standard Arabic, Western numerals, no dash. Each label sits on
a 44 pt tile at 9 px under the file glyph and again in the card's date line
("مستند · أُضيف 23 سبتمبر 2026"), so each is one short word. English keeps the
file extension in capitals, as before.

| Key | Shown where | English | Arabic (draft) |
|---|---|---|---|
| `dashboard.subjectDetail.fileTypes.pdf` | A material's tile and date line, for a .pdf | PDF | مستند |
| `dashboard.subjectDetail.fileTypes.docx` | ... for a .docx | DOCX | وورد |
| `dashboard.subjectDetail.fileTypes.pptx` | ... for a .pptx | PPTX | عرض |
| `dashboard.subjectDetail.fileTypes.xlsx` | ... for a .xlsx | XLSX | جدول |
| `dashboard.subjectDetail.fileTypes.txt` | ... for a .txt | TXT | نص |
| `dashboard.subjectDetail.fileTypes.md` | ... for a .md | MD | نص |

Two questions for the owner: `مستند` for PDF also fits Word files, which read
`وورد` here (the brand name students use); and `.txt` and `.md` share `نص`
(a Markdown file is a text file to a student). A file type the app does not
know keeps its letters in both languages.
