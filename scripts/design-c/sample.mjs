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

/**
 * CHECK 18 (the owner's review of PR #322 at d9647f5, 2026-11-12), by mode:
 *   home / home-desk  (a) in the sample block (the line under the button and
 *              the notice), no protected unit spans two lines: a keep-together
 *              phrase (src/lib/keep-together.ts, KEEP_TOGETHER: "a ready
 *              question", "سؤال جاهز", ...), a kept name (KEEP_WHOLE:
 *              "Voyage AI"), "Anthropic", and every short Latin run LatinText
 *              isolates ([data-kf-latin=short], 30 characters or fewer). d9647f5
 *              drew "...a ready / question." and "...Voyage / AI.". And the
 *              declined sentence has the description's size and colour (it was
 *              text-sm under a text-xs line).
 *   ask        (b) the suggestions well ([data-kf-thread]) has no more than
 *              24 px of empty space under its last suggestion card (d9647f5
 *              kept the height of three cards under two).
 * sampleWholePlant() forces the wrong case per mode (a protected phrase in a
 * 1 px wide line inside the sample block; the well held 700 px tall) and the
 * check must flag it, or the run fails.
 */
export const GAP_MAX = 24;

export function sampleWholeMode(job) {
  const m = job.s.sample;
  return m === 'home' || m === 'home-desk' || m === 'ask' ? m : null;
}

/** Self-contained: serialised into the page. `units` = KEEP_TOGETHER + KEEP_WHOLE + "Anthropic". */
export function sampleWholeCheck(mode, units) {
  window.scrollTo(0, 0);
  const done = (measured, bad) => ({ mode, measured, finding: bad.length ? `check 18 (${mode}): ${bad.join('; ')}` : null });
  if (mode === 'ask') {
    const well = document.querySelector('[data-kf-thread]');
    const cards = well ? [...well.querySelectorAll('[data-kf-suggestion]')] : [];
    if (!well || !cards.length) return done({ cards: cards.length }, ['no suggestions well with a suggestion card']);
    const gap = Math.round(well.getBoundingClientRect().bottom - cards[cards.length - 1].getBoundingClientRect().bottom);
    return done({ cards: cards.length, gap }, gap <= GAP_MAX + 0.5 ? [] : [`the suggestions well has ${gap} px of empty space under its last card (max ${GAP_MAX})`]);
  }
  const blocks = [...document.querySelectorAll('[data-kf-sample] [data-kf-sample-desc], [data-kf-sample] [data-kf-sample-notice], [data-kf-sample] [data-kf-plant18]')];
  if (!blocks.length) return done({ read: 0 }, ['no sample block']);
  const re = new RegExp(units.map((p) => p.split(' ').join('[  ]+')).join('|'), 'g');
  const lines = (rects, lh) => {
    const mids = [];
    for (const r of rects) {
      if (r.width < 0.5 || r.height < 0.5) continue;
      const mid = (r.top + r.bottom) / 2;
      if (!mids.some((m) => Math.abs(m - mid) < lh / 2)) mids.push(mid);
    }
    return mids.length;
  };
  const bad = [];
  let read = 0;
  for (const b of blocks) {
    const lh = parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.4;
    const at = [];
    let s = '';
    const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) for (let i = 0; i < n.data.length; i++) { at.push([n, i]); s += n.data[i]; }
    const ranges = [];
    for (const m of s.matchAll(re)) {
      const r = document.createRange();
      const a = at[m.index], z = at[m.index + m[0].length - 1];
      r.setStart(a[0], a[1]); r.setEnd(z[0], z[1] + 1);
      ranges.push([m[0], r]);
    }
    for (const el of b.querySelectorAll('[data-kf-latin="short"], [data-kf-keep]')) {
      const r = document.createRange(); r.selectNodeContents(el); ranges.push([el.textContent, r]);
    }
    for (const [what, r] of ranges) {
      read++;
      const n = lines(r.getClientRects(), lh);
      if (n > 1) bad.push(`"${what.replace(/ /g, ' ')}" spans ${n} lines in [${[...b.attributes].map((x) => x.name).find((x) => x.startsWith('data-kf-'))}]`);
    }
  }
  const desc = document.querySelector('[data-kf-sample] [data-kf-sample-desc]');
  const notice = document.querySelector('[data-kf-sample] [data-kf-sample-notice="declined"]');
  let style = null;
  if (desc && notice) {
    const d = getComputedStyle(desc), n = getComputedStyle(notice);
    style = { desc: `${d.fontSize} ${d.color}`, declined: `${n.fontSize} ${n.color}` };
    if (d.fontSize !== n.fontSize || d.color !== n.color) bad.push(`the declined sentence is ${style.declined}, the description ${style.desc}: they must match`);
  }
  if (!read) bad.push('no protected unit read in the sample block (the description holds one)');
  return done({ read, ...(style ? { style } : {}) }, bad);
}

/** Its forced wrong cases, measured with the same function; each must be flagged. */
export function sampleWholePlant(mode, units) {
  let undo;
  if (mode === 'ask') {
    const tag = document.createElement('style');
    tag.textContent = '[data-kf-thread] { min-height: 700px !important; flex: none !important; }';
    document.head.appendChild(tag);
    undo = () => tag.remove();
  } else {
    const p = document.createElement('p');
    p.setAttribute('data-kf-plant18', '');
    p.style.width = '1px';
    p.textContent = units[0];
    const host = document.querySelector('[data-kf-sample]') || document.body;
    host.appendChild(p);
    undo = () => p.remove();
  }
  let forced;
  try { forced = window.sampleWholeCheck(mode, units); } finally { undo(); }
  window.scrollTo(0, 0);
  return { mode, caught: !!forced.finding, forced: forced.measured, finding: forced.finding ? null : `check 18 is blind in mode ${mode}: the forced wrong case was not flagged (${JSON.stringify(forced.measured)})` };
}

/**
 * Check 18 against d9647f5's own layout, in this run's AFTER page: this
 * commit's fixes undone in the live DOM (the no-break spaces back to spaces,
 * the kept names' nowrap off, the declined sentence back to text-sm, the
 * well, the chat column and the Ask card stretched again), then measured.
 * Reported, not required: where d9647f5 split nothing (Arabic home, desk),
 * nothing is expected.
 */
export function sampleWholeRevert(mode, units) {
  const undo = [];
  if (mode === 'ask') {
    const well = document.querySelector('[data-kf-thread]');
    for (const el of [well, well && well.parentElement, document.querySelector('[data-kf-ask-card]')]) {
      if (!el) continue;
      const was = el.style.cssText;
      el.style.setProperty('flex', '1 1 0%', 'important');
      undo.push(() => { el.style.cssText = was; });
    }
  } else {
    const tw = document.createTreeWalker(document.querySelector('[data-kf-sample]') || document.body, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.data.includes('\u00A0')) continue;
      const node = n, was = n.data;
      node.data = was.replace(/\u00A0/g, ' ');
      undo.push(() => { node.data = was; });
    }
    for (const el of document.querySelectorAll('[data-kf-sample] [data-kf-keep], [data-kf-sample] [data-kf-sample-notice="declined"]')) {
      const was = el.style.cssText;
      if (el.hasAttribute('data-kf-keep')) el.style.whiteSpace = 'normal';
      else { el.style.fontSize = '0.875rem'; el.style.lineHeight = '1.25rem'; }
      undo.push(() => { el.style.cssText = was; });
    }
  }
  let r;
  try { r = window.sampleWholeCheck(mode, units); } finally { for (const u of undo.reverse()) u(); }
  window.scrollTo(0, 0);
  return { mode, flagged: !!r.finding, finding: r.finding, measured: r.measured };
}
