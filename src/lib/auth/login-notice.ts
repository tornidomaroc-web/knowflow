import type { useTranslation } from '@/lib/i18n';

type Dictionary = ReturnType<typeof useTranslation>;

export type LoginNotice = { text: string; link: { href: string; label: string } | null };

/**
 * What the login page says for `?notice=<code>`, the codes the auth callback
 * sends (`src/app/api/auth/callback/route.ts`). An unknown or absent code
 * says nothing.
 *
 * A failed password-reset link (`recovery_expired`) carries the way to a new
 * one inside the notice: its owner has an account and needs a new link, not
 * the sign-up advice `link_expired` gives.
 */
export function loginNotice(code: string | null, t: Dictionary, locale: string): LoginNotice | null {
  if (code === 'signin_required') return { text: t.auth.noticeSigninRequired, link: null };
  if (code === 'link_expired') return { text: t.auth.noticeLinkExpired, link: null };
  if (code === 'recovery_expired') {
    return { text: t.auth.noticeRecoveryExpired, link: { href: `/${locale}/forgot-password`, label: t.auth.forgotLink } };
  }
  return null;
}
