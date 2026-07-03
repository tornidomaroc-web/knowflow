# Supabase Migration Runbook — move KnowFlow to a new free account

**Status:** 🔴 NOT STARTED · planning complete, no move actions taken.
**Why:** the current Supabase account hit the free 2-project limit; the other two
projects are entering Google Play review and must stay active, so KnowFlow's
Supabase project must move to a brand-new account on a new email.
**Old project ref:** `wnpqdafdkbuvwecksrjj` (from `.env.local`).
**New project ref:** _(fill in after creation)_ `________________`

This is a checkable, ordered runbook. Tick each `[ ]` as you complete it.
**Do the sections IN ORDER.** The two things that prevent irreversible loss are
[§6 EXPORT-before-delete](#6-🚨-export--back-up-from-the-old-project-before-deleting-anything)
and the [delete-last guardrail](#-guardrail-never-delete-before-cutover). They are
called out in red for a reason — do not skip them.

---

## 🚨 GUARDRAIL: never delete before cutover

> **Keep the OLD KnowFlow project fully alive until the entire [§4.6 end-to-end
> verification](#step-46--verify-end-to-end-on-the-new-project-before-deleting-old) passes on the NEW project.**
>
> Deleting a Supabase project is **irreversible** and wipes the entire database
> (schema, tables, RLS, functions, triggers, storage, and all data). There is no
> undo. The old project is your only rollback until the new one is proven.
>
> If free-tier slot pressure tempts you to delete early: **don't.** Prove the new
> project works end-to-end first. Delete-last is the whole safety model.

---

## 0. Pre-flight facts (verified against the repo)

- **Schema is fully in code** — the six files in `supabase/migrations/` define every
  table, RLS policy, function, trigger, extension, and the `vector(1024)` column.
  See [§1](#1-migration-inventory-source-of-truth).
- **BUT these were hand-applied via the Supabase SQL editor** — there is no
  `supabase/config.toml`, no CLI linkage, no migration-tracking table, and the
  filenames are inconsistent (`001_…`, then `20260414_…`). That means the live DB
  **may have drifted** from the repo. The [§6 schema dump + diff](#6-🚨-export--back-up-from-the-old-project-before-deleting-anything)
  is the ONLY way to be certain nothing was applied manually and lost.
- **Concrete drift suspect:** `002_storage.sql` defines only **INSERT** + **SELECT**
  storage policies, but `src/app/api/ingest/route.ts` uploads with `upsert: true`
  (needs an **UPDATE** policy) and nothing defines a **DELETE** policy. If
  re-uploading over a file or deleting a document ever worked live, an
  **UPDATE/DELETE storage policy was added manually and is NOT in the repo.**

---

## 1. Migration inventory (source of truth)

Run these **in this exact order** on the new project (FK + extension dependencies):

| Order | File | Defines |
|---|---|---|
| 1 | `001_initial_schema.sql` | Tables **profiles, knowledge_bases, documents, conversations, messages**; RLS + owner policies on all 5; function **`handle_new_user()`** (SECURITY DEFINER); trigger **`on_auth_user_created`** on `auth.users`. |
| 2 | `002_storage.sql` | Storage bucket **`documents`** (private); storage.objects policies: **INSERT** + **SELECT** (user-folder scoped). ⚠️ see drift suspect above. |
| 3 | `003_waitlist.sql` | Table **waitlist** + RLS + public INSERT policy. |
| 4 | `20260414_subscriptions.sql` | Table **subscriptions** (Paddle mapping) + RLS + SELECT-own policy. |
| 5 | `20260501_rag_pgvector.sql` | `create extension vector`; table **chunks** (`embedding vector(1024)`); indexes incl. **HNSW** (`vector_cosine_ops`); 3 chunks RLS policies; **ALTER documents** add `embedding_status` + `error_message`; function **`match_chunks()`** (SECURITY INVOKER). |
| 6 | `20260629_usage_counters.sql` | Table **usage_counters** (Phase-0 counter) + read-own RLS; function **`increment_usage()`** (SECURITY DEFINER); `grant execute … to authenticated`. |

**Functions/RPCs the app actually calls** (grep of every `.rpc(...)`): only
`increment_usage` and `match_chunks`. Plus the auth trigger's `handle_new_user`.
**No other functions are referenced.** All three are in the migrations above.

- [ ] All six files present and unchanged in `supabase/migrations/` before starting.

---

## 2. Environment variables the app reads for Supabase

The app reads **exactly these three** Supabase vars (grepped — nothing else):

| Var | Read in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/{client,server,middleware}.ts` | **Baked into the client bundle at build time** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same three files | **Baked into the client bundle at build time** |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/app/api/paddle/webhook/route.ts` **only** | server-only |

⚠️ **The two `NEXT_PUBLIC_*` values are compiled into the browser bundle.** Editing
them in Vercel is NOT enough — you must trigger a **fresh redeploy** for new values
to take effect.

Locations these three live in and must be swapped:
- [ ] `.env.local` (local dev)
- [ ] **Vercel** project env → **then redeploy** (mandatory for the `NEXT_PUBLIC_*` pair)
- [ ] **Railway ingestion service** — *verify* it holds **no** `SUPABASE_*` vars. From
  this repo's code the Python service only receives files and returns chunks; Next.js
  does all Supabase writes. But it's a **separate repo** — confirm before assuming clean.

---

## 3. Config NOT in migrations — recreate manually on the new project

- [ ] **Storage bucket `documents`** exists and is **private** (created by `002`; verify it materialized).
- [ ] **Storage UPDATE/DELETE policies** — re-apply if the live-project diff (§6) shows they existed.
- [ ] **Auth → Providers:** enable **Email/password** (only provider used — `signInWithPassword`, `signUp`). No OAuth in code.
- [ ] **Auth → "Confirm email":** must match the OLD project. Signup (`src/app/[locale]/signup/page.tsx`)
  routes **straight to `/dashboard`** with an active session and never sets `emailRedirectTo` —
  that only works if **"Confirm email" is DISABLED**. If the new project defaults to enabled,
  signup will appear broken (no session). **Set it the same as old.**
- [ ] **Auth → URL Configuration:** set **Site URL** + **Redirect URLs**
  (`https://tryknowflow.com` and `http://localhost:3000`).
- [ ] **Email templates:** recreate if customized on old (default is fine if untouched).
- [ ] New project auto-generates its own JWT secret + anon/service keys — expected; that's why §2 swaps keys.

---

## 4. Ordered rebuild sequence (NEW account)

### Step 4.1 — Create project
- [ ] Create the new Supabase project on the new account/email.
- [ ] Record the new **ref/URL** and grab the **new anon + service_role keys** (Settings → API). Fill them into the header of this doc.

### Step 4.2 — Run migrations
- [ ] Run migrations **1 → 6** in the SQL editor in the order in [§1](#1-migration-inventory-source-of-truth).
- [ ] Apply any **manual-drift SQL discovered in §6** (e.g. missing storage UPDATE/DELETE policy) AFTER the six files.

### Step 4.3 — Storage
- [ ] Confirm `documents` bucket exists and is private (create manually if the SQL insert didn't take).

### Step 4.4 — Auth settings
- [ ] Recreate all [§3](#3-config-not-in-migrations--recreate-manually-on-the-new-project) auth config (providers, Confirm-email, Site/Redirect URLs, templates).

### Step 4.5 — Swap env vars
- [ ] Swap the three [§2](#2-environment-variables-the-app-reads-for-supabase) vars in `.env.local`, Vercel (+ **redeploy**), and verify Railway has none.

### Step 4.6 — Verify end-to-end on the NEW project (BEFORE deleting old)
Run the full flow against the new project. **All must pass before §5.**
- [ ] **Sign up** a new user → lands on dashboard (proves `handle_new_user` trigger + Confirm-email setting).
- [ ] **Create a KB + upload a doc** → row in `documents`, rows in `chunks` (proves storage policy + ingestion + embedding insert).
- [ ] **Ask a question** → answer returns (proves `match_chunks` RPC + HNSW index).
- [ ] **Exercise the limit path** → query/upload counter increments (proves `increment_usage`).
- [ ] **Fire a Paddle test webhook** → `subscriptions` upsert works (proves service-role key).

---

## 5. Decommission the OLD project — LAST, and only after §4.6

- [ ] Confirm **every** §4.6 checkbox passed on the new project.
- [ ] Confirm **all** §6 exports are saved locally/off-Supabase.
- [ ] Only then: delete the old project (`wnpqdafdkbuvwecksrjj`). **Irreversible.**

---

## 6. 🚨 EXPORT / back up from the OLD project BEFORE deleting anything

> **This is the single most important section.** Do ALL of it while the old project
> is still alive. If you skip only one thing, skip nothing — items 1–2 are the ones
> that turn this from safe to catastrophic.

1. [ ] **Full schema dump — THE critical artifact.** `pg_dump --schema-only`
   (or `supabase db dump --schema public,storage,auth`, or dashboard → Database → Backups).
   **Diff it against the six migration files** to catch anything hand-applied and not in the repo.
2. [ ] **From the dashboard, list and compare against the repo:** Database →
   **Functions**, **Triggers**, **Policies** (all schemas incl. `storage`),
   **Extensions**, **Indexes**. Anything present live but absent from a migration file
   = manual drift → re-apply it in §4.2.
3. [ ] **Export `waitlist` and `subscriptions` as CSV** — real, non-regenerable data
   (marketing leads; real Paddle customer/subscription mappings). Export even if you
   think they're empty; verify.
4. [ ] **Export Auth users** (if any real accounts exist beyond your test logins).
5. [ ] **Record the Auth settings verbatim** — Confirm-email on/off, Site URL,
   Redirect URLs, providers, any custom email templates (screenshot is fine).
6. [ ] **Storage objects** in `documents` — optional; disposable dev docs, re-uploaded
   later. Skip only if you're fine losing them.

---

## 7. Data-loss assessment (what you're giving up)

Everything is lost on delete: all tables, **`auth.users`** (migrations do NOT recreate
users — everyone re-registers), and all **Storage** objects. Given pre-launch:

- **Disposable:** `chunks` (re-embed by re-uploading), `documents`, `conversations`,
  `messages`, `usage_counters`, and your own test `auth.users`/`profiles`.
- **NOT obviously disposable — export regardless (see §6.3):** `waitlist` (real leads)
  and `subscriptions` (real Paddle mappings). If any real checkout occurred, losing a
  `subscriptions` row breaks entitlement for a paying customer.

---

## 8. Sign-off

- [ ] New project verified end-to-end (§4.6).
- [ ] All exports saved (§6).
- [ ] Old project deleted (§5).
- [ ] App pointed at new project, redeployed, smoke-tested in production.
- [ ] `docs/PROGRESS.md` blocking item marked resolved; Phase 2 visual verification resumed.
