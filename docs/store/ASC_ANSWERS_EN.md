# App Store listing in English (en-US): agent drafts, NOT approved

**Status: draft by the agent, 2026-10-15. Not approved.** The `english`
mode of `.github/workflows/asc-store-setup.yml` refuses to send anything from
this file unless `docs/store/ASC_ANSWERS_EN.approved` exists and holds the
SHA-256 of this file exactly as approved, so an edit after the approval
blocks the write until it is approved again.

The name is the owner's decision of 2026-10-15: "KnowFlow" alone is taken by
another app's English listing (409 `STATE_ERROR.DUPLICATE_NAME.DIFFERENT_ACCOUNT`,
2026-10-10). The other fields match the approved Arabic listing
(`docs/store/ASC_ANSWERS.md` section 4.2) in meaning, field by field, and
replace the earlier English draft of section 4.1.

Rules (checked by the workflow before any write, and by
`scripts/asc/store_setup.py check-en` locally):
- each field within Apple's limit;
- no em dash or en dash;
- no plan, subscription, upgrade, premium, Pro, price, checkout or "free"
  wording (the app's own rule, `scripts/lib/app-wording.mjs`);
- keywords leave out the words of the name and the subtitle, which Apple
  indexes anyway.

Character counts are Unicode code points, as App Store Connect counts them.

## Name (26 of 30)

Arabic: "KnowFlow: ذاكر من ملفاتك" (study from your files).

<!-- asc-en:name:begin -->
```
KnowFlow: Study Your Notes
```
<!-- asc-en:name:end -->

## Subtitle (29 of 30)

Arabic: "اسأل، لخّص، واختبر نفسك" (ask, summarize, and test yourself).

<!-- asc-en:subtitle:begin -->
```
Ask, summarize, test yourself
```
<!-- asc-en:subtitle:end -->

## Keywords (98 of 100)

Arabic: studying, test, summary, exam, revision, lecture, student, homework,
lessons, learning, university, secondary school, baccalaureate, PDF. "Study"
and "test" are in the name and the subtitle; "lessons" is left out for the
limit.

<!-- asc-en:keywords:begin -->
```
quiz,summary,exam,revision,lecture,student,homework,learn,university,high school,baccalaureate,pdf
```
<!-- asc-en:keywords:end -->

## Promotional text (158 of 170)

<!-- asc-en:promotionalText:begin -->
```
Upload your lecture or notes, then ask anything. Every answer comes from your own files, and the summary and the quiz are one tap away. In Arabic and English.
```
<!-- asc-en:promotionalText:end -->

## Description (1,643 of 4,000)

<!-- asc-en:description:begin -->
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
<!-- asc-en:description:end -->

## URLs (from `docs/store/ASC_ANSWERS.md` section 3)

<!-- asc-en:supportUrl:begin -->
```
https://tryknowflow.com/en/contact
```
<!-- asc-en:supportUrl:end -->

<!-- asc-en:privacyPolicyUrl:begin -->
```
https://tryknowflow.com/en/privacy
```
<!-- asc-en:privacyPolicyUrl:end -->

The Marketing URL stays empty (section 3: the landing page shows prices).
