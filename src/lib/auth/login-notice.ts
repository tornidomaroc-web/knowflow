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
/**
 * Whether the address carries GoTrue's error fragment (`#error=…&error_code=…
 * &error_description=…`). A refused mail link arrives with one: /verify writes
 * it, and the browser keeps a fragment across the redirects that follow
 * (callback, then the locale hop), so it would sit in the login page's address
 * bar with GoTrue's own wording in it. The page clears it and never shows it;
 * the notice comes from `?notice=` alone. Any other fragment is left alone.
 */
export function isAuthErrorFragment(hash: string): boolean {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  return p.has('error') || p.has('error_code') || p.has('error_description');
}

export function loginNotice(code: string | null, t: Dictionary, locale: string): LoginNotice | null {
  if (code === 'signin_required') return { text: t.auth.noticeSigninRequired, link: null };
  if (code === 'link_expired') return { text: t.auth.noticeLinkExpired, link: null };
  if (code === 'recovery_expired') {
    return { text: t.auth.noticeRecoveryExpired, link: { href: `/${locale}/forgot-password`, label: t.auth.forgotLink } };
  }
  return null;
}
