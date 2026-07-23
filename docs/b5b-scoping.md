# B5b — Upload Content Hardening: Scoping & Decision Record

**Status:** scoping only. **Nothing in this document changes code.** No route change, no
validation logic, no size-constant edit. It records the constraints this session
**established and verified**, the misdiagnoses it **corrected**, the **split** it proposes,
and the **decisions that remain the founder's to make**. B5b (PIVOT_PLAN §8) and Phase 7 both
stay ⬜ NOT STARTED — a scoping document is not progress on the gate.

**Recorded:** 2026-07-23. **Author context:** written during the same session that closed
register #45 (the live duplicate Vercel ingestion service). This repo records **WHY, not just
what** — every value below is accompanied by the reasoning that makes it binding, and every
fact by how it was verified.

**Scope boundary.** B5b is "deep upload content hardening: magic-byte verification, bomb /
nested-archive limits, content scanning" (PIVOT_PLAN §8, `B5b`). It is distinct from **B5a**
(the extension/MIME allowlist, already ✅ done, Phase 0) and from **B6** (synchronous ingestion
→ background job). B5b and B6 are **coupled but not identical**; §3 records exactly where the
seam falls.

---

## Section 1 — Established constraints (facts, each with how it was verified)

### 1.1 — Vercel enforces a hard 4.5 MB request-body cap at the edge

Vercel Functions reject any request whose body exceeds **4.5 MB** with
`413 FUNCTION_PAYLOAD_TOO_LARGE`, **before the handler runs**. This is a documented platform
constant, **not configurable** — it cannot be raised from `vercel.json`, `next.config.ts`, or
route code. It therefore binds **every upload today**, and it binds *below* the 50 MB the app
currently promises (§1.6).

**Why it matters:** the app's own 50 MB check (`route.ts:51`, `if (file.size > 52428800)`)
can *never fire for the reason a user would expect* — a 10 MB file is rejected by Vercel's edge
at 4.5 MB long before Next sees it. The app's check only ever fires for files between... nothing:
4.5 MB < 50 MB, so the app's 413 is **unreachable for oversize** on Vercel. It could only fire
if the edge cap were absent (e.g. the Railway service, or a self-hosted Next).

**How verified:** documented Vercel platform limit; corroborated by register #45's measurement
work this session, where the Vercel-served ingestion duplicate's `/convert` was noted as
edge-capped at 4.5 MB inbound (unlike Railway).

### 1.2 — Ingestion runs on Railway, not Vercel

`INGESTION_SERVICE_URL = https://knowflow-production.up.railway.app`
(`.env.local:4`; consumed at `route.ts:143` and `src/lib/ingestion.ts:6`). The Python ingestion
service (MarkItDown → chunk → Voyage embed) runs on **Railway**, verified from the Vercel
dashboard during the register-#45 work.

**Consequence:** the `route.ts` → `/convert` hop is **Next (Vercel) → Railway**. It faces **no
second Vercel inbound cap** (Railway is not behind Vercel's edge) and **no Vercel response cap**.
The 4.5 MB edge cap of §1.1 applies to the **browser → Next** leg only.

### 1.3 — Return-path amplification (memory/latency pressure, not a hard 413)

`/convert` returns, in one JSON body, the **full markdown** *plus* **every chunk with its
1024-float embedding inline**. Verified in `services/ingestion/main.py:170-173` (returns
`{ markdown, chunks }`) and `:166-168` (each chunk gets `c["embedding"] = emb`), and consumed at
`route.ts:165` (`const result = await pyResponse.json()`).

From `CHUNK_TOKENS = 512`, `CHUNK_OVERLAP = 64` (`main.py:27-28`) and `EMBED_DIM = 1024`
(`main.py:20`), the JSON response is roughly **9–13× the size of the extracted text**: the
embeddings dominate (1024 floats serialized as ~11 bytes each ≈ ~11 KB per chunk, versus ~2 KB of
chunk text), and the ~512/448 overlap re-emits text at ~1.14×. So roughly **350–480 KB of
extracted text produces a ~4.5 MB response**.

**Why it is NOT a hard 413:** `await pyResponse.json()` at `route.ts:165` **materializes the
entire response in the Next function's memory**, but because ingestion is on **Railway** (§1.2),
this is **memory + latency pressure inside the Next invocation**, not a Vercel response-size
rejection. There is no platform ceiling on this leg — it degrades, it does not cliff.

### 1.4 — Duration likely binds before size, and it is UNMEASURED

**No `maxDuration` is configured anywhere.** Verified grep-empty across `vercel.json`,
`next.config.ts`, `package.json`, **and** all of `src/`. The function runs under the platform
default.

Inside a **single** `/api/ingest` invocation the work is **sequential**:
- Voyage embeds in batches of **128** inputs, each with a **60 s** client timeout
  (`main.py:113-114`, `timeout=60.0`, `for i in range(0, len(texts), 128)`).
- Supabase chunk inserts run in batches of **50** (`route.ts:184`, `BATCH = 50`), looped.

A 4.5 MB text file implies on the order of **~2,600 chunks** (512-token chunks, 64 overlap) and
therefore **~21 sequential embed batches**. The real user-facing ceiling is thus a **duration
ceiling**, and **it is UNMEASURED**. See §5 for the measurement procedure that must precede any
user-facing number.

**Why this ordering matters:** debating a file-size number (§4 decision 1) while the true
binding limit is *time* would set a size cap that either never fires (duration times out first)
or is set to the wrong value. The measurement in §5 tells us which limit actually governs.

### 1.5 — Accepted formats today

`ALLOWED_FILE_TYPES = ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md']`
(`src/types/index.ts:45`, single source of truth; B5a / register #42/#56 closed the drift).

The gate: **extension is the primary check** (`route.ts:60-64`, 415 if the extension is not in
the allowlist). **MIME is only a secondary cross-check and is bypassable** — `route.ts:70-73`
tolerates an **empty** MIME *and* `application/octet-stream`, rejecting only a *specific* MIME
that contradicts the extension. A caller who sends no `Content-Type` (or `octet-stream`) passes
the MIME check with any allowed extension.

**NOTE — txt and md have no magic bytes.** Four of the six formats have file signatures
(`%PDF-` for pdf; `PK\x03\x04` for the docx/pptx/xlsx OOXML trio). **`txt` and `md` have no
signature at all** — they are arbitrary text. A magic-byte rule (§3, B5b-1) **cannot** cover
them; they need a **different** rule: UTF-8 decodability / NUL-byte rejection, not a signature
match. Any signature table that forgets this would reject every legitimate `.txt`/`.md` upload.

### 1.6 — The 50 MB promise is BROKEN in production, asserted in 7 places

The app promises 50 MB in **seven** sites, but §1.1 makes the real ceiling ~4.5 MB, so the
promise is **false in production today**:

1. `src/app/api/ingest/route.ts:51` — the check `if (file.size > 52428800)` (52428800 = 50 MiB)
2. `src/app/api/ingest/route.ts:52` — the 413 body `'File too large. Maximum size is 50MB.'`,
   a **hardcoded English string, not routed through `t.*`** — the **same defect class as
   register #17** (hardcoded English bypassing i18n)
3. `src/components/upload/DropZone.tsx:26` — the client check `if (file.size > 52428800)`
4. `src/lib/i18n/locales/en.ts:248` — `fileTooBig: "File too large. Maximum size is 50MB."`
5. `src/lib/i18n/locales/en.ts:251` — `supported: "… (Max: 50MB)"`
6. `src/lib/i18n/locales/ar.ts:250` — `fileTooBig: "… 50 ميجابايت."`
7. `src/lib/i18n/locales/ar.ts:253` — `supported: "… (الحد الأقصى: 50 ميجابايت)"`

**How verified:** direct grep of each file this session. Two of the seven (route.ts:52 and
the two `supported` strings) also carry the register-#17 i18n defect: correcting the number is
an opportunity to route route.ts:52 through `t.*` at the same time.

---

## Section 2 — Corrections to record (so future readers do not inherit our misdiagnoses)

These are places where an earlier, plausible reading was **wrong**. They are recorded so nobody
re-derives the mistake.

### 2.1 — The 4.5 MB cap does NOT mitigate decompression bombs

It is tempting to read §1.1's edge cap as a partial defense against ZIP bombs ("at least the
input is bounded to 4.5 MB"). **This is the single most dangerous inference available here, and
it is false.** ZIP expansion ratios are astronomical — a few dozen KB of crafted archive can
expand to **petabytes**. **4.5 MB of crafted ZIP still exhausts the ingestion service.** The
inbound cap bounds the *compressed* bytes; the bomb's damage is in the *expansion*, which the cap
never touches. Bomb mitigation must measure or bound the **expanded** size (§3, B5b-2), not the
uploaded size.

### 2.2 — The pre-auth body-buffering concern is BOUNDED, not unbounded — a low-priority ride-along

The request path parses the body **before** it authenticates:
`formData()` at `route.ts:43` → `getUser()` at `route.ts:79` → `enforceLimit` at `route.ts:102`.
It is tempting to call this an urgent "unauthenticated attacker streams unbounded bytes into our
function" hole. **It is bounded by the platform at 4.5 MB (§1.1), so it is NOT urgent.**

- The `getUser()`-above-`formData()` **reorder is verified safe** but is now a **low-priority
  ride-along, not an urgent fix**: `createClient` reads cookies only, so a cookieless caller
  returns `user: null` with zero network calls — moving the auth check above the body parse
  rejects an anonymous caller before buffering, at no correctness cost.
- **`checkDocumentLimit` CANNOT move** above the body parse: it needs `kbId`, which is read
  **from the body** (`route.ts:45`, `formData.get('kb_id')`). No body, no `kbId`, no check.
- **`enforceLimit` should NOT move** above the body parse: it **increments the usage counter**
  (register #24), so running it before a request is known-good would **burn an upload credit on
  a rejected request**.

So the only movable piece is `getUser()`, and its payoff is small because the edge cap already
bounds the exposure. Record it; do not prioritize it.

### 2.3 — PIVOT_PLAN.md:269 asserts a FALSE claim ("Size cap (50 MB) already exists")

`PIVOT_PLAN.md:269` (the **B5a** row) states *"Size cap (50 MB) already exists."* This is
**false**: the effective cap is **~4.5 MB** and is imposed by the **platform** (§1.1), not by
that code, and the app's own 50 MB check is unreachable-for-oversize on Vercel (§1.1). Recorded
here so the contradiction is on the record. **Do NOT edit `PIVOT_PLAN.md` in this PR** — this
document is the correction; the plan edit, if any, is a separate decision.

---

## Section 3 — The split (with the reasoning, not just the labels)

The hardening work divides along **what is doable now on the request path** versus **what
genuinely requires B6's off-request re-handling**, plus two enabling infrastructure moves.

### B5b-1 — Request path, doable NOW, independent of B6

Each item here is a pure function of bytes the handler **already holds** (the uploaded file), so
none of them needs the file re-handled off the request path:

- **Magic-byte verification** — check the leading signature against the declared extension
  (`%PDF-` for pdf; `PK\x03\x04` for the OOXML trio). Pure function of bytes in hand.
- **Declared-size ZIP ratio pre-check** — read the **central directory** of the OOXML/ZIP
  container and sum the *declared* uncompressed sizes. **O(entries), no expansion.** This is a
  *cheap first filter*, not a truthful bound (see B5b-2 on why a lying directory survives it).
- **The auth reorder ride-along** (§2.2) — move `getUser()` above `formData()`. Low priority.

### B5b-2 — Genuinely gated on B6 / register #22

Each item here requires either **actual expansion** (which you do not want to do synchronously on
the request path) or a **worker / external service** that does not exist today:

- **Enforced expansion bounds** — a *truthful* measurement requires **actually expanding** the
  archive and stopping at a byte ceiling. A **lying central directory** (declaring small sizes
  while the streams expand hugely) passes the B5b-1 pre-check and only fails **here**, at real
  expansion. Expansion is slow and memory-hungry → it belongs off the request path (B6).
- **Nested-archive depth** — a bomb can be archives-within-archives; bounding depth means
  recursively opening, i.e. expansion, i.e. B6.
- **Any AV / content scanning** — slow, and needs a scanner binary or service that is **not in
  the image today** (§4 decision 3). Needs a worker.

### (b1) — Move chunk+embedding persistence INTO the Railway service (the enabler of B6)

Today the Railway `/convert` returns a **9–13× JSON blob** (§1.3) that the Next route materializes
and inserts. Instead, have the **Railway service write chunks+embeddings to Supabase directly**.

- **Size-independent** — helps regardless of any file-size ruling.
- **Fixes the return-path wall** (§1.3) — the 9–13× blob never crosses the network; Next stops
  holding it in memory.
- **Relocates the slow work** (embed batches, chunk inserts) to Railway — **the only component
  without a duration ceiling** (§1.4; Vercel has the unmeasured default, Railway does not sit
  behind it).
- **It is the ENABLER of B6, not B6 itself.** Even after (b1), the Next route would still
  `await` Railway until **fire-and-forget** is adopted (return early, let Railway finish). So (b1)
  removes the *payload* wall but not the *duration* wall; B6 proper is the fire-and-forget step.
- **Stands regardless of the file-size ruling** (§4 decision 1).

### (b2) — Signed-URL direct-to-Supabase-storage upload

The browser uploads **straight to Supabase storage** via a signed URL, bypassing Next entirely.

- It is the **ONLY** way past the **4.5 MB inbound cap** (§1.1) — the bytes never traverse
  Vercel's edge.
- **Gated entirely on the founder's file-size ruling** (§4 decision 1): if ~4.5 MB is accepted,
  (b2) is unnecessary; only a *real* 50 MB (or larger) target justifies it.
- **Payoff is limited by register #22** — the free-tier Supabase **5 GB/month egress** caps the
  benefit at roughly **~100 uploads/month at 50 MB** before the tier is exhausted. A 50 MB
  capability the backend cannot afford to serve is a promise in the same family as the broken
  50 MB of §1.6.

---

## Section 4 — Open decisions awaiting Abo Jad's ruling

**Each is stated as a question with its consequences. This document does NOT pick values.**

**1. Max file size.** Accept **~4.5 MB** (correct all 7 sites of §1.6, and route the message
through `t.*`) **vs.** deliver a **real 50 MB** via (b2) signed-URL upload.
*Consequence:* this decision **gates** decision 5 (enforcement point) and the sync/async posture —
a real-50 MB path is inherently async (b2 + B6), a ~4.5 MB path can stay synchronous.

**2. Format list.** Keep **all six**, or **drop the ZIP-container trio (docx / pptx / xlsx)** that
carries **all** the decompression-bomb risk (§2.1). pdf/txt/md carry no ZIP-bomb surface.
*Consequence:* dropping the trio removes the B5b-2 expansion-bound and nested-depth work entirely;
keeping it makes that work mandatory before Phase 8.

**3. What "scanning" means — in or out of scope.**
- **AV** — needs a scanner binary/service; **nothing in the image today** provides it.
- **PII detection** — its own service/model.
- **Prompt-injection in extracted text** — **record explicitly:** extracted document text flows
  **unfiltered** into the Haiku prompt via `<document>` interpolation in the summarize / quiz /
  agent routes. **This is currently unmitigated.** At minimum it needs a **documented
  accepted-risk decision**, even if active mitigation is deferred.
*Consequence:* each sub-item independently either enters scope (with a worker, per B5b-2) or is
recorded as an accepted risk.

**4. Failure posture.** **Reject at upload** (user-visible **415**) **vs. accept-then-quarantine**
(store, scan out-of-band, release or delete).
*Consequence:* reject-at-upload is synchronous and simple but blocks the request on the check;
quarantine needs the async worker (B6) and a quarantine state on `documents`.

**5. Enforcement point.** **Next route**, **Railway service**, or **both**.
*Consequence:* **the Railway service currently trusts its caller completely (bearer token only)** —
`_check_auth` is a single-token equality. Anything enforced **only in Next is bypassed if that
token leaks** (exactly the register-#45 exposure). Enforcing in Railway (or both) is the only
posture robust to a leaked `INGESTION_TOKEN`.

**6. The three ZIP numbers.** Each needs **a value AND a measurement decision**:
- **expansion ratio** (max expanded ÷ compressed)
- **absolute expanded cap** (hard byte ceiling)
- **nesting depth** (max archive-within-archive levels)
For each: is it measured from the **declared central-directory sizes** (cheap, **spoofable** — a
lying directory passes) or from **actual expansion** (accurate, **expensive**, needs B6)?
*Consequence:* declared-size checks are B5b-1 (now); actual-expansion checks are B5b-2 (gated on
B6).

**7. Signature table.** Fix the exact signatures:
- `%PDF-` for **pdf**
- `PK\x03\x04` **plus inner part-path verification** for the **OOXML trio** — a bare ZIP check
  **cannot distinguish docx from pptx from xlsx from a bomb**; the inner part path
  (`word/`, `ppt/`, `xl/`) is what identifies the real type.
- the **txt / md non-signature rule** (§1.5) — UTF-8 decodability / NUL rejection, **not** a
  signature match.
*Consequence:* the table is only correct if it treats the OOXML trio structurally and txt/md
without a signature; a naive "starts with PK" rule both mis-types and mis-defends.

---

## Section 5 — Required measurement before any user-facing number ships

**Question:** at what file size does the upload **time out** (§1.4)?

**Procedure.** Upload **plain `.txt`** files to a **PREVIEW** deployment. Plain text is used
deliberately: **extracted text ≈ file size**, so the variable is clean. A PDF's file size is
dominated by images and tells you **nothing** about the extracted-text volume that actually drives
chunk count / embed batches / duration.

**Failure-signature table (how to read each result):**

| Observed result | Meaning |
|---|---|
| `200` + a `chunk_count` | **pass** — the file ingested |
| `413` + **Vercel HTML** | the **inbound edge cap** (§1.1) — browser→Next leg |
| `413` + **the app's JSON** message | the **app's own** 50 MB check (`route.ts:52`) |
| `500` + `"Ingestion failed"` | the `!pyResponse.ok` path (`route.ts:161-162`) |
| `504` / no response | **duration** — the ceiling we are actually hunting (§1.4) |

**Cost discipline:** each upload **burns a rate-limit credit** (`enforceLimit('upload')`,
`route.ts:102`) and **consumes the register-#22 free-tier database** (storage + egress). Use a
**throwaway subject** and **delete the rows afterward**.

---

## Cross-references

- **Register #45** — the live duplicate Vercel ingestion service, found and closed this session
  while scoping B5b. Distinct incident; its closure is why decision 5 stresses the leaked-token
  posture.
- **Register #22** — free-tier backend limits; bounds (b2)'s payoff (§3) and §5's test budget.
- **Register #24** — `enforceLimit` charges before the paid call; why `enforceLimit` must not
  move above the body parse (§2.2) and why §5 uploads cost credits.
- **Register #17** — hardcoded English bypassing `t.*`; the same defect class as `route.ts:52`
  (§1.6, site 2).
- **B6 (PIVOT_PLAN §8)** — synchronous ingestion; the gate for every B5b-2 item and for (b1)/(b2).
