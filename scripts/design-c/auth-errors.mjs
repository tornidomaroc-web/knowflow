/**
 * AUTH ERRORS IN THE PAGE'S LANGUAGE (audit causes #8 and #3, 2026-11-09).
 *
 * THE FIXTURES, one list read by scripts/verify-auth-errors.mjs (the real
 * auth-js client against these replies, in the tsc job) and by render.mjs
 * (the real pages in Chrome, here): for each form, GoTrue's reply as the
 * hosted project sends it (status, `error_code`, its English `msg`), or no
 * reply at all (status 0: the request is refused before an answer, as when
 * the connection is lost), and the message key it must show.
 *
 * SCREENS (ar and en, light and dark; render.mjs makes the four jobs):
 *   auth-<form>-<id>-app   sign-up and sign-in in the app at 390;
 *   auth-reset-<id>-web    the new-password page at 390 in Safari (the mail
 *                          link opens in Safari, never in the app);
 *   auth-<form>-<id>-desk  each at 1280.
 * The page's own fetch of GoTrue is answered IN THE PAGE (as check-inbox
 * does, activation5.mjs): nothing leaves the browser, no account exists. The
 * new-password page needs a session to show its form: a fixture session is
 * written to the browser client's cookie (`sb-127-auth-token`, the default
 * key for http://127.0.0.1:54321), which no server ever accepts.
 *
 * CHECK 16 (authErrorCheck, on every render of sign-up, sign-in, the
 * new-password and the forgot-password pages): on an Arabic render, every
 * auth error message shown (`form .border-danger-border`) contains an Arabic
 * letter and no Latin sentence of three words or more; on a fixture screen an
 * error message must be shown at all (a fixture that shows nothing proves
 * nothing). A finding fails AFTER. BEFORE (main) reports GoTrue's English as
 * it reaches the Arabic page today. authErrorPlant() forces both wrong
 * cases on every Arabic AFTER render that shows a message (a Latin sentence
 * appended; the Arabic taken out) and each must be flagged, or the run fails.
 */

export const AUTH_ERROR_FIXTURES = [
  { form: 'signup', id: 'weak', status: 422, code: 'weak_password', msg: 'Password should be at least 6 characters.', key: 'weakPassword' },
  { form: 'signup', id: 'bad-email', status: 400, code: 'email_address_invalid', msg: 'Email address "student@example.com" is invalid', key: 'invalidEmail' },
  { form: 'signup', id: 'mail-limit', status: 429, code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded', key: 'emailRateLimit' },
  { form: 'signup', id: 'rate', status: 429, code: 'over_request_rate_limit', msg: 'Request rate limit reached', key: 'requestRateLimit' },
  { form: 'signup', id: 'exists', status: 422, code: 'user_already_exists', msg: 'User already registered', key: 'generic' },
  { form: 'signup', id: 'network', status: 0, key: 'network' },
  { form: 'login', id: 'wrong', status: 400, code: 'invalid_credentials', msg: 'Invalid login credentials', key: 'invalidCredentials' },
  { form: 'login', id: 'unconfirmed', status: 400, code: 'email_not_confirmed', msg: 'Email not confirmed', key: 'emailNotConfirmed' },
  { form: 'login', id: 'rate', status: 429, code: 'over_request_rate_limit', msg: 'Request rate limit reached', key: 'requestRateLimit' },
  { form: 'login', id: 'unknown', status: 400, code: 'captcha_failed', msg: 'captcha protection: request disallowed (no captcha response)', key: 'generic' },
  { form: 'login', id: 'network', status: 0, key: 'network' },
  { form: 'reset', id: 'weak', status: 422, code: 'weak_password', msg: 'Password is known to be weak and easy to guess, please choose a different one.', key: 'weakPassword' },
  { form: 'reset', id: 'same', status: 422, code: 'same_password', msg: 'New password should be different from the old password.', key: 'samePassword' },
  { form: 'reset', id: 'session', status: 403, code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist', key: 'sessionMissing' },
  { form: 'reset', id: 'unknown', status: 500, code: 'unexpected_failure', msg: 'Unexpected failure, please check server logs for more information', key: 'generic' },
  { form: 'reset', id: 'network', status: 0, key: 'network' },
];

/** Where each form's request goes, and its method. */
export const AUTH_ENDPOINT = {
  signup: { method: 'POST', path: /\/auth\/v1\/signup(\?|$)/ },
  login: { method: 'POST', path: /\/auth\/v1\/token\?grant_type=password/ },
  reset: { method: 'PUT', path: /\/auth\/v1\/user(\?|$)/ },
};

/** GoTrue's JSON body for a fixture (null: no answer). */
export function fixtureBody(fx) {
  if (!fx.status) return null;
  return {
    code: fx.status, error_code: fx.code, msg: fx.msg,
    ...(fx.code === 'weak_password' ? { weak_password: { reasons: ['length'], message: fx.msg } } : {}),
  };
}

/** A session the browser client reads from its cookie; no server accepts it. */
export const FIXTURE_SESSION = () => ({
  access_token: 'not-a-token', token_type: 'bearer', expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'not-a-token',
  user: {
    id: '00000000-0000-4000-8000-000000000007', aud: 'authenticated', role: 'authenticated', email: 'student@example.com',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-11-10T00:00:00Z',
  },
});
export const SESSION_COOKIE = 'sb-127-auth-token';
export const sessionCookieValue = () => `base64-${Buffer.from(JSON.stringify(FIXTURE_SESSION())).toString('base64url')}`;

const PAGE = { signup: 'signup', login: 'login', reset: 'reset-password' };

export function authErrorScreens(add, { APP, SAFARI, DESK, DESKTOP }) {
  for (const fx of AUTH_ERROR_FIXTURES) {
    const authErr = { form: fx.form, id: fx.id };
    if (fx.form === 'reset') add(`auth-reset-${fx.id}-web`, PAGE.reset, {}, SAFARI, { authErr });
    else add(`auth-${fx.form}-${fx.id}-app`, PAGE[fx.form], {}, APP, { authErr });
    add(`auth-${fx.form}-${fx.id}-desk`, PAGE[fx.form], {}, DESK, { view: DESKTOP, targets: false, authErr });
  }
}

/** Is this screen one of the auth pages check 16 reads? */
export const isAuthPage = (path) => ['signup', 'login', 'reset-password', 'forgot-password'].includes(path);

/** Before the page loads: GoTrue's reply in the page, and the session cookie for the new-password page. */
export async function authPrepare(tab, job, base) {
  const a = job.s.authErr;
  if (!a) return;
  const fx = AUTH_ERROR_FIXTURES.find((f) => f.form === a.form && f.id === a.id);
  const ep = AUTH_ENDPOINT[fx.form];
  if (fx.form === 'reset') await tab.setCookie({ name: SESSION_COOKIE, value: sessionCookieValue(), url: base });
  await tab.evaluateOnNewDocument((path, method, status, body) => {
    const re = new RegExp(path);
    const real = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
      const m = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (re.test(url) && m === method) {
        if (!status) return Promise.reject(new TypeError('Failed to fetch'));
        return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
      }
      return real(input, init);
    };
  }, ep.path.source, ep.method, fx.status, fixtureBody(fx));
}

/** The real form, filled and sent; done when an error message is drawn. */
export async function authAct(tab, job) {
  const a = job.s.authErr;
  if (!a) return null;
  if (a.form === 'reset') {
    // The form shows once the browser client has read the fixture session.
    await tab.waitForFunction(() => {
      const b = document.querySelector('form button[type="submit"]');
      return b && !b.disabled && document.querySelector('form input[name="new-password"]');
    }, { timeout: 15000 });
  }
  await tab.evaluate((form) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const fill = (name, v) => {
      const el = document.querySelector(`form input[name="${name}"]`);
      if (!el) throw new Error(`no input ${name}`);
      set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    if (form === 'signup') { fill('name', 'Student'); fill('email', 'student@example.com'); fill('password', 'a-long-password-1'); fill('confirm-password', 'a-long-password-1'); }
    if (form === 'login') { fill('email', 'student@example.com'); fill('password', 'a-long-password-1'); }
    if (form === 'reset') fill('new-password', 'a-long-password-1');
    document.querySelector('form button[type="submit"]').click();
  }, a.form);
  await tab.waitForFunction(() => document.querySelector('form .border-danger-border'), { timeout: 15000 });
  return { act: `auth-${a.form}-${a.id}` };
}

/** CHECK 16. Self-contained: serialised into the page. */
export function authErrorCheck(locale, expectError) {
  const boxes = [...document.querySelectorAll('form .border-danger-border')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const ARABIC = /[؀-ۿ]/;
  const LATIN3 = /[A-Za-z]+(?:[\s,.'’:;!?()"-]+[A-Za-z]+){2,}/;
  const findings = [];
  if (expectError && !boxes.length) findings.push('auth error: the forced error shows no message');
  const texts = boxes.map((b) => b.textContent.trim());
  if (locale === 'ar') {
    for (const t of texts) {
      if (!ARABIC.test(t)) findings.push(`auth error: an Arabic page shows a message with no Arabic letter: "${t.slice(0, 90)}"`);
      const m = LATIN3.exec(t);
      if (m) findings.push(`auth error: an Arabic page shows a Latin sentence of 3+ words: "${m[0].slice(0, 90)}"`);
    }
  }
  return { boxes: boxes.length, texts, findings };
}

/**
 * Check 16's forced wrong cases, on an Arabic AFTER render with a message:
 * (a) GoTrue's English appended to the message; (b) the message's text
 * replaced by one Latin word. Each must be flagged; each is undone.
 */
export function authErrorPlant(locale) {
  const box = [...document.querySelectorAll('form .border-danger-border')].find((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (locale !== 'ar' || !box) return { forced: 0, caught: 0, finding: null };
  const span = document.createElement('span');
  span.textContent = ' Invalid login credentials';
  box.appendChild(span);
  let a;
  try { a = window.authErrorCheck(locale, true); } finally { span.remove(); }
  const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push([n, n.data]);
  let b;
  try {
    nodes.forEach(([n], i) => { n.data = i === 0 ? 'Error' : ''; });
    b = window.authErrorCheck(locale, true);
  } finally { for (const [n, d] of nodes) n.data = d; }
  const caughtA = a.findings.some((f) => f.includes('Latin sentence of 3+ words'));
  const caughtB = b.findings.some((f) => f.includes('no Arabic letter'));
  const caught = (caughtA ? 1 : 0) + (caughtB ? 1 : 0);
  return { forced: 2, caught, finding: caught === 2 ? null : `check 16 is blind: GoTrue's English appended flagged ${caughtA}, the Arabic taken out flagged ${caughtB}` };
}
