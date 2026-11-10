# Activation fix 5: copy (SHIPPED)

**Status: SHIPPED.** The owner approved both drafts exactly as written on
2026-11-10 (review of #315). Draft 2 is `dashboard.upload.awaitingConsent` in
the dictionaries, recorded in `docs/copy/ARABIC_STRINGS_app_v8.md`; draft 1
stays in `src/lib/limit-messages.ts` beside every other limit sentence (the same
batch file records its approval). The text below is kept as the record of what
was approved. Everything else this change shows reuses approved strings (listed
at the end).

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
is open. Code: `dashboard.upload.awaitingConsent` (was the draft `AWAITING_CONSENT` in `src/lib/upload-consent.ts`).

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

## Decided

Both approved as written (2026-11-10). Shipped as proposed: the held-file line
in the dictionaries, the upload pause in `limit-messages.ts`, one batch row in
`docs/copy/ARABIC_STRINGS_app_v8.md`.
