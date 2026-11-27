/**
 * UNIVERSAL LINKS, PR 1 OF 2 (big item 4g): the web/server half, no ios/.
 * Study ul-study-a28a444 (report sha256 fb2bfccb...a23a), item 10. Red on
 * main a28a444: none of these files or steps exist there.
 *
 *  1. THE FILE (src/lib/universal-links.ts, served by
 *     src/app/.well-known/apple-app-site-association/route.ts). One details
 *     entry for appID NQ23SMHXJV.com.knowflow.app with exactly ONE component,
 *     the catch-all EXCLUDE: no link opens the app (item 4j, build 9 finding:
 *     the reset mail's link tapped in Gmail for iOS did nothing; #343-#355
 *     included the confirm and reset mails). webcredentials names the same
 *     appID. Nothing else (no appclips, no activitycontinuation). The module
 *     imports nothing, so production-monitor can load it alone from the
 *     commit that is live.
 *  2. THE URL TABLE under Apple's first-match rule ("The first match wins",
 *     applinks.Details.Components), run through BOTH the module's own
 *     aasaMatches() and an independent matcher written here, so a wrong
 *     matcher that agrees with a wrong file cannot pass: every URL stays in
 *     the browser, the confirm and reset mail links first among them, in the
 *     exact shape the live templates send (`&locale=` EMPTY when the account
 *     carries no locale, as on the owner's phone 2026-11-26).
 *  2b. FORCED CASES: the same table run against the five-component file that
 *     was live from #343 to #355 (and against each of its two includes alone)
 *     must FAIL, so a table that cannot see an include coming back is caught.
 *  3. THE ROUTE. force-static; its GET answers 200, application/json, no
 *     Location, and a body equal to the module's object.
 *  4. THE MIDDLEWARE. Its matcher (read from src/middleware.ts) does not
 *     match /.well-known/apple-app-site-association, so no locale 307 can
 *     ever front it; a positive control proves the matcher is read right.
 *  5. THE BANNER. <meta name="apple-itunes-app"> only in
 *     src/app/[locale]/(site)/layout.tsx, as a static metadata export whose
 *     app-id is read from APPLE_APP_APPLE_ID (6820418649), never retyped,
 *     with no app-argument; never under native/ and never in the root
 *     [locale]/layout.tsx (the app's twins share that one); the (site) layout
 *     still reads nothing from the request (it stays prerendered).
 *  6. CI. typecheck.yml runs this script; production-monitor.yml probes the
 *     live file and derives what it expects from the commit Vercel serves.
 *
 * Usage: node --experimental-strip-types scripts/verify-universal-links.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const failures = [];
function check(ok, name, detail = '') {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `  -- ${detail}` : ''}`);
}
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');

installTsxHooks(ROOT);

const APP_ID = 'NQ23SMHXJV.com.knowflow.app';
const CALLBACK = '/api/auth/callback';
const LIB = 'src/lib/universal-links.ts';
const ROUTE = 'src/app/.well-known/apple-app-site-association/route.ts';
const SITE_LAYOUT = 'src/app/[locale]/(site)/layout.tsx';
const ROOT_LAYOUT = 'src/app/[locale]/layout.tsx';

async function load(p) {
  if (!existsSync(resolvePath(ROOT, p))) return null;
  try {
    return await import(pathToFileURL(resolvePath(ROOT, p)).href);
  } catch (e) {
    console.log(`  (import of ${p} threw: ${e.message})`);
    return null;
  }
}

// ---------------------------------------------------------------- 1. the file
console.log('1. the apple-app-site-association object');
const lib = await load(LIB);
const AASA = lib?.AASA;
check(!!AASA && typeof AASA === 'object', `${LIB} exports AASA`);
check(typeof lib?.aasaMatches === 'function', `${LIB} exports aasaMatches(url)`);
check(existsSync(resolvePath(ROOT, LIB)) && !/^\s*import\s/m.test(read(LIB)), `${LIB} imports nothing (production-monitor loads it alone)`);

const details = AASA?.applinks?.details ?? [];
const comps = details[0]?.components ?? [];
check(isDeepStrictEqual(Object.keys(AASA ?? {}).sort(), ['applinks', 'webcredentials']), 'top-level keys are exactly applinks + webcredentials', JSON.stringify(Object.keys(AASA ?? {})));
check(details.length === 1, 'exactly one applinks details entry', `got ${details.length}`);
check(isDeepStrictEqual(details[0]?.appIDs, [APP_ID]), `appIDs is exactly ["${APP_ID}"]`, JSON.stringify(details[0]?.appIDs));
check(details[0] && !('appID' in details[0]) && !('paths' in details[0]), 'no legacy appID / paths keys');
check(comps.length === 1, 'exactly one component', `got ${comps.length}`);

const strip = (c) => { const { comment, ...rest } = c ?? {}; return rest; };
check(isDeepStrictEqual(strip(comps[0]), { '/': '*', exclude: true }), 'the one component is the catch-all exclude', JSON.stringify(strip(comps[0])));
check(comps.every((c) => c?.exclude === true), 'no component is an include (no link opens the app)', JSON.stringify(comps.filter((c) => c?.exclude !== true).map(strip)));
check(comps.length === 1 && typeof comps[0]?.comment === 'string' && comps[0].comment.length > 0, 'the component carries a comment (Apple ignores it)');
check(isDeepStrictEqual(AASA?.webcredentials, { apps: [APP_ID] }), `webcredentials.apps is exactly ["${APP_ID}"]`, JSON.stringify(AASA?.webcredentials));

// ---------------------------------------------------------------- 2. the URL table
console.log('2. the URL table under first-match (module matcher AND an independent one)');
/** Apple's pattern rule: `*` any run (also empty), `?` exactly one character. */
const glob = (pat, s) => new RegExp('^' + pat.split('').map((ch) => (ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&'))).join('') + '$', 's').test(s);
/** Independent of the module: first component that matches decides; none = Safari. Apex https only. */
function independent(urlString, file) {
  const u = new URL(urlString);
  if (u.protocol !== 'https:' || u.hostname !== 'tryknowflow.com' || u.port !== '') return false;
  for (const c of file?.applinks?.details?.[0]?.components ?? []) {
    if (c['/'] !== undefined && !glob(c['/'], u.pathname)) continue;
    const q = c['?'] ?? {};
    // Every named item must be present and match; items the dictionary does not
    // name (locale=) do not stop a match.
    if (!Object.entries(q).every(([k, v]) => u.searchParams.has(k) && glob(v, u.searchParams.get(k)))) continue;
    return c.exclude !== true;
  }
  return false;
}
const H = 'https://tryknowflow.com';
// The mail links first, in every shape the live templates send
// (`&locale={{ .Data.locale }}`, empty for an account with no stored locale).
const MAIL = [
  [`${H}/api/auth/callback?token_hash=pkce_abc123&type=recovery&locale=`, false, 'reset password mail, empty locale= (the build 9 tap)'],
  [`${H}/api/auth/callback?token_hash=pkce_abc123&type=recovery&locale=en`, false, 'reset password mail (en)'],
  [`${H}/api/auth/callback?token_hash=pkce_abc123&type=recovery&locale=ar`, false, 'reset password mail (ar)'],
  [`${H}/api/auth/callback?token_hash=pkce_abc123&type=recovery`, false, 'reset password mail, no locale'],
  [`${H}/api/auth/callback?token_hash=pkce_abc123&type=signup&locale=`, false, 'confirm sign-up mail, empty locale='],
  [`${H}/api/auth/callback?token_hash=pkce_abc123&type=signup&locale=en`, false, 'confirm sign-up mail (en)'],
  [`${H}/api/auth/callback?token_hash=pkce_abc123&type=signup&locale=ar`, false, 'confirm sign-up mail (ar)'],
];
const TABLE = [
  ...MAIL,
  [`${H}/api/auth/callback?code=4f1c2d3e-aaaa-bbbb-cccc-1234567890ab`, false, 'OAuth ?code= return'],
  [`${H}/api/auth/callback?code=abc&token_hash=pkce_x&type=signup`, false, '?code= wins over a token_hash on the same link'],
  [`${H}/api/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid`, false, 'refused link ?error=...&error_code=otp_expired'],
  [`${H}/api/auth/callback?token_hash=pkce_x&type=magiclink`, false, 'token_hash with another type (magiclink)'],
  [`${H}/api/auth/callback?token_hash=&type=signup`, false, 'empty token_hash'],
  [`${H}/api/auth/callback`, false, '/api/auth/callback with no query'],
  [`${H}/en/pricing`, false, '/en/pricing'],
  [`${H}/ar`, false, '/ar'],
  [`${H}/en`, false, '/en'],
  [`${H}/`, false, '/'],
  [`${H}/api/paddle/webhook`, false, '/api/paddle/webhook'],
  [`${H}/en/dashboard?checkout=success&_ptxn=txn_01abc`, false, '/en/dashboard?checkout=... (Paddle return)'],
  [`${H}/en/dashboard`, false, '/en/dashboard'],
  [`${H}/en/reset-password`, false, '/en/reset-password'],
  [`https://www.tryknowflow.com/api/auth/callback?token_hash=pkce_abc123&type=signup&locale=en`, false, 'www host (307s to apex; not in the entitlement)'],
  [`http://tryknowflow.com/api/auth/callback?token_hash=pkce_abc123&type=signup`, false, 'plain http'],
  [`https://tryknowflow.com.evil.example/api/auth/callback?token_hash=x&type=signup`, false, 'look-alike host'],
];
for (const [url, toApp, name] of TABLE) {
  const ind = independent(url, AASA);
  let mod = null;
  try { mod = lib?.aasaMatches ? lib.aasaMatches(url) : null; } catch { mod = 'threw'; }
  check(ind === toApp && mod === toApp, `${name} -> ${toApp ? 'app' : 'Safari'}`, `independent=${ind} module=${mod}`);
}
check(TABLE.every(([, toApp]) => toApp === false), 'every row of the table expects the browser (no row expects the app)');

// ---------------------------------------------------------------- 2b. forced cases
console.log('2b. forced cases: the file live from #343 to #355 must fail this table');
const exc = (q, comment) => ({ '/': CALLBACK, '?': q, exclude: true, comment });
const inc = (type) => ({ '/': CALLBACK, '?': { token_hash: '?*', type }, comment: `${type} mail` });
const all = { '/': '*', exclude: true, comment: 'catch-all' };
const forced = (components) => ({ applinks: { details: [{ appIDs: [APP_ID], components }] }, webcredentials: { apps: [APP_ID] } });
const FORCED = [
  ['the five-component file of #343-#355', forced([exc({ code: '?*' }, 'code'), exc({ error: '?*' }, 'error'), inc('signup'), inc('recovery'), all]), ['reset password mail, empty locale= (the build 9 tap)', 'confirm sign-up mail (en)']],
  ['the recovery include alone', forced([inc('recovery'), all]), ['reset password mail, empty locale= (the build 9 tap)']],
  ['the signup include alone', forced([inc('signup'), all]), ['confirm sign-up mail, empty locale=']],
  ['a bare catch-all include', forced([{ '/': '*', comment: 'everything' }]), ['reset password mail, empty locale= (the build 9 tap)', 'confirm sign-up mail (en)']],
];
for (const [name, file, mustCatch] of FORCED) {
  const caught = MAIL.filter(([url, toApp]) => independent(url, file) !== toApp).map(([, , n]) => n);
  check(mustCatch.every((n) => caught.includes(n)), `${name}: the table sends ${mustCatch.join(' and ')} to the app, so it fails`, `caught=${JSON.stringify(caught)}`);
}

// ---------------------------------------------------------------- 3. the route
console.log('3. the route handler');
const routeSrc = read(ROUTE);
check(!!routeSrc, `${ROUTE} exists`);
check(/export const dynamic = ['"]force-static['"]/.test(routeSrc), 'the route is force-static');
check(/from ['"]@\/lib\/universal-links['"]/.test(routeSrc) && /Response\.json\(\s*AASA\s*\)/.test(routeSrc), 'GET returns Response.json(AASA) from @/lib/universal-links (one source)');
const route = await load(ROUTE);
if (route?.GET) {
  const res = await route.GET();
  const body = await res.json();
  check(res.status === 200, 'GET answers 200', String(res.status));
  check((res.headers.get('content-type') ?? '').startsWith('application/json'), 'GET answers application/json', res.headers.get('content-type'));
  check(res.headers.get('location') === null, 'GET carries no Location (Apple refuses redirects)');
  check(isDeepStrictEqual(body, AASA), 'GET body equals the module object');
} else {
  check(false, 'the route exports GET');
}
check(!existsSync(resolvePath(ROOT, 'public/.well-known/apple-app-site-association')) && !existsSync(resolvePath(ROOT, 'public/apple-app-site-association')), 'no second copy under public/');

// ---------------------------------------------------------------- 4. the middleware
console.log('4. the middleware matcher');
const mw = read('src/middleware.ts');
const m = /matcher:\s*(\[[\s\S]*?\]),?\s*\n\s*\}/.exec(mw);
let matchers = [];
try { matchers = m ? Function(`return ${m[1]};`)() : []; } catch { matchers = []; }
check(matchers.length > 0, 'the matcher array is read from src/middleware.ts', `got ${matchers.length}`);
const hits = (p) => matchers.some((s) => new RegExp(`^${s}$`).test(p));
check(matchers.length > 0 && hits('/en/pricing') && hits('/'), 'positive control: the matcher does match /en/pricing and /');
check(matchers.length > 0 && !hits('/.well-known/apple-app-site-association'), 'the matcher does NOT match /.well-known/apple-app-site-association');

// ---------------------------------------------------------------- 5. the banner
console.log('5. the Smart App Banner');
const site = read(SITE_LAYOUT);
const rules = await load('src/lib/apple-iap/rules.ts');
check(rules?.APPLE_APP_APPLE_ID === 6820418649, 'APPLE_APP_APPLE_ID is 6820418649');
check(/import\s*\{[^}]*\bAPPLE_APP_APPLE_ID\b[^}]*\}\s*from\s*['"]@\/lib\/apple-iap\/rules['"]/.test(site), '(site)/layout.tsx imports APPLE_APP_APPLE_ID');
check(/export const metadata\b/.test(site) && /other:\s*\{[^}]*['"]apple-itunes-app['"]\s*:\s*`app-id=\$\{APPLE_APP_APPLE_ID\}`/.test(site), "(site)/layout.tsx: static metadata.other['apple-itunes-app'] = `app-id=${APPLE_APP_APPLE_ID}`");
check(site && !site.includes('6820418649'), 'the app-id is not retyped in the layout');
check(site && !/app-argument/.test(site), 'no app-argument');
check(site && !/next\/headers|generateMetadata|cookies\(|headers\(/.test(site), '(site)/layout.tsx reads nothing from the request (stays prerendered)');
// Evaluate the metadata expression exactly as written, with the real constant.
const metaExpr = /export const metadata[^=]*=\s*(\{[\s\S]*?\n\});/.exec(site)?.[1];
let meta = null;
try { meta = metaExpr ? Function('APPLE_APP_APPLE_ID', `return (${metaExpr});`)(rules?.APPLE_APP_APPLE_ID) : null; } catch { meta = null; }
check(isDeepStrictEqual(meta, { other: { 'apple-itunes-app': 'app-id=6820418649' } }), "the metadata evaluates to { other: { 'apple-itunes-app': 'app-id=6820418649' } }", JSON.stringify(meta));

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = resolvePath(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(n)) out.push(p);
  }
  return out;
}
const tagged = walk(resolvePath(ROOT, 'src')).filter((p) => readFileSync(p, 'utf8').includes('apple-itunes-app')).map((p) => relative(ROOT, p).replace(/\\/g, '/'));
check(isDeepStrictEqual(tagged, [SITE_LAYOUT]), `apple-itunes-app appears in src/ only in ${SITE_LAYOUT}`, JSON.stringify(tagged));
check(!tagged.some((p) => p.includes('/native/')), 'never under native/');
check(!read(ROOT_LAYOUT).includes('apple-itunes-app') && !read(ROOT_LAYOUT).includes('itunes'), 'never in the root [locale]/layout.tsx (the twins share it)');

// ---------------------------------------------------------------- 6. CI
console.log('6. CI');
const tc = read('.github/workflows/typecheck.yml');
check(/node --experimental-strip-types scripts\/verify-universal-links\.mjs/.test(tc), 'typecheck.yml runs this script');
const pm = read('.github/workflows/production-monitor.yml');
const probe = pm.split(/\n\s*- name: /).find((s) => s.startsWith('Probe GET /.well-known/apple-app-site-association')) ?? '';
check(!!probe, 'production-monitor.yml has an apple-app-site-association probe');
check(/https:\/\/tryknowflow\.com\/\.well-known\/apple-app-site-association/.test(probe), 'it GETs the apex URL');
check(!/curl[^\n]*\s-L\b|--location/.test(probe), 'it never follows a redirect');
check(/application\/json/.test(probe) && /200/.test(probe), 'it requires 200 and application/json');
check(/environment=Production/.test(probe) && /src\/lib\/universal-links\.ts/.test(probe), 'it derives the expected body from the commit Vercel serves (no red between merge and deploy)');
check(/deployments:\s*read/.test(pm), 'the monitor may read deployments (and nothing more)');

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('FAIL: universal links, PR 1 (item 4g):');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: the AASA, its URL table, the route, the matcher, the banner and both CI hooks hold.');
