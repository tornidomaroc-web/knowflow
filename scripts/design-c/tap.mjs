/**
 * ITEM 4J, TAP FEEDBACK (scripts/design-c/render.mjs imports this).
 *
 * THE LOADING SCREENS. Each dashboard segment that waits on the server has a
 * loading.tsx skeleton (src/components/skeleton/DashboardSkeletons.tsx),
 * drawn through /preview/skeleton in the real chrome: the home, the subjects
 * list, a subject, Ask and Settings, in the app at 390 x 844, on the web at
 * 360 x 800 (Android Chrome, DPR 3) and at 1280 x 800, both languages, both
 * themes. They are NEW screens (main answers 404), so check 22 does not hold
 * them; every screen that existed before is held by check 22 as it was.
 *
 * CHECK 32, on every skeleton render (AFTER fails, BEFORE is reported):
 *   (a) the region `[data-kf-skeleton=<route>]` is there, `aria-busy`, and
 *       draws NO text (no text node with a letter or a digit inside it) and
 *       NO spinner (no `animate-spin`, no progressbar, no animation running
 *       or paused inside it under reduced motion);
 *   (b) the tab bar (phone) or the sidebar (desk) is where the real screen
 *       draws it, to the pixel: the skeleton lives inside the chrome;
 *   (c) the shape of the real page: the same tab loaded with the real
 *       screen's design preview (the same fixtures the other checks use),
 *       the first card's top within 24 px of the skeleton's first card
 *       (cards are `.kf-card`, `.kf-ask`, `.kf-streak`; the deltas of the
 *       first three cards are written to the report either way).
 *   Forced cases on AFTER, after the shot: a word planted in the region and
 *   the first card pushed 40 px down must each be flagged, or the run fails
 *   as blind; the run fails if no AFTER skeleton render ran them.
 *
 * CHECK 33, ONE PRESS, ONE REQUEST (src/lib/single-flight.ts), on the
 * existing study and Ask screens, AFTER the shot (their pictures are check
 * 22's): the routes the buttons call are HELD in the page (never answered,
 * aborted at the end), each button is pressed twice in ONE task, then once
 * more a frame later, and the requests that left the page are counted:
 * Summarize -> POST /api/summarize, Quiz me -> POST /api/quiz/generate,
 * Delete (confirm) -> DELETE /api/documents/<id>, Rename (save) -> PATCH
 * /api/documents/<id>, Ask's send -> POST /api/agent. AFTER must count one of
 * each; BEFORE (main) is reported, the witness. Forced case on every render:
 * a planted button with no guard that posts on each press, pressed twice,
 * must count two, or the counter is blind.
 */
import { ANDROID, A360 } from './android360.mjs';

export const SKELETON_ROUTES = ['home', 'subjects', 'subject', 'ask', 'settings'];

/** The real screen each skeleton stands for: its design preview and its query. */
const REAL = {
  home: ['preview/student-home', { state: 'full' }],
  subjects: ['preview/subjects', {}],
  subject: ['preview/subject', {}],
  ask: ['preview/ask', { view: 'app' }],
  settings: ['preview/settings', {}],
};

export function tapScreens(add, { APP, DESK, DESKTOP }, byKey) {
  for (const route of SKELETON_ROUTES) {
    add(`skel-${route}-app`, 'preview/skeleton', { route, platform: 'native' }, APP, { skel: route });
    add(`skel-${route}-360`, 'preview/skeleton', { route, platform: 'web' }, ANDROID, { view: A360, skel: route });
    add(`skel-${route}-desk`, 'preview/skeleton', { route, platform: 'web' }, DESK, { view: DESKTOP, targets: false, skel: route });
  }
  // Check 33 rides on the existing study and Ask screens (their pictures stay check 22's).
  for (const p of ['app', 'web']) {
    byKey(`study-idle-${p}`).tap = 'study';
    byKey(`ask-empty-${p}`).tap = 'ask';
  }
}

/** The real screen's URL for a skeleton job, on the same side. */
export function realUrl(base, job) {
  const [path, extra] = REAL[job.s.skel];
  const q = new URLSearchParams({ ...extra, platform: job.s.q.platform, ...(job.theme ? { theme: job.theme } : {}) }).toString();
  return `${base}/${job.locale}/${path}?${q}`;
}

/**
 * CHECK 32 (a) and the geometry, IN THE PAGE. Self-contained.
 * Returns { region, text, spinner, animations, chrome, cards }.
 */
export function skelRead(route) {
  const region = document.querySelector(`[data-kf-skeleton="${route}"]`);
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const chromeEl = document.querySelector('nav.kf-tabbar') && getComputedStyle(document.querySelector('nav.kf-tabbar')).display !== 'none'
    ? document.querySelector('nav.kf-tabbar') : document.querySelector('aside');
  const chrome = chromeEl ? box(chromeEl) : null;
  const main = document.querySelector('main');
  const cardsIn = (root) => root ? [...root.querySelectorAll('.kf-card, .kf-ask, .kf-streak')].filter((c) => c.getBoundingClientRect().height > 0 && !c.parentElement.closest('.kf-card, .kf-ask, .kf-streak')).slice(0, 3).map(box) : [];
  if (!region) return { region: false, chrome, cards: cardsIn(main) };
  const text = [];
  const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/[\p{L}\p{N}]/u.test(n.textContent)) text.push(n.textContent.trim().slice(0, 30));
  const spinner = [...region.querySelectorAll('.animate-spin, [role="progressbar"], progress')].length;
  const animations = document.getAnimations().filter((a) => a.effect?.target && region.contains(a.effect.target)).map((a) => a.animationName || 'anonymous');
  return { region: true, busy: region.getAttribute('aria-busy') === 'true', text, spinner, animations, chrome, cards: cardsIn(region) };
}

/** The real screen's chrome and first cards (the same reading, on the real page). */
export function realRead() {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const tab = document.querySelector('nav.kf-tabbar');
  const chromeEl = tab && getComputedStyle(tab).display !== 'none' ? tab : document.querySelector('aside');
  const main = document.querySelector('main');
  const cards = main ? [...main.querySelectorAll('.kf-card, .kf-ask, .kf-streak')].filter((c) => c.getBoundingClientRect().height > 0 && !c.parentElement.closest('.kf-card, .kf-ask, .kf-streak')).slice(0, 3).map(box) : [];
  return { chrome: chromeEl ? box(chromeEl) : null, cards };
}

/** The verdict of check 32 from the two readings. */
export function skelVerdict(sk, real) {
  const findings = [];
  if (!sk.region) return { findings: ['no [data-kf-skeleton] region'], deltas: null };
  if (!sk.busy) findings.push('the region is not aria-busy');
  if (sk.text.length) findings.push(`text in the skeleton: ${JSON.stringify(sk.text.slice(0, 3))}`);
  if (sk.spinner) findings.push(`${sk.spinner} spinner(s) in the skeleton`);
  if (sk.animations.length) findings.push(`animation(s) in the skeleton under reduced motion: ${sk.animations.join(', ')}`);
  if (!sk.chrome || !real.chrome) findings.push('no tab bar or sidebar to compare');
  else if (['x', 'y', 'w', 'h'].some((k) => sk.chrome[k] !== real.chrome[k])) findings.push(`the chrome moved: skeleton ${JSON.stringify(sk.chrome)}, real ${JSON.stringify(real.chrome)}`);
  const deltas = sk.cards.map((c, i) => (real.cards[i] ? { top: c.y - real.cards[i].y, height: c.h - real.cards[i].h } : null));
  if (!sk.cards.length || !real.cards.length) findings.push('no card to compare');
  else if (Math.abs(deltas[0].top) > 24) findings.push(`the first card starts ${deltas[0].top} px from the real screen's (limit 24)`);
  return { findings, deltas };
}

/**
 * Check 32's forced cases, AFTER only, after the shot, IN THE PAGE: the same
 * reader (window.skelRead) run with a word planted in the region, and the
 * first card pushed 40 px down (its move measured), each then undone.
 */
export function skelPlant(route) {
  const region = document.querySelector(`[data-kf-skeleton="${route}"]`);
  if (!region) return { ran: false };
  const word = document.createElement('span');
  word.textContent = 'Loading';
  region.prepend(word);
  const withWord = window.skelRead(route);
  word.remove();
  const first = region.querySelector('.kf-card, .kf-ask, .kf-streak');
  const before = first.getBoundingClientRect().top;
  first.style.marginTop = '40px';
  const moved = Math.round(first.getBoundingClientRect().top - before);
  const pushed = window.skelRead(route);
  first.style.marginTop = '';
  return { ran: true, withWord, moved, pushed };
}

/** Whether check 32 flags both forced cases (the pushed reading is judged against the real screen). */
export function skelPlantCaught(plant, real) {
  if (!plant?.ran) return { word: false, push: false };
  const word = skelVerdict(plant.withWord, real).findings.some((f) => /^text in the skeleton/.test(f));
  // Pushed away from the real top on whichever side it already sat, so the forced delta is at least 40.
  const d0 = plant.pushed.cards[0] && real.cards[0] ? plant.pushed.cards[0].y - plant.moved - real.cards[0].y : 0;
  const shift = d0 < 0 ? -2 * plant.moved : 0;
  const pushedReading = { ...plant.pushed, cards: plant.pushed.cards.map((c, i) => (i === 0 ? { ...c, y: c.y + shift } : c)) };
  const push = plant.moved === 40 && skelVerdict(pushedReading, real).findings.some((f) => /^the first card starts/.test(f));
  return { word, push };
}

/** Check 33: hold the routes the guarded buttons call; count what left the page. */
export function tapHold(r, state, held) {
  if (!state.on) return false;
  const u = new URL(r.url());
  const m = r.method();
  const hit = (m === 'POST' && ['/api/summarize', '/api/quiz/generate', '/api/agent'].includes(u.pathname))
    || ((m === 'DELETE' || m === 'PATCH') && /^\/api\/documents\/[^/]+$/.test(u.pathname));
  if (!hit) return false;
  state.seen.push(`${m} ${u.pathname}`);
  held.push(r);
  return true;
}

/** Check 33's presses, through the real controls, on the existing study or Ask screen. */
export async function tapAct(tab, job, state) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const count = (re) => state.seen.filter((s) => re.test(s)).length;
  const out = {};
  // Two presses in one task, then a third a frame later (the button is disabled by then).
  const twice = (sel) => tab.evaluate(async (s) => {
    const b = typeof s === 'string' ? document.querySelector(s) : null;
    if (!b) return false;
    b.click(); b.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    b.click();
    return true;
  }, sel);
  state.on = true;
  // The planted button: no guard, a POST on each press. The counter must see two.
  await tab.evaluate(() => {
    const b = document.createElement('button');
    b.id = 'kf-tap-plant';
    b.onclick = () => { fetch('/api/summarize', { method: 'POST', body: '{}' }).catch(() => {}); };
    document.body.append(b);
    b.click(); b.click();
  });
  await wait(400);
  out.plant = count(/POST \/api\/summarize/);
  state.seen.length = 0;
  if (job.s.tap === 'study') {
    const card = '[data-kf-shot="todo"]';
    out.summary = (await twice(`${card} [data-kf-study="summary"] button`)) ? (await wait(400), count(/POST \/api\/summarize/)) : null;
    out.quiz = (await twice('[data-kf-study="quiz"] button')) ? (await wait(400), count(/POST \/api\/quiz\/generate/)) : null;
    const opened = await tab.evaluate(() => { const b = document.querySelector('[data-kf-action="delete"] button'); if (!b) return false; b.click(); return true; });
    if (opened) {
      await tab.waitForFunction(() => document.querySelectorAll('[data-kf-action="delete"] button').length >= 2, { timeout: 5000 }).catch(() => {});
      out.delete = (await twice('[data-kf-action="delete"] .space-y-2 button')) ? (await wait(400), count(/DELETE \/api\/documents\//)) : null;
    } else out.delete = null;
    const renameOpen = await tab.evaluate(() => { const b = document.querySelector('[data-kf-action="rename"] button'); if (!b) return false; b.click(); return true; });
    if (renameOpen) {
      await tab.waitForFunction(() => document.querySelector('[data-kf-action="rename"] input'), { timeout: 5000 }).catch(() => {});
      await tab.evaluate(() => {
        const i = document.querySelector('[data-kf-action="rename"] input');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(i, 'renamed by check 33');
        i.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await wait(100);
      out.rename = (await twice('[data-kf-action="rename"] .flex-wrap button')) ? (await wait(400), count(/PATCH \/api\/documents\//)) : null;
    } else out.rename = null;
  } else {
    await tab.evaluate(() => {
      const t = document.querySelector('[data-kf-composer] textarea');
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      set.call(t, 'What is elasticity?');
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tab.waitForFunction(() => { const b = document.querySelector('[data-kf-composer] button'); return b && !b.disabled; }, { timeout: 5000 }).catch(() => {});
    out.send = (await twice('[data-kf-composer] button')) ? (await wait(400), count(/POST \/api\/agent/)) : null;
  }
  state.on = false;
  return out;
}

/** Check 33's verdict for one render: every pressed control sent once; the planted double counted two. */
export function tapVerdict(job, out) {
  const findings = [];
  if (out.plant !== 2) findings.push(`check 33 is blind: the unguarded planted button pressed twice counted ${out.plant}, want 2`);
  const want = job.s.tap === 'study' ? ['summary', 'quiz', 'delete', 'rename'] : ['send'];
  for (const k of want) {
    if (out[k] === null || out[k] === undefined) findings.push(`check 33: no ${k} control found to press`);
    else if (out[k] !== 1) findings.push(`check 33: ${k} pressed twice in one task sent ${out[k]} request(s), want 1`);
  }
  return findings;
}
