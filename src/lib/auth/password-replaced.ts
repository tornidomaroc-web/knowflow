import type { User } from '@supabase/supabase-js';

/**
 * Set by /api/auth/callback when the landing user is one whose password GoTrue
 * has just destroyed. Read and cleared on the dashboard, so the notice is shown
 * exactly once.
 */
export const PASSWORD_REPLACED_COOKIE = 'kf_pw_replaced';

/**
 * How much newer the provider identity must be than the user row before we call
 * this a link onto a pre-existing account.
 *
 * A fresh Google signup mints the user and the identity inside ONE GoTrue
 * transaction, so its gap is milliseconds. A user who signed up with a password
 * first and only later pressed "continue with Google" has a gap of at least the
 * time it took them to read a mail they never confirmed. Sixty seconds sits far
 * above the first and far below any realistic second.
 */
export const IDENTITY_AGE_GAP_MS = 60_000;

/**
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * An UNCONFIRMED email+password user who signs in with Google keeps their
 * account, their id and all their rows, and silently loses their password.
 *
 * This is not a Supabase misconfiguration and it is not something we can turn
 * off. It is `RemoveUnconfirmedIdentities` in GoTrue, read at the exact version
 * this project deploys (v2.196.0, `internal/models/user.go:1020`, verified
 * byte-identical to upstream `master` on 2026-09-09):
 *
 *     if identity.Provider != "email" && identity.Provider != "phone" {
 *         u.EncryptedPassword = nil                  // the password is destroyed
 *         tx.UpdateOnly(u, "encrypted_password")
 *     }
 *     u.UserMetaData = identity.IdentityData          // metadata replaced wholesale
 *     // ...then every identity except the provider one is destroyed
 *
 * It is a deliberate anti-takeover measure: an unconfirmed address is not proof
 * of ownership, so whoever proves it via the provider wins, and the unproven
 * password is discarded rather than trusted. We are not arguing with it. We are
 * refusing to let it happen in silence.
 *
 * ============================================================================
 * WHY PROVIDER ABSENCE ALONE IS NOT THE TEST
 * ============================================================================
 * The obvious check is "no email identity", and it is WRONG. After the link, a
 * harmed user reads exactly like a brand-new Google signup: one identity, its
 * provider is google, no email identity anywhere. Gating on that shape would
 * tell every first-time Google user that a password they never had has stopped
 * working, which is a worse defect than the one being fixed.
 *
 * The discriminator is that GoTrue REUSES the existing user row. It links the
 * new identity to a user that already existed and it never touches created_at.
 * So the provider identity is much newer than the user; on a fresh signup the
 * two are minted together. That gap is the only thing that separates the two
 * shapes, and both timestamps are already in the callback response: GoTrue runs
 * `tx.Load(user, "Identities")` on every token issuance, and `Identity.CreatedAt`
 * is serialized as `created_at` with no omitempty.
 *
 * ============================================================================
 * FAIL CLOSED
 * ============================================================================
 * Every uncertain branch returns false. A missed notice leaves the user where
 * they already are, with a working recovery path they have not been pointed at.
 * A false notice tells someone their password is gone when it is not. The first
 * is the failure we accept.
 */
export function detectPasswordReplaced(user: User | null | undefined): boolean {
  if (!user) return false;

  const identities = user.identities;
  if (!identities || identities.length === 0) return false;

  // An email identity still standing means nothing was removed, so there is no
  // password to have lost. This is the cheap exit and the common one.
  if (identities.some((i) => i.provider === 'email' || i.provider === 'phone')) {
    return false;
  }

  const userCreated = Date.parse(user.created_at ?? '');
  if (Number.isNaN(userCreated)) return false;

  // The identity that was just written is the newest one. After the link there
  // is only ever one left, but taking the max keeps this correct if GoTrue ever
  // leaves more than one standing rather than depending on it not doing so.
  let newestIdentity = Number.NEGATIVE_INFINITY;
  for (const identity of identities) {
    const created = Date.parse(identity.created_at ?? '');
    if (Number.isNaN(created)) return false;
    if (created > newestIdentity) newestIdentity = created;
  }

  return newestIdentity - userCreated > IDENTITY_AGE_GAP_MS;
}
