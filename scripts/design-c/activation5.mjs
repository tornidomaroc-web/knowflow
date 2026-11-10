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
 * The owner's review of #315 adds:
 *   upload-refused-app / -desk         the subject page's drop zone after a
 *       REAL refusal: a .zip picked through the real file input (the type check refuses it
 *       before the permission sheet and before any request, on main and on
 *       this PR alike), so main's own error state is rendered and check 14
 *       is measured on it.
 *   ask-oldconv-nomaterial-app / -desk an old conversation in Statistics,
 *       which has since lost its files (`?open=c6`).
 *
 * The owner's review of PR #316 at fc60340 adds:
 *   upload-mime-app / -desk            the drop zone after the ROUTE's mime
 *       refusal, "... (.pdf). ...": a "notes.pdf" whose type is text/plain,
 *       picked through the real input. It passes the drop zone's type check;
 *       the preview has no consent provider, so it is sent at once to the
 *       local server's real /api/ingest, which refuses a type that
 *       contradicts the extension before it reads any account (no Supabase
 *       call), on main and on this PR alike. A mime refusal always names an
 *       ACCEPTED extension (".zip" is refused earlier, as `type`), so the
 *       fixture is ".pdf"; the bracketed group "(.pdf)" is drawn the same way
 *       for any extension.
 * The upload states now take `?platform=` (the app's shell on -app).
 *
 * CHECK 14 (dropZoneErrorCheck, on every app render of a drop zone error
 * state): inside the first 390 x 844 view, above the tab bar, a visible
 * control of at least 44 x 44 that is the topmost element at its centre and,
 * tapped there, opens the file picker (the input's click() is caught, so no
 * dialog opens). dropZoneErrorPlant() hides the controls and must be flagged.
 *
 * CHECK 13 (askPathCheck, on the 390 x 844 Ask screens): in a subject with no
 * file to answer from, the way to its upload tile ([data-kf-ask-upload-link]
 * inside [data-kf-ask-upload-path="material"]) lies wholly inside the first
 * 390 x 844 view, above the tab bar. askPathPlant() pushes it 900 px down and
 * the check must flag that, or the run fails.
 */

export function activation5Screens(add, { APP, SAFARI, DESK, DESKTOP }, byKey) {
  const ask = { view: 'app', kb: 'k3' };
  add('ask-nomaterial-app', 'preview/ask', { platform: 'native', ...ask }, APP, { pr4: 'ask', askPath: true });
  add('ask-nomaterial-web', 'preview/ask', { platform: 'web', ...ask }, SAFARI, { pr4: 'ask', askPath: true });
  add('ask-nomaterial-desk', 'preview/ask', { platform: 'web', ...ask }, DESK, { view: DESKTOP, targets: false, pr4: 'ask' });
  for (const state of ['processing', 'failed', 'consent', 'declined']) {
    const extra = state === 'consent' ? { pr4: 'consent' } : {};
    add(`upload-${state}-app`, 'preview/upload', { platform: 'native', state }, APP, extra);
    add(`upload-${state}-desk`, 'preview/upload', { platform: 'web', state }, DESK, { view: DESKTOP, targets: false, ...extra });
  }
  // The owner's review of #315: check 14 on the app's error states, one of
  // them a real refusal that main renders too.
  byKey('upload-failed-app').dzError = true;
  // On the subject page's preview, which main already renders in the app's
  // shell (?platform=native), so main's own app error state is measured.
  add('upload-refused-app', 'preview/subject', { platform: 'native' }, APP, { a5: 'refuse', dzError: true });
  add('upload-refused-desk', 'preview/subject', { platform: 'web' }, DESK, { view: DESKTOP, targets: false, a5: 'refuse' });
  // The owner's review of #316: the route's mime refusal, "(.pdf).", in the drop zone.
  add('upload-mime-app', 'preview/subject', { platform: 'native' }, APP, { a5: 'mime', dzError: true });
  add('upload-mime-desk', 'preview/subject', { platform: 'web' }, DESK, { view: DESKTOP, targets: false, a5: 'mime' });
  add('ask-oldconv-nomaterial-app', 'preview/ask', { platform: 'native', view: 'app', open: 'c6' }, APP, { pr4: 'ask' });
  add('ask-oldconv-nomaterial-desk', 'preview/ask', { platform: 'web', view: 'app', open: 'c6' }, DESK, { view: DESKTOP, targets: false, pr4: 'ask' });
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

/** The interactions: a refused file through the real input (refuse, mime); the real form, filled and sent (check-inbox). */
export async function a5Act(tab, job) {
  if (job.s.a5 === 'mime') {
    // An accepted extension with a type that contradicts it: the route's own
    // mime refusal (415), answered by the local server before any account read.
    await tab.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) throw new Error('no file input');
      const dt = new DataTransfer();
      dt.items.add(new File(['not a study file'], 'notes.pdf', { type: 'text/plain' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await tab.waitForFunction(() => {
      const z = document.querySelector('input[type="file"]')?.parentElement;
      return z && (z.matches('.border-danger-border') || z.querySelector('.border-danger-border'));
    }, { timeout: 15000 });
    // The refusal shown must be the route's mime sentence (it names "(.pdf)"),
    // not the network failure or another refusal.
    const shown = await tab.evaluate(() => document.querySelector('input[type="file"]')?.parentElement?.textContent || '');
    if (!shown.includes('(.pdf)')) return { act: 'mime', error: `the drop zone shows no "(.pdf)" refusal: ${shown.slice(0, 160)}` };
    return { act: 'mime' };
  }
  if (job.s.a5 === 'refuse') {
    // A .zip is not an accepted type: DropZone refuses it before the
    // permission sheet and before any request, on main and on this PR alike.
    await tab.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) throw new Error('no file input');
      const dt = new DataTransfer();
      dt.items.add(new File(['not a study file'], 'notes.zip', { type: 'application/zip' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await tab.waitForFunction(() => {
      const z = document.querySelector('input[type="file"]')?.parentElement;
      return z && (z.matches('.border-danger-border') || z.querySelector('.border-danger-border'));
    }, { timeout: 15000 });
    return { act: 'refuse' };
  }
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

/**
 * CHECK 14. Self-contained: serialised into the page. Run at the screen's own
 * size, scrolled to the top, before the page is grown for the shot. A drop
 * zone is the element holding a file input; it is in an error state when it
 * is, or holds, a red-edged box (.border-danger-border): main's markup and
 * this PR's alike.
 */
export function dropZoneErrorCheck() {
  window.scrollTo(0, 0);
  const zones = [...document.querySelectorAll('input[type="file"]')].map((i) => i.parentElement)
    .filter((z) => z && (z.matches('.border-danger-border') || z.querySelector('.border-danger-border')));
  if (!zones.length) return { zones: 0, controls: [], finding: 'drop zone error state: none on screen' };
  const H = window.innerHeight, W = window.innerWidth;
  let limit = H;
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.pointerEvents === 'none') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.top < H / 2 || b.top >= H) continue;
    limit = Math.min(limit, b.top);
  }
  // The picker is caught, not opened: every file input's click() and showPicker().
  const proto = HTMLInputElement.prototype;
  const realClick = proto.click, realShow = proto.showPicker;
  let opened = 0;
  proto.click = function () { if (this.type === 'file') { opened++; return; } return realClick.call(this); };
  proto.showPicker = function () { if (this.type === 'file') { opened++; return; } return realShow.call(this); };
  const found = [];
  try {
    for (const z of zones) {
      const cands = [z, ...z.querySelectorAll('button, a[href], [role="button"], label')];
      let ok = null;
      for (const c of cands) {
        const r = c.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) continue;
        if (r.top < 0 || r.bottom > limit + 0.5 || r.left < -0.5 || r.right > W + 0.5) continue;
        const cs = getComputedStyle(c);
        if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (!hit || !(hit === c || c.contains(hit))) continue;
        const before = opened;
        // A tap at the centre: the event reaches the topmost element there and bubbles.
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
        if (opened > before) {
          const tag = c.getAttribute('data-kf-upload');
          ok = { el: c.tagName.toLowerCase() + (tag ? `[data-kf-upload=${tag}]` : ''), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), limit: Math.round(limit) };
          break;
        }
      }
      found.push(ok);
    }
  } finally {
    proto.click = realClick; proto.showPicker = realShow;
  }
  window.scrollTo(0, 0);
  const missing = found.filter((f) => !f).length;
  return { zones: zones.length, controls: found, finding: missing ? `drop zone error state: ${missing} of ${zones.length} has no visible control of 44 x 44 or more inside the first ${W} x ${H} view (usable bottom ${Math.round(limit)}) that opens the file picker` : null };
}

/** Its forced wrong case: the drop zone's controls hidden must be flagged. */
export function dropZoneErrorPlant() {
  const tag = document.createElement('style');
  tag.textContent = '[data-kf-upload] { display: none !important; }';
  document.head.appendChild(tag);
  let forced;
  try { forced = window.dropZoneErrorCheck(); } finally { tag.remove(); }
  window.scrollTo(0, 0);
  return { forced: forced.controls, caught: !!forced.finding, finding: forced.finding ? null : `check 14 is blind: the drop zone's controls hidden were not flagged (${JSON.stringify(forced.controls)})` };
}
