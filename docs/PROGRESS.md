# KnowFlow — Progress Tracker

**Single source of truth for project state.** Built from the actual record: git
commit history + [`PIVOT_PLAN.md`](./PIVOT_PLAN.md) + project memory. Update this
file at the **end of every step** so we never jump ahead on a deferred item or
skip a main phase.

- **Last updated:** 2026-07-05 (**Live-DB reconciliation** — audited the live Supabase project against the repo migrations before P3.1 and found it **far behind**: `usage_counters` + `increment_usage()` and several objects had never actually been applied, so the Phase-0 rate limits were **NOT live**. Reconciled via a consolidated idempotent script; live DB now matches the repo. New register **#23** + lesson recorded; B7 noted as now-genuinely-live. Phase 3 is in progress — P3.0 (schema + types) merged-to-branch, PR **#16** draft.).
- **Active branch:** `feat/phase-3-summaries` (Phase 3, Summaries) — P3.0 committed (`04d1901`), PR **#16** open as **draft**; P3.1 (summary route + rate-limit wiring) next. This `docs/live-db-reconciliation` branch is a docs-only side-step merged ahead of P3.1.
- **Main tip:** **PR #12** merge (Phase 2 — consumer UI redesign, light Calm-Focus) on `main`; this docs PR lands on top. Prior tip: `ed36a3b` (PR #14, Supabase runbook + blocker log).

> ✅ **RESOLVED 2026-07-04 — Supabase project back online (register #21).** The
> project **auto-paused** (free-tier inactivity) and then hit Supabase's free
> **active-project limit**, which is enforced **per Owner across every organization
> they own**. It was fixed **without any project migration**: the project was moved
> into a **new organization** owned by a second real account, and the old account's
> membership was removed from that org — clearing the limit and letting the project
> resume. **The project URL and API keys did not change, so no app code, env,
> re-embedding, or rebuild was needed;** verified by a successful login. The
> heavyweight move planned in [`supabase-migration-runbook.md`](./supabase-migration-runbook.md)
> was **never executed** and is now superseded. **Phase 2's paused Arabic/RTL
> visual verification can now resume.**
>
> ⚠️ This is a dev-time fix, **not** a launch foundation — see register **#22**
> (free tier is not production-grade; a stable, policy-compliant backend is a
> pre-launch decision).

> **Provenance note.** `PIVOT_PLAN.md` §7 defines Phases **0–10 + Later**. It does
> **not** sub-divide Phase 2 into P2.0–P2.7 — that decomposition is a
> conversational working breakdown, recorded here for tracking. The scope of P2.6
> and P2.7 was **decided on 2026-07-02** (see §2) — no longer TBD.

---

## 1. Phase status overview

| Phase | Title | Status | Merge / PR |
|---|---|---|---|
| **0** | Entitlement + embedding seam + rate limits + filename fix | ✅ **DONE** | PR **#10**, merge `043b22e` |
| **1** | Reframe to student product | ✅ **DONE** | PR **#11**, merge `c3cdbe0` |
| **2** | Consumer UI redesign (web, mobile-first) | ✅ **DONE** | PR **#12** (`feat/phase-2-ui-redesign`); P2.0–P2.7 all done, visually verified on `/ar` (RTL + mobile), merged to `main` → production `tryknowflow.com` rebuilds on the light redesign |
| **3** | Summaries (per-document) | 🔄 **IN PROGRESS** | P3.0 done (`04d1901`, schema + types); PR **#16** (draft, `feat/phase-3-summaries`). P3.1 (summary route + rate-limit wiring) next |
| **4** | Quizzes | ⬜ NOT STARTED | — |
| **5** | Streak & progress | ⬜ NOT STARTED | — |
| **6** | Flashcards + spaced repetition (SM-2) | ⬜ NOT STARTED | — |
| **7** | Backend hardening **(GATE before Phase 8)** | ⬜ NOT STARTED | — |
| **8** | Capacitor mobile shell (Android) | ⬜ NOT STARTED | — |
| **9** | AdMob for free users | ⬜ NOT STARTED | — |
| **10** | Play prep & submission | ⬜ NOT STARTED | — |
| **Later** | Apple / iOS (+ page-accurate citations revisit) | ⬜ NOT STARTED | Only after Android is live |

---

## 2. Phase 2 sub-steps (completed record)

| Step | Scope | Status | Commit(s) |
|---|---|---|---|
| **P2.0** | Design-token + font foundation (light "Calm Focus" tokens, Rubik) | ✅ done | `acc7545` |
| **P2.1** | UI primitives (Button/Card/Input/Badge/Sheet on `cn()`) + dashboard shell / sidebar / mobile nav; RTL logical properties | ✅ done | `95736a8` |
| **P2.2** | Student home — first light content screen (thin wrapper + dumb `StudentHome`); ghost `—` streak placeholder | ✅ done | `f3b1119`, `88537e7` |
| **P2.3** | Subjects list (`SubjectsList`) + subject detail + upload zone restyle | ✅ done | `57e0e68` |
| **P2.4** | Ask/chat (KBSelector/ChatBox/MessageBubble/ConversationSidebar) + **Sheet focus trap**; 429 body surfaced | ✅ done | `adf6b3b`, `b0c9aff` |
| **P2.5** | New-subject form + settings/plan (thin wrapper + dumb `SettingsPanel`). **Fully closed** — the `<a>`→`<Link>` upgrade CTA was verified (`/pricing` inits Paddle on a mount effect, not on a full page load) and kept. | ✅ done | `3b05549` |
| **P2.6** | **DECIDED (2026-07-02).** Migrate the remaining **public + auth pages** to light. Presentation-only: all copy (Phase-1 strings diff-clean), all auth/checkout/CTA wiring, and RTL preserved. Done in 3 commits by concern/wiring risk: | ✅ done | 3 commits |
| ↳ **P2.6a** | **Auth** — `login`, `signup` (bridge light canvas; `signInWithPassword` / `signUp` + `profiles` upsert + `router.push` + password-toggle preserved). | ✅ done | _this branch_ |
| ↳ **P2.6b** | **Converting** — `landing`, `pricing` (all `/signup` CTAs + footer links; Paddle init-on-mount + checkout + free-plan `<Link>` preserved). | ✅ done | _this branch_ |
| ↳ **P2.6c** | **Content/legal** — `about`, `contact`, `privacy`, `terms`, `refund` (low/no wiring; about CTA + contact mailto/GitHub preserved; legal content byte-identical; contact form left honestly inert per #19). | ✅ done | _this branch_ |
| **P2.7** | **DONE.** Flipped all three shared dark surfaces to light — dashboard `<main>` (`dashboard/layout.tsx`), root `<body>` (`[locale]/layout.tsx`), and the `globals.css` `body {}` rule — removed every per-screen/per-page light-canvas bridge, and **purged the dead legacy tokens** (`--bg-color`/`--accent-color`/`--border-color`/`--muted-color`/`--input-bg` + the `--font-playfair`/`--font-mono`/`--font-sans` aliases). Full-sweep verified: zero legacy tokens/hexes remain in `src`; wiring intact; nothing vanishes. | ✅ done | _this branch_ |

**Phase 2 exit criteria (decided):** every user-facing screen on the light palette
(dashboard **and** public/auth); the dashboard `<main>`, the root `<body>`, and the
`globals.css` `body {}` rule all flipped light with **no** per-screen/per-page
canvas bridges remaining; PR #12 reviewed and merged to `main`.

---

## 3. Bug & security tracker status (PIVOT_PLAN §8)

| # | Issue | Fix phase | Status |
|---|---|---|---|
| B1 | Pro-buys-nothing (limits ignored subscription) | Phase 0 | ✅ done (`e203fda`) |
| B2 | Dual entitlement source (`profiles.plan` vs `subscriptions`) | Phase 0 | ✅ done — `getEntitlement` is sole source (`5cd499e`, `07230ef`). ⚠️ `profiles.plan` **dead column still present** (see register #11) |
| B3 | Paddle webhook gaps (past_due/paused/resume) | Phase 0 | ✅ done (`dff93fc`) |
| B4 | Unsanitized storage filename (path traversal) | Phase 0 | ✅ done (`0f1edde`, `5769ff9`) |
| B5a | Upload extension/MIME allowlist | Phase 0 | ✅ done (`ca34b45`); accept/hint/allowlist re-aligned in P1.2b/P2.3 |
| B5b | Deep upload content hardening (magic-byte, bomb limits, scanning) | **Phase 7** | ⬜ not started (gates Phase 8) |
| B6 | Synchronous ingestion (holds HTTP connection) | **Phase 7** | ⬜ not started (gates Phase 8) |
| B7 | No rate limiting (cost abuse) | Phase 0 | ✅ done (`9c3b7ba`) — ⚠️ **code shipped Phase 0 but was NOT actually live** until the live-DB reconciliation on 2026-07-05 (`usage_counters`/`increment_usage` had never been applied, so `enforceLimit` failed closed). **Now genuinely active** (real 429s at caps) — see register **#23** |

---

## 4. Deferred-items register

Every tracked-but-not-done item found by sweeping git history, `PIVOT_PLAN.md`,
project memory, and per-step review debates. "Where" is the target phase/trigger;
🔎 marks items surfaced by this sweep beyond the original hand-off list.

| # | Item | Why deferred | Where addressed |
|---|---|---|---|
| 1 | **Server-side limit-message localization** — `/api/ingest` ("…limit of N materials") and `/api/agent` (429 body, "…monthly limit of N conversations") return **English only**; no locale threaded into the API. | Presentation/i18n work outside each step's scope; needs locale plumbed into API routes. | Later i18n pass. **Suggest Phase 7** (or a dedicated i18n follow-up). **NOTE: this is the same underlying item as the hand-off's #10** ("thread locale into the API") — consolidated here. |
| 2 | **Pricing page hardcodes "5 Subjects" / "10 materials" / "10 Subjects"** (`i18n` `pricing.*.features` arrays) — a static marketing list that cannot interpolate the real `FREE_LIMITS`/`PRO_LIMITS`. | Marketing copy is a static array; not wired to the limit constants. | Manual sync — **bump by hand if the limits ever change**. Revisit when pricing is restyled (P2.6) / a pricing pass. |
| 3 | **Stale type literals** — `Document.file_type: 'pdf'\|'docx'\|'xlsx'\|'mp3'\|null` (has stale `mp3`, and is **missing `pptx`/`txt`/`md`** from the real allowlist) and `Conversation.platform: 'web'\|'telegram'\|'slack'` (Telegram/Slack dropped from the product). | Types-only drift; no runtime impact; not worth a churn commit mid-redesign. | Later type cleanup. **Suggest folding into Phase 3** (first backend-touching phase) or a standalone chore. |
| 4 | **Unused `waitlist` table + migration `003_waitlist.sql`** — waitlist code removed (`2234aa0`) but the table/migration remain. | Schema decision (drop vs keep) not urgent; no active reads. | Later schema decision. **Suggest Phase 7** schema cleanup. |
| 5 | **`react-markdown` in `devDependencies` but is a runtime dependency** (chat markdown). A pruned prod install could drop it and break chat. | Sequenced to hardening so it isn't mixed into UI commits (agreed P2.0). | **Phase 7** (per project memory `phase-7-hardening-todos`). |
| 6 | **6 pre-existing npm vulnerabilities** (3 moderate, 3 high) — not introduced by us. | `npm audit fix` can force breaking upgrades; needs triage. | **Phase 7** — triage runtime-reaching vs dev-only (real impact vs noise), then decide. |
| 7 | **Live data-driven subject tiles on the home** (needs a new query for the subject list). | Out of scope for presentation-only P2.2/P2.3 (data layer frozen). | Its own later change. **Suggest Phase 3+** / a home enhancement. |
| 8 | **200-vs-429 limit-message mechanism asymmetry** in `/api/agent` — conversation-limit path returns 200 (streams as a message), query rate-limit returns 429 (now rendered as one-shot). Both surface the real text. | Cosmetic internal inconsistency; **not user-visible** (both deliver the real message). | Optional unification — **no phase**; only if we touch that code anyway. |
| 9 | **Missing `UNIQUE` constraint on `subscriptions.user_id`** — a second row on re-subscribe could break `getEntitlement`'s `.maybeSingle()` (throws on multiple rows). | Schema change; low current risk (webhook upserts one row today). | Later schema cleanup. **Suggest Phase 7** (add unique index / upsert-safe key). |
| 10 | *(merged into #1 — same item: server-message localization / threading locale into the API).* | — | See #1. |
| 11 🔎 | **`profiles.plan` dead column still present** (`001_initial_schema.sql`) — defaults `'free'`, never updated; entitlement reads from `subscriptions` only (B2). | B2 said "keep as cache **or drop**"; drop deferred. | Later schema cleanup — **same Phase 7 bucket as #4/#9**. |
| 12 🔎 | **Public marketing + auth pages still on the legacy dark palette** (landing, pricing, about, contact, privacy, terms, refund, login, signup). A Pro user reaching `/pricing` from light Settings crosses a hard light→dark seam. | These were outside the dashboard-focused P2.0–P2.5 steps. | **P2.6 (decided)** — see §2. Closes before Phase 2 is "done." |
| 13 ✅ | ~~Shared dark surfaces still forced (dashboard `<main>`, root `<body>`, `globals.css` `body {}`); each migrated screen paints its own light-canvas bridge.~~ | — | **RESOLVED in P2.7** — all three flipped light, every bridge removed, legacy tokens purged. |
| 14 🔎 | **Home streak is a non-functional placeholder** (ghost `—`, `streak: number\|null`). | The streak feature itself is Phase 5; P2.2 only shipped an honest placeholder. | **Phase 5** wires real tracking (`study_events`) — placeholder was designed so a real number drops in with no component change. |
| 15 🔎 | **Embedding provider switch (Voyage → self-hosted bge-m3)** — seam shipped in Phase 0 as a documented stub; actual switch not implemented. | Deliberately deferred until a real usage/cost threshold (PIVOT_PLAN §4); avoids provisioning a VM early. | **Trigger-based, not a phase** — flip `EMBEDDING_PROVIDER` when a §4 trigger (Voyage ~80% free tier / DAU >~300–500 / non-zero invoice) hits. |
| 16 🔎 | **Page-accurate citations** — engine cites filename + chunk only; page spans lost in MarkItDown conversion. | Decided (§6): ship file/section only, **never promise page citations**. True page citations need an ingestion rework. | **Later** (uncommitted possibility, revisited with Apple/iOS). |
| 17 🔎 | **Hardcoded English content bypasses `t.*`** (i18n dimension — won't localize under `/ar`). Instances: the three legal page bodies (`privacy`/`terms`/`refund`, fully hardcoded) **and** the auth left-panel tagline **"Unlock your knowledge"** (`login`/`signup`). | Content was never wired to i18n; surfaced during the P2.6 restyle (out of a presentation-only step's scope). | Later i18n gap — move these strings to `t.*`. **Suggest** a Phase 7 / pre-launch i18n pass with register #1. |
| 18 🔎 | **Stale vocabulary + inconsistent contact domains in that hardcoded content** (copy-quality dimension). Instances: legal — "knowledge bases"/"AI agents"/"agents", `privacy@knowflow.ai` & `legal@knowflow.ai` vs the product's `tryknowflow.com` (refund uses `support@tryknowflow.com`); auth — the tagline "Unlock your **knowledge**" still uses the old "knowledge" concept renamed to **Subject/مادة** in Phase 1. | Copy issue, not presentation; out of a restyle's scope. | Later content pass — reword to student vocabulary + unify the contact domain. Fold into the same i18n/copy pass as #17. |
| 19 🔎 | **Contact form is non-functional** (`button type="button"`, no `onSubmit`/handler) — only the `mailto:` and GitHub links work. | Never wired; the page currently *looks* interactive but isn't. | Later decision — either wire the form (endpoint/email service) or make it **honestly** mailto-only (drop the inert fields). |
| 20 🔎 | **FALSE PERFORMANCE CLAIM on the landing hero** — "[OK] Ready in 0.4s." promises near-instant uploads, but real ingestion (MarkItDown → chunk → Voyage embed) is **synchronous and multi-second**. **Honesty / over-promise bucket** — same family as "Unlimited" and page-citations, NOT a localization gap: it misleads the student about a real capability. (The string is also hardcoded English per #17, but that's incidental — the priority defect is the false claim.) **Still live on the merged landing page — knowingly shipped to production; not a Phase 2 blocker.** | Content over-promise on the primary converting page; out of a restyle's scope (preserved verbatim in P2.6b). | **First content pass** — reword/remove the specific time so the claim is true. Treat as an honesty fix, not i18n. |
| 21 ✅ **RESOLVED** | ~~**Supabase project migration to a new free account**~~ — the live DB became unreachable after the project **auto-paused** (free-tier idle) and the owning account hit Supabase's free **active-project limit** (enforced per Owner across every org they own). | **Was actively blocking; cleared 2026-07-04.** | **Resolved without migration:** the project was transferred into a **new organization** under a second real account and the old account's membership was removed from that org, clearing the limit so the project could resume. **URL + API keys unchanged → no re-embedding, rebuild, or env/code change; verified by login.** The [`supabase-migration-runbook.md`](./supabase-migration-runbook.md) plan (export → recreate → key-swap → delete) was **not needed** and is now **superseded** — no old project was deleted. Phase 2's paused Arabic/RTL verification can resume. **Standing footprint is now register #22.** |
| 22 🚀 **PRE-LAUNCH (launch-blocker decision)** | **Supabase free tier is not a production foundation.** Per Supabase's own docs a free project is capped at **500 MB database**, **5 GB egress/month**, **auto-pauses after ~1 week idle**, and is subject to the **active-project limit enforced per Owner across all their organizations**. KnowFlow currently runs on free tier across a **multi-account** setup that stays within Supabase's Acceptable Use Policy (real emails, ≤2 active projects per account, not an "excessive" number of accounts) — fine for development, **not a stable launch foundation.** | Cost/architecture choice that belongs at launch time, not now. **Do not act on this during development.** | **Before public launch, decide a stable, policy-compliant backend:** either a **paid Supabase plan** (a founder budget call at launch) **or migrate to another free-tier-capable Postgres host** (a larger engineering task). **Standing operational reality until then:** a free KnowFlow project **keeps auto-pausing when idle** during development, and the founder **resumes it manually.** Flagged here so it can't be forgotten at ship time. |

| 23 ✅ **RESOLVED 2026-07-05** | **The live Supabase DB was far behind the repo migrations — the Phase-0 rate limits were never actually live.** A pre-P3.1 audit of the live project against `supabase/migrations/` (via `information_schema`) found only **8 tables**, with **`usage_counters` + `increment_usage()` and several other objects never applied**. Because `enforceLimit` **fails CLOSED** when `increment_usage` errors (`rate-limit.ts` — deny rather than risk uncapped cost), the missing counter infra meant the rate-limited paths (`/api/agent` Ask, `/api/ingest` Upload) were **failing closed / the Phase-0 budget caps were inert** — a written migration file had been treated as an applied one. | **Was silently defeating Phase-0 (B7); cleared 2026-07-05.** | **Reconciled** by running a **consolidated, idempotent** script (additive `add column if not exists` / `create or replace`, plus the destructive-but-safe drop/recreate of drifted objects, flagged as such before running) in the Supabase SQL editor — completed *"Success, no rows returned"*. **Verified via `information_schema`:** tables now number **9** with `usage_counters` present, and `documents` carries all four P3.0 summary columns (`summary`, `summary_generated_at`, `summary_is_partial`, `summary_model`). **Live DB now matches the repo migrations.** **Effect:** Phase-0 budget protection (B7) is now **genuinely active** — real **429s at the caps** — where it was previously inert, and Ask/Upload work again instead of failing closed. **Lesson (now a standing rule — see §5): after any migration, VERIFY the live DB matches the repo (`information_schema`) — never treat a written migration file as an applied one.** Related: the org move in #21 and the pre-launch backend decision in #22. |

**Founder-owned open items (PIVOT_PLAN §10) — not engineering-blocked, tracked for launch:**
Next.js hosting decision (Vercel Pro vs self-host, ~Phase 7/10) · **Supabase backend
plan — paid vs. free-tier-capable-host migration (pre-launch; see register #22)** ·
AdMob account verification/payout (before Phase 9) · final free-tier limit numbers
(set Phase 0/1, tune with real usage).

---

## 5. Standing rules (working principles)

- **When in doubt, deny.** Fail closed on limits/entitlement/uploads.
- **Fix what we break, in place.** After fixing a defect, hunt its siblings
  (e.g. the DropZone accept↔allowlist↔hint alignment; the 429 body swallow).
- **Close both halves of a vulnerability** — extension *and* MIME, filename
  sanitize *and* tempfile suffix, etc.
- **All entitlement reads go through `getEntitlement`** — never a raw
  `subscriptions`/`profiles.plan` read. One source of truth.
- **Never promise what the app doesn't do** — no page-level citations (file/section
  only), no "ad-free" until ads exist, no "Unlimited", real interpolated limits.
- **Honest placeholders** — a not-yet-wired feature reads as *not measured*
  (ghost `—`), not as a working zero.
- **Branch protection on `main` with `enforce_admins`** — every phase is one
  branch → PR → review → merge. Nothing merges automatically.
- **One step at a time** — commit per step, stop for review, don't jump ahead on a
  deferred item or skip a main phase (this file exists to enforce that).
- **Presentation-only means locale-diff-clean & logic-verbatim** — restyle without
  touching engine wiring; prove preservation (diff/grep), don't assert it.
- **Verify payment/security facts in code, not from memory** before asserting them.
- **A migration file is a plan, not a fact.** After any migration, **verify the
  live DB matches the repo** (`information_schema`) — never treat a written
  migration file as an applied one (see register #23: the Phase-0 rate limits sat
  inert because `usage_counters`/`increment_usage` were never actually applied).

---

## 6. Maintenance

Update at the **end of each step**: flip the step's status, add its commit, move
any newly-deferred item into §4 with its target phase, and bump *Last updated*.
When a phase merges, set its row to ✅ **DONE** with the merge commit/PR.
