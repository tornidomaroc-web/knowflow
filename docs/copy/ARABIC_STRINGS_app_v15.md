# Arabic copy, app v15: in-app rating, the Settings row (item 4h, PR 1)

**APPROVED by the owner 2026-11-21 03:29Z ("موافق").** Two keys of `dashboard.settings`: `rate` and `rateDesc`. Copied byte for byte by script from the owner's approved set (`rating_strings_approved.md`, sha256 `f37defce8d4d70a71f46b50d969bdf0236aa95de73d84aede81ecabcfeaf5156`). The owner changed one word from the study's draft (rating-study-e7948da, item 8): the Arabic description says "في App Store" where the draft had "على". Both keys are new, so the "Old Arabic" column says "(new key)"; `scripts/verify-arabic-copy.mjs` asserts the new value, and `scripts/verify-review.mjs` (section 6) holds both languages to this file.

Where they show: the last row of Settings, Help and legal, after Support, in the app only (shell 2 where the KnowFlowReview plugin answers, PR 2); the row is Apple's write-review link. The Latin names are drawn as left-to-right isolates (`LatinText`, check 15); the text itself is exactly this. The automatic prompt needs no string: Apple's sheet carries its own, localized by iOS.

English (`src/lib/i18n/locales/en.ts`):

- `dashboard.settings.rate`: Rate KnowFlow
- `dashboard.settings.rateDesc`: Rate the app or write a review on the App Store.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.settings.rate` | قيّم KnowFlow | (new key) |
| `dashboard.settings.rateDesc` | قيّم التطبيق أو اكتب مراجعة في App Store. | (new key) |
