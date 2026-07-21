#!/usr/bin/env bash
#
# Regenerates supabase/database.types.ts from the SQL migrations in this repo.
#
# Spins up a throwaway Postgres, applies the migrations listed in
# supabase/migration-order.txt, dumps TypeScript types from the resulting
# schema, and destroys the database. Nothing outside the container is touched,
# and no remote Supabase project is contacted -- this never needs a token and
# can never read or mutate production.
#
# Usage:  ./scripts/gen-db-types.sh
#
# The script only ever writes the file. Verification is `git diff --exit-code`
# in CI (.github/workflows/db-types.yml): regenerate, then let git decide. That
# keeps one code path, so what CI checks is exactly what a developer runs.
#
set -euo pipefail

# --- Pinned toolchain -------------------------------------------------------
#
# Both pins are exact and immutable. This is the whole point of the job: an
# unpinned generator turns any upstream release into a spontaneous red main,
# with no commit to this repo, because a formatting change in the emitter is
# indistinguishable from schema drift to `git diff --exit-code`.
#
# Postgres is pinned by DIGEST, not by the 17.6.1.143 tag. Tags are mutable and
# get republished in place, so a tag pin would not actually pin anything. This
# digest is the multi-arch index, so it resolves on both amd64 and arm64.
#
# Stock `postgres:15` CANNOT build this schema (it lacks the Supabase-specific
# roles/extensions 001_initial_schema.sql depends on), so the image is not an
# interchangeable detail -- it is part of the contract.
PG_IMAGE="supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453"

# The CLI is used ONLY for `gen types` here; its migration runner is unusable on
# this repo (see supabase/migration-order.txt).
SUPABASE_CLI_VERSION="2.109.1"

# `gen types` does not talk to Postgres itself: it shells out to
# `docker run public.ecr.aws/supabase/postgres-meta:v0.96.6`. That reference is
# compiled into the CLI binary and is a MUTABLE TAG on a rate-limited anonymous
# registry -- the one dependency of this job that was not pinned, in a job whose
# whole premise (see PG_IMAGE above) is that an unpinned toolchain "turns any
# upstream release into a spontaneous red main, with no commit to this repo."
# A republished v0.96.6 with a changed emitter is indistinguishable from schema
# drift to `git diff --exit-code`, so this pin closes the same hole for the
# second image, not merely a reliability one.
#
# Pinned by the multi-arch INDEX digest, exactly as PG_IMAGE is. The digest is
# byte-identical at Docker Hub and at public.ecr.aws, so this is the SAME image
# fetched over a registry that works: content addressing means docker verifies
# these bytes or fails the pull -- it cannot silently substitute. Docker Hub is
# also already in this script's trust set (PG_IMAGE has no registry prefix, so
# it resolves there), and it succeeded in the very run where ECR answered
# `toomanyrequests: Rate exceeded`.
META_IMAGE="docker.io/supabase/postgres-meta@sha256:a84cc713585eea7b401e4a2561ec4a1e48c87083d1c7ecb4502f204bb4391300"

# The reference the CLI actually asks docker for. It must be BYTE-EXACT: docker
# resolves this string, so a local copy stored only under the docker.io digest
# satisfies neither the registry, the repo path, nor the tag, and the CLI's
# pull-if-missing would go straight back to ECR.
META_TAG="public.ecr.aws/supabase/postgres-meta:v0.96.6"

# COUPLING -- read before bumping SUPABASE_CLI_VERSION. The `v0.96.6` above is
# not a choice we made; it is compiled into CLI 2.109.1. A CLI bump may change
# it, which would leave META_TAG naming an image the new CLI never asks for --
# the retag would go unused and the CLI would silently fall back to pulling from
# ECR. That degrades to today's FLAKINESS, never to a wrong result, but it is
# invisible until the throttle hits. So a CLI bump requires re-deriving the tag
# from the new binary and updating BOTH values here:
#
#     grep -a -o -E "postgres-meta[:@a-zA-Z0-9._/-]{0,40}" \
#       "$(npm root -g)/supabase/bin/supabase"   # or the npx-cached binary

CONTAINER="knowflow-typegen-$$"

# Not 5432: that would collide with a developer's local Postgres. Not 543xx
# either -- Windows/Hyper-V reserves several ranges in there (54309-54408 among
# them) and binding fails with a misleading permissions error. 55433 is clear.
PGPORT="55433"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_DIR="$REPO_ROOT/supabase/migrations"
ORDER_FILE="$REPO_ROOT/supabase/migration-order.txt"
OUT_FILE="$REPO_ROOT/supabase/database.types.ts"

# Always destroy the container, and never leave a half-written .tmp behind: it
# would sit untracked inside supabase/, where `git diff --exit-code` cannot see
# it and a stray `git add` could commit it.
cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f "$OUT_FILE.tmp"
}
trap cleanup EXIT

# --- Manifest vs disk, both directions --------------------------------------
#
# Order comes from the manifest, never from a sort, because a sort of these
# filenames is locale-dependent and inverts ALTER/CREATE and DROP/CREATE pairs
# under en_US.UTF-8. See supabase/migration-order.txt.
manifest_rows() { grep -vE '^\s*(#|$)' "$ORDER_FILE"; }

listed="$(manifest_rows | awk '{print $1}' | LC_ALL=C sort)"
on_disk="$(cd "$MIG_DIR" && ls -1 *.sql | LC_ALL=C sort)"

if [ "$listed" != "$on_disk" ]; then
  echo "ERROR: supabase/migration-order.txt does not match supabase/migrations/*.sql" >&2
  echo "       Every migration must be listed explicitly, with an apply/skip decision." >&2
  diff <(echo "$listed") <(echo "$on_disk") \
    --label "listed in migration-order.txt" --label "present on disk" -u >&2 || true
  exit 1
fi

# --- Skipped migrations: verify, do not assume ------------------------------
#
# The skip in migration-order.txt is keyed on the FILENAME, not on the file's
# content. Nothing stopped a `public`-schema object from being added to a
# skipped file: it would be absent from the generated types while this job --
# a REQUIRED status check -- stayed green. A required check passing on a wrong
# result carries authority it has not earned.
#
# So each skipped file is statically verified: every statement must match a form
# whose target is explicitly qualified to an allowlisted schema (auth, storage).
# The predicate is an ALLOWLIST and it fails closed, which is the whole point --
# an UNQUALIFIED `create table foo` resolves to `public` through search_path and
# contains no `public` token at all, so a token scan would sail past exactly the
# case that matters. See scripts/verify-skipped-migrations.awk for the argument
# in full, including what it deliberately refuses to decide.
#
# This runs HERE, beside the manifest/disk cross-check and BEFORE `docker run`,
# because it is a pure text read: it reds in seconds rather than after a minute
# of Postgres startup and a partial application.
for file in $(manifest_rows | awk '$2 ~ /^skip:/ { print $1 }'); do
  echo "==> Verifying skipped migration $file (targets no public-schema object)"
  awk -v FNAME="supabase/migrations/$file" \
      -f "$REPO_ROOT/scripts/verify-skipped-migrations.awk" \
      "$MIG_DIR/$file" >&2 || exit 1
done

# --- Ephemeral database -----------------------------------------------------
echo "==> Starting ephemeral Postgres ($PG_IMAGE)"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=postgres \
  -p "127.0.0.1:$PGPORT:5432" \
  "$PG_IMAGE" >/dev/null

# Readiness is deliberately NOT `pg_isready` over the default unix socket, and
# this is not a style preference -- it is a real race that produced an
# intermittent failure:
#
#     ERROR: could not open relation with OID 16594
#     CONTEXT: SQL statement "SELECT pg_catalog.nextval('graphql.seq_schema_version')"
#
# While the image initialises, the entrypoint runs a TEMPORARY postgres that
# listens on the unix socket ONLY. `pg_isready` there answers "ready" ~2s before
# the real server exists (measured on this image: unix=ready at t=6s, TCP still
# refused until t=8s). Migrations sent into that window race the image's own
# pgsodium/pg_graphql bootstrap and fail at random. A gate that reds main on a
# coin flip is worse than no gate, because the first instinct is to re-run it.
#
# Two signals, both of which the temporary server cannot fake:
#   1. the init-complete marker in the logs, and
#   2. pg_isready forced over TCP (-h 127.0.0.1), which the temp server does not
#      listen on.
# Checked INSIDE the container: the host's mapped port is answered by
# docker-proxy, which accepts connections before postgres is up and would give a
# false ready. Log-marker matching is safe precisely because the image is pinned
# by digest -- the string cannot drift under us.
# NOTE: the log check below captures into a variable and matches with a bash
# `case`, rather than the obvious `docker logs ... | grep -q`. That obvious form
# is NOT safe under `set -o pipefail` and was observed failing here:
#
#     ==> Waiting for init to complete... ok        <- the loop's grep matched
#     ERROR: Postgres never finished initialising   <- the same check, 0s later
#
# `grep -q` exits the instant it matches, `docker logs` is then killed by SIGPIPE
# and exits 141, and pipefail reports that 141 as the pipeline's status -- so a
# SUCCESSFUL match is reported as failure whenever grep wins the race. It is
# timing-dependent, so it passes repeatedly and then reds main for no reason,
# which is precisely the failure mode this job exists to prevent. No pipe, no
# SIGPIPE, no race.
init_complete() {
  local logs
  logs="$(docker logs "$CONTAINER" 2>&1 || true)"
  case "$logs" in
    *"init process complete"*) return 0 ;;
    *) return 1 ;;
  esac
}

echo -n "==> Waiting for init to complete"
for _ in $(seq 1 90); do
  if init_complete; then
    echo " ok"
    break
  fi
  echo -n "."
  sleep 2
done
init_complete || {
  echo >&2
  echo "ERROR: Postgres never finished initialising. Last log lines:" >&2
  docker logs "$CONTAINER" 2>&1 | tail -20 >&2
  exit 1
}

echo -n "==> Waiting for TCP readiness"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -q 2>/dev/null; then
    echo " ok"
    break
  fi
  echo -n "."
  sleep 2
done
docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres -q

# --- Apply migrations -------------------------------------------------------
#
# ON_ERROR_STOP=1 with no error tolerance anywhere. The one skipped migration is
# never executed rather than executed-and-ignored, so there is no swallowed
# failure to hide behind: if a migration is misordered, this aborts loudly
# instead of quietly generating types for a schema that never existed.
applied=0
skipped=0
while read -r file action; do
  case "$action" in
    apply)
      echo "--> apply $file"
      docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -q \
        < "$MIG_DIR/$file"
      applied=$((applied + 1))
      ;;
    skip:*)
      echo "--> SKIP  $file  (reason: ${action#skip:})"
      skipped=$((skipped + 1))
      ;;
    *)
      echo "ERROR: $file has unknown action '$action' in migration-order.txt" >&2
      exit 1
      ;;
  esac
done < <(manifest_rows)

total=$((applied + skipped))
echo "==> Applied $applied/$total migrations; skipped $skipped"
if [ "$skipped" -gt 0 ]; then
  # Printed on EVERY run, green or red, so a reader of the CI log cannot mistake
  # this for a full application of the migration set.
  echo "==> NOTE: this is a PARTIAL application. Skipped, and why:"
  manifest_rows | awk '$2 ~ /^skip:/ { sub(/^skip:/, "", $2); print "      - " $1 "  (" $2 ")" }'
  echo "      Each file above was STATICALLY VERIFIED before startup: every one of"
  echo "      its statements matched a form whose target is explicitly qualified to"
  echo "      an allowlisted schema (auth, storage), so none of them can create a"
  echo "      public-schema object that the generated types would then be missing."
  echo "      That check is a fail-closed static heuristic over SQL text, not a"
  echo "      proof of application: this gate still covers the public schema only,"
  echo "      and it does not prove that every migration applies."
fi

# --- Generate ---------------------------------------------------------------
#
# Put postgres-meta in the local daemon under the EXACT reference the CLI will
# ask for, before the CLI runs. `docker run` pulls only when the reference is
# not found locally (the CLI does not pass --pull always: its failures print
# "Unable to find image ... locally" first), so a local hit means the CLI never
# contacts ECR at all.
#
# The retag is REQUIRED, not defensive. Pulling by digest stores the image under
# `docker.io/supabase/postgres-meta@sha256:...`; the CLI asks for
# `public.ecr.aws/supabase/postgres-meta:v0.96.6`. Different registry, different
# repo path, no tag -- docker would not match it and would pull from ECR exactly
# as before. Nothing here relies on digest-to-tag back-reference behaviour,
# which varies by daemon version; the alias is created explicitly.
echo "==> Pre-pulling postgres-meta ($META_IMAGE)"
docker pull "$META_IMAGE" >/dev/null
docker tag "$META_IMAGE" "$META_TAG"
echo "--> tagged as $META_TAG (the reference the CLI resolves)"

echo "==> Generating types (supabase CLI $SUPABASE_CLI_VERSION)"
npx --yes "supabase@$SUPABASE_CLI_VERSION" gen types typescript \
  --db-url "postgresql://postgres:postgres@127.0.0.1:$PGPORT/postgres" \
  --schema public \
  > "$OUT_FILE.tmp"

mv "$OUT_FILE.tmp" "$OUT_FILE"
echo "==> Wrote $OUT_FILE ($(wc -l < "$OUT_FILE") lines)"
