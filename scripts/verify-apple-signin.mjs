/**
 * SIGN IN WITH APPLE, PR 1 OF 2 (big item 4f): web, server, strings. The
 * study is D:\Temp\kf-research\siwa-study-daf888c\report.md (sha256
 * 3c25f049...86d1cd), approved by the owner with one addition (item 4: an
 * Apple account confirms deletion with a fresh Apple authorization instead
 * of typing a relay address). No network, no credential, no database, no
 * app. Red on main: the modules below do not exist there.
 *
 *  1. THE GATE. appleBridge() is null on the web (no window.Capacitor), for a
 *     forged `KnowFlowApp/2` in a browser, in the Android shell, in an iOS
 *     shell without the plugin, at shell 0 and 1 even with the plugin, and
 *     when the bridge lacks nativePromise. With all of them it calls
 *     `KnowFlowApple` and nothing else.
 *  2. THE NONCE. makeNonce(): a raw 43-character base64url value from 32
 *     random bytes, and `hashed` = SHA-256 hex of the raw (node:crypto's
 *     answer); two calls differ.
 *  3. SIGN-IN. signInWithApple() gives the plugin the HASH and Supabase the
 *     RAW nonce, provider `apple`, the identity token; a first sign-in with a
 *     name writes it (metadata and the profile row, never over an existing
 *     name, never the plan); Cancel calls nothing; every failure is 'failed';
 *     no token reaches a log.
 *  4. THE REVOKE LIBRARY (src/lib/auth/apple-revoke.ts). The ES256 client
 *     secret, signed with a key made here and thrown away: header, claims,
 *     5-minute expiry, a signature node:crypto verifies. The exchange's
 *     request and every refusal: wrong sub, expired or used code, wrong
 *     audience or issuer, stale token, nonce mismatch, missing env, a bad key,
 *     a network error and a timeout (the default is 5 s). The revoke's request
 *     and outcomes. Nothing throws.
 *  5. THE ROUTE (DELETE /api/account), with the session, the admin client,
 *     Paddle and the orchestrator stubbed:
 *     (a) an account WITHOUT an Apple identity: every arm answers the exact
 *         bytes main answers (status, body, Cache-Control), and an Apple code
 *         in the body is ignored: no fetch, no deletion. `--against <file>`
 *         runs this matrix on another copy of the route (main's) to show the
 *         bytes are the same.
 *     (b) an Apple account: a fresh code whose sub matches confirms in place
 *         of the typed email, the exchange runs BEFORE the deletion and the
 *         revoke AFTER it; wrong sub, expired or used code, missing env and a
 *         timeout each refuse without deleting; the typed email still works
 *         (`skipped`); a failed deletion revokes nothing; a failed revoke
 *         still answers deleted. One log line per outcome, no token in it.
 *  6. THE CARD. DeleteAccountCard rendered on the server: an account without
 *     Apple gets no Apple line and posts `{ confirmEmail }` only (read from
 *     source); the Apple account's preview states draw the step, the
 *     fallback and the not-revoked line.
 *  7. THE SOURCES. providers.ts and NEXT_PUBLIC_APPLE_SIGNIN gone from src;
 *     OAuthProvider is 'google'; no `startOAuth('apple')`; Apple is FIRST on
 *     /login and /signup; the button carries Apple's own logo path (sha256
 *     below, from Apple Design Resources); the settings page passes the Apple
 *     identity and the server's readiness; the privacy page names Apple.
 *  8. THE STRINGS. Every key in docs/copy-drafts/siwa_v1.md is, byte for
 *     byte, the dictionary's value in both languages; no em dash, Western
 *     digits, no hit of the app's wording rule; auth.appleFailed retired.
 *
 * Usage: node --experimental-strip-types scripts/verify-apple-signin.mjs [--against <route.ts>]
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { kfWording } from './lib/app-wording.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const AGAINST = argv.includes('--against') ? resolvePath(argv[argv.indexOf('--against') + 1]) : null;

let pass = 0;
const failures = [];
function check(ok, name, detail = '') {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `  -- ${detail}` : ''}`);
}
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');
const has = (p) => existsSync(resolvePath(ROOT, p));
const sha = (s) => createHash('sha256').update(s).digest('hex');

// Every console line of the run is kept: no token, code or key may appear in one.
const LOGGED = [];
for (const k of ['log', 'error', 'warn', 'info']) {
  const real = console[k].bind(console);
  console[k] = (...a) => {
    LOGGED.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
    if (k === 'log' && /^\s{2}(OK|FAIL)|^\n?(\d+ passed|---)/.test(String(a[0]))) real(...a);
  };
}

// ── stubs ───────────────────────────────────────────────────────────────────
const S = (globalThis.__siwa = { user: null, calls: [], deleteResult: null, fetch: null });
installTsxHooks(ROOT, {
  '@/lib/supabase/server': `export async function createClient() {
    return { auth: { getUser: async () => ({ data: { user: globalThis.__siwa.user } }) } };
  }`,
  'next/server': `export class NextRequest extends Request {}
  export class NextResponse extends Response {
    static json(body, init = {}) {
      return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
    }
  }`,
  '@supabase/supabase-js': `export function createClient() { return { admin: true }; }`,
  '@/lib/paddle': `export const paddleClient = { paddle: true };`,
  '@/lib/account-deletion/orchestrate': `
  export async function deleteAccount(admin, paddle, id, email) { globalThis.__siwa.calls.push('delete:' + id + ':' + email); return globalThis.__siwa.deleteResult; }
  export function deletionFailed(r) { return !r.ok; }`,
  '@/lib/supabase/client': `export function createClient() { return globalThis.__siwa.browser; }`,
});
globalThis.fetch = (...a) => {
  S.calls.push('fetch:' + String(a[0]));
  if (!S.fetch) throw new Error('fetch called with no stub');
  return S.fetch(...a);
};

async function load(p) {
  try {
    return await import(pathToFileURL(resolvePath(ROOT, p)).href);
  } catch (e) {
    check(false, `${p} loads`, String(e.message).slice(0, 160));
    return null;
  }
}

// ── 1. the gate ─────────────────────────────────────────────────────────────
const bridgeMod = await load('src/lib/auth/apple-bridge.ts');
const UA0 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const fakeCapacitor = ({ native = true, platform = 'ios', plugins = ['KnowFlowApple'], promise = true } = {}) => {
  const calls = [];
  const C = {
    isNativePlatform: () => native,
    getPlatform: () => platform,
    isPluginAvailable: (n) => plugins.includes(n),
    nativePromise: promise ? (p, m, o) => { calls.push([p, m, o]); return Promise.resolve({ available: true }); } : undefined,
  };
  return { C, calls };
};
if (bridgeMod) {
  const { appleBridge, APPLE_PLUGIN, appleShellAllowed } = bridgeMod;
  const run = (cap, ua) => {
    globalThis.Capacitor = cap?.C;
    const b = appleBridge(ua);
    delete globalThis.Capacitor;
    return b;
  };
  check(APPLE_PLUGIN === 'KnowFlowApple', 'the plugin is KnowFlowApple');
  check(appleShellAllowed(2) && appleShellAllowed(3) && !appleShellAllowed(1) && !appleShellAllowed(0) && !appleShellAllowed(NaN), 'the shell gate is 2 on, never 0 or 1');
  check(run(null, `${UA0} KnowFlowApp/2`) === null, 'gate: a forged KnowFlowApp/2 in a browser (no window.Capacitor) gets no button');
  check(run(fakeCapacitor(), UA0) === null, 'gate: the web (shell 0) with a bridge gets no button');
  check(run(fakeCapacitor(), `${UA0} KnowFlowApp/1`) === null, 'gate: build 8 (shell 1) with the plugin gets no button');
  check(run(fakeCapacitor({ platform: 'android' }), `${UA0} KnowFlowApp/2`) === null, 'gate: the Android shell (KnowFlowApp/2) gets no button');
  check(run(fakeCapacitor({ plugins: ['KnowFlowStore', 'KnowFlowSpeech'] }), `${UA0} KnowFlowApp/2`) === null, 'gate: shell 2 without the plugin (build 9 before PR 2) gets no button');
  check(run(fakeCapacitor({ native: false }), `${UA0} KnowFlowApp/2`) === null, 'gate: isNativePlatform() false gets no button');
  check(run(fakeCapacitor({ promise: false }), `${UA0} KnowFlowApp/2`) === null, 'gate: a bridge without nativePromise gets no button');
  const cap = fakeCapacitor();
  globalThis.Capacitor = cap.C;
  const b = appleBridge(`${UA0} KnowFlowApp/2`);
  check(b !== null, 'gate: shell 2, iOS, the plugin answering: the button may show');
  if (b) await b.call('available');
  delete globalThis.Capacitor;
  check(cap.calls.length === 1 && cap.calls[0][0] === 'KnowFlowApple' && cap.calls[0][1] === 'available', 'the bridge calls KnowFlowApple and nothing else', JSON.stringify(cap.calls));
}

// ── 2. the nonce ────────────────────────────────────────────────────────────
if (bridgeMod) {
  const a = await bridgeMod.makeNonce();
  const b = await bridgeMod.makeNonce();
  check(/^[A-Za-z0-9_-]{43}$/.test(a.raw), 'the raw nonce is 43 base64url characters (32 random bytes)', a.raw);
  check(a.hashed === sha(a.raw), 'the hashed nonce is the SHA-256 hex of the raw one');
  check(a.raw !== b.raw, 'two nonces differ');
}

// ── 3. sign-in ──────────────────────────────────────────────────────────────
const TOKEN = 'eyJ.ID-TOKEN-SECRET.sig';
const CODE = 'c0de-AUTH-SECRET';
function fakeBrowser({ meta = {}, idError = null, profileName = null } = {}) {
  const log = [];
  const browser = {
    auth: {
      signInWithIdToken: async (args) => { log.push(['signInWithIdToken', args]); return idError ? { data: { user: null, session: null }, error: idError } : { data: { user: { id: 'u-1', user_metadata: meta }, session: { access_token: 'x' } }, error: null }; },
      updateUser: async (args) => { log.push(['updateUser', args]); return { data: {}, error: null }; },
    },
    from: (table) => {
      const q = { table, ops: [] };
      const chain = {
        update: (v) => { q.ops.push(['update', v]); return chain; },
        upsert: (v) => { q.ops.push(['upsert', v]); return chain; },
        eq: (c, v) => { q.ops.push(['eq', c, v]); return chain; },
        is: (c, v) => { q.ops.push(['is', c, v]); return chain; },
        then: (res) => { log.push(['from', q]); return Promise.resolve({ error: null, data: profileName }).then(res); },
      };
      return chain;
    },
  };
  return { browser, log };
}
function pluginBridge(answer) {
  const seen = [];
  return { seen, call: (m, o) => { seen.push([m, o]); return typeof answer === 'function' ? answer(m, o) : answer; } };
}
const AUTH = (o = {}) => Promise.resolve({ identityToken: TOKEN, authorizationCode: CODE, user: '001234.abc.0999', email: 'x@privaterelay.appleid.com', givenName: null, familyName: null, ...o });
if (bridgeMod) {
  const { signInWithApple } = bridgeMod;
  {
    const plug = pluginBridge(() => AUTH({ givenName: 'Sara', familyName: 'Ali' }));
    const { browser, log } = fakeBrowser();
    const r = await signInWithApple(plug, browser, 'ar');
    const sent = plug.seen[0]?.[1]?.nonce;
    const call = log.find((x) => x[0] === 'signInWithIdToken')?.[1];
    check(r === 'signed-in', 'a good sheet signs in', r);
    check(plug.seen.length === 1 && plug.seen[0][0] === 'signIn' && /^[0-9a-f]{64}$/.test(sent), 'the plugin gets signIn with the HASHED nonce (64 hex)', JSON.stringify(plug.seen));
    check(call?.provider === 'apple' && call?.token === TOKEN && typeof call?.nonce === 'string' && sha(call.nonce) === sent, 'Supabase gets provider apple, the identity token and the RAW nonce whose SHA-256 the plugin got');
    const upd = log.find((x) => x[0] === 'updateUser')?.[1];
    check(upd?.data?.full_name === 'Sara Ali' && upd?.data?.locale === 'ar', 'a first sign-in with a name saves full_name and the page locale in the metadata', JSON.stringify(upd));
    const prof = log.find((x) => x[0] === 'from')?.[1];
    const ops = JSON.stringify(prof?.ops);
    check(prof?.table === 'profiles' && /\["update",\{"full_name":"Sara Ali"\}\]/.test(ops) && /\["eq","id","u-1"\]/.test(ops) && /\["is","full_name",null\]/.test(ops) && !/upsert|plan/.test(ops), 'the profile row gets the name by UPDATE, own id, only where it has none, never the plan', ops);
  }
  {
    const plug = pluginBridge(() => AUTH({ givenName: 'Sara', familyName: 'Ali' }));
    const { browser, log } = fakeBrowser({ meta: { full_name: 'Sara A.', locale: 'en' } });
    await signInWithApple(plug, browser, 'ar');
    check(!log.some((x) => x[0] === 'updateUser' || x[0] === 'from'), 'an account that already has a name (a linked password account) keeps it: no write');
  }
  {
    const plug = pluginBridge(() => AUTH());
    const { browser, log } = fakeBrowser();
    await signInWithApple(plug, browser, 'en');
    check(!log.some((x) => x[0] === 'updateUser' || x[0] === 'from'), 'a sign-in with no name (every one after the first) writes nothing');
  }
  {
    const plug = pluginBridge(() => Promise.reject(Object.assign(new Error('The user canceled'), { code: 'canceled' })));
    const { browser, log } = fakeBrowser();
    const r = await signInWithApple(plug, browser, 'en');
    check(r === 'canceled' && log.length === 0, 'Cancel in the sheet: canceled, and Supabase is not called', r);
  }
  for (const [what, answer, opts] of [
    ['the plugin fails', () => Promise.reject(Object.assign(new Error('boom'), { code: 'failed' })), {}],
    ['the plugin answers without a token', () => Promise.resolve({ authorizationCode: CODE }), {}],
    ['Supabase refuses the token', () => AUTH(), { idError: { message: 'Nonces mismatch', status: 400 } }],
  ]) {
    const { browser } = fakeBrowser(opts);
    const r = await signInWithApple(pluginBridge(answer), browser, 'en');
    check(r === 'failed', `${what}: failed`, r);
  }
  const conf = await bridgeMod.confirmDeletionWithApple(pluginBridge(() => AUTH()));
  check(conf.ok === true && conf.code === CODE && /^[A-Za-z0-9_-]{43}$/.test(conf.nonce), 'the deletion confirmation hands back the fresh code and the RAW nonce', JSON.stringify({ ok: conf.ok, n: conf.nonce?.length }));
  const conf2 = await bridgeMod.confirmDeletionWithApple(pluginBridge(() => Promise.reject(Object.assign(new Error('x'), { code: 'canceled' }))));
  check(conf2.ok === false && conf2.reason === 'canceled', 'Cancel in the deletion sheet: canceled');
}

// ── 4. the revoke library ───────────────────────────────────────────────────
const revokeMod = await load('src/lib/auth/apple-revoke.ts');
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const ENV = { APPLE_SIWA_TEAM_ID: 'TEAM123456', APPLE_SIWA_KEY_ID: 'KEY1234567', APPLE_SIWA_PRIVATE_KEY: PEM };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const SUB = '001234.5f0e1d2c3b4a59687766554433221100.0999';
const NOW = Date.now();
const idToken = (over = {}) => `${b64u({ alg: 'RS256', kid: 'k' })}.${b64u({ iss: 'https://appleid.apple.com', aud: 'com.knowflow.app', sub: SUB, iat: Math.floor(NOW / 1000) - 5, exp: Math.floor(NOW / 1000) + 600, ...over })}.c2ln`;
const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const hang = (url, init) => new Promise((_, rej) => init?.signal?.addEventListener('abort', () => rej(init.signal.reason ?? new Error('aborted'))));
const REFRESH = 'r.REFRESH-TOKEN-SECRET';
if (revokeMod) {
  const { appleServerEnv, appleClientSecret, exchangeAppleCode, revokeAppleToken, appleIdentitySub, APPLE_CLIENT_ID, APPLE_TIMEOUT_MS } = revokeMod;
  check(APPLE_CLIENT_ID === 'com.knowflow.app' && APPLE_TIMEOUT_MS === 5000, 'client_id com.knowflow.app, timeout 5 s');
  check(appleServerEnv({}) === null && appleServerEnv({ ...ENV, APPLE_SIWA_KEY_ID: ' ' }) === null && appleServerEnv(ENV) !== null, 'the env is all three variables or nothing');
  const escaped = appleServerEnv({ ...ENV, APPLE_SIWA_PRIVATE_KEY: PEM.replace(/\n/g, '\\n') });
  check(escaped?.privateKey.includes('\n-----END') || escaped?.privateKey.includes('\n') === true, 'a key pasted with literal \\n is read as a PEM');
  const env = appleServerEnv(ENV);
  const jwt = appleClientSecret(env, NOW);
  const [h, p, s] = jwt.split('.');
  const H = JSON.parse(Buffer.from(h, 'base64url'));
  const P = JSON.parse(Buffer.from(p, 'base64url'));
  check(H.alg === 'ES256' && H.kid === 'KEY1234567', 'client secret header: ES256 and the key id', JSON.stringify(H));
  check(P.iss === 'TEAM123456' && P.aud === 'https://appleid.apple.com' && P.sub === 'com.knowflow.app' && P.exp - P.iat === 300 && Math.abs(P.iat - Math.floor(NOW / 1000)) <= 1, 'client secret claims: team, Apple audience, the app id, 5-minute expiry', JSON.stringify(P));
  check(cryptoVerify('sha256', Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'client secret signature verifies (ES256, IEEE P1363)');

  const ex = async (fetchImpl, over = {}) => exchangeAppleCode({ code: CODE, expectedSub: SUB, env, fetchImpl, nowMs: NOW, ...over });
  let req = null;
  const ok = await ex((url, init) => { req = { url, init }; return json(200, { id_token: idToken(), refresh_token: REFRESH, access_token: 'a.ACCESS-SECRET' }); });
  const form = new URLSearchParams(String(req?.init?.body ?? ''));
  check(ok.ok === true && ok.sub === SUB && ok.refreshToken === REFRESH, 'exchange: a good code gives the matching sub and the refresh token');
  check(req?.url === 'https://appleid.apple.com/auth/token' && req.init.method === 'POST' && form.get('client_id') === 'com.knowflow.app' && form.get('grant_type') === 'authorization_code' && form.get('code') === CODE && (form.get('client_secret') || '').split('.').length === 3 && req.init.signal, 'exchange request: POST /auth/token, form-encoded, client_id, the code, a client secret, an abort signal');
  const raw = 'n'.repeat(43);
  check((await ex(() => json(200, { id_token: idToken({ nonce: sha(raw) }), refresh_token: REFRESH }), { rawNonce: raw })).ok === true, 'exchange: the token\'s nonce matches the raw nonce the card sent');
  for (const [what, f, over, reason] of [
    ['another Apple ID (wrong sub)', () => json(200, { id_token: idToken({ sub: '000999.other.0001' }), refresh_token: REFRESH }), {}, 'mismatch'],
    ['an expired or used code (invalid_grant)', () => json(400, { error: 'invalid_grant' }), {}, 'refused'],
    ['another app\'s audience', () => json(200, { id_token: idToken({ aud: 'com.other.app' }) }), {}, 'malformed'],
    ['another issuer', () => json(200, { id_token: idToken({ iss: 'https://evil.example' }) }), {}, 'malformed'],
    ['a token not fresh (iat 20 min ago)', () => json(200, { id_token: idToken({ iat: Math.floor(NOW / 1000) - 1200 }) }), {}, 'stale'],
    ['an expired token', () => json(200, { id_token: idToken({ exp: Math.floor(NOW / 1000) - 1 }) }), {}, 'stale'],
    ['a nonce that does not match', () => json(200, { id_token: idToken({ nonce: sha('other') }) }), { rawNonce: raw }, 'mismatch'],
    ['no id_token', () => json(200, { refresh_token: REFRESH }), {}, 'malformed'],
    ['a network error', () => Promise.reject(new TypeError('fetch failed')), {}, 'network'],
    ['a timeout', hang, { timeoutMs: 60 }, 'timeout'],
    ['the env missing', () => { throw new Error('must not fetch'); }, { env: null }, 'missing-env'],
    ['a bad key', () => { throw new Error('must not fetch'); }, { env: { ...env, privateKey: 'not a key' } }, 'bad-key'],
  ]) {
    let fetched = false;
    const r = await ex((...a) => { fetched = true; return f(...a); }, over);
    check(r.ok === false && r.reason === reason, `exchange refuses ${what}: ${reason}`, JSON.stringify(r));
    if (reason === 'missing-env' || reason === 'bad-key') check(!fetched, `exchange with ${what} never calls Apple`);
  }
  const t0 = Date.now();
  const slow = await ex(hang);
  const took = Date.now() - t0;
  check(slow.reason === 'timeout' && took >= 4900 && took < 7000, `the default timeout is 5 s (took ${took} ms)`);

  let rv = null;
  const r1 = await revokeAppleToken({ token: REFRESH, hint: 'refresh_token', env, fetchImpl: (url, init) => { rv = { url, init }; return Promise.resolve(new Response('', { status: 200 })); } });
  const rf = new URLSearchParams(String(rv?.init?.body ?? ''));
  check(r1.outcome === 'revoked' && rv?.url === 'https://appleid.apple.com/auth/revoke' && rf.get('token') === REFRESH && rf.get('token_type_hint') === 'refresh_token' && rf.get('client_id') === 'com.knowflow.app' && rv.init.signal, 'revoke: POST /auth/revoke with the refresh token and its hint: revoked');
  check((await revokeAppleToken({ token: REFRESH, hint: 'refresh_token', env, fetchImpl: () => json(400, { error: 'invalid_client' }) })).outcome === 'failed', 'revoke: Apple refuses: failed');
  check((await revokeAppleToken({ token: REFRESH, hint: 'refresh_token', env, fetchImpl: hang, timeoutMs: 60 })).outcome === 'failed', 'revoke: a timeout: failed');
  check((await revokeAppleToken({ token: REFRESH, hint: 'refresh_token', env, fetchImpl: () => { throw new Error('sync throw'); } })).outcome === 'failed', 'revoke: a fetch that throws: failed, not thrown');

  check(appleIdentitySub({ identities: [{ provider: 'email', identity_data: { sub: 'u' } }, { provider: 'apple', id: SUB, identity_data: { sub: SUB } }] }) === SUB, 'the session\'s Apple sub is read from its apple identity');
  check(appleIdentitySub({ identities: [{ provider: 'email', id: 'u' }] }) === null && appleIdentitySub({}) === null && appleIdentitySub({ identities: [{ provider: 'apple', identity_data: {} , id: '' }] }) === null, 'no apple identity (or an empty sub): null');
}

// ── 5. the route ────────────────────────────────────────────────────────────
const UID = '0a1b2c3d-0000-4000-8000-00000000a11e';
const EMAIL = 'Student@Example.com';
const ok200 = { ok: true, storageDeleted: 3, subscriptionsCanceled: 0, waitlistRemoved: 0 };
const req = (body) => new Request('https://tryknowflow.com/api/account', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
async function call(route, { user, body, del = ok200, fetchImpl = null }) {
  S.user = user; S.deleteResult = del; S.calls = []; S.fetch = fetchImpl;
  const res = await route.DELETE(req(body));
  return { status: res.status, body: await res.text(), cc: res.headers.get('cache-control'), calls: S.calls.slice() };
}
const plain = { id: UID, email: EMAIL, identities: [{ provider: 'email', id: UID, identity_data: { sub: UID } }] };
// The bytes main answers, arm by arm (src/app/api/account/route.ts at daf888c).
const MAIN = [
  ['no session', { user: null, body: { confirmEmail: EMAIL } }, 401, '{"error":"Unauthorized"}', null, false],
  ['a session without an email', { user: { id: UID, email: '' }, body: { confirmEmail: '' } }, 401, '{"error":"Unauthorized"}', null, false],
  ['a body that is not JSON', { user: plain, body: 'not json' }, 400, '{"error":"ConfirmationRequired"}', null, false],
  ['no confirmation', { user: plain, body: {} }, 400, '{"error":"ConfirmationMismatch"}', null, false],
  ['the wrong email', { user: plain, body: { confirmEmail: 'other@example.com' } }, 400, '{"error":"ConfirmationMismatch"}', null, false],
  ['the wrong email with an Apple code beside it', { user: plain, body: { confirmEmail: 'other@example.com', appleAuthorizationCode: CODE, appleNonce: 'n'.repeat(43) } }, 400, '{"error":"ConfirmationMismatch"}', null, false],
  ['no email, only an Apple code', { user: plain, body: { appleAuthorizationCode: CODE } }, 400, '{"error":"ConfirmationMismatch"}', null, false],
  ['the email, trimmed and in other case', { user: plain, body: { confirmEmail: '  student@example.COM ' } }, 200, '{"deleted":true,"storageDeleted":3}', 'no-store', true],
  ['the email and an Apple code (ignored)', { user: plain, body: { confirmEmail: EMAIL, appleAuthorizationCode: CODE } }, 200, '{"deleted":true,"storageDeleted":3}', 'no-store', true],
  ['billing cancelled, account intact', { user: plain, body: { confirmEmail: EMAIL }, del: { ok: false, stage: 'orphaned', reason: 'x' } }, 409, '{"error":"BillingCanceledAccountIntact","stage":"orphaned"}', 'no-store', true],
  ['billing this app cannot reach', { user: plain, body: { confirmEmail: EMAIL }, del: { ok: false, stage: 'billing-unverifiable', reason: 'x' } }, 409, '{"error":"SubscriptionNotCancellableHere","stage":"billing-unverifiable"}', 'no-store', true],
  ['storage failed', { user: plain, body: { confirmEmail: EMAIL }, del: { ok: false, stage: 'storage', reason: 'x' } }, 500, '{"error":"DeletionFailed","stage":"storage"}', 'no-store', true],
];
async function nonAppleMatrix(route, label) {
  process.env.APPLE_SIWA_TEAM_ID = ENV.APPLE_SIWA_TEAM_ID; process.env.APPLE_SIWA_KEY_ID = ENV.APPLE_SIWA_KEY_ID; process.env.APPLE_SIWA_PRIVATE_KEY = PEM;
  for (const [what, opts, status, body, cc, deletes] of MAIN) {
    const r = await call(route, { ...opts, fetchImpl: () => { throw new Error('fetch'); } });
    const fetched = r.calls.some((c) => c.startsWith('fetch:'));
    const deleted = r.calls.some((c) => c.startsWith('delete:'));
    check(r.status === status && r.body === body && r.cc === cc && !fetched && deleted === deletes, `${label}, no Apple identity, ${what}: ${status} ${body}${cc ? ' no-store' : ''}, ${deletes ? 'deletes' : 'deletes nothing'}, no call to Apple`, JSON.stringify({ s: r.status, b: r.body, cc: r.cc, calls: r.calls }));
  }
}
if (AGAINST) {
  const other = await import(pathToFileURL(AGAINST).href);
  await nonAppleMatrix(other, `--against ${AGAINST}`);
}
const route = await load('src/app/api/account/route.ts');
if (route) {
  await nonAppleMatrix(route, 'route');
  const appleUser = { id: UID, email: 'qx7@privaterelay.appleid.com', identities: [{ provider: 'apple', id: SUB, identity_data: { sub: SUB, email: 'qx7@privaterelay.appleid.com' } }] };
  const RAW = 'r'.repeat(43);
  const apple = (exchange, revoke = () => Promise.resolve(new Response('', { status: 200 }))) => (url, init) => (String(url).endsWith('/auth/token') ? exchange(url, init) : revoke(url, init));
  const good = () => json(200, { id_token: idToken({ nonce: sha(RAW), iat: Math.floor(Date.now() / 1000) - 2, exp: Math.floor(Date.now() / 1000) + 600 }), refresh_token: REFRESH });
  const setEnv = (on) => { for (const [k, v] of Object.entries(ENV)) { if (on) process.env[k] = v; else delete process.env[k]; } };
  setEnv(true);

  {
    const r = await call(route, { user: appleUser, body: { appleAuthorizationCode: CODE, appleNonce: RAW }, fetchImpl: apple(good) });
    const order = r.calls.map((c) => c.replace(/:.*$/, '') + (c.includes('/auth/') ? c.slice(c.lastIndexOf('/')) : '')).join(' > ');
    check(r.status === 200 && r.body === '{"deleted":true,"storageDeleted":3,"appleRevoke":"revoked"}' && r.cc === 'no-store', 'Apple account, a fresh code with its own sub, no typed email: deleted, revoked', r.body);
    check(order === 'fetch/token > delete > fetch/revoke', 'the exchange runs BEFORE the deletion and the revoke AFTER it', order);
  }
  for (const [what, exchange, envOn] of [
    ['another Apple ID (wrong sub)', () => json(200, { id_token: idToken({ sub: '000999.other.0001', iat: Math.floor(Date.now() / 1000) - 2, exp: Math.floor(Date.now() / 1000) + 600 }), refresh_token: REFRESH }), true],
    ['an expired or already used code', () => json(400, { error: 'invalid_grant' }), true],
    ['the server without the Apple key (env missing)', good, false],
    ['Apple not answering (timeout, 5 s)', hang, true],
  ]) {
    setEnv(envOn);
    const r = await call(route, { user: appleUser, body: { appleAuthorizationCode: CODE, appleNonce: RAW }, fetchImpl: apple(exchange) });
    const deleted = r.calls.some((c) => c.startsWith('delete:'));
    const revoked = r.calls.some((c) => c.endsWith('/auth/revoke'));
    check(r.status === 400 && r.body === '{"error":"AppleConfirmationFailed"}' && !deleted && !revoked, `Apple account, ${what}: refused (AppleConfirmationFailed), nothing deleted, nothing revoked`, JSON.stringify({ s: r.status, b: r.body, calls: r.calls }));
    if (!envOn) check(!r.calls.some((c) => c.startsWith('fetch:')), 'with the env missing, Apple is never called');
  }
  setEnv(true);
  {
    const r = await call(route, { user: appleUser, body: { confirmEmail: 'QX7@privaterelay.appleid.com' }, fetchImpl: apple(() => { throw new Error('no'); }) });
    check(r.status === 200 && r.body === '{"deleted":true,"storageDeleted":3,"appleRevoke":"skipped"}' && !r.calls.some((c) => c.startsWith('fetch:')), 'Apple account, the typed email still works (the web): deleted, skipped, Apple not called', r.body);
  }
  {
    const r = await call(route, { user: appleUser, body: { confirmEmail: 'wrong@example.com' } });
    check(r.status === 400 && r.body === '{"error":"ConfirmationMismatch"}' && !r.calls.some((c) => c.startsWith('delete:')), 'Apple account, no code and the wrong email: ConfirmationMismatch, nothing deleted', r.body);
  }
  {
    const r = await call(route, { user: appleUser, body: { confirmEmail: 'qx7@privaterelay.appleid.com', appleAuthorizationCode: CODE, appleNonce: RAW }, fetchImpl: apple(() => json(200, { id_token: idToken({ sub: '000999.other.0001', iat: Math.floor(Date.now() / 1000) - 2, exp: Math.floor(Date.now() / 1000) + 600 }) })) });
    check(r.status === 200 && r.body === '{"deleted":true,"storageDeleted":3,"appleRevoke":"mismatch"}' && !r.calls.some((c) => c.endsWith('/auth/revoke')), 'the typed email AND another Apple ID\'s code: deleted by the email, nothing revoked (mismatch)', r.body);
  }
  {
    const r = await call(route, { user: appleUser, body: { appleAuthorizationCode: CODE, appleNonce: RAW }, del: { ok: false, stage: 'storage', reason: 'x' }, fetchImpl: apple(good) });
    check(r.status === 500 && r.body === '{"error":"DeletionFailed","stage":"storage"}' && !r.calls.some((c) => c.endsWith('/auth/revoke')), 'Apple confirmed but the deletion failed: the failure as before, nothing revoked', r.body);
  }
  {
    const r = await call(route, { user: appleUser, body: { appleAuthorizationCode: CODE, appleNonce: RAW }, del: { ok: false, stage: 'orphaned', reason: 'x' }, fetchImpl: apple(good) });
    check(r.status === 409 && !r.calls.some((c) => c.endsWith('/auth/revoke')), 'Apple confirmed, billing cancelled but the account intact: nothing revoked', r.body);
  }
  {
    const r = await call(route, { user: appleUser, body: { appleAuthorizationCode: CODE, appleNonce: RAW }, fetchImpl: apple(good, () => json(400, { error: 'invalid_request' })) });
    check(r.status === 200 && r.body === '{"deleted":true,"storageDeleted":3,"appleRevoke":"failed"}', 'Apple confirmed, the revoke refused: still deleted, failed', r.body);
  }
  const lines = LOGGED.filter((l) => /\[apple-(revoke|confirm)\]/.test(l));
  check(lines.some((l) => /\[apple-revoke\] user=\S+ outcome=revoked status=200/.test(l)) && lines.some((l) => /outcome=skipped/.test(l)) && lines.some((l) => /\[apple-confirm\] user=\S+ outcome=mismatch/.test(l)), 'one log line per outcome, successes too', lines.slice(0, 4).join(' | '));
}
const LEAK = LOGGED.filter((l) => [TOKEN, CODE, REFRESH, 'ACCESS-SECRET', 'BEGIN PRIVATE KEY', PEM.split('\n')[1]].some((x) => l.includes(x)));
check(LEAK.length === 0, 'no token, code or key in any log line of the whole run', LEAK[0]?.slice(0, 120));

// ── 6. the card ─────────────────────────────────────────────────────────────
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const en = (await load('src/lib/i18n/locales/en.ts'))?.en;
const ar = (await load('src/lib/i18n/locales/ar.ts'))?.ar;
const card = await load('src/components/dashboard/DeleteAccountCard.tsx');
if (card && en) {
  const labels = en.dashboard.settings.deleteAccount;
  const r = (p) => renderToStaticMarkup(React.createElement(card.DeleteAccountCard, { labels, homeHref: '/en', showBillingNote: false, ...p }));
  const none = r({});
  const plainOpen = r({ appleAccount: false, previewState: 'open' });
  check(!/apple/i.test(none) && !/apple/i.test(plainOpen) && plainOpen.includes('id="confirm-email"'), 'no Apple identity: no Apple line, the email field as before');
  const webApple = r({ appleAccount: true, appleConfirm: true, previewState: 'open' });
  check(webApple.includes('id="confirm-email"') && !webApple.includes('data-kf-apple-step'), 'an Apple account on the server render (no plugin yet): the email field, no Apple step');
  const fallback = r({ appleAccount: true, appleConfirm: true, previewState: 'apple-fallback' });
  check(!!labels.appleUnconfirmed && fallback.includes(labels.appleUnconfirmed.split(' ')[0]) && fallback.includes('id="confirm-email"'), 'the fallback: the unconfirmed line and the email field');
  const done = r({ appleAccount: true, previewState: 'apple-done' });
  check(done.includes('data-kf-apple-not-revoked') && done.includes('href="/en"') && !!labels.appleDone && done.includes(labels.appleDone), 'not revoked: the line and Done, a full link home');
  const src = read('src/components/dashboard/DeleteAccountCard.tsx');
  check(/JSON\.stringify\(\{ confirmEmail: typed \}\)/.test(src), 'the email path posts { confirmEmail } exactly as before');
  check(/appleBridge\(\)/.test(src) && /useEffect/.test(src) && /appleAccount && appleConfirm/.test(src), 'the Apple step is chosen after mount, only for an Apple account the server can confirm');
}

// ── 7. the sources ──────────────────────────────────────────────────────────
check(!has('src/lib/auth/providers.ts'), 'src/lib/auth/providers.ts is deleted');
{
  const { execFileSync } = await import('node:child_process');
  let hits = '';
  try { hits = execFileSync('git', ['grep', '-n', '-E', 'NEXT_PUBLIC_APPLE_SIGNIN|APPLE_SIGNIN_ENABLED', '--', 'src'], { cwd: ROOT, encoding: 'utf8' }); } catch { hits = ''; }
  check(hits.trim() === '', 'no NEXT_PUBLIC_APPLE_SIGNIN or APPLE_SIGNIN_ENABLED left in src', hits.split('\n')[0]);
}
check(/export type OAuthProvider = 'google';/.test(read('src/lib/auth/oauth.ts')), "OAuthProvider is 'google'");
check(!/startOAuth\('apple'\)/.test(read('src/components/auth/AppleButton.tsx')), "the Apple button no longer starts web OAuth");
for (const p of ['src/app/[locale]/login/page.tsx', 'src/app/[locale]/signup/page.tsx']) {
  const s = read(p);
  const a = s.indexOf('<AppleButton'), g = s.indexOf('<GoogleButton');
  check(a > 0 && g > a, `${p}: Apple FIRST, above Google`);
  check(/useAppleSignIn\(\)/.test(s) && /providerShown = googleSignInAllowed\(.*?\) \|\| apple !== null;/.test(s), `${p}: the divider shows when Apple shows`);
}
{
  const s = read('src/components/auth/AppleButton.tsx');
  const d = /d="(M19\.8196726[^"]+)"/.exec(s)?.[1];
  // Apple Design Resources, Logo-Sign-in-with-Apple.dmg (sha256 99fba5c8a294a86653294b3766d7ce21dde47cc75a77367659c45ea168699af6),
  // "Logo - SIWA - Left-aligned - Black - Large.svg" (sha256 038d2940e825dfb07101f6611f163b8954b9cf37b21bf2818e04b581b44442b1): its one path.
  check(!!d && sha(d) === '14744a92a0af2bc535f9d33ffe6eb17aa1c49647376a488494931e34eab33dc1', "the logo is Apple's own path from Apple Design Resources, unchanged", d ? sha(d) : 'no path');
  check(/viewBox="0 0 39 44"/.test(s) && /kf-apple-button/.test(s) && /min-h-\[3\.375rem\]/.test(s), 'the 39 x 44 frame Apple draws it in, the HIG fill class, 54 pt tall');
}
{
  const s = read('src/app/[locale]/dashboard/settings/page.tsx');
  check(/identities[^\n]*provider === 'apple'/.test(s) && /appleConfirmConfigured\(\)/.test(s) && /appleAccount=\{/.test(s), 'settings passes the Apple identity and whether the server holds the Apple key');
}
check(/<strong>Apple<\/strong>, only if you choose Sign in with Apple in the app\./.test(read('src/app/[locale]/(site)/privacy/page.tsx')), 'the privacy page names Apple');
{
  const s = read('src/lib/auth/apple-revoke.ts');
  check(!/console\.(log|error|warn|info)\([^)]*(token|secret|code|privateKey)\b/i.test(s), 'apple-revoke.ts logs no token, code or key');
  check(!/env\.NEXT_PUBLIC_|env\[.NEXT_PUBLIC_/.test(s) && /APPLE_SIWA_TEAM_ID/.test(s) && /APPLE_SIWA_KEY_ID/.test(s) && /APPLE_SIWA_PRIVATE_KEY/.test(s), 'the server reads the three server-only variables');
}
{
  const pkg = JSON.parse(read('package.json'));
  check(!Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((k) => /apple|jose|jsonwebtoken|social-login/i.test(k)), 'no new dependency (no apple, jose, jsonwebtoken or social-login package)');
}

// ── 8. the strings ──────────────────────────────────────────────────────────
if (en && ar) {
  const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? x : x[p]), o);
  const draft = read('docs/copy-drafts/siwa_v1.md');
  const rows = [...draft.matchAll(/^\| `([^`]+)` \| (.+?) \| (.+?) \|$/gm)];
  check(rows.length === 5, 'the drafts file holds five keys', String(rows.length));
  for (const [, key, e, a] of rows) {
    check(get(en, key) === e, `en ${key} is the draft, byte for byte`, JSON.stringify(get(en, key)));
    check(get(ar, key) === a, `ar ${key} is the draft, byte for byte`, JSON.stringify(get(ar, key)));
    for (const s of [e, a]) check(!/[\u2014\u2013]/.test(s) && !/[\u0660-\u0669\u06F0-\u06F9]/.test(s) && kfWording(s).length === 0, `${key}: no dash, Western digits, no purchase word`, JSON.stringify(kfWording(s)));
  }
  check(en.auth.appleLogin === 'Sign in with Apple' && en.auth.appleSignup === 'Continue with Apple', "the button labels are Apple's own wording, unchanged");
  check(!('appleFailed' in en.auth) && !('appleFailed' in ar.auth), 'auth.appleFailed is retired in both dictionaries');
  check(/verify on build 9/i.test(draft) && /Sign-In & Security/.test(draft), 'the iPhone Settings path is marked VERIFY ON BUILD 9');
  check(/\['auth\.appleFailed',/.test(read('scripts/verify-arabic-copy.mjs')), 'verify-arabic-copy lists auth.appleFailed as retired, with its ruling');
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('---');
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
