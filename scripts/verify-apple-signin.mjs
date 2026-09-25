/**
 * Executable proof for Sign in with Apple (Apple guideline 4.8; register #119):
 * the UI and the code path exist beside Google on both auth pages, and the
 * start asks Supabase for the `apple` provider with the same callback Google
 * uses.
 *
 * The REAL things under test:
 *   - `startOAuth` (`src/lib/auth/oauth.ts`), called with a stubbed Supabase
 *     browser client that records the request: provider `apple`, redirect to
 *     `/api/auth/callback` on the caller's origin; and a refusal is returned,
 *     not thrown, so the button can show its sentence.
 *   - `AppleButton` and `GoogleButton`, RENDERED with react-dom/server from
 *     their real .tsx (`scripts/lib/tsx-hooks.mjs`): Apple's required wording,
 *     the logo, a 44px height.
 *   - Both auth pages import and render `AppleButton` next to `GoogleButton`
 *     (read from source: the pages are client components with hooks, so they
 *     are not rendered here).
 *   - The dictionary carries the three Apple keys in both locales.
 *
 * WHAT THIS CANNOT PROVE, SAID PLAINLY: that Apple accepts the sign-in. That
 * needs the Services ID, the key and the Supabase provider switch, which are
 * console steps only the owner can take (register #119 lists them).
 *
 * Tier 0: no network, no credential, no database, no app.
 *
 * Usage: node --experimental-strip-types scripts/verify-apple-signin.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.__oauthCalls = [];
globalThis.__oauthRefuse = null;
installTsxHooks(ROOT, {
  '@/lib/supabase/client': `
export function createClient() {
  return { auth: { signInWithOAuth: async (req) => { globalThis.__oauthCalls.push(req); return { error: globalThis.__oauthRefuse }; } } };
}`,
});

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const load = async (p) => import(pathToFileURL(resolvePath(ROOT, p)).href);
const read = (p) => readFileSync(resolvePath(ROOT, p), 'utf8');

// 1. The start.
{
  const p = resolvePath(ROOT, 'src/lib/auth/oauth.ts');
  check(existsSync(p), 'src/lib/auth/oauth.ts does not exist');
  if (existsSync(p)) {
    const { startOAuth } = await load('src/lib/auth/oauth.ts');
    const r = await startOAuth('apple', 'https://tryknowflow.com');
    const call = globalThis.__oauthCalls[0];
    console.error(`startOAuth('apple') -> ${JSON.stringify(call)}`);
    check(r === null, 'a successful start must return null');
    check(call?.provider === 'apple', 'the provider asked for was not apple');
    check(call?.options?.redirectTo === 'https://tryknowflow.com/api/auth/callback', `redirectTo was ${call?.options?.redirectTo}`);
    globalThis.__oauthRefuse = { message: 'Unsupported provider: provider is not enabled', status: 400 };
    const realError = console.error; console.error = () => {};
    const refused = await startOAuth('apple', 'https://tryknowflow.com');
    console.error = realError;
    check(refused?.status === 400 && /not enabled/.test(refused.message), 'a refusal must be returned, not thrown');
    const g = await startOAuth('google', 'https://tryknowflow.com');
    check(globalThis.__oauthCalls[2]?.provider === 'google', 'Google must go through the same start');
    void g;
  }
}

// 2. The buttons, rendered.
{
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const p = resolvePath(ROOT, 'src/components/auth/AppleButton.tsx');
  check(existsSync(p), 'src/components/auth/AppleButton.tsx does not exist');
  if (existsSync(p)) {
    const { AppleButton } = await load('src/components/auth/AppleButton.tsx');
    const html = renderToStaticMarkup(React.createElement(AppleButton, { label: 'Sign in with Apple', errorLabel: 'x' }));
    check(html.includes('Sign in with Apple'), 'the Apple button does not carry its label');
    check(/<svg[^>]*aria-hidden="true"/.test(html) && /currentColor/.test(html), 'the Apple button has no logo in the text colour');
    check(/\bh-11\b/.test(html), 'the Apple button is not 44px tall');
    check(/bg-foreground/.test(html) && /text-background/.test(html), 'the Apple button is not painted foreground-on-background (black on light, white on dark)');
  }
}

// 3. Both pages, and the dictionary.
for (const page of ['src/app/[locale]/login/page.tsx', 'src/app/[locale]/signup/page.tsx']) {
  const src = read(page);
  check(/import \{ AppleButton \} from '@\/components\/auth\/AppleButton'/.test(src), `${page} does not import AppleButton`);
  const g = src.indexOf('<GoogleButton');
  const a = src.indexOf('<AppleButton');
  check(g >= 0 && a > g, `${page} does not render AppleButton after GoogleButton`);
}
const { en } = await load('src/lib/i18n/locales/en.ts');
const { ar } = await load('src/lib/i18n/locales/ar.ts');
for (const [name, d] of [['en', en], ['ar', ar]]) {
  for (const k of ['appleLogin', 'appleSignup', 'appleFailed']) {
    check(typeof d.auth[k] === 'string' && d.auth[k].length > 0, `${name}: auth.${k} is missing`);
  }
}
check(en.auth.appleLogin === 'Sign in with Apple' && en.auth.appleSignup === 'Continue with Apple', 'the English labels must be Apple\'s required wording');

if (failures.length === 0) {
  console.log('PASS: Sign in with Apple stands beside Google on both pages and starts the apple provider through the shared callback.');
  process.exit(0);
}
console.log(`FAIL: ${failures.length} problem(s)`);
for (const f of failures) console.log('  ! ' + f);
process.exit(1);
