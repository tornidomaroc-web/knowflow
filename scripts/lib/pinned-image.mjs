/**
 * PINNED IMAGES FROM MORE THAN ONE REGISTRY (CI only).
 *
 * The four Docker-backed required checks (db-types, entitlement-read,
 * entitlement-rls, public-grants) start containers from images pinned by
 * digest. They used to pull them from Docker Hub alone, anonymously, and
 * GitHub's runners share their outbound IPs: on 2026-10-09 every one of those
 * jobs failed three times in 35 minutes on Docker Hub's answers (429
 * "toomanyrequests", then its token service timing out), on a PR that had
 * passed at 20:23 with no change to any of them. ECR Public has refused this
 * repository too (gen-db-types.sh records `toomanyrequests: Rate exceeded`),
 * so trading one anonymous registry for another only moves the lottery.
 *
 * So each image is fetched BY ITS DIGEST from the first of several registries
 * that answers, each tried with backoff between rounds. That is safe because a
 * digest names the content: docker verifies the bytes it receives against it
 * and fails the pull otherwise, so a registry can make a pull fail but cannot
 * make it return anything else. Every source below was checked on 2026-10-09
 * to serve exactly the pinned digest (HTTP 200 for the manifest by digest):
 *
 *   - mirror.gcr.io: Google's public cache of Docker Hub, anonymous, free;
 *   - public.ecr.aws: AWS's public registry. `docker/library/*` is Docker's
 *     own Official Images programme mirrored there; `supabase/*` is
 *     published by Supabase's account (PostgREST included, as
 *     supabase/postgrest, at the same digest);
 *   - docker.io: the original, kept last.
 *
 * No credential is used and none can be added here. An image with no entry in
 * SOURCES is refused, so a new image must be checked on each registry first.
 *
 * The image is then tagged under a LOCAL name that names no registry at all
 * (`kf-ci-pinned/<repo>:<first 12 hex of the digest>`), and the scripts run
 * that name: `docker run` finds it locally and contacts no registry.
 *
 * Usage, from a script: `const local = pullPinned('supabase/postgres@sha256:…')`.
 * From a shell: `local=$(node scripts/lib/pinned-image.mjs 'supabase/postgres@sha256:…')`.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// repository (as the scripts name it) -> the same repository on each registry,
// in the order they are tried.
export const SOURCES = {
  'supabase/postgres': ['mirror.gcr.io/supabase/postgres', 'public.ecr.aws/supabase/postgres', 'docker.io/supabase/postgres'],
  'supabase/postgres-meta': ['mirror.gcr.io/supabase/postgres-meta', 'public.ecr.aws/supabase/postgres-meta', 'docker.io/supabase/postgres-meta'],
  'postgrest/postgrest': ['mirror.gcr.io/postgrest/postgrest', 'public.ecr.aws/supabase/postgrest', 'docker.io/postgrest/postgrest'],
  postgres: ['mirror.gcr.io/library/postgres', 'public.ecr.aws/docker/library/postgres', 'docker.io/library/postgres'],
};

const ROUNDS = 3;
const BACKOFF_S = [0, 15, 45];

const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);
const docker = (args, timeoutS = 600) =>
  spawnSync('docker', args, { encoding: 'utf8', timeout: timeoutS * 1000 });

/** `supabase/postgres@sha256:…` or `postgres:16.15-alpine@sha256:…` -> { repo, digest }. */
export function parsePinned(ref) {
  const m = /^(?:docker\.io\/)?([a-z0-9._/-]+?)(?::[A-Za-z0-9._-]+)?@(sha256:[0-9a-f]{64})$/.exec(ref);
  if (!m) throw new Error(`not a digest-pinned image reference: ${ref}`);
  return { repo: m[1], digest: m[2] };
}

export function localName(ref) {
  const { repo, digest } = parsePinned(ref);
  return `kf-ci-pinned/${repo.replace(/[^a-z0-9]+/g, '-')}:${digest.slice(7, 19)}`;
}

export function pullPinned(ref, log = (s) => console.error(s)) {
  const { repo, digest } = parsePinned(ref);
  const sources = SOURCES[repo];
  if (!sources) throw new Error(`${repo} has no checked sources in scripts/lib/pinned-image.mjs`);
  const local = localName(ref);
  if (docker(['image', 'inspect', local], 60).status === 0) return local;
  const tried = [];
  for (let round = 0; round < ROUNDS; round++) {
    if (BACKOFF_S[round]) {
      log(`    waiting ${BACKOFF_S[round]} s before round ${round + 1}`);
      sleep(BACKOFF_S[round]);
    }
    for (const src of sources) {
      const full = `${src}@${digest}`;
      const r = docker(['pull', '--quiet', full]);
      if (r.status === 0) {
        if (docker(['tag', full, local], 60).status !== 0) throw new Error(`could not tag ${full} as ${local}`);
        log(`==> ${repo}@${digest.slice(0, 19)} from ${src} (round ${round + 1}) as ${local}`);
        return local;
      }
      const why = ((r.stderr || r.stdout || '').trim().split('\n').pop() || `exit ${r.status}`).slice(0, 200);
      tried.push(`${src}: ${why}`);
      log(`    ${src}: ${why}`);
    }
  }
  throw new Error(`no registry served ${repo}@${digest} after ${ROUNDS} rounds:\n  ${tried.join('\n  ')}`);
}

// Shell use: print the local name on stdout, the log on stderr.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.stdout.write(pullPinned(process.argv[2]) + '\n');
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
