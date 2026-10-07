# The path to the stores: distance, order and decisions (2026-10-07)

**Status: analysis and decisions only. Nothing was built, nothing in production
changed.** Written on `main` at `ab39878` on the owner's brief of 2026-10-07,
which restates the ruling of 2026-08-24: publishing to the Apple App Store and
Google Play is the primary goal of the project (`PIVOT_PLAN.md` §5).

Every external rule below was read from its official source on 2026-10-07 and
is cited by section. Facts about this repository were read from the code at
`ab39878`. Facts about the owner's accounts are owner-attested and carry the
date they were last read.

## 0. The answer first

| Question | Answer |
|---|---|
| Distance to a TestFlight build on the owner's iPhone | **4 working sessions** of agent work, plus about 30 minutes of the owner's own console steps. Nothing in Phases 6, 7 or 9 is on this path. |
| Distance to the first App Store review submission | **About 10 working sessions** in total, the four above included, plus the owner's icon, a reviewer account and the App Store Connect forms. |
| Distance to Google Play production | About 2 extra sessions on top of the shared work, then a **fixed 14-day closed test with 12 testers** if the owner's Play account is subject to it (§5). That wait is the longest fixed delay in either store. |
| Mac needed? | **No.** GitHub's standard `macos-26` runner is free on this public repository and ships the Xcode 26 that Apple now requires (§4). |
| Money needed before the first submission | **None.** Every cost below is optional or post-launch, and each is named in USD where it appears. |
| The decision this file asks the owner to sign | **Ship the iOS app as a native shell that loads `tryknowflow.com`, not as the static client bundle `PIVOT_PLAN.md` §5 chose.** The reasons are in §1.1. |

## 1. What the iOS app is: the one architecture decision

### 1.1 Objection to `PIVOT_PLAN.md` §5 "Option B"

§5 chose a client-rendered static bundle inside Capacitor, over the existing
`/api/*` routes, and called a shell that loads the hosted site (`server.url`)
"the textbook 4.2 trigger". This file objects to both halves, with evidence.

**What Apple actually judges.** Guideline 4.2, verbatim: *"Your app should
include features, content, and UI that elevate it beyond a repackaged
website."* It names features, content and UI. It says nothing about where the
HTML is loaded from, and no guideline mentions web views at all (the full text
was searched on 2026-10-07; the only web-engine rule, 2.5.6, requires WebKit,
which Capacitor uses). A static bundle of the same screens shows the reviewer
exactly what the hosted site shows. **It changes the cost, not the verdict.**
`PIVOT_PLAN.md` §5 itself conceded this on 2026-08-24: *"Option B is NOT itself
an answer to 4.2"*.

**What the static bundle would cost here.** The signed-in app is server
rendered. At `ab39878`:

| Server-rendered surface that a static bundle cannot run | Server calls in the file |
|---|---|
| `src/app/[locale]/dashboard/layout.tsx` | 7 |
| `src/app/[locale]/dashboard/settings/page.tsx` | 6 |
| `src/app/[locale]/dashboard/page.tsx` (student home) | 5 |
| `src/app/[locale]/dashboard/knowledge/page.tsx` (subjects) | 1 |
| `src/app/[locale]/dashboard/agent/page.tsx` (ask) | 1 |
| `src/middleware.ts` (session refresh, auth guard, locale cookie) | n/a |

All 13 API routes read the session from cookies through
`src/lib/supabase/server.ts`. A bundle served from `capacitor://localhost`
calls `tryknowflow.com` cross-origin, so cookies do not travel: every route
would need bearer-token auth and CORS, and the five pages and the middleware
would need rewriting as client code. That is roughly 6 to 8 sessions before
the first build, and it forks the app into two front ends that must be kept
equal forever.

**What the hosted-site shell costs.** One Capacitor project whose start URL is
`https://tryknowflow.com/<locale>/dashboard`, with the native layer this file
lists in §2.2. Cookies, server components, the middleware and every API route
work unchanged, because the web view is on the site's own origin. One front
end, one deploy.

**The real risk of the hosted-site shell, stated.** It is guideline **2.5.2**,
not 4.2: apps *"may not download, install, or execute code which introduces or
changes features or functionality of the app"*. A shell over a live site can
change after review. The mitigations: the shell restricts navigation to
`tryknowflow.com` and opens every other link in Safari, the native features are
in the binary, and no feature is ever added to the app by a web deploy alone
without a matching app update. Apple has not cited 2.5.2 against account-based
SaaS shells in the cases this file could find, but that is not proof, so it is
recorded as the residual risk of this decision, rated medium.

**Decision recommended: the hosted-site shell.** Reversible: if App Review
rejects it under 2.5.2 or 4.2, the static bundle remains possible later, and
every native piece built for the shell carries over.

### 1.2 Two facts that break today's code inside any shell

1. **Google sign-in does not work inside an embedded web view.** Google has
   blocked OAuth in embedded web views since 2021-09-30 (`disallowed_useragent`;
   [Google Developers Blog](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/)).
   Inside the shell, the Google button must open the system browser
   (`SFSafariViewController` / `ASWebAuthenticationSession`) and return through
   a deep link that hands the code to `/api/auth/callback` in the web view.
   Until that exists, the shell hides the Google button; email and password
   work as they are.
2. **The store flag is build-time only.** `src/lib/platform.ts` reads
   `NEXT_PUBLIC_KF_PLATFORM` at build time. Vercel builds the web app, so every
   server-rendered page answers `web` and shows the Upgrade links that 3.1.1
   forbids in the app. The shell must identify itself on every request,
   navigations included, which only a user-agent marker does
   (Capacitor `appendUserAgent`), and `resolvePlatform` must read it.
   `scripts/verify-store-purchase-links.mjs` extends to the request path.

## 2. Distance, item by item, in order

Agent sessions are estimates for one focused working session each, including
the proof script every PR here carries. "Owner" steps are console steps the
agent does not take because they need the owner's credentials.

### 2.1 To a TestFlight build on the owner's iPhone

| # | Item | What it actually requires | Who | Size |
|---|---|---|---|---|
| T1 | **Platform at request time** | A user-agent marker read by `resolvePlatform`; the middleware sends a native request for a marketing page (`/`, `/pricing`, `/refund`) to the app's entry; the Google button hidden in native until S1; proof extended to server-rendered pages. Web behaviour unchanged. | Agent | 1 session |
| T2 | **Capacitor project** | `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`; `capacitor.config.ts` with `server.url`, `appendUserAgent`, `allowNavigation` limited to the site, an offline page bundled through `server.errorPath`; the `ios/` project with `TARGETED_DEVICE_FAMILY = 1` (`STORE_ASSETS.md` §5), `ITSAppUsesNonExemptEncryption = NO` (HTTPS only), bundle id `com.knowflow.app` (row #119 (iii), the owner's convention); a temporary icon from the in-app mark. `android/` generated in the same PR. | Agent | 1 session |
| T3 | **Owner console steps** | In App Store Connect: **Apps → +** (name, primary language Arabic, bundle id from T2, SKU); **Users and Access → Integrations → App Store Connect API → generate key** with the App Manager role; paste the Issuer ID, Key ID and the `.p8` contents into three GitHub Actions secrets. The agent never sees the key. If "KnowFlow" is taken as an App Store name, choose another display name here; the bundle id is unaffected. | Owner | ~30 min |
| T4 | **The iOS build job** | A workflow on the standard `macos-26` runner (never a `-large` or `-xlarge` label, §4), triggered only by `workflow_dispatch` and never by a pull request, so no fork can reach the secrets: `npx cap sync ios`, `xcodebuild archive` with automatic signing through the API key (`-allowProvisioningUpdates` with `-authenticationKeyPath/-ID/-IssuerID`, which creates the certificate and profile in the cloud), export for App Store Connect, upload with `xcrun altool --upload-app --apiKey`. Expect one or two red runs while signing settles. | Agent | 1–2 sessions |
| T5 | **Install** | Add the owner to an internal testing group in TestFlight; install the TestFlight app on the iPhone; install the build. Apple: internal testers are App Store Connect users, up to 100, and a build stays testable for 90 days ([TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)). Internal testing needs no App Review. | Owner | ~10 min |

**Total: 4 agent sessions and about 40 minutes of the owner.** At T5 the owner
signs in with email and password and uses the real app on the real phone.
Sign in with Google arrives with S1.

### 2.2 From TestFlight to the first App Store submission

| # | Item | What it requires, and why | Who | Size |
|---|---|---|---|---|
| S1 | **Google through the system browser; Sign in with Apple through the native sheet** | Google: open the OAuth start in `ASWebAuthenticationSession` (Capacitor Browser or a small plugin), return through a custom-scheme deep link, hand the code to `/api/auth/callback` in the web view; the scheme added to Supabase's redirect allow-list (owner). Apple: row #119's native path (iv): `@capacitor-community/apple-sign-in` returns an identity token, the page calls `signInWithIdToken`; the owner ticks **Sign in with Apple** on the App ID and sets **Client IDs = the App ID** in Supabase's Apple provider. No Services ID, no six-monthly secret. Required by **4.8** (§3.3). | Agent + owner (10 min) | 2 sessions |
| S2 | **Apple token revocation on account deletion** | Apple: *"Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens"* ([Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)). Cheapest shape: when an Apple-linked account deletes itself in the app, the app asks for a fresh Apple authorization code, the server exchanges it and calls `/auth/revoke`, so no token is ever stored. Needs one Sign in with Apple key (`.p8`) whose contents the owner stores as a server environment variable. | Agent + owner (10 min) | 1 session |
| S3 | **Native value for 4.2** | Two affordances a website cannot have: (a) a **local daily study reminder** tied to the streak (`@capacitor/local-notifications`, no server, no push certificate, off until the student turns it on, per 5.1.2(i)'s rule that system features may not be required); (b) **"Open in KnowFlow"** for PDF and Word files from Files, Mail and the share sheet (document types in `Info.plist`; the shell passes the file into the existing upload with the 4 MB limit). Together with S1's native sign-in sheet these are the answer to 4.2 (§3.1). | Agent | 2 sessions |
| S4 | **Explicit consent before content goes to third-party AI** | New since this plan was written. **5.1.2(i)**: *"You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so."* The privacy page already names Anthropic and Voyage AI (`privacy/page.tsx:27-35`), but nothing in the app asks. A one-time sheet before the first upload or question, in Arabic and English, naming both providers and what they receive, with Accept and Not now; not now leaves the student unable to upload or ask, with the reason shown. **No register row tracks this; it is a submission blocker.** | Agent | 1 session |
| S5 | **The owner's icon** | One 1024 × 1024 PNG, opaque, square corners (`STORE_ASSETS.md` §1.3, row #120). The temporary icon of T2 is fine for TestFlight, not for the store. | Owner | — |
| S6 | **Screenshots** | Apple accepts a 6.9" set at 1320 × 2868 (`STORE_ASSETS.md` §3.1). The `/preview/*` routes render every screen of §3.3 with fixtures and no sign-in, so the set can be made in Chromium at that size in both languages without touching a real account. | Agent | 0.5 session |
| S7 | **App Store Connect forms** | App Privacy (§3.4, answers drafted by the agent, entered by the owner), age rating questionnaire, category Education, privacy policy URL, support URL (the support e-mail of #19), Arabic and English listing text, review notes stating there is no purchase in the app and naming the reviewer account. | Agent drafts, owner enters | 0.5 session |
| S8 | **A reviewer account** | **2.1(a)**: *"include demo account info (and turn on your back-end service!) if your app includes a login."* A dedicated e-mail-and-password account with one subject, one material, a summary and a quiz. The owner creates it, because the agent does not create production accounts; the three protected test addresses stay untouched. | Owner | 15 min |
| S9 | **Submit** | Upload the final build through T4, attach it to the version, submit. | Owner | — |

**Total from today to submission: about 10 agent sessions** (T1–T4: 4, S1–S4:
6, S6–S7: 1, rounded) and about 1.5 hours of the owner across the steps.

## 3. Apple review risks, each with a verdict and the cheapest fix

### 3.1 Guideline 4.2, minimum functionality

**Text:** 4.2 as quoted in §1.1, and **4.2.2**: *"Other than catalogs, apps
shouldn't primarily be marketing materials, advertisements, web clippings,
content aggregators, or a collection of links."*

**Verdict: passable, medium risk.** KnowFlow is an account-based tool with
upload, ask, summaries, quizzes and a streak, not a clipping. What a reviewer
hits without native value is a site in a frame: no native sign-in sheet, no
reaction to files, nothing that works with the network off.

**Cheapest fix:** S1's native sign-in sheet, S3's reminder and Open-in, and
T2's bundled offline page, so airplane mode shows a designed screen instead of
a blank view. No offline copy of materials is proposed: it would need a local
store and sync, several sessions, and 4.2 does not ask for it by name.

### 3.2 Account deletion in the app

**Text:** **5.1.1(v)**: *"If your app supports account creation, you must also
offer account deletion within the app."* Apple's support page adds: *"Offer to
delete the entire account record, along with associated personal data ...
only offering to temporarily deactivate or disable an account is
insufficient."*

**Verdict: met today, one gap.** Settings carries the deletion card with a
server-checked typed-email confirmation (`DELETE /api/account`, register
#61(b), PR #91), and it renders inside the shell unchanged. **The gap is
Sign in with Apple revocation (S2)**, which exists only once S1 adds Apple.

### 3.3 Sign in with Apple, because Google sign-in is offered

**Text:** **4.8**: apps that use a third-party login such as Google Sign-In
*"must also offer as an equivalent option another login service"* that limits
data to name and e-mail, lets the user keep the e-mail private, and does not
collect interactions for advertising without consent. The exceptions (own
accounts only, education or enterprise accounts, government ID, third-party
client) do not fit: KnowFlow offers Google beside its own accounts.

**Verdict: blocker until S1.** The rule names the properties, not Apple, but
Sign in with Apple is the one service a reviewer will not question, and its
web half is already built and hidden (row #119).

**Cheapest fix:** S1's native path, which row #119 (iv) already found removes
the Services ID, the six-monthly secret and its monitor. One residual from
#119 (ii) stays: an Apple "Hide My Email" relay address bounces our mail
unless `tryknowflow.com` is registered for Private Email Relay. Without it, a
student who signs in with Apple and hides the address receives no
confirmation or reset mail; Sign in with Apple accounts need no confirmation
mail, so this does not block review, but the owner's registration of the
domain (10 minutes, `#89` has the DNS) should go with S1.

### 3.4 App Privacy labels

**Text:** App Privacy details are *"required to submit new apps and app
updates"*, and must cover *"all of the data you or your third-party partners
collect"*; "collect" means transmitting data off the device so that it can be
accessed *"for a period longer than what is necessary to service the
transmitted request in real time"*
([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)).

**Verdict: no risk if answered truthfully; drafted here.** No analytics or
advertising SDK is in `package.json` (checked 2026-10-07), so nothing is used
for tracking and no App Tracking Transparency prompt is needed while AdMob
(Phase 9) is out.

| Data type (Apple's names) | Collected | Linked to the user | Purpose |
|---|---|---|---|
| Contact info: Name, Email Address | Yes | Yes | App Functionality |
| User Content: Other User Content (uploaded files and their text), Customer Support (support mail) | Yes | Yes | App Functionality |
| User Content: questions asked (Other User Content) | Yes | Yes | App Functionality |
| Identifiers: User ID | Yes | Yes | App Functionality |
| Usage Data: Product Interaction (study events, usage counters) | Yes | Yes | App Functionality |
| Purchases | **No** in the app (no purchase surface in native) | — | — |
| Tracking | **No** | — | — |

Anthropic and Voyage AI process the text of materials and questions; Apple's
"third-party partners" definition covers code added to the app, but the
data is collected by KnowFlow's own servers either way, so the rows above
already cover it. The consent of S4 is a separate requirement from the label.

### 3.5 In-app purchase and the Paddle plan

**Text:** **3.1.1**: to unlock features or subscriptions *"you must use
in-app purchase"*; outside the United States storefront *"apps and their
metadata may not include buttons, external links, or other calls to action
that direct customers to purchasing mechanisms other than in-app purchase."*
**3.1.3(b)**, multiplatform services, lets an app honour what was bought on
the web only *"provided those items are also available as in-app purchases
within the app"*. **3.1.3(f)**, free stand-alone apps: *"Free apps acting as
a stand-alone companion to a paid web based tool (i.e. VoIP, Cloud Storage,
Email Services, Web Hosting) do not need to use in-app purchase, provided
there is no purchasing inside the app, or calls to action for purchase
outside of the app."*

**Verdict: the first submission goes under 3.1.3(f), with no purchase surface
in the app; medium risk.** 3.1.3(b) would require building StoreKit, App Store
Server Notifications and a second writer of `subscriptions` (register #73
names exactly that hazard), several sessions, for a product with no paying
customer. The free app with Pro hidden is the cheapest shape, and the purchase
surface is already hidden by the platform flag once T1 makes it request-time.

**What a reviewer hits:** the demo account is free, sees limits, and sees no
Upgrade, no price and no link to `/pricing` anywhere in the app (T1's proof
holds this). **If App Review rejects under 3.1.1 or 3.1.3(b)**, the next
cheapest fix is one session, not StoreKit: requests from the native shell are
served the free tier whatever the web subscription says, so nothing bought
elsewhere unlocks anything in the app and 3.1.1 has nothing to bite on. In-app
purchase is built only when the owner wants revenue from the app itself.

**Reader apps (3.1.3(a)) do not apply:** they are limited to *"magazines,
newspapers, books, audio, music, and video."*

### 3.6 Two more that the brief did not list

- **2.1(a), a reviewer account and a live backend.** S8 covers the account.
  The backend: the Supabase free project paused twice (rows #21, #63). Since
  2026-09-04 `deletion-orphan-watch` calls the database as `anon` every half
  hour (its last three runs, 2026-10-06/07, all succeeded), which is the kind
  of activity a pause waits for the absence of. **Verdict: mitigated, not
  proven**; nothing in this repository reads Supabase's pause clock. The
  certain fix is Supabase Pro (**USD 25 a month**, register #22), which this
  file does not recommend before submission, only before public launch.
- **Age rating.** Apple requires the updated questionnaire (deadline was
  2026-01-31 for existing apps; new apps answer it at creation,
  [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)).
  Students may be minors (`PIVOT_PLAN.md` §8); the app has AI-generated text
  and no user-to-user content. The owner answers in S7; no code follows from
  it while ads are out.

## 4. Building and signing iOS without a Mac

| Route | Cost (USD) | Free tier | Effort here | Verdict |
|---|---|---|---|---|
| **GitHub Actions, standard `macos-26` runner** | **0** on a public repository: *"The use of standard GitHub-hosted runners is free: In public repositories"*; *"Larger runners are always charged for, even when used by public repositories"* ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). For contrast, a private repository pays $0.062 a minute for macOS. | Unlimited minutes; this repository is **PUBLIC** (read 2026-10-07). `macos-26` is GA arm64 and standard ([runner images](https://github.com/actions/runner-images)). | T4: one workflow, signing through the App Store Connect API key. Everything else in this repository already runs on Actions. | **Recommended.** |
| Codemagic | 0 within **500 macOS M2 minutes a month**, one build at a time; then **$0.095 a minute** ([pricing](https://codemagic.io/pricing/)). | 500 minutes is roughly 25–40 iOS builds a month. | A second CI system, its own secrets store and its own config file. | Fallback only, if Actions signing proves unworkable. |
| A rented cloud Mac (MacinCloud and similar) | Paid monthly; not priced here because it is not recommended. | None found. | Interactive Xcode, but a second machine to keep. | Rejected: costs money for what Actions does free. |
| Buying a Mac | Hundreds of USD. | — | — | Rejected. |

**Two rules the build must keep.** (1) The label is exactly `macos-26`. The
`-large`, `-xlarge` and `-intel` labels are larger runners and bill even here.
(2) Apple requires uploads built with Xcode 26 and an iOS 26 SDK since
2026-04-28, and a minimum target of iOS 13 since 2026-09-09
([Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)).
The `macos-26` image meets the first; Capacitor's current template meets the
second.

**The public-repository caveat.** Workflow logs are public. The API key lives
only in Actions secrets, which GitHub masks and does not expose to pull
requests from forks; the iOS job runs on `workflow_dispatch` only. Nothing
signed is committed.

## 5. Google Play: distance, and order

**Owner-attested, 2026-08-24, no re-read since:** an active Play Console
developer account with published apps, $25 paid, Moroccan verification
cleared (`PIVOT_PLAN.md` §5).

**Distance.** T2 generates `android/` in the same PR as `ios/`; T1, S1 (the
Google part), S3 (Open-in has an Android equivalent) and S4 serve both shells.
The Android-only work is a build job on the free `ubuntu-24.04` runner that
signs an app bundle with the owner's upload keystore (the owner's existing
process, stored as secrets) and about **2 sessions**. The owner creates the
app in Play Console and uploads the first bundle by hand. Play then requires
the **target API level 36 (Android 16) for new apps from 2026-08-31**
([target API](https://developer.android.com/google/play/requirements/target-sdk)),
which the current Capacitor Android template must be checked against in T2.

**The fixed wait.** *"Google Play requires personal developer accounts
created after November 13, 2023, to test their apps before those apps are
eligible for distribution"*: **at least 12 testers opted in continuously for
14 days** in a closed test, then an application for production access that
Google answers within seven days
([testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)).
The page reads as per app. **Unknown here:** the owner's account type and
creation date, which decide whether this applies. If it does, it is up to
three weeks of calendar time that no engineering shortens, and the twelve
testers must be real people the owner recruits, since the product has no
users yet.

**Billing.** Play's payments policy: apps *"may not lead users to a payment
method other than Google Play's billing system"*, including through
*"in-app webviews, buttons, links"*
([Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)).
The same native flag of T1 hides every purchase surface. Whether a free Play
app may honour a web subscription was **not answered by the page read**;
under the 3.5 fallback (native served the free tier) the question does not
arise.

**Order: in parallel, Android's clock started as early as possible.** Not
Android first: the owner's own device is an iPhone, and nothing on the iOS
path waits for Android. Not Android after: if the 14-day rule applies, its
clock should run while S1–S7 are built. So the Android internal test starts
the week T2 lands, and the closed test with 12 testers starts as soon as S1
makes sign-in work in the Android shell.

## 6. Phases and items placed before the mobile build: before or after the first submission?

| Item | Verdict | Evidence, and what a user or reviewer would hit if it were missing |
|---|---|---|
| **Phase 6, flashcards and spaced repetition** | **After.** | No guideline asks for it. The app already has upload, ask with citations, summaries, quizzes and a streak, which is the utility 4.2 judges. Register #82 already recommends holding it (free NotebookLM ships the same feature). A reviewer missing flashcards hits nothing. |
| **Phase 7, B5b deep upload hardening** | **After.** | The shell adds no attack surface: it calls the same public `/api/ingest` the web app has exposed since Phase 0, which already has the extension and MIME allowlist (B5a), sanitized file names (B4), a 4 MB limit (#50) and per-user daily caps. A reviewer uploads a normal PDF. The risk B5b closes (a crafted archive costing compute) exists today on the web and does not grow with the app. **This file objects to `PIVOT_PLAN.md` §7 "Must merge before the mobile shell"**: the gate assumed the shell was a new surface, and with the hosted-site shell it is not. |
| **Phase 7, B6 asynchronous ingestion** | **After, with one check in TestFlight.** | A 4 MB text file ingests in 80.5 s inside one request (register #50 §5 measurement), with the progress UI of #113. A reviewer's small PDF finishes in seconds. **The check:** on iOS, sending the app to the background during an upload may suspend the web view's request; #113's copy tells the student that leaving is safe. Test on the owner's iPhone in TestFlight (T5); if the upload dies, the copy changes before submission, not the architecture. |
| **#137 PR B** (unused `authenticated` verbs) | **After. The owner's pause is right.** | Every verb it would revoke is already confined by row security to the student's own rows (`docs/db-grants-audit-137.md` §2); no cross-user write exists. A reviewer cannot reach it. |
| **#137 PR C** (default privileges, `profiles`, EXECUTE from PUBLIC) | **After. The owner's pause is right, for a reason that did not exist a week ago.** | Its main purpose was to catch a future table born with full API grants. `public-grants` (required on `main` since 2026-10-07) now fails any PR whose database has a table outside its declared matrix, so S2 or S4, if either adds a table, must declare its grants there. The hygiene items (`profiles.plan`, EXECUTE from PUBLIC) are not reachable harm (audit §1.6, §1.7). |
| **Phase 9, AdMob** | **After, and better after.** | Not required by anything. Adding it before the first submission would add App Tracking Transparency, an advertising row in App Privacy, and the minors question (`PIVOT_PLAN.md` §8) to the first review. |
| **#22 Supabase free tier** | **After the first submission, before public launch.** | See §3.6. |
| **#70 cancel path, #81 the $49 price** | **Not on the app path.** | Both are web billing surfaces; the app has no purchase surface (§3.5). #81 is not edited by this file. |
| **#119 Sign in with Apple** | **Before (S1).** | Guideline 4.8. |
| **#120 store assets** | **Before (S5, S6).** | An upload or listing without them fails validation. |
| **5.1.2(i) AI consent** (no row) | **Before (S4).** | Guideline 5.1.2(i), quoted in S4. |

## 7. Recommendation

The shortest ordered path to TestFlight on the owner's iPhone is **T1 →
T2 → T3 (owner) → T4 → T5 (owner)**: about four working sessions of agent work
and forty minutes of the owner, with Phases 6, 7 and 9 and #137 PR B and PR C
all after the first submission.

**The first item to build next is T1**, the request-time platform marker and
the native routing, because every later step depends on the app hiding its
purchase surface and its Google button by itself, and because it changes no
web behaviour, so it can ship to production safely before any shell exists.

Then S1 → S4 → S3 → S2 → S6/S7 → S8 → S9 for the first App Store submission,
about six more sessions, with Android's internal test started as T2 lands and
its closed test started as S1 lands.
