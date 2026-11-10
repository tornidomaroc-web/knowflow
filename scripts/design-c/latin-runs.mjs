/**
 * CHECK 15: LATIN RUNS IN RIGHT-TO-LEFT TEXT (after activation 5's renders:
 * the wrong-type refusal broke "PDF, DOCX, PPTX, XLSX, TXT, MD" over two
 * lines and drew ".zip" as "zip."; the declined sentence broke "Voyage" /
 * "AI.").
 *
 * In the page, on EVERY screen (so BEFORE measures main everywhere), every
 * text block that reads right to left (:dir(rtl)), its text read across its
 * inline children, cut with the rule of src/lib/latin-groups.ts
 * (splitLatinRuns: a bracketed Latin group, or a bare run: an optional "."
 * and a Latin word, then Latin words, digits and the separators between
 * them), re-read from the TEXT so main's plain text is read the same way:
 *   (a) a run of at most 30 characters (a group's inside its brackets) lies
 *       on ONE line;
 *   (b) on each line, the run's characters are drawn left to right in their
 *       logical order (".zip" as ".zip", a list in its order).
 * Skipped: file names ([data-filename], #124's own isolation) and answer
 * cards ([data-kf-bubble="answer"], check 10).
 *
 * SCOPE. A finding inside a drop zone (the element holding a file input) or
 * the AI permission sheet ([data-kf-consent-sheet]) fails an AFTER render.
 * Any other finding is printed and kept in report.json as outside this
 * change, not failed: the owner's ruling is to fix only these two places now
 * and propose the rest as one follow-up.
 */
export function latinRunsCheck() {
  const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/, LAT = /[A-Za-zÀ-ɏ]/;
  const GROUP = /\(([^()[\]\n]+)\)/g;
  const RUN = /\.?[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ0-9]*(?:[ ,.\-_'’/+&]+[A-Za-zÀ-ɏ0-9]+)*/g;
  const SKIP = '[data-filename], [data-kf-bubble="answer"], script, style, noscript, textarea, input, select, svg';
  const inlineLike = (el) => { const d = getComputedStyle(el).display; return d === 'inline' || d === 'contents'; };
  const containerOf = (node) => { let el = node.parentElement; while (el && el !== document.body && inlineLike(el)) el = el.parentElement; return el; };
  const blocks = new Map();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data) continue;
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) continue;
    const c = containerOf(n);
    if (!c) continue;
    if (!blocks.has(c)) blocks.set(c, []);
    blocks.get(c).push(n);
  }
  const charRect = (node, i) => {
    const r = document.createRange();
    r.setStart(node, i);
    r.setEnd(node, i + 1);
    return [...r.getClientRects()].find((x) => x.width > 0 && x.height > 0) || null;
  };
  const sameLine = (a, b) => Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < Math.min(a.height, b.height) / 2;
  const zones = [...document.querySelectorAll('input[type="file"]')].map((i) => i.parentElement).filter(Boolean);
  const scopeOf = (el) => (el.closest('[data-kf-consent-sheet]') ? 'consent-sheet' : zones.some((z) => z.contains(el)) ? 'drop-zone' : null);
  const findings = [];
  const runs = [];
  for (const [block, nodes] of blocks) {
    const B = block.getBoundingClientRect();
    if (!(B.width > 0 && B.height > 0) || !block.matches(':dir(rtl)')) continue;
    const parts = [];
    let text = '';
    for (const n of nodes) { parts.push({ n, start: text.length }); text += n.data; }
    if (!LAT.test(text)) continue;
    const at = (i) => { let k = parts.length - 1; while (k > 0 && parts[k].start > i) k--; return charRect(parts[k].n, i - parts[k].start); };
    // The pieces, as splitLatinRuns cuts them: bracketed groups first, bare runs in the rest.
    const found = [];
    let from = 0;
    const bare = (s, base) => { for (const m of s.matchAll(RUN)) found.push({ start: base + m.index, run: m[0], len: m[0].length }); };
    for (const m of text.matchAll(GROUP)) {
      if (!LAT.test(m[1]) || RTL.test(m[1])) continue;
      bare(text.slice(from, m.index), from);
      found.push({ start: m.index, run: m[0], len: m[1].length });
      from = m.index + m[0].length;
    }
    bare(text.slice(from), from);
    const scope = scopeOf(block);
    for (const f of found) {
      const rects = [];
      for (let i = f.start; i < f.start + f.run.length; i++) {
        if (/\s/.test(text[i])) continue;
        const r = at(i);
        if (r) rects.push({ i, r });
      }
      if (!rects.length) continue;
      const lines = [];
      for (const { r } of rects) if (!lines.some((l) => sameLine(l, r))) lines.push(r);
      const short = f.len <= 30;
      let reversed = null;
      for (let a = 0; a < rects.length && !reversed; a++) {
        for (let b = a + 1; b < rects.length; b++) {
          if (!sameLine(rects[a].r, rects[b].r)) continue;
          const ca = (rects[a].r.left + rects[a].r.right) / 2, cb = (rects[b].r.left + rects[b].r.right) / 2;
          if (cb < ca - 1) { reversed = `"${text[rects[b].i]}" is drawn left of "${text[rects[a].i]}"`; break; }
        }
      }
      const where = `${block.tagName.toLowerCase()} "${text.trim().slice(0, 60)}"`;
      const g = { run: f.run, short, lines: lines.length, ordered: !reversed, scope, isolated: !!(rects.length && parts.find((p) => p.start <= rects[0].i && rects[0].i < p.start + p.n.data.length)?.n.parentElement.closest('[data-kf-latin]')) };
      runs.push(g);
      if (short && lines.length > 1) findings.push({ scope, text: `a short Latin run splits across ${lines.length} lines: "${f.run}" in ${where}` });
      if (reversed) findings.push({ scope, text: `a Latin run is drawn out of order (${reversed}): "${f.run}" in ${where}` });
    }
  }
  return { findings, runs: runs.length, inScope: runs.filter((r) => r.scope).length, isolated: runs.filter((r) => r.isolated).length };
}

/**
 * CHECK 15'S FORCED WRONG CASES (run AFTER the shot, on every screen with an
 * isolate in scope). (a) every short isolate holding a space drawn at its
 * narrowest (a word per line): each must be flagged as split; (b) every
 * isolate of two or more letters drawn backwards (unicode-bidi:
 * isolate-override, direction: rtl; plain right-to-left is not enough, since
 * the space between two Latin words still resolves left to right): each must
 * be flagged as out of order.
 * Each is undone after its read; a check that misses one is blind.
 */
export function latinRunsPlant() {
  const isos = [...document.querySelectorAll('[data-kf-latin]')].filter((b) => b.getBoundingClientRect().width > 0 && (b.closest('[data-kf-consent-sheet]') || [...document.querySelectorAll('input[type="file"]')].some((i) => i.parentElement && i.parentElement.contains(b))));
  if (!isos.length) return { isolates: 0, finding: null };
  const shortsWithSpace = isos.filter((b) => b.dataset.kfLatin === 'short' && /\S\s+\S/.test(b.textContent));
  const withSep = isos.filter((b) => b.textContent.replace(/\s/g, '').length >= 2);
  const count = (res, kind, list) => list.filter((b) => res.findings.some((f) => f.text.startsWith(kind) && f.text.includes(`"${b.textContent}"`))).length;
  const style = (css) => { const t = document.createElement('style'); t.textContent = css; document.head.appendChild(t); return t; };
  let t = style('[data-kf-latin="short"] { display: inline-block !important; width: min-content !important; white-space: normal !important; }');
  let narrow;
  try { narrow = window.latinRunsCheck(); } finally { t.remove(); }
  t = style('[data-kf-latin] { direction: rtl !important; unicode-bidi: isolate-override !important; }');
  let flipped;
  try { flipped = window.latinRunsCheck(); } finally { t.remove(); }
  const splitCaught = count(narrow, 'a short Latin run splits', shortsWithSpace);
  const orderCaught = count(flipped, 'a Latin run is drawn out of order', withSep);
  const blind = splitCaught !== shortsWithSpace.length || orderCaught !== withSep.length;
  return {
    isolates: isos.length, shortsWithSpace: shortsWithSpace.length, splitCaught, reversible: withSep.length, orderCaught,
    finding: blind ? `check 15 is blind: ${shortsWithSpace.length} short isolate(s) with a space, forced narrow flagged ${splitCaught}; ${withSep.length} of two or more letters, drawn backwards flagged ${orderCaught}` : null,
  };
}
