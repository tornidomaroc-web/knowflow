/**
 * Executable proof for the regression that PR #128's landing() would have
 * shipped the moment the recovery email template is flipped to `token_hash`.
 *
 * WHY THIS EXISTS AS A SCRIPT RATHER THAN AN HTTP TEST. The route only reaches
 * this decision AFTER a live `verifyOtp` or code exchange succeeds. Neither can
 * be minted without sending a real password-reset mail, and the one unused
 * reset link in existence belongs to the owner and has not been clicked. So the
 * cross-device shape is unreachable over HTTP without spending something real.
 * The decision itself is reachable, and this drives the REAL module rather than
 * a copy: it imports `src/lib/auth/recovery-landing.ts` directly, which is the
 * same module `src/app/api/auth/callback/route.ts` imports.
 *
 * THE DEFECT. Before this change the destination was chosen from the
 * `kf_recovery` cookie alone. That cookie is written by the forgot-password
 * page, so it exists only in the browser that ASKED for the mail. Today that is
 * harmless, because the link is `pkce_` prefixed and the exchange fails on any
 * other device anyway. It stops being harmless the instant the template emits a
 * `token_hash` link: `verifyOtp` needs no verifier, so a phone opening a
 * laptop's reset mail would SUCCEED, find no cookie, and be sent to the
 * dashboard -- signed in, with the forgotten password still in place and
 * nothing on screen saying so. Worse than today's honest failure.
 *
 * THE FIX. `type=recovery` travels in the link, so it survives the trip to
 * another device. It is authoritative; the cookie is only the fallback for the
 * code arm, which carries no type back.
 *
 * Case 4 below is a deliberate, documented outcome rather than an oversight: a
 * user holding a live recovery cookie who clicks a SIGNUP link lands on the
 * reset form. Harmless (they can set a password or cancel) and it keeps the
 * rule to one sentence.
 */
import { resolveLandingPath } from '../src/lib/auth/recovery-landing.ts';

/** The logic this replaces, kept here so the regression is DEMONSTRATED and not
 *  merely asserted. If these two ever agree on case 1, the fix is gone. */
function oldLandingPath({ hasRecoveryCookie }) {
  return hasRecoveryCookie ? '/reset-password' : '/dashboard';
}

const CASES = [
  { name: 'recovery link, NO cookie (CROSS-DEVICE)', otpType: 'recovery', hasRecoveryCookie: false, want: '/reset-password', regression: true },
  { name: 'recovery link, cookie present (same device)', otpType: 'recovery', hasRecoveryCookie: true,  want: '/reset-password' },
  { name: 'signup link, no cookie', otpType: 'signup', hasRecoveryCookie: false, want: '/dashboard' },
  { name: 'signup link, cookie present (documented)', otpType: 'signup', hasRecoveryCookie: true,  want: '/reset-password' },
  { name: 'code arm (no type), no cookie: OAuth', otpType: null, hasRecoveryCookie: false, want: '/dashboard' },
  { name: 'code arm (no type), cookie: same-device reset', otpType: null, hasRecoveryCookie: true,  want: '/reset-password' },
];

let pass = 0;
const failures = [];

console.log('');
console.log('  resolveLandingPath, driven from src/lib/auth/recovery-landing.ts');
console.log('  ' + '-'.repeat(76));

for (const c of CASES) {
  const got = resolveLandingPath({ otpType: c.otpType, hasRecoveryCookie: c.hasRecoveryCookie });
  const ok = got === c.want;
  if (ok) pass += 1; else failures.push(`${c.name}: wanted ${c.want}, got ${got}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${c.name.padEnd(46)} -> ${got}`);
}

// The regression case must ALSO differ from the old behaviour, or this file is
// proving nothing.
const r = CASES.find((c) => c.regression);
const oldGot = oldLandingPath({ hasRecoveryCookie: r.hasRecoveryCookie });
const newGot = resolveLandingPath({ otpType: r.otpType, hasRecoveryCookie: r.hasRecoveryCookie });
const demonstrated = oldGot === '/dashboard' && newGot === '/reset-password';
if (demonstrated) pass += 1;
else failures.push('the regression case no longer differs from the old logic');

console.log('  ' + '-'.repeat(76));
console.log(`  ${demonstrated ? 'OK  ' : 'FAIL'}  ${'cross-device: old logic vs new'.padEnd(46)} -> old=${oldGot} new=${newGot}`);
console.log('');
console.log(`  ${pass} passed, ${failures.length} failed, ${CASES.length + 1} total`);
for (const f of failures) console.log('  ! ' + f);
console.log('');

process.exit(failures.length === 0 ? 0 : 1);
