# App Store listing in English (en-GB), version 1.0.1

**Approved by the owner on 2026-10-28** in chat (fields at 19:50, the French
description at 19:52), as `ASO_1.0.1_APPROVED.md`, SHA-256
`c6db0d75a536bbdb598c7bdcb30542f3ce9f2f8b3aec8598db01bebd2d720757`. The texts below are that file's bytes;
nothing was reworded. The promotional text and the description are the approved en-US ones (`docs/store/ASC_ANSWERS_EN.md`), byte for byte; `check-locales` fails if they drift apart.

The `en-gb` mode of `.github/workflows/asc-store-setup.yml` writes the
en-GB fields of an editable version (1.0.1 in Prepare for Submission) from
this file, and refuses unless `ASC_ANSWERS_GB.approved` holds the SHA-256
of this file with LF line ends. Any edit to this file blocks the write until
it is approved again.

Why en-GB at all: in Saudi Arabia, the UAE, Kuwait, Qatar, Jordan, Morocco,
Egypt, Algeria and Tunisia the store indexes ar-SA and en-GB, not en-US (the
owner's basis, from industry cross-localization tables; Apple does not publish
them). The name differs from en-US ("KnowFlow: Study Your Notes") so the two
listings index different words.

Rules (checked by `scripts/asc/store_setup.py check-locales` locally and by
the workflow before the key is read):
- each field within Apple's limit, counted in Unicode code points as App Store
  Connect counts them;
- no em dash or en dash;
- no plan, subscription, upgrade, premium, Pro, price, checkout or "free"
  wording (`scripts/lib/app-wording.mjs`, English and Arabic), and for French
  also gratuit, abonnement, prix, tarif, payant, forfait, offre, essai, achat,
  mise à niveau, par mois and the euro sign (`FR_WORDING` in
  `scripts/asc/store_setup.py`).

## Name (28 of 30)

<!-- asc-en-gb:name:begin -->
```
KnowFlow: AI Notes & Quizzes
```
<!-- asc-en-gb:name:end -->

## Subtitle (27 of 30)

<!-- asc-en-gb:subtitle:begin -->
```
Summaries and exam revision
```
<!-- asc-en-gb:subtitle:end -->

## Keywords (92 of 100)

<!-- asc-en-gb:keywords:begin -->
```
study,ask,lecture,student,homework,university,bac,pdf,tutor,chat,learn,test,school,assistant
```
<!-- asc-en-gb:keywords:end -->

## Promotional text (158 of 170)

<!-- asc-en-gb:promotionalText:begin -->
```
Upload your lecture or notes, then ask anything. Every answer comes from your own files, and the summary and the quiz are one tap away. In Arabic and English.
```
<!-- asc-en-gb:promotionalText:end -->

## Description (1,643 of 4,000)

<!-- asc-en-gb:description:begin -->
```
KnowFlow turns your study files into answers, summaries and quizzes.

Add a subject, upload your lecture notes, slides or readings, then ask the way you would ask a classmate. Every answer is written from the files of that subject and names the file it came from, so you can check it yourself.

WHAT YOU CAN DO
• Organize your study by subject, with each subject's files inside it.
• Upload PDF, Word, PowerPoint, Excel, text and Markdown files, up to 4 MB per file.
• Ask in Arabic or English and get a clear answer from your own files, with the name of the source file.
• Open the summary of any file to review it quickly.
• Test yourself with a five-question quiz made from a file, then check your answers.
• Keep a daily study streak and follow your progress on your home screen.
• Turn on a daily study reminder at the time you choose. It stays on your phone.
• Use the app in Arabic or English, in a dark or light appearance.

YOUR PERMISSION COMES FIRST
Answers, summaries and quizzes are written by AI. Before anything is sent, KnowFlow asks your permission and names the two companies involved: Anthropic, which writes the answers, summaries and quizzes, and Voyage AI, which prepares the text so the right passage can be found. Neither receives your name or your email address. You can withdraw the permission at any time in Settings.

YOUR ACCOUNT AND YOUR DATA
Rename or delete any file whenever you like, and delete your account and everything in it from Settings.

AI can make mistakes. Check important answers against your files.

Privacy policy: https://tryknowflow.com/en/privacy
Terms of use: https://tryknowflow.com/en/terms
```
<!-- asc-en-gb:description:end -->

## URLs (the en-US ones, `docs/store/ASC_ANSWERS.md` section 3)

<!-- asc-en-gb:supportUrl:begin -->
```
https://tryknowflow.com/en/contact
```
<!-- asc-en-gb:supportUrl:end -->

<!-- asc-en-gb:privacyPolicyUrl:begin -->
```
https://tryknowflow.com/en/privacy
```
<!-- asc-en-gb:privacyPolicyUrl:end -->

The Marketing URL stays empty (section 3: the landing page shows prices).
