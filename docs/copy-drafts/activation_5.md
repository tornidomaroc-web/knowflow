# Activation fix 5: copy (DRAFT, awaiting the owner)

**Status: DRAFT.** Two new sentences, both in English and Arabic. Neither is in
`src/lib/i18n/locales/*.ts` or `docs/copy/`: each lives beside the code that
shows it, marked DRAFT, until the owner approves or replaces it. Everything else
this change shows reuses approved strings (listed at the end).

Rules held: Modern Standard Arabic, short, no Latin word inside an Arabic
sentence, no plan, upgrade, price or free word, no em dash.

## 1. The upload pause after many failed uploads (cause #10)

Where: `/api/ingest`'s refusal when the day's upload attempts reach the ceiling
(5 uploads + 5 failed attempts for a free account). It is reached only when
many of today's uploads failed, because a failed upload no longer uses one of
the day's 5. Code: `UPLOAD_FAILURES_HEAD` in `src/lib/limit-messages.ts`,
followed by the existing reset clause (`resetClause`, already shipped).

| | en | ar |
|---|---|---|
| sentence | Many of your uploads did not finish today, so uploading is paused. | لم يكتمل رفع عدد من ملفاتك اليوم، لذا توقف الرفع مؤقتًا. |
| then (existing) | It resets in about {n} hours. | يتجدد الحد بعد نحو {n} ساعات. |

Why no number: the student did nothing wrong and there is nothing to buy; the
number would invite counting failures.

## 2. The held file under the AI permission sheet (cause #7)

Where: the drop zone, under the picked file's name, while the permission sheet
is open. Code: `AWAITING_CONSENT` in `src/lib/upload-consent.ts`.

| | en | ar |
|---|---|---|
| line | Kept here until you answer. Nothing is sent yet. | محفوظ هنا حتى تجيب. لم يُرسَل شيء بعد. |

## Reused, approved strings (no change)

| Where | Key | en |
|---|---|---|
| Ask, subject with no file: title | `dashboard.home.step2Title` | Upload your materials |
| Ask, subject with no file: line | `dashboard.home.step2Desc` | PDFs, slides and notes. |
| Ask, subject with no file: button (to the subject's upload tile) | `dashboard.upload.uploadButton` | Upload a file |
| Drop zone after "Not now" | `dashboard.aiConsent.declined` | Nothing was sent. Uploading, asking, … |
| Drop zone, processing failed | `uploadRefusalMessage(…, 'unconfirmed')` | Your file arrived, but we could not confirm it was processed. … |
| Upload refused, day's 5 used | `dailyLimitMessage(…, 'upload', …)` | You've reached today's limit of 5 uploads. … |

## For the owner to decide

1. Approve both drafts as they are, or give your own text.
2. On approval they move into the dictionaries (`dashboard.upload.awaitingConsent`)
   or stay in `limit-messages.ts` (the upload pause, like every other limit
   sentence), with a batch row in `docs/copy/`.
