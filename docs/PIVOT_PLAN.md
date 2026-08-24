# KnowFlow Pivot Plan — B2B HR Tool → B2C Student Study Assistant

**Status:** Planning reference. Approved direction; build against this doc.
**Author:** Technical co-founder review.
**Last updated:** 2026-06-28.

> This document is the single build reference for the pivot. It is intentionally
> blunt about what already works, what is broken, what cannot be free, and the
> exact order we ship in. Every phase is one branch → PR → merge (branch
> protection on `main`). Nothing here is merged automatically.

---

## 0. The one fact that reframes everything

KnowFlow is **not actually B2B at the data layer** — it is already single-user-per-account.
There is no `organizations`/`teams`/`seats` table. Every `knowledge_base`,
`document`, `conversation`, and `message` is already scoped to one `user_id` via
Row Level Security. The "B2B" identity lives almost entirely in **copy and UI**,
not in the schema.

**Consequence:** the pivot is mostly reframing + new study features, **not** a
data-model teardown. The RAG engine and per-user isolation are reusable as-is.

---

## 1. Codebase audit

### Reusable as-is (the engine is genuinely good)
- **RAG core** — `services/ingestion/main.py`: MarkItDown → tiktoken 512/64-token
  chunking → Voyage `voyage-3-large` (1024-dim) embeddings. `chunks` table with
  pgvector **HNSW** index + `match_chunks` RPC (cosine ANN, `SECURITY INVOKER`
  so RLS still applies). Maps 1:1 to "student uploads course material."
- **Grounded Q&A with citations** — `src/app/api/agent/route.ts`: retrieve →
  compose context → stream Claude **Haiku 4.5** → return `[n]` citations
  (filename + similarity). The "Explain this to me" feature **already exists**;
  it needs a consumer UI, not new engine work.
- **Per-user isolation** — RLS on every table keyed to `auth.uid()`. Solid B2C base.
- **Auth, storage, i18n (ar/en + RTL), Supabase plumbing** — reusable.

### HR-specific / must change
- **All marketing copy** — `src/lib/i18n/locales/en.ts` + `ar.ts`: "HR policies,"
  "contracts," "onboard new employees," "your team," "catalog → sales assistant."
  Full rewrite to student framing.
- **Pricing model** — `$49/mo`, "Telegram + Slack + API," "Enterprise/Custom."
  Drop Enterprise entirely; restructure to one cheap consumer Pro tier.
- **Dashboard UX** — dark "terminal/enterprise" aesthetic (Playfair + mono,
  `#2eff8c` on near-black, uppercase tracking, numbered "01/02" cards) reads as a
  developer console, not a 2026 consumer study app. Mobile-first redesign.
- **Vocabulary** — "Knowledge Base" → "Subject/Course," "Agent" → "Ask/Tutor,"
  "Documents" → "Materials."

---

## 2. Feature evaluation

| Feature | Verdict | Notes |
|---|---|---|
| Semantic search over own material | ✅ Exists | `match_chunks`. Zero engine work. |
| "Explain this" grounded Q&A + citations | ✅ Exists | `/api/agent` already does it. UI reframe only. **Citations are file/section, NOT page** (see §6). |
| Per-subject/course organization | ✅ Exists | `knowledge_bases` = subjects. Free limit of 2 is too low; raise it (students have 5–8 courses). |
| Auto-summaries per document | 🟡 Small new work | One LLM call over `documents.markdown_content` (already stored). No new infra. |
| Auto-quizzes / review questions | 🟡 Moderate | LLM generation + `quizzes`/`quiz_items` tables. |
| Spaced-repetition flashcards | 🟡 Heaviest net-new | Generation easy; SM-2 needs `flashcards` + `flashcard_reviews` + daily-queue query. Strongest retention/ad-impression driver, but deferred to a late phase. |
| Daily streak / progress | 🟡 Small new work | One `study_events` table + streak query. Cheap, high retention value. |

### Decisions / objections
- **Drop per-chapter summaries for v1.** Reliable chapter detection from arbitrary
  PDFs is fuzzy and produces embarrassing splits. Do **per-document** summaries
  first; add chapter awareness only if document structure is clean.
- **Drop Telegram/Slack/API** from the product entirely. Irrelevant to students,
  maintenance liabilities.
- **Citation honesty:** see §6. We ship file/section citations and **never**
  promise page-level citations.

---

## 3. Backend / schema changes for B2C entitlement

### The entitlement bug (must fix — Phase 0)
There are currently **two** entitlement sources that disagree:
1. `profiles.plan` — defaults `'free'`, **never updated by anything**. Dead column.
2. `subscriptions.status` — `'free'/'pro'`, updated by the Paddle webhook.

And critically: **`src/lib/limits-server.ts` applies `FREE_LIMITS` to everyone —
it never reads subscription status.** A paying Pro user is still capped at free
limits. **Pro currently buys nothing.** This must be fixed before any monetization
functions.

### Minimal fix (no large migration)
1. **Make `subscriptions` the single source of truth.** Stop using `profiles.plan`
   (keep only as denormalized cache or drop).
2. Add `getEntitlement(userId) → { tier: 'free'|'pro', adsEnabled, expiresAt }`
   derived solely from `subscriptions` (`status = 'pro'` AND
   `current_period_end > now()`). Every limit check and the ads decision reads
   this one function.
3. Add **`GET /api/entitlement`** returning that object — **this is the contract
   the mobile app reads** to decide ads on/off. Both web and mobile hit the same
   endpoint. Mobile never computes entitlement locally.
4. Gate `FREE_LIMITS` behind `getEntitlement` so Pro actually unlocks higher limits.
5. **Harden the Paddle webhook** (see bug tracker, §8).

### New tables for the study features (all per-user, RLS like existing)
`flashcards`, `flashcard_reviews` (SM-2 state), `quizzes`/`quiz_items`,
`study_events` (streaks), and `summaries` (or a column on `documents`),
`usage_counters` (rate limiting — Phase 0).

### Scaling notes (today's code is built for low-volume B2B)
- **No rate limiting anywhere** — Phase 0 adds per-user daily caps.
- **Synchronous ingestion** — `/api/ingest` holds the HTTP connection through
  conversion + embedding. Fine at low volume, times out at scale — Phase 7.
- `/api/agent` per-request bookkeeping is fine; the rate limiter sits in front.

---

## 4. Embedding layer — swappable interface (Phase 0), Voyage now, bge-m3 later

**Decision:** build embedding behind a single clean interface with two
interchangeable providers, switchable by one env value, **no schema change**. Run
on Voyage now; defer self-hosted bge-m3 until a real threshold (below). **Do not
provision any VM now.**

### Why this is low-complexity (endorsed, not over-engineered)
The provider boundary **already exists** as an HTTP seam: all embedding is
isolated in `services/ingestion/main.py::_embed()`, and Next.js only ever talks to
it via `/embed`. "Swappable" is therefore **one env var + one branch in one
function** — not a new architecture.

### Minimal spec
- Config value **`EMBEDDING_PROVIDER`** (`voyage` | `bge_m3`), default `voyage`.
- Dispatch inside the existing `_embed()`:
  - `voyage` → current code path, unchanged.
  - `bge_m3` → **documented stub that raises "not provisioned yet."** Not
    implemented now. **`torch` / `sentence-transformers` are deliberately NOT
    added to `requirements.txt`** — that is the point of deferring; adding them now
    bloats the slim image and its memory for a provider we are not using.
- Contract both providers honor (enforced by `/health`): **output dim = 1024,
  cosine metric, same encode call for query and document.** Guarantees no schema
  change on switch.
- **Reject any further generalization** (provider registry, abstract base classes,
  multiple files). That is the over-engineering to avoid.

### Verified viability facts
- **Dimension:** bge-m3 dense embedding is exactly **1024** → drops into the
  existing `vector(1024)` column + HNSW index. Cosine (`<=>`) is correct for it.
  **No schema change.** Bonus: bge-m3 is strong in Arabic.
- **Memory:** bge-m3 (XLM-RoBERTa-large, ~568M params) needs **~3–5 GB RAM at
  FP32** (~1.2–1.5 GB as ONNX int8). **It will OOM on 512 MB free tiers**
  (Render free, Fly micro). The current ingestion image is tiny only because it
  offloads to Voyage's API.
- **Free host that actually fits:** **Oracle Cloud Always Free** (ARM Ampere, up
  to 24 GB / 4 OCPU) runs bge-m3 FP32 comfortably. HF Spaces (16 GB) works but
  sleeps/cold-starts and is demo-ToS. **Railway no longer has a free tier**
  (trial credit → $5/mo usage-billed).
- **Latency tradeoff:** self-hosted CPU inference ≈ **1–3 s per embedding** vs
  ~50–150 ms from Voyage. Hits every search and every "ask."

### The switch trigger (Voyage → self-hosted bge-m3 on Oracle Always Free)
Flip `EMBEDDING_PROVIDER=bge_m3` (after provisioning an Oracle ARM VM and
implementing the stub) when **any one** hits first:
1. **Voyage free allowance:** monthly embedding token usage reaches **~80%** of
   Voyage's free tier (watch the Voyage dashboard).
2. **Traffic:** sustained **DAU > ~300–500**, or embedding **> ~1–2M tokens/month**.
3. **Cost:** the moment Voyage would post a **non-zero invoice** while there is
   still no subscription revenue covering it.

Until then **stay on Voyage** — faster, no VM to babysit, free allowance covers an
early user base.

### Re-embed migration (when switching; no schema change)
Vectors from different models are **not comparable**, so everything must be
re-embedded in one sweep (dim stays 1024, so no table drop):
1. Stand up the bge-m3 endpoint (Oracle); verify `/health` → dim 1024.
2. Briefly freeze/queue ingestion so no mixed vectors are written.
3. Re-run the existing **`backfill.py`** pattern over every `document` with
   non-empty `markdown_content` (it already deletes+reinserts a doc's chunks and
   is safe to re-run). Markdown is retained → **no re-upload, no re-conversion**.
4. Verify `select count(*) from chunks` and spot-check `match_chunks` queries.
5. Flip live traffic.

---

## 5. Mobile packaging — reuse the existing Capacitor pipeline

**SUPERSEDED 2026-08-24.** The decision below replaces *"Google Play first,
Android-only for the initial launch. Apple is deferred entirely to a later phase (no
free path at $99/yr; target students in Morocco/MENA skew heavily Android)."* That
sentence and its cost premise are both void, and they are recorded separately below
because only one of the two was overtaken by a ruling — **the other was overtaken by
a fact.**

**Decision:** **publishing to BOTH the Google Play Store and the Apple App Store is
THE PRIMARY GOAL of this project.** It is not a phase, not a later revisit, and not a
milestone that Android reaches first. Every phase below is preparation or repair
toward that release. Where a fix can be shaped to suit both stores at no extra cost
it must be; where it cannot, the store constraint is named in the row rather than
discovered at submission. **The demand premise is untouched** — the target market
does skew Android, and that is a *sequencing* argument, never a reason to defer.

**Superseded reason 1 — the "$99/yr, no free path".** The **Apple Developer Program
fee is PAID and the account is complete, awaiting approval.** Provenance:
**owner-attested** (`b1-verification-protocol.md` §2.6.6) — no agent here holds Apple
credentials and none read App Store Connect. Recorded with that label rather than as
machine-verified, and **not weaker for being stated.**

**Superseded reason 2 — the implied Mac purchase.** A Mac build host is **not a
purchase.** GitHub Actions provides **macOS runners** and this repository is
**PUBLIC**. **MACHINE-VERIFIED 2026-08-24 against GitHub's own documentation:** the
macOS images (`macos-latest`, `macos-14`, `macos-15`) are **standard** GitHub-hosted
runners, and *"Use of the standard GitHub-hosted runners is free and unlimited on
public repositories."* **Larger runners are always billed even on public repos** —
so an iOS job **must use a standard `macos-*` label and must never request a larger
runner.** That is the one cost-relevant constraint, and it is a rule, not a risk.

**Two corrections to how this was put to me, recorded because the record IS the
point.** **(a) Register #52 does NOT rely on the unbilled-minutes fact** — #52 is the
Python-CI gate row and its promotion rule, and it rests on neither. The unbilled
claim lives in **four workflow comments** (`typecheck.yml:14-15`,
`db-types.yml:17-18`, `ingestion-image.yml:38`, `production-monitor.yml:24`), and
those four are the sites this verification corroborates. **(b) COST was verified;
THROUGHPUT WAS NOT.** GitHub applies per-plan concurrency limits to macOS jobs; that
figure was not read and **is not asserted here.** It cannot make an iOS build cost
money — it can only make it queue. **Nothing in this repository currently constrains
macOS use:** all four workflows pin `ubuntu-24.04`, no org runner group is involved
(`runner_group_name` is empty on inspected jobs), and no concurrency group is shared
across workflows.

**Known, available path (not a risk):** an active Google Play Console developer
account already exists with published apps — **$25 paid, account verified,
Moroccan-account verification already cleared.** Treat Play publishing as a solved
logistics problem.

### Approach: Option B — client-rendered shell over existing `/api/*` routes
Reuse the **same proven Capacitor + Next.js pipeline already shipping UnicornApps
and Scan & Action to Play.** Do **not** introduce anything new (no React Native,
no different build system).

**Why not the naive alternatives:**
- Pure webview-of-hosted-URL (`server.url`) risks Apple 4.2 "repackaged website"
  rejection — and is unnecessary since we already have a real client-shell pipeline.
- React Native would be a full rewrite.

**4.2 IS NOW A BINDING CONSTRAINT, NOT A HEDGE — and the first bullet does not
survive intact.** Its two clauses fare differently. The **first clause holds and
hardens:** `server.url` pointed at a hosted site is the textbook 4.2 trigger, and
that is now a live rejection cause rather than a risk noted against a deferred store.
The **second clause is void for Apple:** *"we already have a real client-shell
pipeline"* is true of Play and false of Apple — see the inheritance list below.

**AND OPTION B IS NOT ITSELF AN ANSWER TO 4.2.** Verbatim: *"Your app should include
features, content, and UI that elevate it beyond a repackaged website. If your app is
not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store."*
Option B avoids the most obvious 4.2 **trigger**; it does not establish app-likeness,
because 4.2 judges **features, content and UI** and Option B is an **architecture
choice**. A client SPA serving the website's own screens inside a shell can still
read as a repackaged website. **Option B is NOT reopened as an architecture decision
— it is recorded as an INCOMPLETE one.** Closing the gap needs at least one genuinely
native affordance: share-sheet / native-file-picker ingestion, offline access to
already-ingested materials, or push notifications. **That is new Phase 8 scope this
section did not previously contain, and it is the direct cost of 4.2 going live.**

### How the existing pipeline cuts Phase 8 work

**EVERY ITEM BELOW IS ANDROID-ONLY, AND THIS IS THE LARGEST UNCOSTED CONSEQUENCE OF
THE DUAL-STORE RULING.** Gradle/Android Studio config, Play Console upload, the
signing keystore and the internal-testing-to-production track **do not transfer to
Apple.** There is no inherited Xcode project, no provisioning profiles, no App Store
Connect flow. Only the middle item — the static/client build step producing the
Capacitor-loadable bundle — is genuinely shared. **So this subsection's closing
"clone the pipeline, swap branding" is true for the Android half and false for the
Apple half; the Apple half is nearer greenfield than the Android half ever was.** The
build **HOST** is solved (free standard macOS runners, above); the **PIPELINE** is
not.

Because UnicornApps / Scan & Action already solved the hard parts, KnowFlow
inherits (**for Android**):
- **Capacitor project scaffolding + Gradle/Android Studio config** — copy the
  working setup; only app id, name, icons, splash change.
- **The static/client build step** that turns the Next.js front end into a
  Capacitor-loadable bundle — reuse the proven config rather than discovering it.
- **Play Console upload + signing + release-track workflow** — same account, same
  keystore process, same internal-testing → production flow you already run.
- **Native plugin wiring conventions** (status bar, splash, etc.) — reuse.

Net: Phase 8 becomes "clone the pipeline, point the shell at KnowFlow's `/api/*`
routes + Supabase JS, swap branding," not "learn Capacitor." The genuinely new
work is the **AdMob** plugin (Phase 9) and making the consumer screens render as
**client components** (data via existing API routes over HTTPS).

---

## 6. Citations — file/section only (decided)

The engine cites **filename + chunk**, **not page number**. Chunks are
token-windowed from concatenated markdown; page boundaries are lost during
MarkItDown conversion.

**Decision:** ship **file/section citations only**. **Do not build page-accurate
citations now, and do not promise "page citations" anywhere in the UI or store
copy.** True page citations may come later **only** if we rework ingestion to
extract per-page text and store page spans. Tracked as a future possibility, not
a committed feature.

---

## 7. Phased roadmap (each phase = one branch → PR → merge)

Marketing is out of scope until the app is live and reviewed. **SUPERSEDED
2026-08-24 — was *"Roadmap is Android-first; Apple revisited only after Android is
live."*** Both stores are the primary goal (§5), so the roadmap is **dual-target**:
**Phase 8 builds both shells and Phase 10 submits to both.** Android may still
*ship* first for logistics reasons; it is no longer a **precondition** for Apple
work, and no Apple item may be parked on "after Android is live" again.

| Phase | Title | Scope |
|---|---|---|
| **0** | Entitlement + embedding seam + rate limits + filename fix | `getEntitlement` + `GET /api/entitlement`; gate `FREE_LIMITS` behind it; **harden Paddle webhook**; `EMBEDDING_PROVIDER` dispatch with bge-m3 as a documented stub (no torch deps); per-user daily rate limits via `usage_counters`; **sanitize storage filenames (B4)** and **basic upload extension/MIME allowlist (B5a)** in `/api/ingest`. Voyage stays active. No VM, no schema-breaking change. |
| **1** | Reframe to student product | Rewrite ar/en copy; rename concepts (Subject/Materials/Ask); raise free KB limit; drop Enterprise/Telegram/Slack/API. No engine changes. |
| **2** | Consumer UI redesign (web, mobile-first) | New design system; restructure dashboard into a student home (subjects, streak placeholder, ask). Keep server APIs. |
| **3** | Summaries | Per-document summary generation + UI. |
| **4** | Quizzes | Generation + `quizzes`/`quiz_items` + quiz-taking UI. |
| **5** | Streak & progress | `study_events` + streak logic + home widget. |
| **6** | Flashcards + spaced repetition | SM-2 tables + daily review queue + UI (heaviest). |
| **7** | Backend hardening **(GATE before Phase 8)** | Per-user rate-limit tuning; **async/queued ingestion (B6)**; **deep upload content hardening (B5b)** — magic-byte verification, decompression-bomb / nested-archive limits, content scanning (coupled to the async rework). Must merge before the mobile shell. |
| **8** | Capacitor mobile shell — **Android AND iOS** | Clone existing Capacitor+Next.js pipeline (**the inherited parts are Android-only — see §5**); client SPA over existing `/api/*`; branding swap. **iOS additionally needs: an Xcode project, signing/provisioning, a build job on a standard `macos-*` runner, and at least one native affordance to answer Apple 4.2.** **GATE: the in-app billing surface must be status-only before either shell ships (§8, reclassified).** |
| **9** | AdMob for free users | `@capacitor-community/admob`, gated by `GET /api/entitlement`. No ads for Pro. **Apple's own ads/kids posture is NOT covered by §8's Play-side note and is UNREVIEWED — it is not asserted here to be equivalent.** |
| **10** | Store prep & submission — **Play AND App Store** | Privacy policy, icons, screenshots. **Play:** Data-safety form (incl. the account-deletion declarations), internal testing → production review. **Apple:** App Privacy labels, App Store Connect, TestFlight → review. |
| **Later** | Page-accurate citations revisit | **This is NO LONGER the Apple row** — Apple moved into Phases 8 and 10 on 2026-08-24. Page-accurate citations revisited only if pursued (§6). |

---

## 8. Bug & security tracker (nothing left behind)

Every issue found during the audit, tied to the phase that fixes it. This table is
the checklist — a phase is not "done" until its rows are closed.

| # | Issue | Severity | Fix phase | Notes |
|---|---|---|---|---|
| B1 | **Pro-buys-nothing:** `limits-server.ts` applies `FREE_LIMITS` to everyone; never reads subscription status. Paying users stay capped. | High (correctness/revenue) | **Phase 0** | Gate limits behind `getEntitlement`. |
| B2 | **Dual entitlement source:** `profiles.plan` (dead, never updated) vs `subscriptions.status` (live). | High (correctness) | **Phase 0** | Make `subscriptions` single source of truth; stop using `profiles.plan`. |
| B3 | **Paddle webhook gaps:** only handles `created`/`canceled`/`updated`. Missing `past_due`, `paused`, and resume. A failed payment never downgrades. | High (revenue/security) | **Phase 0** | Add the missing event handlers + resume path. |
| B4 | **Unsanitized storage filename:** `${user.id}/${kbId}/${file.name}` — crafted name enables path traversal / overwrite. | High (security) | **Phase 0** | Moved up from Phase 7: real uploads happen during dev/testing across Phases 2–6, so this hole must not stay open. ~10-line fix in `/api/ingest`. |
| B5a | **No upload extension/MIME allowlist:** unexpected file types reach MarkItDown unchecked. | Medium (security) | **Phase 0** | Cheap (3–4 lines in the same `/api/ingest` handler as B4); pulled forward to ride along. Size cap (50 MB) already exists. |
| B5b | **Deep upload content hardening:** magic-byte verification (don't trust extension), decompression-bomb / nested-archive limits, content scanning. | Medium (security/cost) | **Phase 7** | Genuine work, coupled to the async ingestion rework (B6) where the file is re-handled off the request path. Gates Phase 8. |
| B6 | **Synchronous ingestion:** `/api/ingest` holds the HTTP connection through conversion + embedding; times out at scale. | Medium (scalability) | **Phase 7** | Move to background job/queue. |
| B7 | **No rate limiting anywhere:** free consumer tier with no limiter = cost abuse on both Voyage and Claude calls. | High (cost) | **Phase 0** | `usage_counters` + per-user daily caps; burst guard. |

**Minors noted (not blocking, fold into nearest relevant phase):** student users
may be minors → AdMob must use **non-personalized ads** and correct content
rating / Play Families + COPPA/GDPR-K posture (Phase 9/10).

**RECLASSIFIED 2026-08-24 — THE MOBILE BILLING SURFACE IS NO LONGER A "MINOR".** It
was filed in the sentence above as *"not blocking"*, alongside the ads posture. It is
a **PHASE 8 GATE** and a rejection cause. Apple **3.1.1(a)**, verbatim: *"In all
other storefronts, except for the United States storefront, where this prohibition
does not apply, apps and their metadata may not include buttons, external links, or
other calls to action that direct customers to purchasing mechanisms other than
in-app purchase."* **Morocco/MENA is not the US storefront**, so the carve-out does
not reach the target market. **The offending surface ALREADY EXISTS and is ALREADY
MARKED FOR REUSE:** `src/components/dashboard/SettingsPanel.tsx` renders an
**Upgrade** `<Link>` to `upgradeHref` → `/{locale}/pricing` → Paddle checkout
(`@paddle/paddle-js`), and `src/app/[locale]/dashboard/settings/page.tsx:6` comments
that presentation lives in the dumb panel *"(Phase 8 reuse)"* — **so it ships into
the shell by default unless changed.** The requirement is **unchanged in substance**
(status-only, no purchase links or steering); only its **severity and phase** are
corrected. **The web app is unaffected** — this constrains the packaged shells, not
`tryknowflow.com`.

---

## 9. Honest cost reality — "everything free" is not fully achievable

I accept and record the pushback so there are no false expectations.

| Cost | Unavoidable? | Mitigation |
|---|---|---|
| **Claude generation per "ask"** (Haiku 4.5) | **Yes.** Every question is a paid LLM call, and it is the **bigger** of the two paid calls — larger than embeddings. | Hard **per-user daily query cap** (Phase 0) bounds it; keep Haiku (cheap tier), tight `max_tokens`, prompt caching on the static system block (already in place). Ads revenue must cover residual. There is **no free hosted LLM** at consumer scale. |
| **Voyage embeddings per query/upload** | Not at first — covered by free allowance. | Stay on Voyage now; switch to self-hosted **bge-m3 on Oracle Always Free** at the §4 trigger to drive this to $0. |
| **Vercel commercial use** | **Yes if hosting on Vercel.** Hobby tier is **non-commercial per ToS**; a monetized app needs Pro (~$20/mo). | Either budget Vercel Pro, or self-host the Next.js app (e.g. on the same Oracle Always Free box / a free-tier-capable host). Decide before public launch (around Phase 7/10). |
| **Apple Developer Program ($99/yr)** | **CLOSED 2026-08-24 — PAID, not deferred.** Account complete, **awaiting approval**. Provenance **owner-attested** (§2.6.6). | No action. **Supersedes *"deferred, not incurred now"***, which is void. |
| **Mac build host for iOS** | **No — CLOSED 2026-08-24, and it was never a purchase.** | **MACHINE-VERIFIED:** standard GitHub-hosted macOS runners are *"free and unlimited on public repositories"* and this repo is public. **RULE: use a standard `macos-*` label; NEVER a larger runner** — larger runners bill even on public repos. **Cost verified; per-plan macOS CONCURRENCY was not read** — it can queue a build, never bill one. |
| **Google Play ($25 one-time)** | **Already handled.** | Existing verified Play Console account; no action, no risk. |

**Bottom line:** removing Voyage does **not** make the stack free, because Claude
generation and (if used) Vercel commercial hosting remain. The real budget
protection at launch is **rate-limiting free users** (Phase 0) and **keeping
generation cheap and capped** — not the embedding swap.

---

## 10. Open items still owned by the founder
- Confirm hosting decision for the Next.js app before public launch (Vercel Pro vs
  self-host) — drives the B-tier cost line.
- AdMob account: phone/identity/tax verification and payout threshold (flagged,
  not solved here) — needed before Phase 9 revenue.
- Final free-tier limit numbers (KB count, daily questions, daily uploads) — set in
  Phase 0/1, tune with real usage.
