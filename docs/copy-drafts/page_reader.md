# The page reader's heading (DRAFT, NOT APPROVED, WIRED FOR REVIEW)

**Status: DRAFT for the owner, 2026-11-16.** The heading is wired into
`src/lib/page-reader.ts` as `PAGE_HEADING`, because the material made from
photographed pages needs one per photo. It stays a draft until the owner
approves it at review; an approved change is one edit here and one in
`PAGE_HEADING`, and `scripts/verify-page-reader.mjs` holds both to the same
text.

## Where it appears

Inside the material, not on a screen: `POST /api/page-read` makes ONE `.md`
file from the photos it read, and each photo's text sits under a level-2
heading with the photo's number (`## Page 3` / `## الصفحة 3`), in the language
of the request. A photo that could not be read leaves its number out, so the
numbers always match the photos. The material's summary, quiz and answers read
the heading as part of the text.

The route adds no other words. Every refusal it sends reuses a sentence that
already exists (`uploadRefusalMessage` request, session and nothing-saved; the
consent, allowance, subject-limit and daily-limit sentences); why a single
photo was not read travels as a machine code (`photos[].code`) for the screen
that will come with the camera, whose words are drafted with it.

| | Text |
|---|---|
| en | Page {n} |
| ar | الصفحة {n} |

`{n}` is the photo's number in the batch, 1 to 10, in Western digits.

Arabic notes: Modern Standard Arabic; الصفحة with the article, as a heading
names one page; Western digits, as everywhere in KnowFlow.

## Rules held by the proof

No em or en dash; no price, plan, upgrade or "free" wording in either
language; Western digits only; no Latin letter inside the Arabic; `{n}` once.

## Before a screen sends photos: the permission's wording (not drafted here)

The route sends nothing without the AI permission (`hasAiConsent`), but the
permission a student gives today describes text only:

- the sheet, `dashboard.aiConsent.anthropic`: "Anthropic receives the text of
  your materials and your questions, and writes the answers, summaries and
  quizzes.";
- the privacy policy (`src/app/[locale]/(site)/privacy/page.tsx`):
  "Anthropic and Voyage AI receive the text of your materials and your
  questions."

A photo carries more than text (handwriting, a face, a room). Before the
camera screen ships, both should say that photos of pages go to Anthropic,
and `AI_CONSENT_VERSION` (src/lib/ai-consent.ts) should rise to 2 so every
student is asked once more under the new wording (Apple 5.1.2(i): disclose
what is shared, then ask). That wording is the owner's call and belongs with
the camera screen's copy.
