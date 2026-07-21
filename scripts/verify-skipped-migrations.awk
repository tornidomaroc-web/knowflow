# Static verifier for migrations that supabase/migration-order.txt marks skip:*.
#
# Usage:  awk -v FNAME=<path> -f scripts/verify-skipped-migrations.awk <path>
# Exit 0: every statement matched a verified-safe form.
# Exit 1: rejected; the reason and the offending statement are printed.
#
# WHY THIS EXISTS
# ---------------
# scripts/gen-db-types.sh applies the migrations listed in the manifest to an
# ephemeral Postgres and generates types from the resulting `public` schema. One
# migration is deliberately SKIPPED -- 002_storage.sql targets the `storage`
# schema, which a bare Postgres does not have. That skip is keyed on the
# FILENAME, not on the file's content, so nothing stopped a `public`-schema
# object from being added to a skipped file: it would be silently absent from
# the generated types while `db-types` -- a REQUIRED status check -- stayed
# green. A required check passing on a wrong result is worse than no check.
#
# The script used to PRINT, on every run, "Skipped migrations create no objects
# in the public schema, so they cannot affect the generated types." Nothing
# executed that claim. This program does.
#
# THE PREDICATE IS AN ALLOWLIST, AND IT FAILS CLOSED
# --------------------------------------------------
# Every statement in a skipped file must match one of the forms in SAFE[] below.
# Each of those forms already pins its target to an explicitly-qualified,
# allowlisted schema, so there is no separate "extract the target, then check
# its schema" stage that could disagree with itself. Anything that matches
# nothing is REJECTED -- including, deliberately, forms that are merely
# unrecognised rather than known-bad.
#
# A denylist keyed on the token `public` would be exactly backwards, in BOTH
# directions, which is why this is not one:
#
#   * It would MISS the dangerous case. `create table foo (id int)` resolves to
#     `public` through search_path and contains no `public` token anywhere. That
#     unqualified form is the one that must red, and an allowlist reds it by
#     construction -- it simply matches no SAFE[] pattern.
#
#   * It would FIRE on a harmless one. 002_storage.sql line 1 is
#     `insert into storage.buckets (id, name, public)`, where `public` is the
#     bucket-visibility COLUMN. A token scan reds a provably clean tree on its
#     very first run, and a gate that reds for its own reasons trains people to
#     re-run it.
#
# WHAT THIS IS NOT
# ----------------
# It is a fail-closed STATIC heuristic over SQL text, not a proof of anything.
# Constructs it cannot decide statically -- dollar-quoted bodies ($$ ... $$),
# dynamic SQL, an unterminated literal or comment -- are REJECTED rather than
# guessed at. Refusing to guess is what keeps the result meaningful. The only
# sound proof is execution, and execution is exactly what the skip exists to
# avoid: the storage schema is absent on bare Postgres.

BEGIN {
    # Schemas a skipped migration is allowed to target. Deliberately short.
    # `public` is not here and must never be: an object in `public` is the whole
    # hazard, because a skipped file's public objects are missing from the
    # generated types while the gate reports success.
    SCHEMA = "(auth|storage)"
    QUALIFIED = SCHEMA "\\.[a-z_0-9]+([ (]|$)"

    # Verified-safe statement forms, matched against the SCRUBBED text (see
    # scrub(): lowercased, whitespace-collapsed, comments removed, string
    # literals replaced by `s`, quoted identifiers by `q`).
    #
    # Add a form here only when the pattern itself pins the target to an
    # allowlisted schema. A form that merely "looks safe" does not belong.
    SAFE[1]  = "^insert into " QUALIFIED
    SAFE[2]  = "^update " QUALIFIED
    SAFE[3]  = "^delete from " QUALIFIED
    SAFE[4]  = "^truncate (table )?" QUALIFIED
    SAFE[5]  = "^(create|alter|drop) (policy|trigger|rule) [a-z_0-9]+ on (only )?" QUALIFIED
    SAFE[6]  = "^create (or replace )?(unlogged )?(table|view|materialized view|sequence) (if not exists )?" QUALIFIED
    SAFE[7]  = "^alter (table|view|materialized view|sequence) (if exists )?(only )?" QUALIFIED
    SAFE[8]  = "^drop (table|view|materialized view|sequence) (if exists )?" QUALIFIED
    SAFE[9]  = "^(grant|revoke) [a-z_0-9, ]+ on (table |sequence )?" QUALIFIED
    SAFE[10] = "^create schema (if not exists )?" SCHEMA "$"
    NSAFE = 10

    rejected = 0
}

{ buf = buf $0 "\n" }

END {
    if (FNAME == "") FNAME = "(stdin)"
    scrub()
    if (!rejected) check()
    if (rejected) explain()
    exit (rejected ? 1 : 0)
}

# Record a rejection. Collects rather than exiting, so one run reports every
# problem in the file instead of only the first.
function reject(reason, stmt) {
    if (!rejected) {
        print ""
        print "ERROR: " FNAME " is SKIPPED by supabase/migration-order.txt, but it"
        print "       cannot be shown to leave the `public` schema untouched."
    }
    rejected = 1
    print ""
    print "  - " reason
    if (stmt != "")
        print "        " clip(stmt)
}

# Printed once, after every rejection in the file has been listed.
function explain() {
    print ""
    print "       A skipped migration is NEVER applied to the type-generation"
    print "       database, so anything it puts in `public` would be MISSING from"
    print "       supabase/database.types.ts while db-types stayed green."
    print ""
    print "       Only statements whose target is EXPLICITLY qualified to an"
    print "       allowlisted schema (auth, storage) are accepted. An UNQUALIFIED"
    print "       target resolves to `public` through search_path, so it is"
    print "       rejected even though it contains no `public` token."
    print ""
    print "       Fix one of: qualify the target; move the statement into an"
    print "       applied migration; or -- if the form is genuinely safe and"
    print "       merely unrecognised -- extend SAFE[] in"
    print "       scripts/verify-skipped-migrations.awk, deliberately."
    print ""
}

function clip(s) {
    return (length(s) > 160) ? substr(s, 1, 157) "..." : s
}

# Single pass over the raw file, removing everything that must not be pattern-
# matched: comments (which can contain any word at all) and literals (which can
# contain any word at all, including the name of a table). String literals
# collapse to `s` and quoted identifiers to `q`, so tokenisation stays stable
# and `storage."objects"` still reads as a qualified target (`storage.q`).
#
# Doing this BEFORE splitting on `;` is also what makes the split sound: a `;`
# inside a comment or a literal is already gone by then.
function scrub(   i, n, c, two, depth, rest, closed) {
    n = length(buf)
    sql = ""
    i = 1
    while (i <= n) {
        c   = substr(buf, i, 1)
        two = substr(buf, i, 2)

        if (two == "--") {
            while (i <= n && substr(buf, i, 1) != "\n") i++
            sql = sql " "
            continue
        }

        # Postgres block comments NEST, unlike C. Track depth, or `/* /* */ */`
        # would end early and leak its tail into the matched text.
        if (two == "/*") {
            depth = 1
            i += 2
            while (i <= n && depth > 0) {
                if (substr(buf, i, 2) == "/*") { depth++; i += 2; continue }
                if (substr(buf, i, 2) == "*/") { depth--; i += 2; continue }
                i++
            }
            if (depth > 0) {
                reject("it contains an UNTERMINATED block comment, so its real statement text cannot be determined statically.", "")
                return
            }
            sql = sql " "
            continue
        }

        # Dollar-quoting opens a body this checker will not parse: a function
        # body or a DO block can create anything, anywhere, including through
        # dynamic SQL that does not exist as text at all. Reject, do not guess.
        if (c == "$") {
            rest = substr(buf, i)
            if (match(rest, /^\$\$/) || match(rest, /^\$[A-Za-z_][A-Za-z_0-9]*\$/)) {
                reject("it contains a DOLLAR-QUOTED body ($$ ... $$) -- a function body or DO block. A skipped file containing dynamic SQL cannot be statically verified; apply it or split it.", "")
                return
            }
            sql = sql c
            i++
            continue
        }

        if (c == "'") {
            i++
            closed = 0
            while (i <= n) {
                if (substr(buf, i, 2) == "''") { i += 2; continue }
                if (substr(buf, i, 1) == "'")  { i++; closed = 1; break }
                i++
            }
            if (!closed) {
                reject("it contains an UNTERMINATED string literal, so its real statement text cannot be determined statically.", "")
                return
            }
            sql = sql "s"
            continue
        }

        if (c == "\"") {
            i++
            closed = 0
            while (i <= n) {
                if (substr(buf, i, 2) == "\"\"") { i += 2; continue }
                if (substr(buf, i, 1) == "\"")   { i++; closed = 1; break }
                i++
            }
            if (!closed) {
                reject("it contains an UNTERMINATED quoted identifier, so its real statement text cannot be determined statically.", "")
                return
            }
            sql = sql "q"
            continue
        }

        sql = sql c
        i++
    }
}

function check(   nst, i, j, st, ok) {
    gsub(/[ \t\r\n]+/, " ", sql)
    sql = tolower(sql)

    nst = split(sql, stmts, ";")
    for (i = 1; i <= nst; i++) {
        st = stmts[i]
        sub(/^ +/, "", st)
        sub(/ +$/, "", st)
        if (st == "") continue

        ok = 0
        for (j = 1; j <= NSAFE; j++) {
            if (st ~ SAFE[j]) { ok = 1; break }
        }
        if (!ok)
            reject("this statement matches no verified-safe form:", st)
    }
}
