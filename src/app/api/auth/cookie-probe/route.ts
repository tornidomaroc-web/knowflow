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
 *   real    the session as it was written at 01:04: two chunks, no `Secure`
 *   secure  the same two chunks with `Secure` (what the app writes after #228)
 *   one     a single 1 KB cookie, well under one chunk
 *   big     six full chunks, about 19 KB of Set-Cookie
 *
 * The names are `kf-probe-auth-token.N`, never `sb-…`: nothing in the app
 * reads them, and no real session is touched. The value is the letter `a`
 * repeated, so no data leaves this file. Only a GET is answered, and only a
 * browser is affected by it, and only its own cookies.
 *
 * WHAT IT NEVER DOES (amended 2026-10-04, on the owner's review of #228):
 *   - It never reads, counts or echoes a cookie outside its own names: the
 *     landing sees only names matching `PROBE_NAME`, shows their size and
 *     never their value, and a name that does not match is not rendered at
 *     all (a planted name is markup, and this page writes names into HTML).
 *   - Every answer it gives (307, 200, the sunset 404, an error 500) carries
 *     `Cache-Control: no-store`. Without it, production sends a route
 *     handler's 307 as `public, max-age=0, must-revalidate` (measured on
 *     `/api/auth/callback`, 2026-10-04).
 *   - It answers nothing after `SUNSET`: a temporary route on production that
 *     forgets to be removed stops on its own. Extending it is a one-line PR.
 *   - `big` (19 KB of cookies on every request to the site) expires in an
 *     hour, not 400 days: a link to it must not leave a browser carrying
 *     that weight for a year. `real`, `secure` and `one` keep the library's
 *     Max-Age, because they are the shape under test.
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
  big: { chunks: 6, secure: false, maxAge: 60 * 60 },
} as const;
type Variant = keyof typeof VARIANTS;

const NAME = 'kf-probe-auth-token';
const PROBE_NAME = /^kf-probe-auth-token(\.\d+)?$/;
/** After this instant the route answers 404 to everything. Row #135 (a). */
const SUNSET = Date.parse('2026-10-31T23:59:59Z');
const NO_STORE = 'no-store';

function isVariant(v: string | null): v is Variant {
  return v !== null && Object.prototype.hasOwnProperty.call(VARIANTS, v);
}

/** The session cookies' shape, from the library that writes the real ones. */
function probeCookies(variant: Variant) {
  const spec = VARIANTS[variant];
  if (spec.chunks === 0) return [];
  // Two chunks means one full chunk and a short tail, as a real session splits.
  const bytes = 'bytes' in spec ? spec.bytes : (spec.chunks - 1) * MAX_CHUNK_SIZE + 300;
  const options = { ...DEFAULT_COOKIE_OPTIONS, ...(spec.secure ? SESSION_COOKIE_OPTIONS : {}), ...('maxAge' in spec ? { maxAge: spec.maxAge } : {}) };
  return createChunks(NAME, 'a'.repeat(bytes)).map(({ name, value }) => ({ name, value, options }));
}

export async function GET(request: NextRequest) {
  let response: NextResponse;
  try {
    response = Date.now() > SUNSET ? new NextResponse('Not found', { status: 404 }) : answer(request);
  } catch {
    response = new NextResponse('Probe error', { status: 500 });
  }
  response.headers.set('cache-control', NO_STORE);
  return response;
}

function answer(request: NextRequest): NextResponse {
  const { searchParams, origin } = new URL(request.url);
  const self = `${origin}/api/auth/cookie-probe`;
  const received = request.cookies.getAll().filter((c) => PROBE_NAME.test(c.name));

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
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
