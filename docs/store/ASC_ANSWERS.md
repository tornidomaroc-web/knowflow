# App Store Connect answers: KnowFlow (com.knowflow.app, Apple ID 6820418649)

Drafted 2026-10-10 (store path S7a). **Nothing here has been entered in App
Store Connect.** Every answer below was checked against the code, the privacy
manifest and the live site on that date, not against the brief that asked for
it. Where the code and an earlier document disagree, §7 says so.

Each ready-to-paste text sits in its own code block, so it copies without
Markdown. Character counts are Unicode code points, the way App Store Connect
counts them (an Arabic shadda counts as one).

Contents: §1 App Privacy · §2 Age rating · §3 Category and URLs · §4 Listing
text (English, Arabic) · §5 App Review Information · §6 How the reviewer's
sign-in details reach the form · §7 Mismatches and open risks · §8 EU trader
status (decided) · §9 Sources. Amended 2026-10-10 (S7b): §2 mapped to Apple's
questionnaire item by item, §5 and §6 rewritten for `asc-review-details.yml`,
§7 findings 1, 2, 6, 7 and 8, §8 decided.

## 1. App Privacy (the "nutrition label")

**Source of truth:** `ios/App/App/PrivacyInfo.xcprivacy` (five collected
types, all linked, none for tracking), `package.json` (no analytics,
advertising, crash or attribution SDK), the signup form (`full_name`, email,
password), the tables (`documents`, `chunks`, `messages`, `conversations`,
`quizzes`, `quiz_attempts`, `study_events`, `usage_counters`), the AI routes
and the server's `kf-usage` log lines.

**Data used to track you:** No. **Tracking domains:** none. **App Tracking
Transparency prompt:** not needed.

Answer "Yes, we collect data from this app", then select exactly these six
types. For every one: **Linked to the user's identity: Yes. Used for tracking:
No.**

| ASC category | ASC data type | Purposes to tick | What it is in KnowFlow |
|---|---|---|---|
| Contact Info | **Name** | App Functionality | `full_name` from the signup form |
| Contact Info | **Email Address** | App Functionality | the sign-in identifier; confirmation and reset mail |
| User Content | **Other User Content** | App Functionality | uploaded files and their text, questions asked, answers, summaries, quizzes and quiz answers |
| Identifiers | **User ID** | App Functionality, **Analytics** | the account id; it is on every `kf-usage` log line the owner reads for cost |
| Usage Data | **Product Interaction** | App Functionality, **Analytics** | study events (streak), daily counters (limits), the per-request usage lines |
| Diagnostics | **Other Diagnostic Data** | App Functionality | server request and error logs (Vercel), kept up to one day |

**Not collected (leave unticked), with the reason:**

- Purchases: the app has no purchase surface. A web purchase is recorded by
  the website, not by the app.
- Customer Support: support is an e-mail written outside the app (mail app),
  not a form inside it. This agrees with the manifest and corrects
  `STORE_PATH.md` §3.4, which had ticked it.
- Location, Contacts, Health, Financial Info, Sensitive Info, Browsing
  History, Search History, Device ID, Advertising Data, Crash Data,
  Performance Data, Photos or Videos, Audio, Gameplay: none is collected. The
  study reminder is a local notification. Its time stays on the phone and
  nothing is sent.

**Anthropic and Voyage AI.** The label has no field for processors. The rows
above already cover what they receive (Other User Content), and the in-app
sheet asks first (guideline 5.1.2(i), `src/lib/ai-consent.ts`). Apple's form
counts data "you or your third-party partners collect"; both process content
for KnowFlow. Neither receives the name or the e-mail (the sheet says so). The
privacy page says Anthropic's terms exclude training on API content, and that
Voyage AI is set to zero retention on our account since 2026-09-12.

**The manifest says the same six things** since 2026-10-10 (S7b, §7
findings 1 and 2): `PrivacyInfo.xcprivacy` carries the Analytics purpose on
User ID and Product Interaction and the Other Diagnostic Data type, and
`.github/scripts/ios-privacy-check.py` fails any built binary whose manifest
differs from this table. Build 2 carries it.

## 2. Age rating questionnaire

Apple's questionnaire of 2025-07-24 (ratings 4+, 9+, 13+, 16+, 18+), as the
"Age ratings values and definitions" reference and the API's
`ageRatingDeclaration` attributes list it on 2026-10-10 (sources in §9). The
items are in Apple's order; the API attribute names the form field exactly.
Frequency items take None, Infrequent or Frequent; the others Yes or No.

| # | Item (API attribute) | Answer | Why, from the code |
|---|---|---|---|
| 1 | Parental Controls (`parentalControls`) | No | No parent or guardian tool exists. |
| 2 | Age Assurance (`ageAssurance`) | No | No age check at signup; no Declared Age Range API. |
| 3 | Unrestricted Web Access (`unrestrictedWebAccess`) | **No** | The shell shows tryknowflow.com only; an off-site link opens in Safari, outside the app (ios-smoke proof). Yes would force 16+. |
| 4 | User-Generated Content (`userGeneratedContent`) | **No** | Apple's definition is *broad distribution* of user content. A student's files and questions are private to that account; no other user can see them. |
| 5 | Social Media (`socialMedia`) | No | No feed, likes, comments or shares. |
| 6 | Social Media Disabled for Users Under 13 (`socialMediaAgeRestricted`) | No | Not applicable without item 5. |
| 7 | Messaging and Chat (`messagingAndChat`) | **No** | Apple's definition is users communicating *with one another*. Ask is a question to the AI about the student's own files. |
| 8 | Advertising (`advertising`) | No | No ad SDK, no paid promotion (Phase 9 is not built). |
| 9 | Profanity or Crude Humor (`profanityOrCrudeHumor`) | None | No such app content. |
| 10 | Horror/Fear Themes (`horrorOrFearThemes`) | None | No such app content. |
| 11 | Alcohol, Tobacco, or Drug Use or References (`alcoholTobaccoOrDrugUseOrReferences`) | None | No such app content. |
| 12 | Medical or Treatment Information (`medicalOrTreatmentInformation`) | **None** | The app gives no diagnosis or treatment guidance of its own. A student's biology or pharmacology notes are the student's private material, read back to that student; Apple's item is about content the app provides. Infrequent would force 13+, which the override below reaches anyway. |
| 13 | Health or Wellness Topics (`healthOrWellnessTopics`) | No | No self-care or lifestyle advice; the study reminder is a notification, not wellness guidance. |
| 14 | Mature or Suggestive Themes (`matureOrSuggestiveThemes`) | None | No such app content (same reasoning as 12 for a history or law student's own notes). |
| 15 | Sexual Content or Nudity (`sexualContentOrNudity`) | None | No such app content. |
| 16 | Graphic Sexual Content and Nudity (`sexualContentGraphicAndNudity`) | None | Any other answer makes the app unpublishable. |
| 17 | Cartoon or Fantasy Violence (`violenceCartoonOrFantasy`) | None | No such app content. |
| 18 | Realistic Violence (`violenceRealistic`) | None | No such app content. |
| 19 | Prolonged Graphic or Sadistic Realistic Violence (`violenceRealisticProlongedGraphicOrSadistic`) | None | Any other answer makes the app unpublishable. |
| 20 | Guns or Other Weapons (`gunsOrOtherWeapons`) | None | No such app content. |
| 21 | Gambling (`gambling`) | No | Nothing is wagered. |
| 22 | Simulated Gambling (`gamblingSimulated`) | None | Nothing is wagered. |
| 23 | Contests (`contests`) | **None** | Apple's definition is users competing for rankings or rewards. A quiz is marked for the student alone; the streak has no ranking and no prize. |
| 24 | Loot Boxes (`lootBox`) | No | Nothing is purchasable. |

**AI-generated content.** No item asks about it (checked on the definitions
page, the setup page and the API attributes on 2026-10-10). Apple's news
post of 2025-07-24 says instead that "AI assistants and chatbot
functionality" must be weighed through the existing content items. The
answers above do that: the model writes only from the student's own upload.

**Calculated rating:** 4+ (every item None or No).

**Override to Higher Age Rating (`ageRatingOverrideV2`): THIRTEEN_PLUS.**
Decided, for three reasons: answers, summaries and quizzes are free text
from a generative model that no human reads; an account takes an e-mail
address and a name, and neither the privacy policy nor the terms says
anything about children (checked 2026-10-10), so a 4+ listing would invite
under-13s; the audience is secondary school and university students. The
override applies in every storefront and maps to each region's values.

**Made for Kids:** not applicable. **Age Suitability URL
(`developerAgeRatingInfoUrl`):** leave empty. **Korea (`gracRatingClassificationNumber`):**
leave empty; no GRAC rating exists.

## 3. Category and URLs

| Field | Value | Checked 2026-10-10 |
|---|---|---|
| Primary category | **Education** | |
| Secondary category | **Productivity** | Optional. The other honest fit is Reference; Productivity matches "organise, review, remind". |
| Support URL (en) | `https://tryknowflow.com/en/contact` | 200, has the support mailto |
| Support URL (ar) | `https://tryknowflow.com/ar/contact` | 200, has the support mailto |
| Privacy Policy URL (en) | `https://tryknowflow.com/en/privacy` | 200, names Anthropic and Voyage AI |
| Privacy Policy URL (ar) | `https://tryknowflow.com/ar/privacy` | 200 |
| Marketing URL | **leave empty** | Optional field. The landing page `/en`, `/ar` shows prices, a Pricing link and "Start free" in a normal browser. Pointing App Store metadata at it is a call to action for an outside purchase (3.1.1, 3.1.3(f)). See §7, finding 4. |
| Copyright | `2026 KnowFlow` | |

The `/` root answers 307 to `/ar` (or `/en` by the browser language), so the
language-specific URLs above are the ones to paste, not the bare domain.

## 4. Listing text

Rules applied: no price, plan, upgrade, free or subscription wording; no em
dash or en dash; Modern Standard Arabic; Western numerals; words the app
itself uses (Arabic مادة = subject, ملف = material, as in `ar.ts`). Keywords
leave out words already in the name and subtitle, which Apple indexes anyway.

### 4.1 English (en-US)

**Name** (8 of 30)

```
KnowFlow
```

**Subtitle** (27 of 30)

```
Answers from your own notes
```

**Keywords** (98 of 100)

```
study,quiz,summary,exam,revision,lecture,pdf,student,homework,tutor,learn,university,school,arabic
```

**Promotional text** (153 of 170)

```
Upload a lecture or your notes, then ask anything. Every answer comes from your own files, with a summary and a quiz one tap away. In Arabic and English.
```

**Description** (1,626 of 4,000)

```
KnowFlow turns your own study files into answers, summaries and quizzes.

Add a subject, upload your lecture notes, slides or readings, and ask questions the way you would ask a classmate. Every answer is written from the files in that subject and names the file it came from, so you can check it.

WHAT YOU CAN DO
• Organise your study by subject, with each subject's files inside it.
• Upload PDF, Word, PowerPoint, Excel, text and Markdown files, up to 4 MB each.
• Ask in Arabic or English and get a clear answer from your own material, with the source file shown.
• Open a summary of any file to review it quickly.
• Test yourself with a five-question quiz made from a file, then check your answers.
• Keep a daily study streak and see your progress on your home screen.
• Turn on a daily study reminder at the time you choose. It stays on your phone.
• Use the app in Arabic or English, in a dark or light appearance.

YOUR PERMISSION COMES FIRST
Answers, summaries and quizzes are written by AI. Before anything is sent, KnowFlow asks your permission and names the two companies involved: Anthropic, which writes the answers, summaries and quizzes, and Voyage AI, which prepares the text so the right passage can be found. Neither receives your name or your email address. You can withdraw the permission at any time in Settings.

YOUR ACCOUNT, YOUR DATA
Rename or delete any file at any time, and delete your account and everything in it from Settings.

AI can make mistakes. Check important answers against your files.

Privacy policy: https://tryknowflow.com/en/privacy
Terms of use: https://tryknowflow.com/en/terms
```

### 4.2 Arabic (ar-SA)

**Approved by the owner on 2026-10-10 as written below, including the name
"KnowFlow: ذاكر من ملفاتك".** Any later change goes through a copy batch.

**Name** (24 of 30)

```
KnowFlow: ذاكر من ملفاتك
```

**Subtitle** (23 of 30)

```
اسأل، لخّص، واختبر نفسك
```

**Keywords** (87 of 100)

```
مذاكرة,اختبار,ملخص,امتحان,مراجعة,محاضرة,طالب,واجبات,دروس,تعلم,جامعة,ثانوية,بكالوريا,PDF
```

**Promotional text** (132 of 170)

```
ارفع محاضرتك أو ملاحظاتك، ثم اسأل ما تشاء. كل إجابة تأتي من ملفاتك أنت، والملخص والاختبار على بُعد لمسة واحدة. بالعربية والإنجليزية.
```

**Description** (1,351 of 4,000)

```
يحوّل KnowFlow ملفات مذاكرتك إلى إجابات وملخصات واختبارات.

أضف مادة، وارفع ملاحظات المحاضرات أو الشرائح أو القراءات، ثم اسأل كما تسأل زميلك. تُكتب كل إجابة من ملفات تلك المادة، وتذكر الملف الذي جاءت منه، لتتحقق منها بنفسك.

ما الذي يمكنك فعله
• نظّم مذاكرتك حسب المادة، وضع ملفات كل مادة داخلها.
• ارفع ملفات PDF وWord وPowerPoint وExcel والنصوص وMarkdown، حتى 4 ميغابايت للملف الواحد.
• اسأل بالعربية أو بالإنجليزية، واحصل على إجابة واضحة من ملفاتك أنت، مع اسم الملف المصدر.
• افتح ملخص أي ملف لتراجعه بسرعة.
• اختبر نفسك باختبار من خمسة أسئلة يُعدّ من الملف، ثم صحّح إجاباتك.
• حافظ على سلسلة مذاكرة يومية، وتابع تقدّمك في صفحتك الرئيسية.
• فعّل تذكيرًا يوميًا بالمذاكرة في الوقت الذي تختاره، ويبقى على هاتفك.
• استخدم التطبيق بالعربية أو بالإنجليزية، بمظهر داكن أو فاتح.

إذنك أولًا
يكتب الذكاء الاصطناعي الإجابات والملخصات والاختبارات. وقبل إرسال أي شيء، يطلب KnowFlow إذنك ويسمّي الشركتين المعنيتين: Anthropic التي تكتب الإجابات والملخصات والاختبارات، وVoyage AI التي تهيّئ النص للعثور على المقطع المناسب. لا تتلقى أيّ منهما اسمك ولا بريدك الإلكتروني. ويمكنك سحب الإذن في أي وقت من الإعدادات.

حسابك وبياناتك
أعد تسمية أي ملف أو احذفه متى شئت، واحذف حسابك وكل ما فيه من الإعدادات.

قد يخطئ الذكاء الاصطناعي، فتحقّق من الإجابات المهمة في ملفاتك.

سياسة الخصوصية: https://tryknowflow.com/ar/privacy
شروط الاستخدام: https://tryknowflow.com/ar/terms
```

**What's New** is not asked for a first version.

## 5. App Review Information

**Sign-in required:** Yes. **User name / Password:** the reviewer account,
written into its two fields by `asc-review-details.yml` (§6), never typed by
hand and never in this file. The password goes only into the password field,
never into the notes; the workflow refuses notes that carry it.

**Contact information:** first name, last name, e-mail and phone of the
person App Review should call. The name and the support address are secrets
of the `reviewer` environment (`REVIEW_CONTACT_FIRST_NAME`,
`REVIEW_CONTACT_LAST_NAME`, `REVIEW_CONTACT_EMAIL`, set 2026-10-10), written
by the same workflow. The phone is sent only if `REVIEW_CONTACT_PHONE` exists;
otherwise the workflow leaves the field as it is and says whether it is
empty.

**Notes** (English only. App Review works in English, so there are no Arabic
note lines.) (2,296 of 4,000). The two HTML comments around the block are the
markers `asc-review-details.yml` reads the notes between; keep them.

<!-- asc-review-notes:begin -->
```
SIGNING IN
The app opens on the Sign In screen. Use the demo account in the Sign-In Information fields (email and password). The account holds one subject, "Biology", with one file, "photosynthesis-notes.txt", which already has a summary and a quiz. The language switch (English / العربية) is at the top of every screen.

AI PERMISSION (guideline 5.1.2(i))
This demo account has deliberately NOT given the AI permission, so you will see the one-time permission sheet. It appears the first time you upload a file, ask a question, open a new summary or start a quiz. The quickest path: Subjects > Biology > the file > "Quiz me on this material". The sheet names Anthropic (writes answers, summaries and quizzes) and Voyage AI (prepares text for search). "Not now" sends nothing and leaves those features unavailable, with the reason shown. The permission can be withdrawn or given at any time in Settings > "AI processing".

DAILY STUDY REMINDER (local notification)
Settings > "Study reminder" > the "Remind me every day" switch, with a time picker (default 19:00). iOS asks for notification permission when you turn it on. The reminder is scheduled on the device only; nothing is sent to our servers.

DAILY LIMITS
Each account can upload 5 files per day (also 10 questions, 5 new summaries and 5 new quizzes per day). The counters reset once a day. If a limit is reached during review, the app says so and the next day's counter starts fresh.

NO PURCHASES IN THE APP (guideline 3.1.3(f))
The app costs nothing and is a stand-alone companion to the KnowFlow web service. It contains no in-app purchase, no price, no purchase button and no link to a purchase page. Any paid tier is managed on the website only and is never mentioned or linked inside the app.

SIGN-IN METHODS
The app offers email and password only, with no third-party or social login, so Sign in with Apple is not required (4.8). Students who registered with Google on the website set a password once through "Forgot your password?"; a line on the Sign In screen tells them so.

ACCOUNT DELETION (5.1.1(v))
Settings > "Delete account" deletes the account and everything in it, immediately.

FILE UPLOADS
Supported: PDF, Word, PowerPoint, Excel, text and Markdown, up to 4 MB each. Off-site links open in Safari, outside the app.
```
<!-- asc-review-notes:end -->

**Attachment:** none needed.

## 6. How the reviewer's sign-in details reach the form

**Decided and built (2026-10-10): `.github/workflows/asc-review-details.yml`,
one job, one environment, an App Manager key made for it. Nobody types or
reads the password, nothing usable crosses a job boundary, and the public
log shows statuses and field names only.**

**Why one job.** A GitHub job reads the secrets of exactly one environment.
The reviewer's password lives in `reviewer` and the Admin key in
`testflight`, so a two-job design has to pass something usable between
them, and on a public repository every job output, artifact and log line is
public. Instead the write runs in `reviewer` with its own, smaller key.

**The key: App Manager, not Admin.** Apple describes App Manager as the role
that "manages all aspects of an app, such as pricing, App Store information,
and app development and delivery", and lets App Manager access be limited to
chosen apps. It cannot manage users or certificates and cannot see finance.
That is the least role that edits App Review Information. The Admin key of
T4 stays in `testflight` for the build and is never used here.

**What the owner does, once (no secret in chat):**

1. App Store Connect > Users and Access > Integrations > Team Keys > "+".
   Name `KnowFlow review details`, access **App Manager**; if the dialog
   offers app access, choose **KnowFlow** only. Generate.
2. Download the `.p8` once (Apple allows one download), then from a terminal
   in the repository, with the file path in place of `<path>`:
   `gh secret set ASC_REVIEW_KEY_P8 --env reviewer < <path>`
   `gh secret set ASC_REVIEW_KEY_ID --env reviewer` (paste the Key ID shown
   on the key's row), and
   `gh secret set ASC_REVIEW_ISSUER_ID --env reviewer` (paste the Issuer ID
   shown above the key list). Then delete the `.p8` file.
3. Nothing else. The agent dispatches the workflow (`dry_run: true` first),
   reads its log, and dispatches the write.

**What the workflow does** (`workflow_dispatch` only; `main` only, by the
environment's branch policy and by its own `if`; `ubuntu-24.04`; the only
foreign code is the pinned `actions/checkout`; then openssl, curl, jq and
coreutils from the image):

1. Checks that every secret is present, by name. Checks the key is a PEM
   key openssl can read.
2. Reads the notes from this file between the two marker comments; refuses
   them if they are longer than 4000 characters, carry the reviewer's
   address or the password, or carry a dash.
3. Mints a ten-minute token with openssl alone (ES256; the DER signature's
   two integers laid out as the raw 64 bytes), masks it, keeps it in a file
   that curl reads as a header. A local run of the same lines against a
   throwaway key produced a token node's crypto verified.
4. Reads version 1.0 of app 6820418649 and its review detail, and prints
   the status, the version state and each field as `set` or `empty`.
5. **Dry run (the default and the first run after merge): stops here.**
6. Otherwise builds the body with jq (secrets reach jq as arguments, never a
   shell string), sends one PATCH (or one POST if no detail exists) with
   contact name and e-mail, `demoAccountName`, `demoAccountPassword` in its
   own field, `demoAccountRequired: true`, the notes, and `contactPhone`
   only if the secret exists. Prints the status and the fields as
   `set`/`empty`, and a warning if the phone is empty.
7. Shreds the key, the token and the notes, even when a step failed.

**Security design, in five lines.**
1. One environment, one runner, no job output, no artifact: nothing crosses.
2. The key is the lowest role that can do the write and can be limited to
   this app; the Admin key never leaves `testflight`.
3. Every secret is masked by GitHub; the token is masked the moment it is
   minted; bodies go to files, never to the log; no `set -x`.
4. The notes are checked against the address and the password before the
   write, so the one free-text field cannot carry either.
5. The workflow cannot run from a pull request or a branch: dispatch only,
   `main` only, and the environment refuses any other ref.

**Residual risks, stated.** A run log is public: it shows that a review
detail exists, which fields are set, and the version state. Anyone with
write access to `main` could change the notes in this file before a run;
the owner merges every change. If Apple refuses the App Manager key for
this endpoint (403), the log says so and the fallback is the same workflow
with the Admin key's three secrets copied into `reviewer` by the owner.

## 7. Mismatches and open risks found while drafting

1. **Manifest says App Functionality only; the code also does Analytics.**
   Every `kf-usage` line (`/api/agent`, quiz, summary routes) carries
   `user_id` with token counts, and the owner reads these lines to measure cost
   per question (cost-measurement plan, 2026-09-23). Vercel keeps them for 1
   hour (Hobby) or 1 day (Pro). Apple counts data kept "longer than what is
   necessary to service the transmitted request in real time" as collected.
   **Fixed 2026-10-10 (S7b):** the label ticks Analytics for User ID and
   Product Interaction (§1), and `PrivacyInfo.xcprivacy` now carries
   `NSPrivacyCollectedDataTypePurposeAnalytics` on those two entries;
   `ios-privacy-check.py` expects exactly that.
2. **Server logs are diagnostics and are not in the manifest.** Request and
   error logs in Vercel are kept up to a day. **Fixed 2026-10-10 (S7b):**
   the label declares Other Diagnostic Data (§1) and the manifest carries
   `NSPrivacyCollectedDataTypeOtherDiagnosticData` (linked, App
   Functionality); build 2 ships it.
3. **`STORE_ASSETS.md` §4** listed the privacy types without Name and
   without the purposes. It is corrected in place in this change to point
   here. **`STORE_PATH.md` §3.4** ticked Customer Support. The manifest
   (2026-10-09) already dropped it, and this file follows the manifest.
4. **The required URLs show prices on the web.** `/en/contact` and
   `/en/privacy` (and the Arabic ones) carry the site's Pricing link when a
   reviewer opens them in a browser. Inside the app they do not: with the
   app's user agent `KnowFlowApp/1` no pricing link is served (checked today).
   Support and privacy URLs are mandatory, and a pricing link in a site
   header is common, so the risk is **low**. The Marketing URL is optional,
   and the landing page is a sales page, so it is left **empty**. If App
   Review cites 3.1.3(f) over the support URL, the fix is a header-less
   contact page for the app marker.
5. **No minimum age anywhere.** The terms and the privacy policy say nothing
   about children. The 13+ override (§2) covers the store listing, not the
   policy. A one-paragraph addition to both pages ("KnowFlow is for students
   aged 13 and over"), in both languages, should go with the owner's next
   copy batch. Not a submission blocker by itself.
6. **The consent sheet's training sentence ("neither uses your content to
   train its models"), verified 2026-10-10.** Anthropic: its commercial terms
   (effective 2025-06-17) say "Anthropic may not train models on Customer
   Content from Services". Voyage AI: its terms (updated 2026-05-27) grant
   Voyage a licence to train on customer content **unless the organisation
   opts out** in the dashboard (a payment method must be on file); after the
   opt-out, content "will be immediately deleted by Voyage AI after it is
   processed", and the opt-out cannot be undone from the dashboard. The
   KnowFlow organisation was switched to "Opted Out" on 2026-09-12, read
   back on screen by the owner (register row #90). The Voyage dashboard asks
   for a login that the agent does not perform, so the toggle was not
   re-read on 2026-10-10; because it is one-way, the 2026-09-12 reading
   stands. The sentence stays as written: every byte the sheet governs is
   sent after both the opt-out and the consent. **Not covered by the
   sentence, and still open in row #90:** content sent before 2026-09-12
   stays inside Voyage's grant. The one action that re-proves the claim: sign
   in to dashboard.voyageai.com, Organization > Terms of Service, and read
   "Opted Out".
7. **The reset time is not proven, so the notes no longer name it.**
   `increment_usage` (three migrations, last `20260708_quizzes.sql`) writes
   `current_date`, which is the connection's time zone: Supabase's default is
   UTC and no migration sets `timezone` on the database, a role or the
   function, but the live setting could not be read on 2026-10-10 (next
   finding). The notes say "once a day".
8. **The production Supabase project is not reachable from the owner's
   signed-in Chrome.** On 2026-10-10 `supabase.com/dashboard/project/wnpqdafdkbuvwecksrjj`
   redirected to the organisation list; the KnowFlow organisation shows no
   project, "Free Plan", and a red "Outstanding invoices" banner whose link
   points at that organisation's billing page, while the three other
   organisations hold unrelated projects. Production itself answers (the
   screenshot run signed in at 14:35Z the same day). Either the project sits
   under another Supabase account, or it was moved. The owner should open
   the KnowFlow organisation's billing page and say which account owns the
   project; until then no dashboard read of production is possible.

## 8. EU Digital Services Act trader status: decided

**Decided by the owner on 2026-10-10: KnowFlow remains declared as a trader
and keeps the 27 EU storefronts.** The owner's contact details are shown on
KnowFlow's EU product pages, as Apple's trader rules require. Nothing to
enter per app unless App Store Connect asks for a per-app confirmation at
submission; the account-level declaration from 2026-10-07 covers it.

The facts the decision rested on (read 2026-10-10):

- Apple requires a declaration either way, "even if you don't distribute
  apps in the EU"; "Apple can't determine whether you're a trader."
- Account level, with a per-app override: Business > Agreements >
  Compliance > Digital Services Act; per app under App Information > App
  Store Regulations and Permits.
- A trader's address (or P.O. box), phone and e-mail are published on the
  product page in the 27 EU countries only, where the app is distributed
  there. Apple verifies e-mail and phone by code and the address by document.
- Apps with no declaration were removed from EU storefronts from 2025-02-18.
- KnowFlow sells a paid tier on the web, which is the ordinary case of a
  trader under the DSA.

## 9. Sources (read 2026-10-10)

- Apple, age ratings values and definitions; set an app age rating:
  developer.apple.com/help/app-store-connect (reference/app-information,
  manage-app-information).
- Apple, manage EU DSA trader requirements:
  developer.apple.com/help/app-store-connect/manage-compliance-information.
- Apple, App privacy details: developer.apple.com/app-store/app-privacy-details.
- Apple, generating tokens for API requests (`scope` claim):
  developer.apple.com/documentation/appstoreconnectapi.
- Press on the 2025-02-18 EU removals: TechCrunch, 9to5Mac (2025-02-18).
- Live site: `curl` of each URL in §3, with and without the app's user agent.
- Apple, App Store Connect API: `ageRatingDeclaration` attributes;
  `POST /v1/appStoreReviewDetails`; `GET /v1/appStoreVersions/{id}/appStoreReviewDetail`;
  Apple news 2025-07-24 (the new age rating system) and 2026-07-09 (the
  social media items). Role descriptions: App Store Connect Help, reference,
  account management, role permissions.
- Voyage AI terms of service (voyageai.com/tos, updated 2026-05-27) and docs
  FAQ (docs.voyageai.com/docs/faq); Anthropic commercial terms
  (anthropic.com/legal/commercial-terms, effective 2025-06-17).
