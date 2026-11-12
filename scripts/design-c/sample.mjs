/**
 * THE SAMPLE FILE (audit cause 9, docs/plans/sample-file.md): its screens and
 * check 17.
 *
 * Screens, in ar and en, light and dark (render.mjs makes the four jobs):
 *   home-empty / home-empty-desk / home-one / home-one-desk  (existing keys)
 *       the home with no material now carries the button under the three
 *       steps; main (BEFORE) has none, which check 17 reports there.
 *   home-full / home-full-desk  (existing keys) a home WITH material: the
 *       button must be absent.
 *   home-sample-declined   the card after "Not now" on the permission sheet:
 *       the approved declined sentence under the button, nothing created.
 *   subject-sample-app / -desk  the subject "مثال" / "Sample" holding the one
 *       ready file.
 *   ask-sample-app / -desk      Ask opened on that subject: the ready question
 *       as a chip under the field.
 * The new states are frozen previews (`?sample=`, `?view=sample`); main does
 * not know them and renders its default page, so BEFORE is main's preview.
 *
 * CHECK 17 (sampleCheck), by mode:
 *   home       (390 x 844) exactly one [data-kf-sample-button], inside the
 *              steps card and after its list, reading the approved button
 *              text, at least 44 x 44, wholly inside the first view above the
 *              tab bar, with its one-line description under it.
 *   home-desk  (1280) the same button and description, visible.
 *   absent     a home with material: no sample button anywhere.
 *   ask        exactly one [data-kf-sample-question] inside the composer,
 *              reading the approved question on ONE line and not truncated;
 *              on a phone at least 44 tall and inside the first view. Pressed,
 *              it puts the question in the field and NO request leaves (the
 *              page's fetch is counted); the field is then emptied again so
 *              the shot shows the screen as it opens.
 *   no-question  every other Ask render: no ready question.
 * samplePlant() forces the wrong case for each mode (the button pushed 900 px
 * down or hidden; a button injected into a home with material; the chip
 * pushed down or hidden; a chip injected into another subject's Ask) and the
 * check must flag it, or the run fails.
 */

export function sampleScreens(add, { APP, DESK, DESKTOP }, byKey) {
  for (const k of ['home-empty', 'home-one']) byKey(k).sample = 'home';
  for (const k of ['home-empty-desk', 'home-one-desk']) byKey(k).sample = 'home-desk';
  for (const k of ['home-full', 'home-full-desk']) byKey(k).sample = 'absent';
  add('home-sample-declined', 'preview/student-home', { platform: 'native', sample: 'declined' }, APP, { sample: 'home' });
  add('subject-sample-app', 'preview/subject', { platform: 'native', view: 'sample' }, APP, { pr3: true });
  add('subject-sample-desk', 'preview/subject', { platform: 'web', view: 'sample' }, DESK, { view: DESKTOP, targets: false, pr3: true });
  const ask = { view: 'app', sample: '1', kb: 'ks' };
  add('ask-sample-app', 'preview/ask', { platform: 'native', ...ask }, APP, { pr4: 'ask', sample: 'ask' });
  add('ask-sample-desk', 'preview/ask', { platform: 'web', ...ask }, DESK, { view: DESKTOP, targets: false, pr4: 'ask', sample: 'ask' });
}

/** Which mode a job is checked in: its own, or `no-question` on every other Ask render. */
export function sampleMode(job) {
  return job.s.sample || (job.s.path === 'preview/ask' ? 'no-question' : null);
}

/**
 * CHECK 17. Self-contained: serialised into the page. Run at the screen's own
 * size, scrolled to the top, before the page is grown for the shot.
 */
export async function sampleCheck(mode, locale) {
  window.scrollTo(0, 0);
  const TEXT = {
    ar: { button: 'جرّب بملف جاهز', desc: 'ملف قصير عن الخلية وسؤال جاهز. يمكنك حذفه متى شئت.', question: 'ما دور الميتوكوندريا في الخلية؟' },
    en: { button: 'Try with a sample file', desc: 'A short file about the cell and a ready question. You can delete it any time.', question: 'What do mitochondria do in the cell?' },
  }[locale];
  const H = window.innerHeight, W = window.innerWidth;
  const phone = W < 768;
  let limit = H;
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.pointerEvents === 'none') continue;
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.top < H / 2 || b.top >= H) continue;
    limit = Math.min(limit, b.top);
  }
  const text = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const seen = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0; };
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), limit: Math.round(limit), viewport: `${W} x ${H}` }; };
  const inFirstView = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= limit + 0.5 && r.left >= -0.5 && r.right <= W + 0.5; };
  const done = (measured, bad, what) => ({ mode, measured, finding: bad.length ? `${what}: ${bad.join('; ')}` : null });

  if (mode === 'absent') {
    const n = document.querySelectorAll('[data-kf-sample-button]').length;
    return done({ buttons: n }, n ? [`${n} sample button(s) on a home that has material`] : [], 'sample button');
  }
  if (mode === 'no-question') {
    const n = document.querySelectorAll('[data-kf-sample-question]').length;
    return done({ chips: n }, n ? [`${n} ready question(s) on an Ask screen that is not the sample subject's`] : [], 'ready question');
  }
  if (mode === 'home' || mode === 'home-desk') {
    const home = document.querySelector('[data-kf-home]') || document.querySelector('main div.max-w-6xl');
    const card = home && [...home.querySelectorAll('section')].find((s) => s.querySelector(':scope > ol'));
    const all = document.querySelectorAll('[data-kf-sample-button]');
    const btn = card && card.querySelector('[data-kf-sample-button]');
    if (!btn) return done({ buttons: all.length }, [`no sample button in the three-steps card (${all.length} on the page)`], 'sample button');
    const list = card.querySelector(':scope > ol');
    const desc = card.querySelector('[data-kf-sample-desc]');
    const b = box(btn);
    const bad = [
      ...(all.length === 1 ? [] : [`${all.length} sample buttons on the page, want 1`]),
      ...(list.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING ? [] : ['the button is not after the steps']),
      ...(seen(btn) ? [] : ['the button is not visible']),
      ...(text(btn) === TEXT.button ? [] : [`the button reads "${text(btn)}", want "${TEXT.button}"`]),
      ...(!phone || (b.w >= 44 && b.h >= 44) ? [] : [`the button is ${b.w} x ${b.h}, under 44 x 44`]),
      ...(!phone || inFirstView(btn) ? [] : [`the button is not fully inside the first ${W} x ${H} view above the tab bar (top ${b.top}, bottom ${b.bottom}, usable bottom ${b.limit})`]),
      ...(desc && seen(desc) && text(desc) === TEXT.desc ? [] : [`the line under the button reads "${desc ? text(desc) : '(none)'}", want "${TEXT.desc}"`]),
    ];
    const notice = card.querySelector('[data-kf-sample-notice]');
    return done({ button: b, text: text(btn), desc: desc ? box(desc) : null, notice: notice ? notice.getAttribute('data-kf-sample-notice') : null }, bad, 'sample button');
  }
  // mode === 'ask'
  const all = document.querySelectorAll('[data-kf-sample-question]');
  const chip = document.querySelector('[data-kf-composer] [data-kf-sample-question]');
  if (!chip) return done({ chips: all.length }, [`no ready question in the composer (${all.length} on the page)`], 'ready question');
  const label = chip.querySelector('span') || chip;
  const b = box(chip);
  const lh = parseFloat(getComputedStyle(label).lineHeight) || 20;
  const field = document.querySelector('[data-kf-composer] textarea');
  // The press: the question goes into the field and nothing is sent.
  const realFetch = window.fetch;
  let requests = 0;
  window.fetch = (...a) => { requests++; return realFetch(...a); };
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const bubblesBefore = document.querySelectorAll('[data-kf-thread] > *').length;
  let filled = null;
  try {
    chip.click();
    await frame();
    filled = field ? field.value : null;
    await frame();
  } finally { window.fetch = realFetch; }
  const chipAfter = !!document.querySelector('[data-kf-composer] [data-kf-sample-question]');
  const bubblesAfter = document.querySelectorAll('[data-kf-thread] > *').length;
  // The field emptied again, through React's own setter, and the caret taken out.
  if (field) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, '');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.blur();
    await frame();
  }
  window.scrollTo(0, 0);
  const bad = [
    ...(all.length === 1 ? [] : [`${all.length} ready questions on the page, want 1`]),
    ...(seen(chip) ? [] : ['the chip is not visible']),
    ...(text(chip) === TEXT.question ? [] : [`the chip reads "${text(chip)}", want "${TEXT.question}"`]),
    ...(label.getBoundingClientRect().height <= lh * 1.5 ? [] : ['the question is on more than one line']),
    ...(label.scrollWidth <= label.clientWidth + 0.5 ? [] : [`the question is cut (${label.scrollWidth} > ${label.clientWidth})`]),
    ...(!phone || b.h >= 44 ? [] : [`the chip is ${b.h} tall, under 44`]),
    ...(inFirstView(chip) ? [] : [`the chip is not fully inside the first ${W} x ${H} view above the tab bar (top ${b.top}, bottom ${b.bottom}, usable bottom ${b.limit})`]),
    ...(filled === TEXT.question ? [] : [`pressed, the field holds "${filled}", want the question`]),
    ...(requests === 0 ? [] : [`pressed, ${requests} request(s) left the page; the chip must send nothing`]),
    ...(chipAfter && bubblesAfter === bubblesBefore ? [] : ['pressed, the conversation changed; the chip must only fill the field']),
  ];
  return done({ chip: b, text: text(chip), filled, requests }, bad, 'ready question');
}

/** Its forced wrong cases, measured with the same function; each must be flagged. */
export async function samplePlant(mode, locale) {
  const style = (css) => { const tag = document.createElement('style'); tag.textContent = css; document.head.appendChild(tag); return () => tag.remove(); };
  const inject = (attr, into) => { const el = document.createElement('button'); el.setAttribute(attr, ''); el.textContent = 'x'; (into || document.body).appendChild(el); return () => el.remove(); };
  const phone = window.innerWidth < 768;
  const cases = {
    home: () => style('[data-kf-sample-button] { margin-top: 900px !important; }'),
    'home-desk': () => style('[data-kf-sample-button] { display: none !important; }'),
    absent: () => inject('data-kf-sample-button'),
    ask: () => style(phone ? '[data-kf-sample-question] { margin-top: 900px !important; }' : '[data-kf-sample-question] { display: none !important; }'),
    'no-question': () => inject('data-kf-sample-question', document.querySelector('[data-kf-composer]')),
  };
  const undo = cases[mode]();
  let forced;
  try { forced = await window.sampleCheck(mode, locale); } finally { undo(); }
  window.scrollTo(0, 0);
  return { mode, caught: !!forced.finding, forced: forced.measured, finding: forced.finding ? null : `check 17 is blind in mode ${mode}: the forced wrong case was not flagged (${JSON.stringify(forced.measured)})` };
}
