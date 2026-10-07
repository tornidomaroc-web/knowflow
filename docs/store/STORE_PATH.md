# The path to the stores: distance, order and decisions (2026-10-07)

**Status: analysis and decisions only. Nothing was built, nothing in production
changed.** Written on `main` at `ab39878` on the owner's brief of 2026-10-07,
which restates the ruling of 2026-08-24: publishing to the Apple App Store and
Google Play is the primary goal of the project (`PIVOT_PLAN.md` §5).

Every external rule below was read from its official source on 2026-10-07 and
is cited by section. Facts about this repository were read from the code at
`ab39878`. Facts about the owner's accounts are owner-attested and carry the
date they were last read.

**AMENDED 2026-10-07, same day, after reading Scan & Action** (the owner's
other app, same Apple team, `tornidomaroc-web/scan-and-action` at its `main`
of 2026-10-07, read only through the GitHub API). §8 holds the lessons item by
item. The corrections it forced are made in place below and each is marked
*"Corrected by §8"*: Google sign-in through a native plugin instead of the
system browser (§1.2, S1), the build job copied rather than written (T4), EU
trader status, which Apple requires even outside the EU (§3.6), Android
sequenced after iOS (§5), and the session estimates (§0, §7).

## 0. The answer first

| Question | Answer |
|---|---|
| Distance to a TestFlight build on the owner's iPhone | **3 working sessions** of agent work, plus about 30 minutes of the owner's own console steps. Nothing in Phases 6, 7 or 9 is on this path. *Corrected by §8: was 4; the build job and its signing fixes are copied from Scan & Action, and the owner's iPhone is already registered on the team.* |
| Distance to the first App Store review submission | **About 9 working sessions** in total, the three above included, plus the owner's icon, a reviewer account, the EU trader declaration and the App Store Connect forms. *Corrected by §8: was 10.* |
| Distance to Google Play production | **After the iOS submission, not in parallel.** *Corrected by §8:* the owner has no Android device, so Android Google sign-in cannot be witnessed, and Scan & Action records that the account cannot register as a Google Play merchant. About 2 extra sessions, then a **fixed 14-day closed test with 12 testers** if the owner's Play account is subject to it (§5). |
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
   ~~Inside the shell, the Google button must open the system browser
   (`SFSafariViewController` / `ASWebAuthenticationSession`) and return through
   a deep link that hands the code to `/api/auth/callback` in the web view.~~
   *Corrected by §8:* inside the shell, Google and Apple both sign in through
   the native sheet of `@capgo/capacitor-social-login`, which returns an ID
   token that the page hands to Supabase's `signInWithIdToken`. Scan & Action
   shipped exactly this (its PR #258) and witnessed both on the owner's iPhone
   on 2026-09-28. No deep link and no redirect allow-list entry are needed.
   Until it exists, the shell hides the Google button; email and password
   work as they are.
2. **The store flag is build-time only.** `src/lib/platform.ts` reads
   `NEXT_PUBLIC_KF_PLATFORM` at build time. Vercel builds the web app, so every
   server-rendered page answers `web` and shows the Upgrade links that 3.1.1
   forbids in the app. The shell must identify itself on every request,
   navigations included, which only a user-agent marker does
   (Capacitor `appendUserAgent`), and `resolvePlatform` must read it.
   `scripts/verify-store-purchase-links.mjs` extends to the request path.
   **Built as step a (2026-10-07, below):** the token is `KnowFlowApp/<n>`,
   read by `platformFromHeaders` in `src/lib/platform.ts`; the build-time
   flag and `NativePlatformHeader` are deleted. **A correction found while
   building:** `/en/login` was prerendered and served from Vercel's CDN with
   the Google button in its static HTML, so a client-side hide would have left
   it there. The first build of step a made those pages render per request;
   the owner objected (web visitors would pay for an app-only need, and a
   Hobby plan has hard limits), and the second build keeps every web page
   static and gives each one an app TWIN under `/<locale>/native/`, chosen
   by the middleware. §2.1 T1 has the measurements that decided it.

| T1 | **Platform at request time. DONE 2026-10-07 (step a).** | The marker is the user-agent token `KnowFlowApp/<n>` or `x-kf-platform: native`, read per request by `platformFromHeaders`. **Signed-in pages** (rendered per request already) read it through `currentPlatform()`; their client components get it through `PlatformProvider`, never from `navigator.userAgent`. **Prerendered pages** stay prerendered and on the CDN for the web; each has a twin under `src/app/[locale]/native/` (a bare re-export of the same page under a layout that hides the Pricing link and the Google button), and the middleware **rewrites** an app request for `/<locale>/{login,signup,about,contact,privacy,terms,refund}` to `/<locale>/native/…`, the URL unchanged, each variant at its own cache key. The landing and `/pricing` are redirected to the dashboard; `/refund` is a policy page, not a call to action, and is rewritten like the other legal pages, not redirected. A web visit straight to a `/native/` path gets the 404 page. **Measured on production before building (2026-10-07, five samples each):** a static page from the CDN answers in 0.18–0.20 s; a function-rendered response in 0.26–0.31 s warm and about 1.0 s cold; so the per-request design would have cost every web visitor and crawler 0.1–0.8 s on the landing, and every visit a function invocation against the Hobby allowance (1,000,000 invocations, 4 CPU-hours and 360 GB-hours a month, with no overage billing: Vercel pauses, it does not charge). The twin design costs the web nothing: Routing Middleware already runs on every request in both designs ("it runs globally before the cache", Vercel), and Next "automatically propagates the required RSC rewrite headers upstream" on `NextResponse.rewrite`, so the router's own fetches land on the twin. Proof: `scripts/verify-platform-gate.mjs` (a step of the required `tsc` job) renders each surface both ways, drives the real middleware (redirects, rewrites, the 404 for a direct twin visit), and scans `src/` for an ungated link or button, a twin that is not a bare re-export, a twin missing from the middleware's list, or a static page that reads the request. | Agent | 2 sessions, spent |
| T2 | **Capacitor project (step b). DONE 2026-10-07.** | `capacitor.config.ts` (`com.knowflow.app`, `server.url` = the live site, `allowNavigation` = `tryknowflow.com`, `errorPath` = the bundled offline page, `appendUserAgent: 'KnowFlowApp/1'` on iOS and Android), `native/www/` (the offline page, Arabic first), `ios/` (Capacitor 8.5.2 SPM template, iPhone only, `ITSAppUsesNonExemptEncryption = NO`, no purpose string, `Package.resolved` committed) and `android/` (template, target API 36). **Proven on a standard `macos-26` runner by `.github/workflows/ios-smoke.yml`** (run 37634371713, head `896a84e51a39ff99e8b3beafaa6a6e9ff3332178`): the app built unsigned for the simulator and run against the live site read, from inside the web view, (1) the first page is the login twin with no Google button and the user agent carries `KnowFlowApp/1`; (2) `window.Capacitor.isNativePlatform()` is true and the platform is `ios` in a document served from tryknowflow.com, so the bridge works on the remote origin and the bundled-build fallback of §1.1 is not needed; (3) a click on the signup link kept the document and landed on the signup twin, and a direct load of the dashboard bounced to the login twin; (4) with the site's name pointed at 127.0.0.1 the bundled offline page showed; (5) the GitHub link in the privacy page's footer left the web view on the privacy page and put Safari in front. Screenshots of every step and the readings are the run's artifact. **Two template facts learned:** Capacitor 8.5's `SceneDelegate` builds `CAPBridgeViewController()` in code and never reads the class named in `Main.storyboard`, so a subclass must be instantiated there; and on this simulator the app's temporary directory is `tmp/<bundle id>/`, not `tmp/`. | Agent | 1 session, spent |
| T3 | **Owner console steps (next)** | In App Store Connect: **Apps → +** (name, primary language Arabic, bundle id from T2, SKU); **Users and Access → Integrations → App Store Connect API → generate a new key for KnowFlow** (not Scan & Action's key, §8.4); in GitHub, create the environment `testflight` limited to deployments from `main` and put the Issuer ID, Key ID and the `.p8` contents in it as three environment secrets. The agent never sees the key. If "KnowFlow" is taken as an App Store name, choose another display name here; the bundle id is unaffected. *Corrected by §8:* the owner's iPhone is already a registered device on this team (Scan & Action, 2026-09-28), which development signing needs; nothing to do for it. | Owner | ~30 min |
| T4 | **The iOS build job** | *Corrected by §8:* **copy Scan & Action's `.github/workflows/ios-testflight.yml`** and adapt it (§8.4): two jobs so the key never sits on a runner that ran npm; `macos-26`; API-key automatic signing that archives for development and re-signs for the App Store at export (Scan & Action's PRs #261 and #262 are the dead end of forcing a Distribution identity); the stale-certificate sweep, because Apple caps a team at ten Development certificates and every hosted run makes one; `testFlightInternalTestingOnly` until the submission build; `CFBundleVersion` from the run number; `Package.resolved` committed. Triggered by `workflow_dispatch` and by a push to `main` that touches the native project only; never by a pull request. | Agent | 1 session |
| T5 | **Install** | Add the owner to an internal testing group in TestFlight; install the TestFlight app on the iPhone; install the build. Apple: internal testers are App Store Connect users, up to 100, and a build stays testable for 90 days ([TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)). Internal testing needs no App Review. | Owner | ~10 min |

**Total: 3 agent sessions and about 40 minutes of the owner** (*corrected by
§8*: was 4). At T5 the owner signs in with email and password and uses the
real app on the real phone. Sign in with Google arrives with S1. **The first
build is also the test of the one thing Scan & Action cannot vouch for:** that
the Capacitor bridge reaches a page loaded from `tryknowflow.com` (§8.3). T2
carries a simulator launch check copied from Scan & Action's `ios-audit.yml`
that reads `window.Capacitor` inside the loaded page.

### 2.2 From TestFlight to the first App Store submission

| # | Item | What it requires, and why | Who | Size |
|---|---|---|---|---|
| S1 | **Google and Apple through one native plugin** | *Corrected by §8:* Scan & Action's route, PR #258: `@capgo/capacitor-social-login` with `providers = { google: true, apple: true, facebook: false, twitter: false }`, its patch that guards the AppTrackingTransparency import, and the binary audit that proves neither the Facebook SDK nor AppTrackingTransparency is linked (§8.2). The page calls `signInWithIdToken` with the token; the session cookie lands on `tryknowflow.com` inside the web view, so every server-rendered page sees it. Owner: an iOS OAuth client in KnowFlow's Google Cloud project, its id added to Supabase's Google provider as an authorized client; **Sign in with Apple** ticked on the App ID; **Client IDs = the App ID** in Supabase's Apple provider; the entitlement `com.apple.developer.applesignin` in the project. No Services ID, no six-monthly secret. Required by **4.8** (§3.3). | Agent + owner (20 min) | 1 session |
| S2 | **Apple token revocation on account deletion** | Apple: *"Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens"* ([Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)). *Corrected by §8:* copy Scan & Action's design, PR #272, proven by one real deletion on the owner's iPhone on 2026-09-30: the delete dialog opens one more Apple sheet, its authorization code goes with `DELETE /api/account`, the server exchanges it at `/auth/token` and revokes at `/auth/revoke` with a client secret minted per call, nothing stored, and a failed revocation never blocks the deletion but is named in the response and logged (Scan & Action logged only failures at first, and success then read as an absence; its PR #274). Owner: one Sign in with Apple key for KnowFlow, its Team ID, Key ID and `.p8` set as server variables in Vercel. | Agent + owner (10 min) | 1 session |
| S3 | **Native value for 4.2** | Two affordances a website cannot have: (a) a **local daily study reminder** tied to the streak (`@capacitor/local-notifications`, no server, no push certificate, off until the student turns it on, per 5.1.2(i)'s rule that system features may not be required); (b) **"Open in KnowFlow"** for PDF and Word files from Files, Mail and the share sheet (document types in `Info.plist`; the shell passes the file into the existing upload with the 4 MB limit). Together with S1's native sign-in sheet these are the answer to 4.2 (§3.1). | Agent | 2 sessions |
| S4 | **Explicit consent before content goes to third-party AI** | New since this plan was written. **5.1.2(i)**: *"You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so."* The privacy page already names Anthropic and Voyage AI (`privacy/page.tsx:27-35`), but nothing in the app asks. A one-time sheet before the first upload or question, in Arabic and English, naming both providers and what they receive, with Accept and Not now; not now leaves the student unable to upload or ask, with the reason shown. **No register row tracks this; it is a submission blocker.** | Agent | 1 session |
| S5 | **The owner's icon** | One 1024 × 1024 PNG, opaque, square corners (`STORE_ASSETS.md` §1.3, row #120). The temporary icon of T2 is fine for TestFlight, not for the store. | Owner | — |
| S6 | **Screenshots** | Apple accepts a 6.9" set at 1320 × 2868 (`STORE_ASSETS.md` §3.1). The `/preview/*` routes render every screen of §3.3 with fixtures and no sign-in, so the set can be made in Chromium at that size in both languages without touching a real account. | Agent | 0.5 session |
| S7 | **App Store Connect forms** | App Privacy (§3.4, answers drafted by the agent, entered by the owner), age rating questionnaire, category Education, privacy policy URL, support URL (the support e-mail of #19), Arabic and English listing text, review notes stating there is no purchase in the app and naming the reviewer account. | Agent drafts, owner enters | 0.5 session |
| S8 | **A reviewer account** | **2.1(a)**: *"include demo account info (and turn on your back-end service!) if your app includes a login."* A dedicated e-mail-and-password account with one subject, one material, a summary and a quiz. The owner creates it, because the agent does not create production accounts; the three protected test addresses stay untouched. | Owner | 15 min |
| S9 | **Submit** | Upload the final build through T4, attach it to the version, submit. | Owner | — |

**Total from today to submission: about 9 agent sessions** (T1–T4: 3, S1–S4:
5, S6–S7 with S10 below: 1) and about 2 hours of the owner across the steps.
*Corrected by §8: was 10.*

| # | Added by §8 | What it requires | Who | Size |
|---|---|---|---|---|
| S10 | **The operator named in the legal pages** | Scan & Action named its individual operator in its privacy policy and terms (its PR #269), because the account is an individual's and the App Store lists the seller by that name. KnowFlow's privacy and terms pages name no operator (`grep`, 2026-10-07). | Agent | inside S6/S7 |
| S11 | **EU trader declaration** | §3.6. Account-level, once, so one declaration covers Scan & Action and KnowFlow. | Owner | 10 min |

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
- **EU trader status: the plan's premise is wrong.** *Corrected by §8.*
  `PIVOT_PLAN.md` §9 (2026-09-08) and the owner's brief of 2026-10-07 treat
  trader status as EU-only and not blocking. Apple's page, read 2026-10-07:
  *"Even if you don't distribute apps in the EU, you'll still need to declare
  a trader status."* The declaration is made once per account (Business,
  Agreements, Compliance), with a per-app override
  ([DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements)).
  The page does not say what happens at submission without it, so this file
  treats it as a submission blocker, the cautious reading. **Cost: ten minutes
  of the owner, once, and it covers both apps.** Scan & Action's board still
  lists it open for that app. Declaring as a trader publishes the address and
  phone only on EU product pages, and KnowFlow is not distributed in the EU.
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

~~**Order: in parallel, Android's clock started as early as possible.**~~
*Corrected by §8.* **Order: Android after the iOS submission.** Three facts
from Scan & Action, same owner, same accounts, overturn the parallel plan:

1. **There is no Android device.** Scan & Action's board: Android Google
   sign-in *"is UNVERIFIED and stays so until a device exists"*; a mismatch of
   the Play App Signing SHA-1 fails with `[28444] Developer console is not set
   up correctly` *"on the device only"*; and its open PR #285 records that the
   emulator route was refused because it needs a typed password. KnowFlow's
   Android sign-in would sit in the same unverifiable state.
2. **The account cannot sell through Play.** Scan & Action's invariant states
   *"the Morocco-based developer account cannot register as a Google Play
   merchant"* (owner-stated there, not read from Play here). So the Android app
   is free with no purchase surface, exactly like iOS, and nothing on Android
   earns money sooner.
3. **The twelve testers are people, and the product has none yet.** If the
   14-day rule applies, the owner must recruit them; starting the clock early
   does not help without them.

`T2` still generates `android/` so the two shells never diverge, and the
Android build job is about two sessions once a device and twelve testers
exist.

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

*Corrected by §8; the paragraphs below supersede the first version of this
section.* The shortest ordered path to TestFlight on the owner's iPhone is
**T1 → T2 → T3 (owner) → T4 → T5 (owner)**: about three working sessions of
agent work and forty minutes of the owner, with Phases 6, 7 and 9 and #137
PR B and PR C all after the first submission.

**The first item to build next is T1**, the request-time platform marker and
the native routing, because every later step depends on the app hiding its
purchase surface and its Google button by itself, and because it changes no
web behaviour, so it can ship to production safely before any shell exists.

Then S1 → S4 → S3 → S2 → S6/S7 with S10 → S11 and S8 (owner) → S9 for the
first App Store submission, about six more sessions, nine in total. Android
follows the iOS submission (§5).

## 8. Lessons from Scan & Action (read 2026-10-07)

**Source and limits.** `tornidomaroc-web/scan-and-action`, public, read only
through the GitHub API on 2026-10-07: `WORK-QUEUE.md` (its only board),
`CLAUDE.md`, `.github/workflows/ios-testflight.yml` and `ios-audit.yml`,
`apps/frontend/capacitor.config.ts`, the `ios/` project (`Info.plist`,
`App.entitlements`, `PrivacyInfo.xcprivacy`, `ExportOptions.plist`,
`MainViewController.swift`), the social-login patch, the environment policy of
`testflight`, and its merged PRs since 2026-09-26. Nothing in that repository
was changed. **The most important limit: Scan & Action has never been
submitted to App Review.** Its board's last stage line is *"Submission, once
design steps 1 to 5 are done and every APPLE TRACK blocker is closed"*, and
its export options still carry `testFlightInternalTestingOnly`. So it proves
the pipeline, signing, processing, TestFlight and native sign-in on this team;
it proves nothing yet about what a reviewer decides on 4.2, 3.1.3(f) or
anything else.

### 8.1 The path Scan & Action took, in order

| When | PR | Step | Error, dead end or finding | Fix |
|---|---|---|---|---|
| 2026-09-26/27 | #258 | Google and Apple sign-in | Apple 4.8 makes Apple mandatory once Google is offered | `@capgo/capacitor-social-login`, native sheets, `signInWithIdToken`; Apple native-only, so no Services ID and no six-monthly secret |
| 2026-09-27 | #260 | iOS platform and TestFlight workflow | Capacitor 8 SPM template generated on Windows and committed | `macos-26`, API-key automatic signing, run on `main` and dispatch only |
| 2026-09-27 | #261 | Signing | Run 36355312731: *"Your team has no devices from which to generate a provisioning profile"*; #261 forced an Apple Distribution identity | **Wrong fix**: run 36355938894, *"conflicting provisioning settings"* |
| 2026-09-27/28 | #262 | Signing | (the revert) | Revert #261; register the owner's iPhone (2026-09-28); archive signs for development, export re-signs for the App Store; a test forbids the override |
| 2026-09-28 | #263 | Processing | Build 4 **rejected in processing, ITMS-90683**, missing `NSPhotoLibraryUsageDescription` | Purpose strings for every API a linked plugin can reach, localized; `PrivacyInfo.xcprivacy` (UserDefaults `CA92.1`); a test derives the keys from plugin sources. **Build 5 passed and installed on the owner's iPhone** |
| 2026-09-28 | #264 | Hardening | The Admin key sat on a runner that had run npm | Two jobs (`web` builds, `testflight` has no checkout and no npm), actions pinned to SHAs, `pipefail`; Swift packages resolved and scanned for plugins and macros before the key exists |
| 2026-09-29 | #268, #269 | Store metadata | No Support URL; legal pages named no operator | A public `/support` page; the individual operator named |
| 2026-09-29 | #270 | Binary | The social-login plugin links the Facebook SDK and AppTrackingTransparency even unused, which forced a tracking purpose string in an app that does not track | Facebook provider off in `capacitor.config.ts`, the import guarded by a patch, `ios-audit.yml` reads `otool -L` on every PR and every archive |
| 2026-09-29 | #271 | 5.1.1(i), 2.1(a) | No privacy link inside the native app (the landing, which held it, never renders natively); "Data coming soon" on a new account's first screen | A Legal panel in Settings with no price or plan; the placeholders rewritten |
| 2026-09-30 | #272, #274 | Account deletion | Apple's revocation page | Fresh Apple sheet at deletion, server exchange and revoke, nothing stored, proven on the owner's iPhone; then `main` went red on a time-bomb test nobody read, and a success that logged nothing |
| 2026-09-30 | #275 | Reproducibility | An upstream Swift package release could move the build | `Package.resolved` committed; strict resolution |
| 2026-09-30 | #276 | 4.2 | Its own board judged the app *"a B2B web admin panel on a phone"*, which is what 4.2 excludes | The system document scanner (VisionKit) as the native value |
| 2026-10-01/04 | #277 | Signing | Run 13: *"Your account has reached the maximum number of certificates"*: every hosted run creates a Development certificate, Apple caps the team at ten | A sweep that revokes API-made Development certificates older than six hours, team-wide |

**Cost, inferred from PR dates (the repository records no sessions):** about
fourteen PRs over nine days, roughly ten working sessions, of which about four
were spent on dead ends KnowFlow can now skip (#261 and its revert, ITMS-90683,
the certificate cap, the Facebook SDK).

**Still open there (its board, 2026-10-07):** the EU trader declaration, brand
verification on the Google consent screen, Private Email Relay registration,
Android Google sign-in (no device), the App Privacy labels, the measured first
scan, the submission build, and the design steps before submission. Its
"No support page" item is still unticked although #268 shipped `/support`.

### 8.2 Each item, and what it means for KnowFlow

| Item | Verdict for KnowFlow | How, or why not |
|---|---|---|
| Free `macos-26` build, API-key automatic signing | **Applies as is** | Same team, same public-repository terms. |
| Secrets kept from fork runs | **Applies as is** | An environment `testflight` limited to `main`; no `pull_request` trigger; two jobs so the key never meets npm. |
| Device registration for development signing | **Already done** | The owner's iPhone is registered on the team; the dead end of #261 is not repeated. |
| Ten-certificate cap and the sweep | **Applies with adaptation** | The cap is per team, so the two apps' runs **share it**. KnowFlow must carry the same six-hour rule, so neither pipeline revokes a certificate the other is using, and the two pipelines must never be given different rules. |
| Purpose strings, ITMS-90683 | **Applies with adaptation** | KnowFlow's plugins differ: social login, local notifications, document opening. Its file input accepts only documents (`DropZone.tsx:169`, `.pdf,.docx,.pptx,.xlsx,.txt,.md`), so no camera or photo key is expected; copy the test that derives keys from plugin sources rather than guessing. |
| Privacy manifest | **Applies as is** | The same plugin ships no manifest; the UserDefaults `CA92.1` declaration carries over. |
| Facebook SDK and AppTrackingTransparency | **Applies as is** | Same plugin, same switch, same patch, same `otool` audit. |
| 4.2 native value | **Applies with adaptation** | Scan & Action's answer is a document scanner, native to its purpose. KnowFlow's answer stays §3.1's: native sign-in, a local study reminder, "Open in KnowFlow". A scanner that photographs textbook pages would be stronger, but needs text recognition before ingestion (a photo has no text, register #128), so it is not proposed for the first submission. |
| 3.1.3(f) and the payment surface | **Applies with adaptation: the mechanism does not carry over** | Scan & Action gates on `Capacitor.isNativePlatform()` in the bundled client. **That cannot work in a shell over the live site:** KnowFlow's Upgrade links are rendered on the server, before any client code runs, so the server must know it is talking to the app. Replaced by T1's user-agent marker; Scan & Action itself already appends one on Android (`appendUserAgent: 'ScanActionAndroid'`). The proof becomes a request-path test, not a render of a client component. |
| In-app privacy link | **Already met, check in native** | KnowFlow's Settings links privacy and terms (`dashboard/settings/page.tsx`); T1 must not send `/privacy` or `/terms` to the app entry. |
| Placeholder text, 2.1(a) | **Checked, none found** | `grep` for "coming soon" and its Arabic forms in `src/`: nothing. |
| Sign in with Apple and Google | **Applies as is** | S1, corrected. One adaptation: the session cookie is set on `tryknowflow.com` inside the web view by the page itself, which a live-site shell supports directly. |
| Apple revocation at deletion | **Applies as is** | S2, corrected; the server half becomes a Next.js route on Vercel. |
| Private Email Relay | **Applies with adaptation** | Same rule, KnowFlow's own domain and sender (#119 (ii), #89). |
| Reviewer account | **Applies with adaptation** | Scan & Action keeps its reviewer account on Pro through a plan override with no subscription. KnowFlow has no override, and a hand-made `subscriptions` row without a Paddle id trips register #73's guard by design. KnowFlow's reviewer account is free, seeded with one subject and one material, and the review notes state the daily limits, so a reviewer is not surprised by a limit. |
| Screenshots | **Not evidenced** | Scan & Action has not produced its set yet; §2.2 S6 stands. |
| EU trader status | **Applies, and corrects this file** | Account-level; one declaration covers both apps (§3.6). |
| App Privacy labels | **Applies with adaptation** | Scan & Action's rule, "derive the processor list from the code at submission time", is right and adopted; the processors differ (Anthropic, Voyage AI, Supabase, Resend, Vercel, Railway). |
| TestFlight internal distribution | **Applies as is** | Builds join the internal group automatically on processing. |

### 8.3 The architecture, re-judged

**Kept: the shell over the live site, with one new fact weighed against it and
one new test.**

**The new fact against it.** Capacitor's own configuration reference says of
`server.url`: *"This is intended for use with live-reload servers. This is not
intended for use in production"*, and says the same of `allowNavigation`
([Capacitor config](https://capacitorjs.com/docs/config)). That is the
framework disclaiming support, not Apple refusing anything. The concrete
failure it warns of is that the native bridge and plugins are designed for the
bundled origin.

**What Scan & Action's experience says.** Nothing from App Review, because it
has not been reviewed. What it does show: (1) its bundled build cost nothing
extra **because its web app was already a client-rendered Vite app calling a
backend over CORS with tokens**; KnowFlow's is the opposite, server rendered
with cookie sessions (§1.1), so the same choice costs KnowFlow about six to
eight sessions; (2) its own judgment of 4.2 turned on native value, a
scanner, not on bundling, which is §1.1's reading; (3) its sign-in plugin
hands a token to the page, which works the same whether the page is bundled
or loaded from `tryknowflow.com`, provided the bridge reaches that page.

**So the decisive question is the bridge on the remote origin, and the first
build answers it.** T2 copies Scan & Action's simulator launch check
(`MainViewController.swift` writes what the loaded page reports;
`ios-audit.yml` reads it) and asserts that `window.Capacitor` exists inside
`https://tryknowflow.com`. **If it does not, the architecture changes to the
bundled build before any S-item is built**, at the six-to-eight-session cost,
and this file is corrected. That makes the risk cost one session to discover,
not a rejection.

**A risk the live-site shell adds, named.** Every page on `tryknowflow.com`
gets the native bridge. A cross-site-scripting flaw on the site would reach
the app's plugins. The plugin set is kept small (sign-in, notifications,
document opening; no file-system write, no contacts), and `allowNavigation`
is limited to `tryknowflow.com`.

### 8.4 Reuse, and what must not be shared

**Copy, with attribution in each file's header:**

- `.github/workflows/ios-testflight.yml`: the two-job shape, the pre-key
  package resolution and plugin-and-macro scan, the certificate sweep, the
  archive-for-development and export-for-store pattern, the `otool` readings,
  the key-removal step. **Adapt:** paths (`apps/frontend` becomes the
  repository root), the plugin list in the artifact, the positive control
  (`DocumentScannerPlugin` does not exist in KnowFlow), and the `push` trigger
  limited to native paths, because a web change does not change a live-site
  app.
- `.github/workflows/ios-audit.yml` and the launch check in
  `MainViewController.swift`, adapted to read the remote page.
- `ios/ExportOptions.plist`, with KnowFlow's own values.
- `patches/@capgo+capacitor-social-login+8.5.11.patch` and the
  `SocialLogin.providers` map, re-checked against the plugin version KnowFlow
  installs.
- The purpose-string test and `PrivacyInfo.xcprivacy`.
- The design of the revocation service (#272) and its logging of every outcome
  (#274).

**Never shared:**

- **The App Store Connect API key.** KnowFlow gets its own key in its own
  repository's environment. A shared key means one leak exposes both apps and
  one revocation breaks both pipelines.
- **The Sign in with Apple key**, the Google OAuth clients and their Google
  Cloud project, the Supabase project and its keys.
- **The bundle id** (`com.scanaction.app` is Scan & Action's; KnowFlow's is
  `com.knowflow.app`) and the App Store Connect app record.
- **The reviewer account.**
- The **Team ID** is the same team and is not a secret; it is the one value
  both projects legitimately carry.

### 8.5 Live risks found in Scan & Action: reported, not fixed

Recorded for the owner. Nothing was changed in that repository.

1. **The signing job can execute Xcode project content produced by the job
   that ran npm.** `web` runs `npm ci` (and so every package's install script,
   including `patch-package`) and uploads `apps/frontend/ios` as an artifact;
   `testflight` downloads it, places the Admin `.p8` in `$RUNNER_TEMP/asc`,
   and runs `xcodebuild archive`. It checks that certain files exist and that
   no package declares a SwiftPM plugin or macro, but **it does not check that
   `App.xcodeproj/project.pbxproj` matches the commit**. A compromised npm
   dependency could add a Run Script build phase to that file in the artifact,
   and Xcode would run it on the runner that holds the key. The key has the
   **Admin** role on the team that also holds KnowFlow. **Suggested fix there:**
   in `testflight`, compare every committed file under `ios/` (all but the
   synced web bundle, `capacitor.config.json` and the CLI-written
   `CapApp-SPM/Package.swift`) with the commit, read through the API without
   npm, and fail on any difference; and give the key the narrowest role that
   still creates certificates. KnowFlow's copy of the workflow carries this
   check from its first version.
2. **An Admin key on a team with two apps.** Any leak of Scan & Action's key
   is a leak for KnowFlow too. Separate keys (§8.4) limit the blast radius of
   the next one, not of this one.
3. **The board says "No support page" is open while `/support` shipped in
   #268.** Not a security risk; a record that will mislead the submission
   checklist.
