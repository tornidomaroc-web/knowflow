import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_COOKIE_OPTIONS, MAX_CHUNK_SIZE, createChunks } from '@supabase/ssr';
import { SESSION_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options';

export const dynamic = 'force-dynamic';

/**
 * THE EXPERIMENT FOR REGISTER #135 (a). A diagnostic, not a feature: it can be
 * deleted the day the row closes.
 *
 * On 2026-09-29T01:04:00Z an iPhone in a Safari Private tab tapped a verified
 * signup link. The callback answered `307 /ar/dashboard` with the session
 * cookies; Safari showed "the server stopped responding" and never asked for
 * the dashboard. The same route's two refused 307s, which carry no cookie,
 * load fine in the same Private tab (the owner, 2026-09-29T23:50Z). So the one
 * thing left to test is a 307 THAT SETS COOKIES OF THE SESSION'S SHAPE, and
 * the only way to get one on a phone today is to sign up, which spends a mail
 * and a token every attempt and cannot vary the shape.
 *
 * This route is that 307 without the signup. `?variant=` picks the cookie
 * shape; the redirect lands back here with `?landed=<variant>`, and the page
 * lists which probe cookies the browser sent back. The cookies are built by
 * `@supabase/ssr`'s OWN chunker with its OWN defaults, so `real` is the
 * production shape to the byte in everything but the name and the value:
 *
 *   none    a 307 with no cookie at all (the control the owner already passed)
 *   real    the session as it is written today: two chunks, no `Secure`
 *   secure  the same two chunks with `Secure` (what the app writes after #135)
 *   one     a single 1 KB cookie, well under one chunk
 *   big     six full chunks, about 19 KB of Set-Cookie
 *
 * The names are `kf-probe-auth-token.N`, never `sb-…`: nothing in the app
 * reads them, and no real session is touched. The value is the letter `a`
 * repeated, so no data leaves this file. Only a GET is answered, and only a
 * browser is affected by it, and only its own cookies.
 *
 * READING THE RESULT ON THE PHONE (Safari, a Private tab, no account, no mail):
 *   1. Open `/api/auth/cookie-probe?variant=real`. If the page that lists the
 *      cookies appears, the production shape crosses the Private tab and the
 *      01:04 failure was not deterministic on our response. If Safari fails as
 *      it did, it is reproduced; then `none` (must pass) and `secure`, `one`,
 *      `big` say which property matters.
 *   2. On the landing page, "open a real page": the same cookies ride on a
 *      request through the middleware, which is the second half of the real
 *      landing. "Clear" removes them.
 */
const VARIANTS = {
  none: { chunks: 0, secure: false },
  real: { chunks: 2, secure: false },
  secure: { chunks: 2, secure: true },
  one: { chunks: 1, secure: false, bytes: 1024 },
  big: { chunks: 6, secure: false },
} as const;
type Variant = keyof typeof VARIANTS;

const NAME = 'kf-probe-auth-token';

function isVariant(v: string | null): v is Variant {
  return v !== null && Object.prototype.hasOwnProperty.call(VARIANTS, v);
}

/** The session cookies' shape, from the library that writes the real ones. */
function probeCookies(variant: Variant) {
  const spec = VARIANTS[variant];
  if (spec.chunks === 0) return [];
  // Two chunks means one full chunk and a short tail, as a real session splits.
  const bytes = 'bytes' in spec ? spec.bytes : (spec.chunks - 1) * MAX_CHUNK_SIZE + 300;
  const options = { ...DEFAULT_COOKIE_OPTIONS, ...(spec.secure ? SESSION_COOKIE_OPTIONS : {}) };
  return createChunks(NAME, 'a'.repeat(bytes)).map(({ name, value }) => ({ name, value, options }));
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const self = `${origin}/api/auth/cookie-probe`;
  const received = request.cookies.getAll().filter((c) => c.name === NAME || c.name.startsWith(`${NAME}.`));

  if (searchParams.get('clear') === '1') {
    const response = NextResponse.redirect(`${self}?landed=cleared`);
    received.forEach(({ name }) => response.cookies.set(name, '', { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 }));
    return response;
  }

  const variant = searchParams.get('variant');
  if (isVariant(variant)) {
    const response = NextResponse.redirect(`${self}?landed=${variant}`);
    probeCookies(variant).forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }

  const landed = searchParams.get('landed');
  const rows = received.map((c) => `<li><code>${c.name}</code>: ${c.value.length} bytes</li>`).join('');
  const total = received.reduce((n, c) => n + c.name.length + c.value.length, 0);
  const links = (Object.keys(VARIANTS) as Variant[])
    .map((v) => `<a href="${self}?variant=${v}">${v}</a>`)
    .join(' · ');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Cookie probe (#135)</title></head>
<body style="font: 16px/1.5 system-ui; padding: 24px; max-width: 40rem; margin: auto">
<h1 style="font-size: 1.25rem">Cookie probe (register #135)</h1>
<p>Landed: <strong>${landed ? landed.replace(/[^a-z]/g, '') : 'nothing yet'}</strong>. Probe cookies the browser sent back: <strong>${received.length}</strong>, ${total} bytes.</p>
<ul>${rows || '<li>none</li>'}</ul>
<p>Run a variant: ${links}</p>
<p><a href="${origin}/ar/login">Open a real page with these cookies</a> · <a href="${self}?clear=1">Clear the probe cookies</a></p>
</body></html>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
