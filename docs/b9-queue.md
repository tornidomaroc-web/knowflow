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

## B9-2 — Correct the "every 15 minutes" cadence claims to the MEASURED figure

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
