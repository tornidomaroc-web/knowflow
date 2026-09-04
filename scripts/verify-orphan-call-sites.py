#!/usr/bin/env python3
"""Static verifier for the account-deletion orphan trace (register #54).

Usage:  python scripts/verify-orphan-call-sites.py
Exit 0: every invariant below holds.
Exit 1: rejected; each failure names the invariant and what was found instead.

WHY THIS EXISTS
---------------
`recordDeletionOrphan` is proven against the live table by
scripts/verify-deletion-orphan-recorder.ts. That the two orphan arms in
src/lib/account-deletion/orchestrate.ts actually CALL it cannot be proven the
same way: reaching either arm requires fault injection, which was refused at
both ends of the deletion arc. So those two lines are verified by inspection.

Inspection happens once. This file is the part that happens on every run.

THIS DOES NOT SHRINK THAT GAP, AND MUST NOT BE DESCRIBED AS DOING SO. The gap is
that the arms never execute under verification; a static check executes nothing
either. What it removes is a DIFFERENT failure -- silent drift and omission over
time -- which the gap statement never covered and which is the likelier of the
two to actually bite. The realistic way this breaks is not that today's two
lines are wrong; it is that a future third orphan arm is added by someone who
does not remember any of this, ships without a recorder call, and nothing
notices because the arm cannot be exercised. That is the case this closes.

The precedent is scripts/verify-skipped-migrations.awk (register #40, closed by
PR #62): built for exactly this shape -- an invariant no dynamic test could
reach, so it was machine-checked statically and wired beside the gate, fail
closed. A required check passing on a wrong result is worse than no check, so
every predicate here is written so that ABSENCE fails rather than passes.

LIMITS, STATED RATHER THAN DISCOVERED. This reads text. It proves the call
SITES exist and are shaped correctly; it proves nothing about what happens at
runtime. It skips line comments when hunting for `throw`, which is enough for
this codebase and is not a parser. If it ever disagrees with the compiler, the
compiler is right and this file is the thing to fix.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORCHESTRATE = ROOT / "src" / "lib" / "account-deletion" / "orchestrate.ts"
RECORDER = ROOT / "src" / "lib" / "account-deletion" / "orphan-record.ts"

EXPECTED_ARMS = 2

failures: list[str] = []
notes: list[str] = []


def ok(msg: str) -> None:
    notes.append("  OK    " + msg)


def bad(msg: str) -> None:
    failures.append(msg)
    notes.append("  FAIL  " + msg)


def code_lines(text: str) -> str:
    """Drop comment-only lines. Not a parser; see LIMITS above."""
    kept = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("*") or stripped.startswith("//") or stripped.startswith("/*"):
            continue
        kept.append(line)
    return "\n".join(kept)


def main() -> int:
    for path in (ORCHESTRATE, RECORDER):
        if not path.is_file():
            bad(f"{path.relative_to(ROOT)} is missing")
    if failures:
        return report()

    orch = ORCHESTRATE.read_text(encoding="utf-8")
    rec = RECORDER.read_text(encoding="utf-8")

    # --- the import exists -------------------------------------------------
    if re.search(r"import\s*\{[^}]*\brecordDeletionOrphan\b[^}]*\}\s*from\s*'\./orphan-record'", orch):
        ok("orchestrate.ts imports recordDeletionOrphan")
    else:
        bad("orchestrate.ts does not import recordDeletionOrphan from './orphan-record'")

    # --- exactly the expected number of orphan arms ------------------------
    arms = list(re.finditer(r"return\s*\{[^}]*stage:\s*'orphaned'[^}]*\}", orch))
    if len(arms) == EXPECTED_ARMS:
        ok(f"orchestrate.ts returns stage: 'orphaned' from exactly {EXPECTED_ARMS} arms")
    else:
        bad(
            f"orchestrate.ts has {len(arms)} arms returning stage: 'orphaned', expected {EXPECTED_ARMS}. "
            "A new arm must log, then await recordDeletionOrphan, then return -- and this count must be updated "
            "deliberately, not to make the check pass."
        )

    # --- each arm logs first, then records, then returns -------------------
    cursor = 0
    for i, arm in enumerate(arms, start=1):
        region = orch[cursor:arm.start()]
        cursor = arm.end()

        log = list(re.finditer(r"console\.error\(\s*`\[account-deletion-orphan\][^`]*stage=([a-z-]+)", region))
        call = list(re.finditer(r"await\s+recordDeletionOrphan\(\s*admin\s*,\s*\{", region))

        if not log:
            bad(f"arm {i}: no [account-deletion-orphan] console.error before the return")
        if not call:
            bad(
                f"arm {i}: no AWAITED recordDeletionOrphan(admin, ...) before the return. "
                "A floating promise is dropped on serverless teardown; the await is load-bearing."
            )
        if not log or not call:
            continue

        if log[-1].start() < call[-1].start():
            ok(f"arm {i}: console.error fires before the awaited recordDeletionOrphan")
        else:
            bad(
                f"arm {i}: recordDeletionOrphan is called before the console.error. The log line must fire "
                "FIRST and unconditionally so the durable write can never regress what already existed."
            )

        logged_stage = log[-1].group(1)
        tail = region[call[-1].start():]
        recorded = re.search(r"stage:\s*'([^']+)'", tail)
        if recorded is None:
            bad(f"arm {i}: recordDeletionOrphan call passes no literal stage")
        elif recorded.group(1) == logged_stage:
            ok(f"arm {i}: logged stage and recorded stage agree ({logged_stage})")
        else:
            bad(
                f"arm {i}: logs stage={logged_stage} but records stage='{recorded.group(1)}'. "
                "An operator correlating the log line with the row would be reading two different incidents."
            )

    # --- the recorder still cannot throw and cannot hang -------------------
    if re.search(r"export\s+async\s+function\s+recordDeletionOrphan\b[^{]*Promise<void>", rec):
        ok("recordDeletionOrphan returns Promise<void>, so no caller can branch on it")
    else:
        bad("recordDeletionOrphan no longer returns Promise<void>; a boolean invites an `if` after the boundary")

    if "abortSignal(AbortSignal.timeout(" in rec:
        ok("the insert carries AbortSignal.timeout(...)")
    else:
        bad("the insert no longer carries AbortSignal.timeout(...); an unbounded write can hang the route")

    if re.search(r"\}\s*catch\s*\(", rec):
        ok("the insert is wrapped in catch")
    else:
        bad("the insert is no longer wrapped in catch; a rejection would propagate past the irreversible boundary")

    thrown = [ln for ln in code_lines(rec).splitlines() if re.search(r"\bthrow\b", ln)]
    if thrown:
        bad("orphan-record.ts contains a throw: " + " | ".join(t.strip() for t in thrown))
    else:
        ok("orphan-record.ts contains no throw")

    return report()


def report() -> int:
    print("verify-orphan-call-sites (register #54)")
    for line in notes:
        print(line)
    print("")
    if failures:
        print(f"REJECTED: {len(failures)} invariant(s) violated")
        return 1
    print(f"ALL {len(notes)} INVARIANTS HOLD")
    return 0


if __name__ == "__main__":
    sys.exit(main())
