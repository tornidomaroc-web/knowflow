/**
 * ACTIVATION FIX 5 (the 2026-11-09 audit, causes #6, #10, #7): the screens
 * the audit never rendered, and check 13.
 *
 * Screens, in ar and en, light and dark (render.mjs makes the four jobs):
 *   ask-nomaterial-app / -web / -desk  Ask opened on a subject with no file it
 *       can answer from (`?kb=k3`: the preview's Statistics holds only a
 *       processing file). AFTER opens that subject on the way to its upload
 *       tile; main (BEFORE) quietly switches to the first subject that can be
 *       asked, which is what this PR changes.
 *   upload-processing-app / -desk      the drop zone 12 s into processing.
 *   upload-failed-app / -desk          the reply when processing fails.
 *   upload-consent-app / -desk         the picked file held under the open
 *       permission sheet (pr4 'consent' checks apply to the sheet).
 *   upload-declined-app / -desk        the tile again after "Not now".
 *   check-inbox-app / -web / -desk     sign-up's "Check your inbox" notice,
 *       unchanged, reached through the real form: the page's own fetch of
 *       GoTrue's /auth/v1/signup is answered in the page with a user and no
 *       session (confirm-email on), so nothing leaves the browser.
 * The upload states are frozen previews (`/preview/upload?state=`); main does
 * not know `state` and renders its default page, so BEFORE is main's upload
 * preview.
 *
 * CHECK 13 (askPathCheck, on the 390 x 844 Ask screens): in a subject with no
 * file to answer from, the way to its upload tile ([data-kf-ask-upload-link]
 * inside [data-kf-ask-upload-path="material"]) lies wholly inside the first
 * 390 x 844 view, above the tab bar. askPathPlant() pushes it 900 px down and
 * the check must flag that, or the run fails.
 */

export function activation5Screens(add, { APP, SAFARI, DESK, DESKTOP }) {
  const ask = { view: 'app', kb: 'k3' };
  add('ask-nomaterial-app', 'preview/ask', { platform: 'native', ...ask }, APP, { pr4: 'ask', askPath: true });
  add('ask-nomaterial-web', 'preview/ask', { platform: 'web', ...ask }, SAFARI, { pr4: 'ask', askPath: true });
  add('ask-nomaterial-desk', 'preview/ask', { platform: 'web', ...ask }, DESK, { view: DESKTOP, targets: false, pr4: 'ask' });
  for (const state of ['processing', 'failed', 'consent', 'declined']) {
    const extra = state === 'consent' ? { pr4: 'consent' } : {};
    add(`upload-${state}-app`, 'preview/upload', { platform: 'native', state }, APP, extra);
    add(`upload-${state}-desk`, 'preview/upload', { platform: 'web', state }, DESK, { view: DESKTOP, targets: false, ...extra });
  }
  add('check-inbox-app', 'signup', {}, APP, { a5: 'check-inbox' });
  add('check-inbox-web', 'signup', {}, SAFARI, { a5: 'check-inbox' });
  add('check-inbox-desk', 'signup', {}, DESK, { view: DESKTOP, targets: false, a5: 'check-inbox' });
}

/**
 * Before the page loads (check-inbox only): GoTrue's sign-up answers in the
 * page, as it does with confirm-email on: a user, no session.
 */
export async function a5Prepare(tab, job) {
  if (job.s.a5 !== 'check-inbox') return;
  await tab.evaluateOnNewDocument(() => {
    const real = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
      if (/\/auth\/v1\/signup(\?|$)/.test(url)) {
        const user = {
          id: '00000000-0000-4000-8000-000000000005', aud: 'authenticated', role: '', email: 'student@example.com',
          app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
          identities: [{ id: '00000000-0000-4000-8000-000000000005', identity_id: '00000000-0000-4000-8000-000000000006', user_id: '00000000-0000-4000-8000-000000000005', provider: 'email', identity_data: { email: 'student@example.com' } }],
          created_at: '2026-11-10T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
        };
        return Promise.resolve(new Response(JSON.stringify(user), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return real(input, init);
    };
  });
}

/** The interaction (check-inbox only): the real form, filled and sent. */
export async function a5Act(tab, job) {
  if (job.s.a5 !== 'check-inbox') return null;
  await tab.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const fill = (name, v) => {
      const el = document.querySelector(`form input[name="${name}"]`);
      if (!el) throw new Error(`no input ${name}`);
      set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    fill('name', 'Student');
    fill('email', 'student@example.com');
    fill('password', 'a-long-password-1');
    fill('confirm-password', 'a-long-password-1');
  });
  await tab.evaluate(() => document.querySelector('form button[type="submit"]').click());
  // Done when the notice box (its title and its sentence) is drawn; an error
  // box instead (a failed sign-up) is the interaction's failure.
  await tab.waitForFunction(() => document.querySelector('form .border-primary-border p + p') || document.querySelector('form .border-danger-border'), { timeout: 15000 });
  const err = await tab.evaluate(() => document.querySelector('form .border-danger-border')?.textContent || null);
  if (err) return { act: 'check-inbox', error: `sign-up showed an error, not the notice: ${err.slice(0, 120)}` };
  return { act: 'check-inbox' };
}

/**
 * CHECK 13. Self-contained: serialised into the page. Run at the screen's own
 * size, scrolled to the top, before the page is grown for the shot.
 */
export function askPathCheck() {
  window.scrollTo(0, 0);
  const path = document.querySelector('[data-kf-ask-upload-path="material"]');
  const link = path && path.querySelector('[data-kf-ask-upload-link]');
  if (!link) return { link: null, finding: 'zero-material Ask: no way to the subject\'s upload tile ([data-kf-ask-upload-path="material"] [data-kf-ask-upload-link])' };
  const H = window.innerHeight, W = window.innerWidth;
  let limit = H;
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.pointerEvents === 'none') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.top < H / 2 || b.top >= H) continue;
    limit = Math.min(limit, b.top);
  }
  const r = link.getBoundingClientRect();
  const box = { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), limit: Math.round(limit), viewport: `${W} x ${H}`, href: link.getAttribute('href') };
  const inside = r.top >= 0 && r.bottom <= limit + 0.5 && r.left >= -0.5 && r.right <= W + 0.5 && r.height > 0;
  const sub = /\/dashboard\/knowledge\/[^/?#]+$/.test(box.href || '');
  const bad = [
    ...(inside ? [] : [`not fully inside the first ${W} x ${H} view above the tab bar (top ${box.top}, bottom ${box.bottom}, usable bottom ${box.limit})`]),
    ...(sub ? [] : [`it leads to ${box.href}, not the subject's own page`]),
  ];
  return { link: box, finding: bad.length ? `zero-material Ask: the upload link is ${bad.join('; ')}` : null };
}

/** Its forced wrong case: the link pushed 900 px down must be flagged. */
export function askPathPlant() {
  const tag = document.createElement('style');
  tag.textContent = '[data-kf-ask-upload-path="material"] [data-kf-ask-upload-link] { margin-top: 900px !important; }';
  document.head.appendChild(tag);
  let forced;
  try { forced = window.askPathCheck(); } finally { tag.remove(); }
  window.scrollTo(0, 0);
  return { forced: forced.link, caught: !!forced.finding, finding: forced.finding ? null : `check 13 is blind: the upload link pushed down 900 px was not flagged (${JSON.stringify(forced.link)})` };
}
