# KnowFlow — Progress Tracker

**Single source of truth for project state.** Built from the actual record: git
commit history + [`PIVOT_PLAN.md`](./PIVOT_PLAN.md) + project memory. Update this
file at the **end of every step** so we never jump ahead on a deferred item or
skip a main phase.

- **Last updated:** 2026-07-03 (P2.6a auth pages migrated; register #17–19 added).
- **Active branch:** `feat/phase-2-ui-redesign` → **draft PR #12** (not merged).
- **Main tip:** `c3cdbe0` (Merge PR #11, Phase 1).

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
| **2** | Consumer UI redesign (web, mobile-first) | 🟡 **IN PROGRESS** | draft PR **#12** (`feat/phase-2-ui-redesign`); P2.0–P2.5 done, P2.6–P2.7 remaining |
| **3** | Summaries (per-document) | ⬜ NOT STARTED | — |
| **4** | Quizzes | ⬜ NOT STARTED | — |
| **5** | Streak & progress | ⬜ NOT STARTED | — |
| **6** | Flashcards + spaced repetition (SM-2) | ⬜ NOT STARTED | — |
| **7** | Backend hardening **(GATE before Phase 8)** | ⬜ NOT STARTED | — |
| **8** | Capacitor mobile shell (Android) | ⬜ NOT STARTED | — |
| **9** | AdMob for free users | ⬜ NOT STARTED | — |
| **10** | Play prep & submission | ⬜ NOT STARTED | — |
| **Later** | Apple / iOS (+ page-accurate citations revisit) | ⬜ NOT STARTED | Only after Android is live |

---

## 2. Active phase — Phase 2 sub-steps

| Step | Scope | Status | Commit(s) |
|---|---|---|---|
| **P2.0** | Design-token + font foundation (light "Calm Focus" tokens, Rubik) | ✅ done | `acc7545` |
| **P2.1** | UI primitives (Button/Card/Input/Badge/Sheet on `cn()`) + dashboard shell / sidebar / mobile nav; RTL logical properties | ✅ done | `95736a8` |
| **P2.2** | Student home — first light content screen (thin wrapper + dumb `StudentHome`); ghost `—` streak placeholder | ✅ done | `f3b1119`, `88537e7` |
| **P2.3** | Subjects list (`SubjectsList`) + subject detail + upload zone restyle | ✅ done | `57e0e68` |
| **P2.4** | Ask/chat (KBSelector/ChatBox/MessageBubble/ConversationSidebar) + **Sheet focus trap**; 429 body surfaced | ✅ done | `adf6b3b`, `b0c9aff` |
| **P2.5** | New-subject form + settings/plan (thin wrapper + dumb `SettingsPanel`). **Fully closed** — the `<a>`→`<Link>` upgrade CTA was verified (`/pricing` inits Paddle on a mount effect, not on a full page load) and kept. | ✅ done | `3b05549` |
| **P2.6** | **DECIDED (2026-07-02).** Migrate the remaining **public + auth pages** to light. Presentation-only: preserve all copy (Phase-1 strings diff-clean), all auth/checkout/CTA wiring, and RTL. Split into 3 commits by concern/wiring risk (approved 2026-07-03): | 🟡 in progress | — |
| ↳ **P2.6a** | **Auth** — `login`, `signup` (bridge light canvas; `signInWithPassword` / `signUp` + `profiles` upsert + `router.push` + password-toggle preserved). | ✅ done | _this branch_ |
| ↳ **P2.6b** | **Converting** — `landing`, `pricing` (all `/signup` CTAs + footer links; Paddle init-on-mount + checkout + free-plan `<Link>` preserved). | ⬜ remaining | — |
| ↳ **P2.6c** | **Content/legal** — `about`, `contact`, `privacy`, `terms`, `refund` (low/no wiring; about CTA + contact mailto/GitHub preserved; legal content verbatim). | ⬜ remaining | — |
| **P2.7** | **DECIDED (2026-07-02).** Final layout flip + Phase-2 close. Flip the shared dark surfaces light and remove the per-screen/per-page light-canvas bridges: (a) dashboard `<main>` in `dashboard/layout.tsx`; (b) the root `<body>` in `[locale]/layout.tsx`; (c) the `body {}` rule in `globals.css`. **Must be last** — the root body/globals rule sit behind the P2.6 pages, so flipping them before P2.6 is done would make un-migrated pages' bare `text-white` vanish. | ⬜ remaining | — |

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
| B7 | No rate limiting (cost abuse) | Phase 0 | ✅ done (`9c3b7ba`) |

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
| 13 🔎 | **Shared dark surfaces still forced** — dashboard `<main>` (`dashboard/layout.tsx`), the root `<body>` (`[locale]/layout.tsx`), and the `globals.css` `body {}` rule; each migrated screen paints its own light canvas as a bridge. | Can't flip a shared surface light until *all* screens/pages on it are migrated (un-migrated ones put bare `text-white` on it). | **P2.7 (decided)** — final flip of all three + remove bridges; must run last. |
| 14 🔎 | **Home streak is a non-functional placeholder** (ghost `—`, `streak: number\|null`). | The streak feature itself is Phase 5; P2.2 only shipped an honest placeholder. | **Phase 5** wires real tracking (`study_events`) — placeholder was designed so a real number drops in with no component change. |
| 15 🔎 | **Embedding provider switch (Voyage → self-hosted bge-m3)** — seam shipped in Phase 0 as a documented stub; actual switch not implemented. | Deliberately deferred until a real usage/cost threshold (PIVOT_PLAN §4); avoids provisioning a VM early. | **Trigger-based, not a phase** — flip `EMBEDDING_PROVIDER` when a §4 trigger (Voyage ~80% free tier / DAU >~300–500 / non-zero invoice) hits. |
| 16 🔎 | **Page-accurate citations** — engine cites filename + chunk only; page spans lost in MarkItDown conversion. | Decided (§6): ship file/section only, **never promise page citations**. True page citations need an ingestion rework. | **Later** (uncommitted possibility, revisited with Apple/iOS). |
| 17 🔎 | **Legal pages render hardcoded English JSX, not `t.*`** (`privacy`, `terms`, `refund`) — they show English even under `/ar`. | Content was never wired to i18n; surfaced during the P2.6 restyle (out of a presentation-only step's scope). | Later i18n gap — localize legal copy (thread `t.*` or per-locale content). **Suggest** a Phase 7 / pre-launch i18n pass with register #1. |
| 18 🔎 | **Legal pages carry stale B2B vocabulary + inconsistent contact domains** — "knowledge bases"/"AI agents"/"agents"; `privacy@knowflow.ai` & `legal@knowflow.ai` vs the product's `tryknowflow.com` (refund uses `support@tryknowflow.com`). | Copy issue, not presentation; out of a restyle's scope. | Later content pass — reword to student vocabulary + unify the contact domain. Fold into the same legal-copy pass as #17. |
| 19 🔎 | **Contact form is non-functional** (`button type="button"`, no `onSubmit`/handler) — only the `mailto:` and GitHub links work. | Never wired; the page currently *looks* interactive but isn't. | Later decision — either wire the form (endpoint/email service) or make it **honestly** mailto-only (drop the inert fields). |

**Founder-owned open items (PIVOT_PLAN §10) — not engineering-blocked, tracked for launch:**
Next.js hosting decision (Vercel Pro vs self-host, ~Phase 7/10) · AdMob account
verification/payout (before Phase 9) · final free-tier limit numbers (set Phase
0/1, tune with real usage).

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

---

## 6. Maintenance

Update at the **end of each step**: flip the step's status, add its commit, move
any newly-deferred item into §4 with its target phase, and bump *Last updated*.
When a phase merges, set its row to ✅ **DONE** with the merge commit/PR.
