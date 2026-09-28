import type { EmailOtpType } from '@supabase/supabase-js';

/** Written by the forgot-password page just before it asks for the mail. */
export const RECOVERY_COOKIE = 'kf_recovery';

export type LandingPath = '/reset-password' | '/dashboard';

/**
 * Where a SUCCESSFUL auth landing goes.
 *
 * Split out of the route handler so it can be executed on its own. The route
 * only reaches this decision after a live `verifyOtp` or code exchange, and
 * neither can be minted without sending real mail, so there is no HTTP-level
 * proof of the cross-device case available without spending a real link.
 * Exercising the decision directly is, and `scripts/verify-recovery-landing.mjs`
 * imports THIS module rather than a copy of it.
 *
 * `type=recovery` on the link is AUTHORITATIVE; the cookie is only a fallback.
 * The type survives a trip to another device. The cookie cannot, because it
 * lives in the browser that asked for the mail. Consulting the cookie first is
 * the regression this exists to prevent: once the recovery template emits a
 * `token_hash` link, `verifyOtp` succeeds on ANY device, so a phone opening a
 * laptop's reset mail would be signed in and dropped on the dashboard with the
 * password it came to replace still unset. That is worse than today's honest
 * failure, because the window is open and nothing on screen says so.
 */
export function resolveLandingPath(input: {
  otpType?: EmailOtpType | string | null;
  hasRecoveryCookie: boolean;
}): LandingPath {
  if (input.otpType === 'recovery') return '/reset-password';
  return input.hasRecoveryCookie ? '/reset-password' : '/dashboard';
}

export type FailedLinkNotice = 'recovery_expired' | 'link_expired';

/**
 * Which login notice a mail link gets when `verifyOtp` refuses it.
 *
 * The same authority as above: `type` is written into the link by the mail
 * template, so an expired link and an already-used one carry it alike, and it
 * does not depend on anything the refusal says. A password-reset link gets its
 * own notice, pointing at a new link: its owner has an account, and "sign up
 * again", which `link_expired` says, would send them no reset mail. Every other
 * type keeps `link_expired`. The cookie is NOT consulted: it only says this
 * browser once asked for a reset, not that this link was one.
 *
 * A hand-edited `type` can only change which of the two notices is shown; the
 * link has already been refused by then.
 */
export function failedLinkNotice(otpType: EmailOtpType | string | null | undefined): FailedLinkNotice {
  return otpType === 'recovery' ? 'recovery_expired' : 'link_expired';
}
