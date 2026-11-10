import type { Locale } from '@/lib/i18n';
import { AUTH_COPY_DRAFT, type AuthCopyKey } from '@/lib/auth/auth-copy-drafts';

/**
 * WHAT AN AUTH FORM SHOWS WHEN SUPABASE REFUSES (audit cause #8, 2026-11-09:
 * GoTrue's own English sentence, "Invalid login credentials", "User already
 * registered", "Failed to fetch", reached the Arabic sign-up, sign-in and
 * new-password pages as it came).
 *
 * The forms now show a sentence of OURS, in the page's language, chosen from
 * the error's CODE. Display only: the auth calls, their handlers, the
 * callback and the confirmation flow are unchanged.
 *
 * THE ORDER IS code, then the error's class name, then the HTTP status. The
 * English message text is NEVER read: auth-js gives every reply from GoTrue
 * a code (`error_code`, or `code` under API version 2024-01-01), and the
 * errors it raises itself carry a class name (AuthRetryableFetchError when
 * the request never got an answer or got a 502, 503 or 504;
 * AuthSessionMissingError when there is no session to update). A reply with
 * no code and no known class falls back to its status (429 is a rate limit),
 * then to the generic sentence. So an Arabic screen never shows a raw English
 * sentence, whatever GoTrue answers.
 *
 * EACH FORM SHOWS ONLY WHAT IS TRUE FOR IT. A key outside the form's list
 * (an "email not confirmed" on the new-password page, say) becomes the
 * generic sentence.
 *
 * DISCLOSURE: never more than before (docs/copy-drafts/auth_errors.md has the
 * review). An existing account is never named: `user_already_exists`,
 * `email_exists` and `identity_already_exists` show the generic sentence. A
 * wrong password and an unknown address are the same reply
 * (`invalid_credentials`). The send limit says nothing of an earlier mail.
 */
export type AuthForm = 'signup' | 'login' | 'reset';

export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'weakPassword'
  | 'samePassword'
  | 'invalidEmail'
  | 'emailRateLimit'
  | 'requestRateLimit'
  | 'sessionMissing'
  | 'network'
  | 'generic';

/** What the mapper reads from a Supabase AuthError: never its message. */
export type AuthErrorLike = { code?: string | null; name?: string | null; status?: number | null } | null | undefined;

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  email_address_invalid: 'invalidEmail',
  over_email_send_rate_limit: 'emailRateLimit',
  over_request_rate_limit: 'requestRateLimit',
  session_not_found: 'sessionMissing',
  session_expired: 'sessionMissing',
  refresh_token_not_found: 'sessionMissing',
  refresh_token_already_used: 'sessionMissing',
  request_timeout: 'network',
  // Never named: an existing account is not disclosed (see above).
  user_already_exists: 'generic',
  email_exists: 'generic',
  identity_already_exists: 'generic',
};

const BY_NAME: Record<string, AuthErrorKey> = {
  AuthRetryableFetchError: 'network',
  AuthSessionMissingError: 'sessionMissing',
  AuthWeakPasswordError: 'weakPassword',
  // auth-js raises it before any request when the email or password is missing.
  AuthInvalidCredentialsError: 'invalidCredentials',
};

const ALLOWED: Record<AuthForm, readonly AuthErrorKey[]> = {
  signup: ['weakPassword', 'invalidEmail', 'emailRateLimit', 'requestRateLimit', 'network', 'generic'],
  login: ['invalidCredentials', 'emailNotConfirmed', 'requestRateLimit', 'network', 'generic'],
  reset: ['weakPassword', 'samePassword', 'sessionMissing', 'requestRateLimit', 'network', 'generic'],
};

/** The message key for a Supabase auth error on this form. */
export function authErrorKey(error: AuthErrorLike, form: AuthForm): AuthErrorKey {
  const key = pick(error);
  return ALLOWED[form].includes(key) ? key : 'generic';
}

function pick(error: AuthErrorLike): AuthErrorKey {
  if (!error) return 'generic';
  if (typeof error.code === 'string' && BY_CODE[error.code]) return BY_CODE[error.code];
  if (typeof error.name === 'string' && BY_NAME[error.name]) return BY_NAME[error.name];
  if (error.status === 429) return 'requestRateLimit';
  return 'generic';
}

/** The approved strings this mapping reuses (the rest are drafts). */
type ApprovedAuth = { resetNoSession: string };

/**
 * The sentence for a key, in the page's language. `sessionMissing` reuses the
 * approved `auth.resetNoSession`; every other key is a DRAFT awaiting the
 * owner (src/lib/auth/auth-copy-drafts.ts). On approval the drafts move into
 * the dictionaries as `auth.errors` and the one line below reads
 * `t.auth.errors[key]` instead.
 */
export function authErrorText(key: AuthErrorKey, t: { auth: ApprovedAuth }, locale: Locale): string {
  if (key === 'sessionMissing') return t.auth.resetNoSession;
  return AUTH_COPY_DRAFT[locale][key as AuthCopyKey];
}

/** The page's sentence for a Supabase auth error on this form. */
export function authErrorMessage(error: AuthErrorLike, form: AuthForm, t: { auth: ApprovedAuth }, locale: Locale): string {
  return authErrorText(authErrorKey(error, form), t, locale);
}
