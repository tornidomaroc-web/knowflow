/**
 * Executable proof for auth errors in the page's language (audit cause #8)
 * and the app's line under the check-inbox notice (cause #3).
 *
 * 1. THE REAL CLIENT. @supabase/supabase-js, with a fetch that answers every
 *    request with the design-c fixture (scripts/design-c/auth-errors.mjs: the
 *    reply GoTrue sends, or no reply): signUp, signInWithPassword and
 *    updateUser return the real AuthError, and the mapper must give the
 *    fixture's key. updateUser runs on a fixture session in memory.
 * 2. Every key's sentence, both languages: an Arabic one holds an Arabic
 *    letter and NO Latin letter; none holds an em dash or a plan, upgrade,
 *    price or free word; none is GoTrue's English.
 * 3. The pages: sign-up, sign-in and the new-password page never put an
 *    error's `.message` on screen, and read `authErrorMessage`; the
 *    forgot-password page still shows no error text from Supabase at all.
 * 4. Disclosure: an existing account is never named (user_already_exists,
 *    email_exists, identity_already_exists give the generic sentence on
 *    sign-up); a key outside a form's list is the generic sentence; the
 *    English message is never read (an error with only a message is generic).
 * 5. Cause #3: the check-inbox app line is drawn only when the platform is
 *    the app, inside the notice; the drafts are not in the dictionaries.
 *
 * On main the mapper does not exist and the three pages show `.message`,
 * so this fails there.
 *
 * Tier 0: no network (the fetch is local), no app, no credential.
 *
 * Usage: node --experimental-strip-types scripts/verify-auth-errors.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
installTsxHooks(ROOT);
const failures = [];
let passes = 0;
const EM_DASH = String.fromCharCode(0x2014);
const check = (ok, msg) => { if (ok) passes++; else failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const src = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

const { AUTH_ERROR_FIXTURES, AUTH_ENDPOINT, fixtureBody, FIXTURE_SESSION } = await load('scripts/design-c/auth-errors.mjs');
const { createClient } = await import(pathToFileURL(resolvePath(ROOT, 'node_modules/@supabase/supabase-js/dist/index.mjs')).href);
const { useTranslation } = await load('src/lib/i18n/index.ts');
const T = { en: useTranslation('en'), ar: useTranslation('ar') };

const mapperPath = 'src/lib/auth/auth-error.ts';
const hasMapper = existsSync(resolvePath(ROOT, mapperPath));
check(hasMapper, `${mapperPath} does not exist (main shows GoTrue's message as it comes)`);
const M = hasMapper ? await load(mapperPath) : null;
const D = existsSync(resolvePath(ROOT, 'src/lib/auth/auth-copy-drafts.ts')) ? await load('src/lib/auth/auth-copy-drafts.ts') : null;

// 1. The real client against each fixture.
const URL_ = 'http://127.0.0.1:54321';
function clientFor(fx) {
  const ep = AUTH_ENDPOINT[fx.form];
  const store = new Map();
  if (fx.form === 'reset') store.set('sb-127-auth-token', JSON.stringify(FIXTURE_SESSION()));
  const fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (ep.path.test(url) && (init.method || 'GET').toUpperCase() === ep.method) {
      if (!fx.status) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(fixtureBody(fx)), { status: fx.status, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected request ${init.method || 'GET'} ${url}`);
  };
  return createClient(URL_, 'placeholder-not-a-key', {
    global: { fetch },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } },
  });
}
for (const fx of AUTH_ERROR_FIXTURES) {
  const c = clientFor(fx);
  let error;
  if (fx.form === 'signup') ({ error } = await c.auth.signUp({ email: 'student@example.com', password: 'a-long-password-1' }));
  if (fx.form === 'login') ({ error } = await c.auth.signInWithPassword({ email: 'student@example.com', password: 'a-long-password-1' }));
  if (fx.form === 'reset') ({ error } = await c.auth.updateUser({ password: 'a-long-password-1' }));
  check(!!error, `${fx.form}/${fx.id}: the client returned no error`);
  if (!M || !error) continue;
  const key = M.authErrorKey(error, fx.form);
  check(key === fx.key, `${fx.form}/${fx.id}: code ${error.code} name ${error.name} status ${error.status} maps to ${key}, expected ${fx.key}`);
  for (const loc of ['ar', 'en']) {
    const text = M.authErrorMessage(error, fx.form, T[loc], loc);
    check(typeof text === 'string' && text.length > 0, `${fx.form}/${fx.id}/${loc}: no sentence`);
    check(!fx.msg || text !== fx.msg, `${fx.form}/${fx.id}/${loc}: GoTrue's English reaches the page: ${text}`);
    if (loc === 'ar') check(/[؀-ۿ]/.test(text) && !/[A-Za-z]/.test(text), `${fx.form}/${fx.id}/ar: not an Arabic sentence: ${text}`);
  }
}

// 2. Every sentence, both languages.
const BANNED = /\b(plan|upgrade|price|pricing|free|pro|premium|subscri\w*)\b|باق|ترقي|سعر|مجان|اشتراك/i;
if (M) {
  const keys = ['invalidCredentials', 'emailNotConfirmed', 'weakPassword', 'samePassword', 'invalidEmail', 'emailRateLimit', 'requestRateLimit', 'sessionMissing', 'network', 'generic'];
  for (const k of keys) for (const loc of ['ar', 'en']) {
    const s = M.authErrorText(k, T[loc], loc);
    check(typeof s === 'string' && s.trim().length > 0, `${k}/${loc}: empty`);
    check(!s.includes(EM_DASH), `${k}/${loc}: em dash in "${s}"`);
    check(!BANNED.test(s), `${k}/${loc}: plan, upgrade, price or free word in "${s}"`);
    if (loc === 'ar') check(/[؀-ۿ]/.test(s) && !/[A-Za-z]/.test(s) && !/[٠-٩۰-۹]/.test(s), `${k}/ar: Latin letter, Eastern digit or no Arabic in "${s}"`);
  }
  check(M.authErrorText('sessionMissing', T.ar, 'ar') === T.ar.auth.resetNoSession, 'sessionMissing reuses the approved auth.resetNoSession');
}

// 3. The pages.
const PAGES = { signup: 'src/app/[locale]/signup/page.tsx', login: 'src/app/[locale]/login/page.tsx', reset: 'src/app/[locale]/reset-password/page.tsx' };
for (const [form, p] of Object.entries(PAGES)) {
  const s = src(p);
  check(!/setError\(\s*\w+\.message\s*\)/.test(s), `${p}: an error's .message is put on screen`);
  check(s.includes(`authErrorMessage(`) && s.includes(`'${form}'`), `${p}: does not show authErrorMessage(…, '${form}', …)`);
}
const forgot = src('src/app/[locale]/forgot-password/page.tsx');
check(!/\.message/.test(forgot.replace(/console\.error\([^)]*\)/g, '')), 'forgot-password shows a Supabase message');

// 4. Disclosure.
if (M) {
  for (const code of ['user_already_exists', 'email_exists', 'identity_already_exists']) check(M.authErrorKey({ code, status: 422 }, 'signup') === 'generic', `signup ${code} is not the generic sentence`);
  check(M.authErrorKey({ code: 'email_not_confirmed', status: 400 }, 'reset') === 'generic', 'a key outside the form is not generic');
  check(M.authErrorKey({ code: 'invalid_credentials' }, 'signup') === 'generic', 'invalid credentials on sign-up is not generic');
  check(M.authErrorKey({ status: 400 }, 'login') === 'generic', 'a code-less 400 is not generic');
  check(M.authErrorKey({ status: 429 }, 'login') === 'requestRateLimit', 'a code-less 429 is not the rate limit');
  check(M.authErrorKey({ message: 'Invalid login credentials', status: 400 }, 'login') === 'generic', 'the message text is read');
  check(M.authErrorKey(null, 'login') === 'generic', 'no error is not generic');
  const enRate = M.authErrorText('emailRateLimit', T.en, 'en');
  check(!/sent|already|just/i.test(enRate), `the send limit implies an earlier mail: "${enRate}"`);
}

// 5. Cause #3, and the drafts stay out of the dictionaries.
const signup = src(PAGES.signup);
check(/platform === 'native' && [\s\S]{0,200}CHECK_INBOX_APP_DRAFT\[/.test(signup), 'the check-inbox app line is not drawn under platform === \'native\'');
check(D && D.CHECK_INBOX_APP_DRAFT && /[؀-ۿ]/.test(D.CHECK_INBOX_APP_DRAFT.ar) && !/[A-Za-z]/.test(D.CHECK_INBOX_APP_DRAFT.ar) && !D.CHECK_INBOX_APP_DRAFT.ar.includes(EM_DASH), 'no Arabic check-inbox app draft');
check(!('errors' in T.ar.auth) && !('checkInboxApp' in T.ar.auth), 'a draft is in the dictionaries before approval');

console.log(`\n${passes} passed, ${failures.length} failed`);
for (const f of failures) console.log(`FAIL ${f}`);
if (failures.length) process.exit(1);
console.log('PASS: every auth error on sign-up, sign-in and the new-password page is a sentence of ours in the page\'s language, chosen by code; no account is named; the app tells the student to come back and sign in.');
