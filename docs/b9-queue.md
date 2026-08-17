# B9 — running list

**What this file is.** The queue of items ruled in an earlier session but deliberately **not**
executed in the PR that ruled them, because each is a docs correction that does not earn a PR of its
own. B9 is where they land. **An item written here has not happened yet** — that is the whole point
of keeping it separate from `PROGRESS.md` §7, whose blocks record what *did* happen.

Nothing in this file is a claim about production. Nothing here is evidence for any row in
`docs/b1-verification-protocol.md` §10.

---

## How read-back criteria are written here — EARNED 2026-08-17, NOT ABSTRACT

B9-3 below was an empirical round with pre-declared criteria, and **the criteria turned out to be
unsatisfiable by any outcome.** Voiding them retires that round; it does nothing to stop the next set
being written the same way. These three rules are the cost of that, written where the next person to
open an empirical round will hit them. They are deliberately short and checkable — this is a rule,
not a methodology.

1. **Every bucket must be reachable, and the buckets must be exhaustive.** Before the round starts,
   construct one concrete outcome that lands in each bucket, and confirm no possible outcome lands in
   none of them. B9-3's criteria failed both halves: every candidate read window fell in NO bucket.
2. **Do not require two coupled statistics to hold simultaneously without a stated tie-break.** A
   full-cycle mean and a daytime mean are not independent — the first is a mixture containing the
   second. B9-3's NO CHANGE band pinned both, which silently fixed their *ratio* at a value that was
   an artifact of one night's data. If a round genuinely needs two statistics, name which one decides
   when they disagree.
3. **A band inherits the authority of the sample it came from.** Figures computed over ten intervals
   are criteria for a comparison of about ten intervals. Applying them to hundreds asserts a
   stability the sample never demonstrated.

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

## B9-3 ✅ CLOSED 2026-08-17 — the `*/30` round is read; its criteria were void and the honest result is recorded

**READ 2026-08-17** against 248 scheduled runs over 329.8 hours (247 intervals), `*/30` unchanged
since the PR #77 merge at 2026-08-03T13:17Z. The four `workflow_dispatch` runs are excluded from
every interval computation. Full detail and the arithmetic are in the workflow's own cron comment and
in the commit that wrote it (`ab11810`, superseded by this branch's final SHA if it is rebased).

**FINDING 1 — the criteria could not have been satisfied by any outcome, and that is recorded as a
defect rather than re-fitted.** The NO CHANGE band required a full-cycle mean of 95.7–129.5 min
*while* the daytime mean sat at 57.7–78.1 — a full/daytime ratio of **1.23–2.24**. The measured ratio
is **1.10** across all scheduled runs, **1.17** across runs that actually probed, and 1.10–1.17 in
every sub-window on either series. The band was reachable only if overnight delivery stayed as bad as
it was on the single night that produced the baseline, whose three intervals (210.8, 218.7, 225.7)
forced a 1.66 ratio out of ten samples. **Every candidate read window — 24h, 48h, 72h, 96h, 120h,
168h and the full record — landed in NO bucket.** The methodology was validated by reproducing the
documented baseline first: the 16:08:47–22:56:08Z window recomputes to 7 runs, 6 intervals, **67.9
min**, and the full pre-change record to 10 intervals, **112.6 min**. Same code, same answers. The
three rules at the top of this file are what that cost bought.

**FINDING 2 — the answer the round was for, which survives the first.** *The requested rate is not
the binding variable.* With the cron line unchanged, delivery ran **146.1 min** mean over Aug 3–6,
**79.4 min** over Aug 7–14, and **48.2 min** over the final 48 hours — from 10–23% of the requested
48 runs/day to 63–65%. A threefold swing with no input moved dwarfs the 112.6 → 80.1 difference the
round was built to detect, so **no comparison of `*/15` against `*/30` can be read out of this record
at all.** Repo activity does not explain it: five commits landed in the whole window and none on
Aug 14–16, across the step change. Delivery is set inside GitHub and is **not stationary**. **The
question is retired** — a third cron value would measure the drift, not the value.

**NOT REVERTED to `*/15`,** though Aug 3–6 alone read 146.1 and tripped the WORSE threshold below.
Reverting on a window that later regressed to 48.2 would react to a regime rather than to the
setting, and would forfeit the only constant-input series there is.

**FINDING 3 — the worst blind window is 596 min (9.93 h), not any mean, and it is partly self-inflicted.**
2026-08-06T14:29Z → 2026-08-07T00:25Z. Two scheduled runs inside it, `31119684416` (16:23:58Z) and
`31125404749` (18:12:55Z), were **cancelled before they started** — job `probe` cancelled, zero steps,
no probe, no assertion evaluated. They are the only two non-successful scheduled runs in the entire
`*/30` record. **Counting scheduled runs regardless of outcome hides this**: that series reads 372.6
min for the same window, a 60% understatement. **This is now register #60**, because the fix is a
behaviour change to the workflow's concurrency block and not a docs correction — see §4 of
`PROGRESS.md`.

**THE FIGURE THAT REPLACES `15` IN THE B9-2 SITES IS A WORST CASE, NOT A MEAN.** Those four sites were
corrected on 2026-08-10 to `~68 min daytime / ~113 min full-cycle`, which were the *baseline* numbers
and are now superseded. Because delivery is non-stationary, no single mean is durable and quoting one
is what produced two rounds of false claims already. All four now carry **"worst observed blind
window 9.9 h (2026-08-06); typical 50–80 min; non-stationary"**.

---

## B9-3 (original text, retained — this is what was ruled on 2026-08-03)

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

**⚠ RESOLVED 2026-08-17 — read 13 days after it became readable, and 7 days after this row recorded
that it was already overdue.** The round was not lost, but the visible-deferral note above is the only
reason it was not: it survived two intervening sessions as a written row rather than as an intention.
That is the mechanism working, and it is also the second time in this file that "the one thing that
must not happen" nearly happened. The result is in the CLOSED block at the top of this item.

---

## B9-4 ✅ CLOSED 2026-08-17 — the two assertions ship, and they are negative-tested

**CLOSED** by the `ci/b9-4-monitor-embed-model-guard` branch. `embed_provider == "voyage"` and
`embed_model == "voyage-3-large"` now sit beside the existing three assertions in
`.github/workflows/production-monitor.yml`.

**⚠ THE RATIONALE BELOW IS WRONG, AND IT IS CORRECTED RATHER THAN QUIETLY DROPPED — the guard it
justified is still worth keeping.** This row argued that register #56's mutable `FROM python:3.11-slim`
tag plus register #55's rebuild-on-every-push meant *"a dependency resolution that changed the
embedding model while keeping the dimension at 1024"*. **That mechanism does not exist.** The model
is `VOYAGE_MODEL = os.environ.get("VOYAGE_MODEL", "voyage-3-large")` (`services/ingestion/main.py:19`)
and it is sent explicitly as `"model": VOYAGE_MODEL` in a raw `httpx` POST (`:141`). There is no SDK
whose default could shift; **`pip` cannot move that string, and neither can a base-image rebuild.**

**What the guard actually catches, which is real and worth the two lines:** a `VOYAGE_MODEL` or
`EMBEDDING_PROVIDER` environment-variable change on Railway, or an edit to `main.py:19`/`:43` that
ships without the workflow literal moving. Those are config-and-code drift, not dependency drift.

**What nothing catches — now register #59:** `/health` reports a *self-declared string*. If Voyage
repoints `voyage-3-large` server-side, the string is unchanged, `/health` is unchanged, and the
monitor stays green. A per-row model column on `chunks` would not help either — it would record
`voyage-3-large` for both the old and the new weights. See §4 of `PROGRESS.md`.

**A WRONG RATIONALE THAT PRODUCED A CORRECT GUARD IS STILL A RECORD DEFECT.** The claim survived into
a shipped commit message (`d82905d`, immutable), this row, and the workflow's own comment block. Two
of the three are corrected; the commit message cannot be. **A reader who finds the dependency-resolution
argument in `d82905d` should read it against this paragraph.** The lesson is not "the guard was
unnecessary" — it is that the hazard was reasoned about at the wrong layer, and nobody checked the
twenty lines of `main.py` that would have settled it in a minute.

**NEGATIVE-TESTED 2026-08-17 — both assertions proven to fail the job against live production,** on a
scratch branch cut from `d82905d`, one literal flipped per dispatch, branch deleted afterwards. Run
**32019016890** (`embed_model` flipped) and run **32019111049** (`embed_provider` flipped) both FAILED
with `Probe /health` red and the convert probe skipped. **Two dispatches were required, not one:** the
assertions are sequential statements in one `run:` block and a red exits the step, so flipping
`embed_provider` alone would have meant `embed_model` never executed. **The verbatim `::error::` output
of both runs is transcribed in this branch's second commit message, because GitHub deletes these logs
on or about 2026-11-15 and git is the only store that outlives that.**

**WHAT THE NEGATIVE TEST DOES NOT PROVE:** the literal was flipped, not `/health`'s output. It
establishes that the assertions execute, that a false comparison exits non-zero, that the `exit 1`
fires and the annotation renders. It does **not** establish that Railway can produce the
disagreement — no deployment served a wrong model, and none was made to.

---

## B9-4 (original text, retained — this is what was ruled on 2026-08-10, rationale and all)

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
