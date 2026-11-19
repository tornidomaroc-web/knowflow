import { createHash, createPrivateKey, sign } from 'node:crypto';

/**
 * SIGN IN WITH APPLE, THE SERVER'S PART (iOS 1.1, big item 4f): the code
 * exchange and the token revoke Apple requires at account deletion ("Apps
 * that support Sign in with Apple should use the Sign in with Apple REST API
 * to revoke user tokens",
 * https://developer.apple.com/support/offering-account-deletion-in-your-app/).
 *
 * NOTHING IS STORED. The app asks Apple for a fresh authorization code at the
 * moment of deletion (one more Apple sheet); this file exchanges it at
 * /auth/token, checks whose it is, and later revokes the refresh token that
 * exchange returned. No refresh token is ever written anywhere, so there is no
 * table of long-lived Apple credentials to protect, rotate or leak.
 *
 * THE CODE IS ALSO THE CONFIRMATION (the owner's addition, item 4). The
 * exchanged id_token's `sub` must equal the session's own Apple identity. A
 * code can only be made by someone who just passed Apple's own sheet for that
 * Apple ID, which is stronger proof than typing an address the settings page
 * displays.
 *
 * WHY THE id_token's SIGNATURE IS NOT CHECKED. It is not taken from the
 * client: this server receives it directly from appleid.apple.com over TLS,
 * in answer to a request authenticated with our own client secret. OpenID
 * Connect allows TLS server validation in place of the signature in exactly
 * this case (Core 1.0, 3.1.3.7, item 6), and it spares a JWKS fetch. The
 * claims are still held: issuer, audience, expiry, freshness, subject, nonce.
 *
 * THE CLIENT SECRET is an ES256 JWT minted per call with a 5-minute expiry
 * (Apple allows up to six months:
 * https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret),
 * so nothing ever needs rotating. Signed with node:crypto: no dependency.
 *
 * Server-only variables, set by the owner in Vercel (never NEXT_PUBLIC_):
 * APPLE_SIWA_TEAM_ID, APPLE_SIWA_KEY_ID, APPLE_SIWA_PRIVATE_KEY (the .p8 PEM).
 * Missing, every call answers `missing-env` and never reaches Apple.
 *
 * NOTHING HERE THROWS, and nothing here logs a token, a code or the key.
 */
export const APPLE_CLIENT_ID = 'com.knowflow.app';
export const APPLE_ISSUER = 'https://appleid.apple.com';
export const APPLE_TIMEOUT_MS = 5000;
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
/** A code lives five minutes; its token's iat must be at most this old. */
const FRESH_MS = 10 * 60 * 1000;

export type AppleServerEnv = { teamId: string; keyId: string; privateKey: string };

export function appleServerEnv(env: Record<string, string | undefined> = process.env): AppleServerEnv | null {
  const teamId = env.APPLE_SIWA_TEAM_ID?.trim();
  const keyId = env.APPLE_SIWA_KEY_ID?.trim();
  // A PEM pasted into a dashboard often arrives with literal "\n".
  const privateKey = env.APPLE_SIWA_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey };
}

/** Whether the server can confirm a deletion with Apple at all (the card asks for the typed email otherwise). */
export function appleConfirmConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return appleServerEnv(env) !== null;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** Throws on a bad key; every caller below catches. */
export function appleClientSecret(env: AppleServerEnv, nowMs: number = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: env.keyId }));
  const body = b64url(JSON.stringify({ iss: env.teamId, iat, exp: iat + 300, aud: APPLE_ISSUER, sub: APPLE_CLIENT_ID }));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(env.privateKey), dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64url(sig)}`;
}

/** The Apple `sub` of the session's apple identity, or null for any other account. */
export function appleIdentitySub(user: { identities?: Array<{ provider?: string; id?: string; identity_data?: Record<string, unknown> | null }> | null }): string | null {
  const identity = (user.identities ?? []).find((i) => i?.provider === 'apple');
  if (!identity) return null;
  const sub = identity.identity_data?.sub ?? identity.id;
  return typeof sub === 'string' && sub.trim() !== '' ? sub : null;
}

type Fetch = typeof fetch;

export type AppleExchangeFailure = 'missing-env' | 'bad-key' | 'timeout' | 'network' | 'refused' | 'malformed' | 'stale' | 'mismatch';
export type AppleExchange =
  | { ok: true; sub: string; refreshToken: string | null; accessToken: string | null; status: number }
  | { ok: false; reason: AppleExchangeFailure; status: number | null };

async function post(url: string, form: Record<string, string>, fetchImpl: Fetch | undefined, timeoutMs: number): Promise<{ res: Response } | { fail: 'timeout' | 'network' }> {
  // A plain timer, not AbortSignal.timeout(): that one is unref'd, so a hung
  // request can leave nothing holding the process to fire it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await (fetchImpl ?? globalThis.fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
      signal: controller.signal,
      cache: 'no-store',
    });
    return { res };
  } catch {
    return { fail: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function claims(idToken: unknown): Record<string, unknown> | null {
  if (typeof idToken !== 'string') return null;
  const part = idToken.split('.')[1];
  if (!part) return null;
  try {
    const o = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Exchanges a fresh authorization code (valid five minutes, single use) and
 * says whether it belongs to `expectedSub`. `rawNonce` is the value the card
 * hashed for Apple; when the token carries a nonce claim it must be that hash.
 */
export async function exchangeAppleCode(o: {
  code: string;
  expectedSub: string;
  rawNonce?: string | null;
  env?: AppleServerEnv | null;
  fetchImpl?: Fetch;
  nowMs?: number;
  timeoutMs?: number;
}): Promise<AppleExchange> {
  const env = o.env === undefined ? appleServerEnv() : o.env;
  if (!env) return { ok: false, reason: 'missing-env', status: null };
  let secret: string;
  try {
    secret = appleClientSecret(env, o.nowMs ?? Date.now());
  } catch {
    return { ok: false, reason: 'bad-key', status: null };
  }
  const r = await post(TOKEN_URL, { client_id: APPLE_CLIENT_ID, client_secret: secret, code: o.code, grant_type: 'authorization_code' }, o.fetchImpl, o.timeoutMs ?? APPLE_TIMEOUT_MS);
  if ('fail' in r) return { ok: false, reason: r.fail, status: null };
  const status = r.res.status;
  let body: Record<string, unknown> | null = null;
  try {
    body = (await r.res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (!r.res.ok) return { ok: false, reason: 'refused', status };
  const c = claims(body?.id_token);
  if (!c) return { ok: false, reason: 'malformed', status };
  const aud = c.aud;
  if (c.iss !== APPLE_ISSUER || !(aud === APPLE_CLIENT_ID || (Array.isArray(aud) && aud.includes(APPLE_CLIENT_ID)))) return { ok: false, reason: 'malformed', status };
  const now = o.nowMs ?? Date.now();
  const exp = typeof c.exp === 'number' ? c.exp * 1000 : 0;
  const iat = typeof c.iat === 'number' ? c.iat * 1000 : 0;
  if (exp <= now || iat < now - FRESH_MS || iat > now + FRESH_MS) return { ok: false, reason: 'stale', status };
  if (typeof c.sub !== 'string' || c.sub !== o.expectedSub) return { ok: false, reason: 'mismatch', status };
  if (typeof c.nonce === 'string' && o.rawNonce) {
    if (c.nonce !== createHash('sha256').update(o.rawNonce).digest('hex')) return { ok: false, reason: 'mismatch', status };
  }
  const tok = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
  return { ok: true, sub: c.sub, refreshToken: tok(body?.refresh_token), accessToken: tok(body?.access_token), status };
}

/** Ends KnowFlow's access to the student's Apple Account. Apple answers 200 on success. */
export async function revokeAppleToken(o: {
  token: string;
  hint: 'refresh_token' | 'access_token';
  env?: AppleServerEnv | null;
  fetchImpl?: Fetch;
  timeoutMs?: number;
}): Promise<{ outcome: 'revoked' | 'failed'; status: number | null }> {
  const env = o.env === undefined ? appleServerEnv() : o.env;
  if (!env) return { outcome: 'failed', status: null };
  let secret: string;
  try {
    secret = appleClientSecret(env);
  } catch {
    return { outcome: 'failed', status: null };
  }
  const r = await post(REVOKE_URL, { client_id: APPLE_CLIENT_ID, client_secret: secret, token: o.token, token_type_hint: o.hint }, o.fetchImpl, o.timeoutMs ?? APPLE_TIMEOUT_MS);
  if ('fail' in r) return { outcome: 'failed', status: null };
  return { outcome: r.res.ok ? 'revoked' : 'failed', status: r.res.status };
}

/** What DELETE /api/account says about Apple, for an Apple account only. */
export type AppleRevokeOutcome = 'revoked' | 'failed' | 'skipped' | 'mismatch';
