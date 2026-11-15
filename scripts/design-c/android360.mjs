/**
 * ANDROID AT 360 (the Android 360 audit of 52ddaf5, 2026-11-12): design-c drew
 * phones only at 390 x 844 with an iPhone user agent, so three defects that
 * show only at 360 pt, the most common Android CSS width, passed every run:
 *   - a stat tile's label "لها اختبار" wrapped and dropped its number 15 px
 *     below its row neighbours (SubjectHeader, and the same tile on the
 *     subjects list);
 *   - the sample's ready question was cut "...in the ce…" (ChatBox);
 *   - the Arabic sign-up note left "جديدة" alone on its last line.
 *
 * A360 is 360 x 800 at DPR 3, mobile, touch, with an Android Chrome user
 * agent. Android has no app (STORE_PATH.md: Android after iOS), so every 360
 * screen is the WEB twin. Only the screens these fixes touch are drawn at 360
 * (the subject page full, empty and sample; the subjects list full and empty;
 * Ask in the sample subject; sign-up), in ar and en, light and dark: 7
 * screens, 28 jobs, 56 renders, about a ninth of the run, not a second run.
 * Every check render.mjs makes on a phone screen runs on them too (contrast,
 * 44 pt targets, shaping, lines, rows, PR 3, PR 4's Ask checks, check 15,
 * check 16 on sign-up, checks 17 and 18 on Ask).
 *
 * CHECK 19 (every render): the numbers of one row of stat tiles (a <dl>'s
 * children holding a <dt> and a <dd>) share a bottom within 1 px. Read by
 * structure, so main is measured too. statRowPlant() undoes the fix in the
 * page (the tile a block, the number 4 px under a label one line taller) and
 * the check must flag it, or the run fails.
 *
 * CHECK 20 (sign-up): the note under the password (the paragraph that holds
 * the forgot-password link) never ends on one word alone, never splits a kept
 * term across lines ("كلمة" and "مرور", the owner's review of #328), never
 * overflows its box, and its kept piece (data-kf-keep) fits inside the note.
 * signupNotePlant() puts one word on a line of its own at the end, and
 * signupTermPlant() breaks the line between "كلمة" and "مرور"; the check must
 * flag both, or the run fails.
 *
 * Check 17's ready question (sample.mjs) now allows two balanced lines and
 * no more, and still fails on a cut (scroll width or height over the box);
 * chipCutPlant() forces main's single truncated line and must be flagged.
 */
export const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
export const A360 = { width: 360, height: 800, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

export function android360Screens(add) {
  const o = { view: A360, android: true };
  add('signup-a360', 'signup', {}, ANDROID, o);
  add('subject-a360', 'preview/subject', { platform: 'web' }, ANDROID, { ...o, pr3: true });
  add('subject-empty-a360', 'preview/subject', { platform: 'web', view: 'empty' }, ANDROID, { ...o, pr3: true });
  add('subject-sample-a360', 'preview/subject', { platform: 'web', view: 'sample' }, ANDROID, { ...o, pr3: true });
  add('subjects-a360', 'preview/subjects', { platform: 'web' }, ANDROID, { ...o, pr3: true });
  add('subjects-empty-a360', 'preview/subjects', { platform: 'web', state: 'zero' }, ANDROID, { ...o, pr3: true });
  add('ask-sample-a360', 'preview/ask', { platform: 'web', view: 'app', sample: '1', kb: 'ks' }, ANDROID, { ...o, pr4: 'ask', sample: 'ask' });
}

/** CHECK 19. Self-contained: serialised into the page. */
export function statRowCheck() {
  const tiles = [...document.querySelectorAll('dl > div')].filter((d) => d.querySelector(':scope > dt') && d.querySelector(':scope > dd') && d.getBoundingClientRect().width > 0);
  const rows = [];
  for (const t of tiles) {
    const top = t.getBoundingClientRect().top;
    const row = rows.find((r) => r.dl === t.parentElement && Math.abs(r.top - top) <= 2);
    if (row) row.tiles.push(t); else rows.push({ dl: t.parentElement, top, tiles: [t] });
  }
  const findings = [];
  let measured = 0;
  for (const r of rows) {
    if (r.tiles.length < 2) continue;
    measured++;
    const bottoms = r.tiles.map((t) => t.querySelector(':scope > dd').getBoundingClientRect().bottom);
    const spread = Math.max(...bottoms) - Math.min(...bottoms);
    if (spread > 1) findings.push(`check 19: a row of ${r.tiles.length} stat tiles has its numbers ${spread.toFixed(1)} px apart (${r.tiles.map((t, i) => `"${t.querySelector(':scope > dt').textContent.trim()}" ${bottoms[i].toFixed(1)}`).join('; ')})`);
  }
  return { rows: measured, tiles: tiles.length, finding: findings.length ? findings.join(' | ') : null };
}

/** Check 19's forced case: main's tile shape, one label a line taller. */
export function statRowPlant() {
  const tag = document.createElement('style');
  tag.textContent = 'dl > div { display: block !important; } dl > div > dd { margin-top: 4px !important; padding-top: 0 !important; } dl > div:first-child > dt { padding-bottom: 17px !important; }';
  document.head.appendChild(tag);
  let forced;
  try { forced = window.statRowCheck(); } finally { tag.remove(); }
  if (!forced.rows) return { rows: 0, caught: null, finding: null };
  return { rows: forced.rows, caught: !!forced.finding, finding: forced.finding ? null : 'check 19 is blind: a row with one number 17 px lower was not flagged' };
}

/** CHECK 20. Self-contained: serialised into the page. */
export function signupNoteCheck() {
  // Terms whose words must sit on one line (each pair adjacent in reading order).
  const TERMS = [['كلمة', 'مرور']];
  const notes = [...document.querySelectorAll('p')].filter((p) => p.querySelector('a[href$="/forgot-password"]') && p.getBoundingClientRect().width > 0);
  const findings = [];
  const read = [];
  for (const p of notes) {
    const words = [];
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const re = /\S+/g;
      for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const rc = range.getClientRects()[0];
        if (rc && rc.width > 0) words.push({ w: m[0], mid: (rc.top + rc.bottom) / 2, top: rc.top, bottom: rc.bottom });
      }
    }
    const lines = [];
    for (const w of words) {
      const l = lines.find((x) => w.mid >= x.top && w.mid <= x.bottom);
      if (l) { l.words.push(w); l.top = Math.min(l.top, w.top); l.bottom = Math.max(l.bottom, w.bottom); w.line = l; } else { const n = { top: w.top, bottom: w.bottom, words: [w] }; lines.push(n); w.line = n; }
    }
    lines.sort((a, b) => a.top - b.top);
    const last = lines[lines.length - 1];
    const box = p.getBoundingClientRect();
    const keep = p.querySelector('[data-kf-keep]');
    const kr = keep ? keep.getBoundingClientRect() : null;
    const keepFits = kr && last ? kr.left >= box.left - 0.5 && kr.right <= box.right + 0.5 && kr.height < 2 * (last.bottom - last.top) : null;
    const overflow = p.scrollWidth > p.clientWidth + 1;
    const split = [];
    for (let i = 0; i + 1 < words.length; i++) for (const [a, b] of TERMS) if (words[i].w === a && words[i + 1].w === b && words[i].line !== words[i + 1].line) split.push(`${a} ${b}`);
    read.push({ lines: lines.length, last: last ? last.words.map((w) => w.w).join(' ') : '', keep: keep ? keep.textContent : null, keepFits, overflow, split });
    if (lines.length > 1 && last.words.length === 1) findings.push(`check 20: the sign-up note ends on one word alone ("${last.words[0].w}")`);
    for (const t of split) findings.push(`check 20: the sign-up note splits "${t}" across lines`);
    if (keepFits === false) findings.push(`check 20: the kept piece "${keep.textContent}" does not fit the note (${kr.left.toFixed(1)}-${kr.right.toFixed(1)} in ${box.left.toFixed(1)}-${box.right.toFixed(1)}, ${kr.height.toFixed(1)} tall)`);
    if (overflow) findings.push(`check 20: the sign-up note overflows its box (${p.scrollWidth} > ${p.clientWidth})`);
  }
  return { notes: read, finding: findings.length ? findings.join(' | ') : null };
}

/** Check 20's forced case: one word put on a line of its own at the note's end. */
export function signupNotePlant() {
  const p = [...document.querySelectorAll('p')].find((x) => x.querySelector('a[href$="/forgot-password"]'));
  if (!p) return { caught: null, finding: null };
  const br = document.createElement('br');
  const w = document.createElement('span');
  w.textContent = 'x';
  p.append(br, w);
  let forced;
  try { forced = window.signupNoteCheck(); } finally { br.remove(); w.remove(); }
  return { caught: !!forced.finding, finding: forced.finding ? null : 'check 20 is blind: a note ending on one word alone was not flagged' };
}

/** Check 20's forced term case: a line break between "كلمة" and "مرور" (Arabic pages only). */
export function signupTermPlant() {
  const p = [...document.querySelectorAll('p')].find((x) => x.querySelector('a[href$="/forgot-password"]'));
  if (!p) return { caught: null, finding: null };
  const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let node = null;
  let at = -1;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { at = n.data.indexOf('كلمة مرور'); if (at >= 0) { node = n; break; } }
  if (!node) return { caught: null, finding: null };
  const parent = node.parentNode;
  const rest = node.splitText(at + 'كلمة '.length);
  const br = document.createElement('br');
  parent.insertBefore(br, rest);
  let forced;
  try { forced = window.signupNoteCheck(); } finally { br.remove(); parent.normalize(); }
  const caught = !!forced.finding && /splits "كلمة مرور"/.test(forced.finding);
  return { caught, finding: caught ? null : `check 20 is blind to a split term: "كلمة" and "مرور" on two lines were not flagged (${forced.finding || 'nothing flagged'})` };
}

/** Check 17's new forced case (ask mode): main's single truncated line, narrowed. */
export async function chipCutPlant(locale) {
  const tag = document.createElement('style');
  tag.textContent = '[data-kf-sample-question] span { display: block !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; max-width: 120px !important; -webkit-line-clamp: none !important; }';
  document.head.appendChild(tag);
  let forced;
  try { forced = await window.sampleCheck('ask', locale); } finally { tag.remove(); }
  window.scrollTo(0, 0);
  const cut = !!forced.finding && /is cut/.test(forced.finding);
  return { caught: cut, finding: cut ? null : `check 17 is blind to a cut question: ${forced.finding || 'nothing flagged'}` };
}
