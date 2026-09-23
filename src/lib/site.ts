export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tryknowflow.com'
).replace(/\/$/, '');

export const SITE_NAME = 'KnowFlow';

/**
 * THE ONE ADDRESS A STUDENT IS TOLD TO WRITE TO (register #19, 2026-09-23).
 * Owner-attested: the mailbox is theirs and they read it. Every "contact us"
 * in the app, the contact page, the legal pages and the error sentences,
 * reads this constant, so the promise cannot fork again. (`tryknowflow.com`
 * has ImprovMX mail records, but whether a `support@` alias on that domain
 * forwards anywhere is not readable from outside, so the address the app used
 * to print, `support@` on the domain, is gone from every surface.)
 */
export const SUPPORT_EMAIL = 'unicornapps.support@gmail.com';

/** Fill `{email}` in a dictionary block's strings with SUPPORT_EMAIL. */
export function withSupportEmail<T extends Record<string, string>>(labels: T): T {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels)) out[k] = v.replace('{email}', SUPPORT_EMAIL);
  return out as T;
}
