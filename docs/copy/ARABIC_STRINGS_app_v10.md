# Arabic copy, app v10: the sample file (audit cause 9)

Approved by the owner on 2026-11-11 as drafted in `docs/copy-drafts/sample_file_ui.md` (now marked shipped), with the button "جرّب بملف جاهز", the subject "مثال", the file "الخلية" and the question "ما دور الميتوكوندريا في الخلية؟". The English twins were approved with them:

- `dashboard.home.sampleButton`: Try with a sample file
- `dashboard.home.sampleDesc`: A short file about the cell and a ready question. You can delete it any time.
- `dashboard.home.sampleAdding`: Adding the file…
- `dashboard.home.sampleSubjectName`: Sample
- `dashboard.home.sampleFileName`: The cell
- `dashboard.home.sampleExists`: You already have the sample file. Open it from your subjects.
- `dashboard.home.sampleFailed`: Could not add the file. Try again.
- `dashboard.agent.sampleQuestion`: What do mitochondria do in the cell?

Where they show: the button, its line and the two notices on the home's three-steps card, only while the student has no material (`src/components/dashboard/SampleFileButton.tsx`); the subject and file names on what `/api/sample` creates (the stored file is `الخلية.pdf` / `The cell.pdf`); the question as a chip under the Ask field, only in a subject that holds the sample file (`src/components/agent/ChatBox.tsx`). Every key is NEW, so the "Old Arabic" column says so; the proof asserts the new value only. No plan, price, upgrade or "free" wording.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.home.sampleButton` | جرّب بملف جاهز | (new key) |
| `dashboard.home.sampleDesc` | ملف قصير عن الخلية وسؤال جاهز. يمكنك حذفه متى شئت. | (new key) |
| `dashboard.home.sampleAdding` | نضيف الملف… | (new key) |
| `dashboard.home.sampleSubjectName` | مثال | (new key) |
| `dashboard.home.sampleFileName` | الخلية | (new key) |
| `dashboard.home.sampleExists` | لديك ملف المثال من قبل. افتحه من موادك. | (new key) |
| `dashboard.home.sampleFailed` | تعذّرت إضافة الملف. حاول مرة أخرى. | (new key) |
| `dashboard.agent.sampleQuestion` | ما دور الميتوكوندريا في الخلية؟ | (new key) |
