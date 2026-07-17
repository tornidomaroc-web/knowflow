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
  echo "      Skipped migrations create no objects in the public schema, so they"
  echo "      cannot affect the generated types. This gate therefore covers the"
  echo "      public schema only -- it is not a proof that every migration applies."
fi

# --- Generate ---------------------------------------------------------------
echo "==> Generating types (supabase CLI $SUPABASE_CLI_VERSION)"
npx --yes "supabase@$SUPABASE_CLI_VERSION" gen types typescript \
  --db-url "postgresql://postgres:postgres@127.0.0.1:$PGPORT/postgres" \
  --schema public \
  > "$OUT_FILE.tmp"

mv "$OUT_FILE.tmp" "$OUT_FILE"
echo "==> Wrote $OUT_FILE ($(wc -l < "$OUT_FILE") lines)"
