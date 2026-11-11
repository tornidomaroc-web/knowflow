# The sample file: button, subject name, ready question and refusals (APPROVED)

**Status: APPROVED by the owner 2026-11-11**, as drafted, with the button
"جرّب بملف جاهز" and the plural English question. Nothing here is in the
dictionaries or in `docs/copy/` yet. In the UI PR the strings move into `ar.ts` and `en.ts` under
the keys below, with one batch file in `docs/copy/`. The file's own text is
`docs/copy-drafts/sample_file_cell.md`; the build plan is
`docs/plans/sample-file.md`.

Rules held: Modern Standard Arabic, short, no Latin word inside an Arabic
sentence, no plan, price, upgrade or "free" wording, no em dash, Western
digits.

## 1. New strings

| Where | Key (proposed) | ar | en |
|---|---|---|---|
| The button on the three-steps card, zero material only | `dashboard.home.sampleButton` | جرّب بملف جاهز | Try with a sample file |
| One line under the button | `dashboard.home.sampleDesc` | ملف قصير عن الخلية وسؤال جاهز. يمكنك حذفه متى شئت. | A short file about the cell and a ready question. You can delete it any time. |
| The button while the sample is being added | `dashboard.home.sampleAdding` | نضيف الملف… | Adding the file… |
| The subject's name | `dashboard.home.sampleSubjectName` | مثال | Sample |
| The file's display name | `dashboard.home.sampleFileName` | الخلية | The cell |
| The ready question under the Ask field | `dashboard.agent.sampleQuestion` | ما دور الميتوكوندريا في الخلية؟ | What do mitochondria do in the cell? |
| The student already has the sample subject | `dashboard.home.sampleExists` | لديك ملف المثال من قبل. افتحه من موادك. | You already have the sample file. Open it from your subjects. |
| Adding failed (network or server) | `dashboard.home.sampleFailed` | تعذّرت إضافة الملف. حاول مرة أخرى. | Could not add the file. Try again. |

Notes:

- `sampleDesc` is needed: without it the button does not say what will be
  created or that it can be removed. It names no limit and no count.
- `sampleExists` should rarely show: the button is drawn only at zero material,
  and a second press opens the existing sample subject instead of refusing (see
  the plan, idempotency). The line is the fallback when that subject exists but
  cannot be opened.
- The English ready question uses the plural "mitochondria", the word the
  English file uses. The Arabic question is the owner's draft, unchanged.

## 2. Reused, approved strings (no change)

| Case | Key |
|---|---|
| The subject limit is reached, in the app | `dashboard.newKb.errorLimitApp` |
| The subject limit is reached, on the web | `dashboard.newKb.errorLimitFree`, `errorLimitPro`, `errorLimitUpgrade` (exactly as the new-subject page shows them today) |
| The AI permission sheet, both buttons and its text | `dashboard.aiConsent.*` |
| The student pressed "Not now" on the sheet | `dashboard.aiConsent.declined`, the sentence the drop zone shows today after "Not now" (src/components/upload/DropZone.tsx:280); nothing is created |

The subject-limit refusal cannot happen at the moment the button is visible in
the normal case (zero material usually means few subjects), but a student can
hold 5 empty subjects. The reused line already says the right thing; inside the
app it carries no purchase wording.

## 3. Open points for the owner

1. "جرّب بملف جاهز" against "جرّب بملف تجريبي": the first avoids repeating the
   root in "جرّب ... تجريبي". Say which you prefer.
2. The subject name "مثال" is one word, so the subjects list and the home's
   row need no bidi care. The file name "الخلية" is shown without its
   extension, like every material name (Store-Fix-1).
