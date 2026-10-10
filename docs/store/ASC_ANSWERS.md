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
status (the owner's decision) · §9 Sources.

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

**Two answers here are wider than the manifest** (§7, findings 1 and 2):
Analytics on User ID and Product Interaction, and Other Diagnostic Data. The
label is entered as above. The manifest catches up in build 2.

## 2. Age rating questionnaire

Apple's current questionnaire (definitions read 2026-10-10). Answer exactly:

**In-app controls**

| Item | Answer |
|---|---|
| Parental Controls | No |
| Age Assurance | No |

**Capabilities**

| Item | Answer | Reason |
|---|---|---|
| Unrestricted Web Access | **No** | The shell shows tryknowflow.com only. Any off-site link opens in Safari, outside the app (proven by `ios-smoke.yml`'s "external" step). |
| User-Generated Content | **No** | What a student uploads or asks is private to that account. No other user can see it, so nothing is "broadly distributed". |
| Messaging and Chat | **No** | Ask is a question to the AI about the student's own files. Users cannot reach each other. |
| Advertising | **No** | No ad SDK and no paid promotion (Phase 9 ads are not built). |

**Content: all "None" (or "No")**

| Section | Items | Answer |
|---|---|---|
| Mature themes | Profanity or Crude Humor; Horror/Fear Themes; Alcohol, Tobacco, or Drug Use or References | None |
| Medical and wellness | Medical or Treatment Information; Health or Wellness Topics | None. The app gives no medical or lifestyle guidance of its own. A student's biology notes are the student's material, not app content. |
| Sexuality or nudity | Mature or Suggestive Themes; Sexual Content or Nudity; Graphic Sexual Content and Nudity | None |
| Violence | Cartoon or Fantasy Violence; Realistic Violence; Prolonged Graphic or Sadistic Realistic Violence; Guns or Other Weapons | None |
| Chance-based activities | Simulated Gambling; Contests | None. The streak has no prize and no ranking. |
| Chance-based activities | Gambling; Loot Boxes | No |

**If the form shows an item about AI-generated content or a chatbot** (none
is in Apple's published definitions as of today), answer **Yes**: answers,
summaries and quizzes are written by Anthropic's model.

**Calculated rating:** expected **4+**.

**Override to Higher Age Rating: 13+. Decided, with reasons.**

- Answers are free text from a generative model. It answers from the
  student's own upload, which can contain anything, and no human reads the
  output.
- An account takes an e-mail address and a name. Neither the privacy policy
  nor the terms says anything about children (checked 2026-10-10: no age,
  minor or parent wording on either page). A 4+ listing invites under-13s,
  and in the US storefront collecting a child's e-mail is COPPA territory.
- The market is students (secondary school and university).

**Made for Kids:** No. **Age Suitability URL:** leave empty.

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
written into the form by the workflow of §6, never typed by hand and never in
this file.

**Contact information:** first name, last name, e-mail and phone of the
person App Review should call. These are the owner's own details. They are
not secrets, but they are not in the repository either (§6 says how they are
filled).

**Notes** (English only. App Review works in English, so there are no Arabic
note lines.) (2,301 of 4,000)

```
SIGNING IN
The app opens on the Sign In screen. Use the demo account in the Sign-In Information fields (email and password). The account holds one subject, "Biology", with one file, "photosynthesis-notes.txt", which already has a summary and a quiz. The language switch (English / العربية) is at the top of every screen.

AI PERMISSION (guideline 5.1.2(i))
This demo account has deliberately NOT given the AI permission, so you will see the one-time permission sheet. It appears the first time you upload a file, ask a question, open a new summary or start a quiz. The quickest path: Subjects > Biology > the file > "Quiz me on this material". The sheet names Anthropic (writes answers, summaries and quizzes) and Voyage AI (prepares text for search). "Not now" sends nothing and leaves those features unavailable, with the reason shown. The permission can be withdrawn or given at any time in Settings > "AI processing".

DAILY STUDY REMINDER (local notification)
Settings > "Study reminder" > the "Remind me every day" switch, with a time picker (default 19:00). iOS asks for notification permission when you turn it on. The reminder is scheduled on the device only; nothing is sent to our servers.

DAILY LIMITS
Each account can upload 5 files per day (also 10 questions, 5 new summaries and 5 new quizzes per day). The counters reset at midnight UTC. If a limit is reached during review, the app says so and the next day's counter starts fresh.

NO PURCHASES IN THE APP (guideline 3.1.3(f))
The app costs nothing and is a stand-alone companion to the KnowFlow web service. It contains no in-app purchase, no price, no purchase button and no link to a purchase page. Any paid tier is managed on the website only and is never mentioned or linked inside the app.

SIGN-IN METHODS
The app offers email and password only, with no third-party or social login, so Sign in with Apple is not required (4.8). Students who registered with Google on the website set a password once through "Forgot your password?"; a line on the Sign In screen tells them so.

ACCOUNT DELETION (5.1.1(v))
Settings > "Delete account" deletes the account and everything in it, immediately.

FILE UPLOADS
Supported: PDF, Word, PowerPoint, Excel, text and Markdown, up to 4 MB each. Off-site links open in Safari, outside the app.
```

**Attachment:** none needed.

## 6. How the reviewer's sign-in details reach the form

**Decided: an App Store Connect API write from GitHub Actions. The password
never leaves GitHub's secret store, and nobody types or reads it.**

What exists today (read 2026-10-10 with `gh api`, names only):

- Environment `reviewer` holds `REVIEWER_EMAIL` and `REVIEWER_PASSWORD`. It
  deploys from `main` only.
- Environment `testflight` holds `ASC_ISSUER_ID`, `ASC_KEY_ID` and
  `ASC_KEY_P8` (the Admin key from T4). It deploys from `main` only.
- App Store Connect's API exposes the App Review details of a version
  (`appStoreReviewDetails`: `demoAccountName`, `demoAccountPassword`,
  `demoAccountRequired`, `notes`, and the contact fields).

The mechanism (step S7b, built and run by the agent; nothing for the owner
to type):

1. A new workflow, `workflow_dispatch` only, on `main`, two jobs.
2. **Job 1** (environment `testflight`) signs a token with the API key, finds
   version 1.0 of app 6820418649 in "Prepare for Submission" and its review
   detail (creating an empty one if none exists), and writes the Notes of §5,
   read from this file. It then signs a **second token** valid for 10 minutes
   whose `scope` claim allows exactly one operation: `PATCH
   /v1/appStoreReviewDetails/<that id>`. That token is the job's only output.
3. **Job 2** (environment `reviewer`) sends that single PATCH with
   `demoAccountRequired: true` and the e-mail and password from its own
   secrets. It prints only the HTTP status. The Admin key never sits on the
   runner that holds the password, and the password never sits on the runner
   that holds the key.
4. The agent then opens App Store Connect read-only and checks that the user
   name field shows the reviewer's address and the password field is filled,
   without revealing it.

**Why not the alternatives.** Typing it in by hand needs someone who knows
the password; nobody does (it was generated into the secret). Resetting it
through the mail would put a password in someone's hands, and in chat. A
password in the repository or in this report is ruled out.

**What the owner must do: nothing for the sign-in fields.** For the four
contact fields, App Store Connect normally fills them from the account
holder. If the phone field is empty when the agent checks in step 4, the
owner types their phone number once in App Review Information. That is a
phone number, not a password.

**Residual risks, stated.** The scoped token travels as a job output; anyone
who could read it within 10 minutes could only rewrite this one review
record. Apple's `scope` claim accepts explicit ids (no wildcards), which is
why job 1 resolves the id first. If Apple refuses a scoped PATCH, the
fallback is to drop the scope and keep the 10-minute expiry. The agent
reports which one ran.

## 7. Mismatches and open risks found while drafting

1. **Manifest says App Functionality only; the code also does Analytics.**
   Every `kf-usage` line (`/api/agent`, quiz, summary routes) carries
   `user_id` with token counts, and the owner reads these lines to measure cost
   per question (cost-measurement plan, 2026-09-23). Vercel keeps them for 1
   hour (Hobby) or 1 day (Pro). Apple counts data kept "longer than what is
   necessary to service the transmitted request in real time" as collected.
   **Fix:** the label ticks Analytics for User ID and Product Interaction
   (§1). In build 2, `PrivacyInfo.xcprivacy` adds
   `NSPrivacyCollectedDataTypePurposeAnalytics` to those two entries.
2. **Server logs are diagnostics and are not in the manifest.** Request and
   error logs in Vercel are kept up to a day. **Fix:** the label declares
   Other Diagnostic Data (§1). Build 2 adds
   `NSPrivacyCollectedDataTypeOtherDiagnosticData` (linked, App
   Functionality).
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
6. **The consent sheet's training sentence rests on two facts outside the
   code.** For Anthropic, its published API terms. For Voyage AI, the
   zero-retention setting the privacy page dates to 2026-09-12. If either
   setting changes, the sheet and the privacy page become false together.
7. **Review notes promise "midnight UTC".** `usage_counters.day` defaults to
   Postgres `current_date`, which is UTC on Supabase's default time zone. That
   setting was not read today; the sentence holds unless the database time
   zone was changed.

## 8. EU Digital Services Act trader status: the owner's decision

This file does not decide it. The facts:

- **Apple requires a declaration either way**, "even if you don't distribute
  apps in the EU". You assess it yourself under EU law; "Apple can't
  determine whether you're a trader."
- **Account level, with a per-app override.** Business > Agreements >
  Compliance > Digital Services Act. Per app: App Information > App Store
  Regulations and Permits > Digital Services Act > Edit.
- **Recorded on 2026-10-08 (T3):** the account already declared itself a
  trader, from Scan & Action's declaration of 2026-10-07. KnowFlow inherits it
  unless overridden. Not re-read today, because this step opens nothing in App
  Store Connect.
- **If trader:** Apple publishes the address (or P.O. box), phone number and
  e-mail on the product page **in the 27 EU countries only, and only where
  the app is distributed there.** Apple verifies the e-mail and phone by
  two-factor code and the address with a document (business or legal
  records; for a P.O. box, also a bill or receipt), and asks for payment
  account details if missing.
- **If not a trader:** nothing is published. Undeclared apps were removed
  from EU storefronts from 2025-02-18 (press reports of Apple's notice).
- **What bears on KnowFlow:** it sells a paid tier on the web (Paddle), which
  is commercial activity. Under the DSA, that is the ordinary case of a trader.
  A "not a trader" declaration would be hard to defend if ever questioned.
- **The lever that avoids publishing anything:** KnowFlow's market is
  Morocco and the Gulf. Untick the 27 EU countries under Pricing and
  Availability, keep the trader declaration, and nothing about the owner is
  shown on any KnowFlow page. The cost is no KnowFlow in EU storefronts.

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
