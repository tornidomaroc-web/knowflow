# Arabic copy, app v3: the file-type labels on a material's tile and date line (Step Store-Shots-1)

Approved by Abo Jad on 2026-10-13, by the merge of #265 (453f1cc), as written in the agent drafts of `docs/copy-drafts/redesign_v2.md` (retired by this batch). English keeps the extension letters: "PDF" / "DOCX" / "PPTX" / "XLSX" / "TXT" / "MD".
All six keys are NEW (added by #265, Step Redesign-3), so the "Old Arabic" column says so; the proof asserts the new value only.
Shown on a material's tile, under the file glyph, and in its date line ("مستند · أُضيف 23 سبتمبر 2026"), in both shells (src/components/materials/MaterialCard.tsx).

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.subjectDetail.fileTypes.pdf` | مستند | (new key) |
| `dashboard.subjectDetail.fileTypes.docx` | وورد | (new key) |
| `dashboard.subjectDetail.fileTypes.pptx` | عرض | (new key) |
| `dashboard.subjectDetail.fileTypes.xlsx` | جدول | (new key) |
| `dashboard.subjectDetail.fileTypes.txt` | نص | (new key) |
| `dashboard.subjectDetail.fileTypes.md` | نص | (new key) |
