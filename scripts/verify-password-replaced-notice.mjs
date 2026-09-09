/**
 * Executable proof for the notice shown to a user whose password GoTrue
 * destroyed when they signed in with Google.
 *
 * Run: node --experimental-strip-types scripts/verify-password-replaced-notice.mjs
 *
 * WHY THIS EXISTS AS A SCRIPT RATHER THAN AN HTTP TEST. Reaching the real
 * branch over HTTP costs a Google account, an unconfirmed signup against
 * production, and a password typed into a provider. That is exactly the run
 * that was retired: the linking behaviour was settled from GoTrue source at the
 * deployed version instead, and no owner should ever have to produce an account
 * to re-establish it. What remains testable is OUR decision, and this drives the
 * REAL module: it imports `src/lib/auth/password-replaced.ts`, the same module
 * `src/app/api/auth/callback/route.ts` imports.
 *
 * WHAT IT HAS TO PROVE. Not that the function returns true somewhere. That the
 * two shapes which look IDENTICAL on provider are told DIFFERENT things:
 *
 *   the harmed user     one google identity, minted long after the user row
 *   a fresh Google user one google identity, minted WITH the user row
 *
 * Both have no email identity. A check on provider absence alone returns true
 * for both and would tell a first-time Google user that a password they never
 * had has stopped working. `naiveNoEmailIdentity` below is that check, kept here
 * so the discrimination is DEMONSTRATED and not merely asserted. If it ever
 * agrees with the real function on both shapes, this file is proving nothing.
 */
import {
  detectPasswordReplaced,
  IDENTITY_AGE_GAP_MS,
} from '../src/lib/auth/password-replaced.ts';

/** The check this rejects: "no email identity" and nothing else. */
function naiveNoEmailIdentity(user) {
  if (!user?.identities?.length) return false;
  return !user.identities.some((i) => i.provider === 'email');
}

const T0 = Date.parse('2026-09-09T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

/** A user row plus the identities GoTrue would have left standing. */
const user = (userCreatedMs, identities) => ({
  id: '00000000-0000-0000-0000-000000000000',
  created_at: iso(userCreatedMs),
  identities: identities.map(([provider, createdMs]) => ({
    provider,
    created_at: createdMs === null ? undefined : iso(createdMs),
  })),
});

const DAYS = 86_400_000;

const CASES = [
  {
    name: 'HARMED: password user, google 3 days later',
    user: user(T0, [['google', T0 + 3 * DAYS]]),
    want: true,
    shape: 'harmed',
  },
  {
    name: 'FRESH: google signup, both minted together',
    user: user(T0, [['google', T0]]),
    want: false,
    shape: 'fresh',
  },
  {
    name: 'FRESH: google signup, 200ms transaction jitter',
    user: user(T0, [['google', T0 + 200]]),
    want: false,
  },
  {
    name: 'HARMED: the impatient case, gap of 5 minutes',
    user: user(T0, [['google', T0 + 5 * 60_000]]),
    want: true,
  },
  {
    name: 'email+password user, email identity standing',
    user: user(T0, [['email', T0]]),
    want: false,
  },
  {
    name: 'CONFIRMED user who linked google (email survives)',
    user: user(T0, [['email', T0], ['google', T0 + 3 * DAYS]]),
    want: false,
  },
  {
    name: 'boundary: gap exactly at the threshold',
    user: user(T0, [['google', T0 + IDENTITY_AGE_GAP_MS]]),
    want: false,
  },
  {
    name: 'boundary: gap one ms over the threshold',
    user: user(T0, [['google', T0 + IDENTITY_AGE_GAP_MS + 1]]),
    want: true,
  },
  { name: 'no identities at all', user: user(T0, []), want: false },
  {
    name: 'identity created_at missing (fail closed)',
    user: user(T0, [['google', null]]),
    want: false,
  },
  {
    name: 'user created_at unparseable (fail closed)',
    user: { created_at: 'not-a-date', identities: [{ provider: 'google', created_at: iso(T0) }] },
    want: false,
  },
  { name: 'null user', user: null, want: false },
];

let pass = 0;
const failures = [];

console.log('');
console.log('  detectPasswordReplaced, driven from src/lib/auth/password-replaced.ts');
console.log('  ' + '-'.repeat(76));

for (const c of CASES) {
  const got = detectPasswordReplaced(c.user);
  const ok = got === c.want;
  if (ok) pass += 1;
  else failures.push(`${c.name}: wanted ${c.want}, got ${got}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${c.name.padEnd(52)} -> ${got}`);
}

// ---------------------------------------------------------------------------
// The load-bearing half: the two shapes must be told DIFFERENT things, and the
// naive check must fail to separate them.
// ---------------------------------------------------------------------------
const harmed = CASES.find((c) => c.shape === 'harmed').user;
const fresh = CASES.find((c) => c.shape === 'fresh').user;

const shown = (u) =>
  detectPasswordReplaced(u)
    ? 'BANNER: your password no longer works, set a new one'
    : 'nothing, straight to the dashboard';

console.log('  ' + '-'.repeat(76));
console.log('  What each shape is actually told');
console.log(`    harmed user          ${shown(harmed)}`);
console.log(`    fresh google signup  ${shown(fresh)}`);

const separated =
  detectPasswordReplaced(harmed) === true && detectPasswordReplaced(fresh) === false;
if (separated) pass += 1;
else failures.push('the two shapes are no longer told different things');

const naiveHarmed = naiveNoEmailIdentity(harmed);
const naiveFresh = naiveNoEmailIdentity(fresh);
const naiveConflates = naiveHarmed === true && naiveFresh === true;
if (naiveConflates) pass += 1;
else failures.push('the naive check no longer conflates the two shapes, so this proves nothing');

console.log('  ' + '-'.repeat(76));
console.log(`  ${separated ? 'OK  ' : 'FAIL'}  ${'age gap separates the two shapes'.padEnd(52)} -> harmed=${detectPasswordReplaced(harmed)} fresh=${detectPasswordReplaced(fresh)}`);
console.log(`  ${naiveConflates ? 'OK  ' : 'FAIL'}  ${'provider absence alone CONFLATES them'.padEnd(52)} -> harmed=${naiveHarmed} fresh=${naiveFresh}`);
console.log('');
console.log(`  ${pass} passed, ${failures.length} failed, ${CASES.length + 2} total`);
for (const f of failures) console.log('  ! ' + f);
console.log('');

process.exit(failures.length === 0 ? 0 : 1);
