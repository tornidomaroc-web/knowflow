# B9 — running list

**What this file is.** The queue of items ruled in an earlier session but deliberately **not**
executed in the PR that ruled them, because each is a docs correction that does not earn a PR of its
own. B9 is where they land. **An item written here has not happened yet** — that is the whole point
of keeping it separate from `PROGRESS.md` §7, whose blocks record what *did* happen.

Nothing in this file is a claim about production. Nothing here is evidence for any row in
`docs/b1-verification-protocol.md` §10.

---

## B9-1 — Set Railway **Watch Paths** to `services/ingestion/**`, AFTER PR C merges

**Ruled** 2026-08-02, `docs/b1-verification-protocol.md` §9.1 (which supersedes §9's "between B and
C" placement). **Register #55.**

Not a docs line — a dashboard change plus a two-direction empirical test, both directions mandatory:
one no-op commit under `services/ingestion/` (expect a deploy) **and** one touching only `docs/`
(expect none). The negative push is what distinguishes "pattern active" from "pattern silently
discarded"; without it the positive test passes on a pattern that does nothing. Record deployment
ID, commit SHA, trigger label and duration for each push, read from Railway's deployment list.

---

## B9-2 ✅ CLOSED 2026-08-10 — Correct the "every 15 minutes" cadence claims to the MEASURED figure

**CLOSED by the N11 docs PR.** All four `b1-verification-protocol.md` sites now carry the measured
figure instead of 15, and the immutable `PROGRESS.md:217` site is superseded by the new 2026-08-10 §7
block rather than edited — the mechanism this row specified, used exactly as specified. **Line numbers
in the table below had drifted by PR #78's +360 lines and were re-located by content, not by number,
which is the same failure mode §2.1's line-reference drift note records.**

**Why it closed here rather than in its own PR:** the N11 PR already edits this file and already
writes the superseding §7 block that the `PROGRESS.md` site requires. Leaving four known-false
sentences in place **inside the very PR whose §7 block records the sixth instance of false claims
surviving in records** was not defensible.

**Opened** 2026-08-03 by the `*/30` change to `.github/workflows/production-monitor.yml`.

The workflow **requested** `*/15`. It **delivered** a mean interval of **67.9 minutes across the
2026-08-02 daytime window** (16:08–23:59Z, 7 runs, range 60.8–76.6) and **112.6 minutes across the
full 18.8-hour record** (11 runs to 2026-08-03T10:54:36Z), with three overnight intervals of
210.8–225.7 minutes. **`~70 minutes` is a measurement, not an estimate, and must be written as one.**
Every site below states or implies 15.

| Site | Current text | Note |
|---|---|---|
| `b1-verification-protocol.md:772` (§9.1) | "reds within **one tick — at most ~15 minutes**" | "at most" was never true even at `*/15`; with `*/30` requested it is further off |
| `b1-verification-protocol.md:866` (§10 preamble) | "re-asserts all three **every 15 minutes**" | |
| `b1-verification-protocol.md:903` (V1 evidence cell) | "Re-asserted every 15 min since 14:59Z" | |
| `b1-verification-protocol.md:908` (N9 evidence cell) | same claim | |
| `PROGRESS.md:217` (§7, 2026-08-02 block) | "every 15 minutes", twice | **§7 blocks are immutable.** This one is corrected by a **new** §7 block that supersedes the figure, never by editing the block. Same mechanism the 2026-08-02 block used on the 2026-07-23 entry. |

**Why this rides in B9 rather than in its own PR:** it changes no behaviour and gates nothing. The
one place the correction could not wait is the workflow file itself, where a `# Every 15 minutes`
comment sitting above a `*/30` line would have been a false statement introduced by the very commit
that made it false. That comment was corrected in place.

---

## B9-3 — Read back the `*/30` empirical round and record the result, whichever way it goes

**Opened** 2026-08-03 with B9-2. The baseline is B9-2's table. Compare **like windows** — the
diurnal effect (≈68 min daytime vs ≈220 min overnight) is larger than the effect being tested, so a
short or badly-placed comparison window can produce either answer by accident.

Read after **≥ 19 hours** of `*/30` scheduling covering a full day+night cycle (≥ 10 intervals):

- **IMPROVEMENT** — full-cycle mean **≤ 45 min** *and* daytime-window mean **≤ 45 min**. Reading:
  the requested rate was the binding constraint; asking for less got more.
- **NO CHANGE** — full-cycle mean within ±15% of **112.6 min** *and* daytime mean within ±15% of
  **67.9 min**. Reading: delivery is independent of the requested rate, GitHub's scheduler sets the
  detection window and the cron expression does not. **This is a finding, and it gets written down
  in the same words as an improvement would.** It also retires the idea, so nobody re-runs it.
- **WORSE** — full-cycle mean above 130 min. Revert to `*/15` (which costs nothing on a public repo)
  and record that lowering the request made delivery worse.

Whatever the outcome, the honest number replaces the 15 in every B9-2 site. The one thing that must
not happen is the round being run and quietly not read.

**⚠ OVERDUE AS OF 2026-08-10.** `*/30` has been live since the PR #77 merge on 2026-08-03T13:17Z, so
the ≥19-hour window opened on **2026-08-04 ~08:00Z** and this round has now been readable for **six
days without being read** — against a row whose own closing sentence is *"the one thing that must not
happen is the round being run and quietly not read."* **B9-2's sites were corrected on 2026-08-10 using
the BASELINE figures, not the `*/30` result**, because the result does not exist yet; when B9-3 is read,
whichever way it goes, those same four sites take the final number. Recorded here rather than silently
left, because a deferral that is not visible is indistinguishable from a decision.

---

## B9-4 — `production-monitor` does not assert `embed_provider` or `embed_model`

**Opened** 2026-08-10 while preparing N11's pre-upload drift check.

The workflow asserts `ok == true` (`:115`), `embed_dim == 1024` (`:123`) and
`supabase_configured == true` (`:131`). It **never checks `embed_provider` or `embed_model`.**

**Why that gap has teeth rather than being pedantry:** register **#56** leaves `FROM python:3.11-slim`
a **mutable tag** with **no transitive pins**, and register **#55** rebuilds the image on every push to
`main`. A dependency resolution that changed the embedding **model** while keeping the **dimension** at
1024 would write vectors from a different model into the same `vector(1024)` column, pass all three
monitor assertions, and silently degrade retrieval against every chunk already stored. The dimension
check catches a dimension change; **nothing catches a model swap.**

N11's pre-upload read compared all four fields **by hand** against the pre-merge capture and they were
byte-identical — but that was a human diffing two strings in a chat window, which is not a standing
check and does not survive the session.

**The fix is two `jq -e` lines beside the existing three**, pinning `embed_provider == "voyage"` and
`embed_model == "voyage-3-large"`. **It is deliberately NOT done here:** it edits
`.github/workflows/production-monitor.yml`, and this is a docs-only PR. **It should not wait for B9** —
see the closing recommendation in the N11 PR: it is the cheapest standing guard against the one hazard
**N10's digest pin is otherwise the only defence for**, and N10 is not due until PR C.
