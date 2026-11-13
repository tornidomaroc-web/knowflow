# Two refusals for the AI cost caps (DRAFT, NOT APPROVED, WIRED FOR REVIEW)

**Status: DRAFT for the owner, 2026-11-13.** Unlike `checkout_error.md`, these
two strings ARE used by the code in this PR, from `src/lib/limit-messages.ts`
(the one place every limit message is written), because the caps cannot ship
without a sentence. `scripts/verify-ai-cost-caps.mjs` holds the code to the
exact text below, so a change approved here is one edit in each place. They
are not in `ar.ts` or `en.ts`: like every other limit message, the server
writes them in the student's language.

## 1. A question over 4,000 characters

Sent by `/api/agent` as text/plain with status 413 and the header
`X-KF-Refusal: question-too-long`. The chat shows it as the reply and puts
the student's question back in the box, so a long paste is not lost. The
question was not counted and nothing was sent to Voyage AI or Anthropic.

| | Text |
|---|---|
| en | A question can be up to 4,000 characters, and this one is longer. Shorten it or split it into two questions, then send it again. |
| ar | يمكن أن يصل السؤال إلى 4000 حرف، وهذا السؤال أطول من ذلك. اختصره أو قسّمه إلى سؤالين، ثم أرسله مجددًا. |

Arabic: 4000 حرف is the genitive singular a round thousand takes; Western
digits, no thousands separator inside the Arabic (the app writes 4 ميغابايت
the same way). مجددًا with tanween fatha, as `ar.ts` writes it.

## 2. A file that converts to too much text

Sent by `/api/ingest` as `{ success: false, error }` with status 422 when the
ingestion service refuses the file with `text_too_long` (over 4,194,304
characters of text) or `archive_too_large` (a .docx, .pptx or .xlsx whose
contents unpack to over 64 MiB, or over 10,000 parts). The upload box shows
it as it shows every refusal. The material is marked as failed and, like any
failed upload, does not use one of the day's uploads.

| | Text |
|---|---|
| en | This file holds more text than can be read from one file. Split it into smaller files, then upload them. |
| ar | يحتوي هذا الملف على نص أطول مما يمكن قراءته من ملف واحد. قسّمه إلى ملفات أصغر، ثم ارفعها. |

No number is printed: a character count means nothing to a student choosing a
file, and the 4 MB they do know is already true of this file.

## Rules held

Short, plain, true. No plan, price, upgrade, subscription or "free" word.
Modern Standard Arabic, no Latin word inside the Arabic sentences, Western
digits, no em dash.
