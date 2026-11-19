import { shellVersionFromHeaders } from '@/lib/platform';

/**
 * SIGN IN WITH APPLE IN THE APP (iOS 1.1, big item 4f), reached the way
 * KnowFlowSpeech and KnowFlowStore are: through the bridge the iOS shell
 * injects into every page, `window.Capacitor`. No `@capacitor/core` import,
 * no new dependency, no paid or third-party auth service.
 *
 * THE NATIVE FLOW, NOT WEB OAUTH. The plugin (ios/App/App/KnowFlowApple.swift,
 * PR 2) shows Apple's own sheet and hands back an identity token; the page
 * gives that token to Supabase with `signInWithIdToken`. No Services ID, no
 * return URL and no client secret that expires every six months, which is the
 * cost web OAuth carries (STORE_PATH.md, the study's item 4). The web keeps
 * Google and email; it never shows Apple.
 *
 * THE GATE: the native bridge, iOS, the `KnowFlowApple` plugin answering, AND
 * shell 2 on. The plugin is registered only by the iOS shell that carries the
 * Sign in with Apple entitlement (PR 2), so its presence proves both; the
 * Android shell also says `KnowFlowApp/2` and has none; a forged
 * `KnowFlowApp/2` in a browser has no `window.Capacitor`.
 *
 * WHY THE SHELL IS READ FROM navigator.userAgent HERE. The app's /login and
 * /signup are prerendered under `native/layout.tsx`, which may not read the
 * request (verify-platform-gate.mjs), so no shell version reaches them through
 * PlatformProvider. The reading is the server's own parser
 * (`shellVersionFromHeaders`) over the same user agent the server reads, and
 * it is taken after mount only, so the server markup and the hydrated markup
 * are the same by construction: the button appears in an effect.
 */
export const APPLE_PLUGIN = 'KnowFlowApple';

/** The first shell that may show Sign in with Apple (build 9's marker). */
export const APPLE_SHELL_VERSION = 2;

export function appleShellAllowed(shellVersion: number): boolean {
  return Number.isInteger(shellVersion) && shellVersion >= APPLE_SHELL_VERSION;
}

export type AppleMethod = 'available' | 'signIn';

export type AppleBridge = {
  call: (method: AppleMethod, options?: object) => Promise<unknown>;
};

type NativeBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options: object) => Promise<unknown>;
};

export function appleBridge(userAgent: string = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? ''): AppleBridge | null {
  if (!appleShellAllowed(shellVersionFromHeaders((name) => (name === 'user-agent' ? userAgent : null)))) return null;
  const C = (globalThis as { Capacitor?: NativeBridge }).Capacitor;
  if (!C?.isNativePlatform?.()) return null;
  if (!C.getPlatform || C.getPlatform() !== 'ios') return null;
  if (!C.isPluginAvailable?.(APPLE_PLUGIN) || !C.nativePromise) return null;
  const native = C.nativePromise;
  return { call: (method, options) => native(APPLE_PLUGIN, method, options ?? {}) };
}

/**
 * THE NONCE, the replay guard. The page makes 32 random bytes (the RAW
 * nonce, base64url) and gives Apple only its SHA-256 in hex; Apple writes that
 * hash into the identity token, and Supabase hashes the raw value it is given
 * and compares (https://supabase.com/docs/guides/auth/social-login/auth-apple).
 * A token lifted from elsewhere carries another hash and is refused.
 */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const raw = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  const hashed = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/** What KnowFlowApple.signIn resolves with (PR 2). Names come on the first authorization only. */
export type AppleAuthorization = {
  identityToken: string;
  authorizationCode: string;
  user: string;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

export function parseAuthorization(raw: unknown): AppleAuthorization | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const identityToken = str(o.identityToken);
  const authorizationCode = str(o.authorizationCode);
  if (!identityToken || !authorizationCode) return null;
  return {
    identityToken,
    authorizationCode,
    user: str(o.user) ?? '',
    email: str(o.email),
    givenName: str(o.givenName),
    familyName: str(o.familyName),
  };
}

type Authorized = { ok: true; auth: AppleAuthorization } | { ok: false; reason: 'canceled' | 'failed' };

/** One Apple sheet. Cancel is its own answer: the page says nothing then. */
async function authorize(bridge: AppleBridge, hashedNonce: string): Promise<Authorized> {
  try {
    const auth = parseAuthorization(await bridge.call('signIn', { nonce: hashedNonce }));
    return auth ? { ok: true, auth } : { ok: false, reason: 'failed' };
  } catch (e) {
    const code = e && typeof e === 'object' ? (e as { code?: unknown }).code : undefined;
    return { ok: false, reason: code === 'canceled' ? 'canceled' : 'failed' };
  }
}

/** "Sara" and "Ali" to "Sara Ali"; null when Apple gave neither (every sign-in after the first). */
export function appleFullName(given: string | null, family: string | null): string | null {
  const name = [given, family].filter((x): x is string => !!x && x.trim() !== '').map((x) => x.trim()).join(' ');
  return name === '' ? null : name;
}

/** The parts of the Supabase browser client this file uses. */
export type AppleSupabase = {
  auth: {
    signInWithIdToken: (args: { provider: 'apple'; token: string; nonce: string }) => Promise<{
      data: { user: { id: string; user_metadata?: Record<string, unknown> } | null } | null;
      error: { message?: string; status?: number } | null;
    }>;
    updateUser: (args: { data: Record<string, unknown> }) => Promise<{ error: unknown }>;
  };
  from: (table: 'profiles') => {
    update: (values: { full_name: string }) => {
      eq: (column: 'id', value: string) => { is: (column: 'full_name', value: null) => PromiseLike<{ error: unknown }> };
    };
  };
};

export type AppleSignInResult = 'signed-in' | 'canceled' | 'failed';

/**
 * The button's whole flow: the sheet with the hashed nonce, then Supabase with
 * the raw one. On success `@supabase/ssr` has written the session cookie, and
 * the caller navigates to the dashboard as password login does.
 *
 * THE NAME, ONCE. Apple's identity token never carries the name, and Apple
 * gives the name only on the first authorization, so this is the one chance to
 * keep it. It is written only when the account has no name yet: a student who
 * already has a password account under the same address (Supabase links
 * identities by email) keeps the name they chose. The profile row is UPDATED,
 * never upserted, so its plan cannot be touched.
 *
 * Never logs a token or a code: only the outcome and Supabase's message.
 */
export async function signInWithApple(bridge: AppleBridge, supabase: AppleSupabase, locale: string): Promise<AppleSignInResult> {
  const nonce = await makeNonce();
  const sheet = await authorize(bridge, nonce.hashed);
  if ('reason' in sheet) return sheet.reason;
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: sheet.auth.identityToken, nonce: nonce.raw });
  if (error || !data?.user) {
    console.error('[auth] apple signInWithIdToken refused', { message: error?.message ?? 'no user', status: error?.status ?? null });
    return 'failed';
  }
  const name = appleFullName(sheet.auth.givenName, sheet.auth.familyName);
  const meta = data.user.user_metadata ?? {};
  if (name && !str(meta.full_name)) {
    const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: name, ...(str(meta.locale) ? {} : { locale }) } });
    if (metaError) console.error('[auth] apple name: metadata not saved');
    const { error: rowError } = await supabase.from('profiles').update({ full_name: name }).eq('id', data.user.id).is('full_name', null);
    if (rowError) console.error('[auth] apple name: profile not saved');
  }
  return 'signed-in';
}

/**
 * DELETION, CONFIRMED BY APPLE (the owner's addition to the study, item 4). A
 * student who hid their email cannot reasonably type a random
 * privaterelay address, so an Apple account confirms with one more Apple
 * sheet instead. The fresh authorization code goes to DELETE /api/account,
 * which exchanges it with Apple and accepts it only if the token's `sub` is
 * this session's own Apple identity; the same exchange gives the refresh token
 * the server revokes after the deletion. The raw nonce travels with it so the
 * server can match the token's nonce claim when Apple includes one.
 */
export async function confirmDeletionWithApple(bridge: AppleBridge): Promise<{ ok: true; code: string; nonce: string } | { ok: false; reason: 'canceled' | 'failed' }> {
  const nonce = await makeNonce();
  const sheet = await authorize(bridge, nonce.hashed);
  if ('reason' in sheet) return { ok: false, reason: sheet.reason };
  return { ok: true, code: sheet.auth.authorizationCode, nonce: nonce.raw };
}
