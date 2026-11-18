/**
 * THE CAMERA SCREEN ("صوّر صفحاتك", feat/camera-screen) in design-c.
 *
 * WHO SEES WHAT. The camera exists only for the app from shell 2
 * (`KnowFlowApp/2`, which declares NSCameraUsageDescription). Build 8
 * (`KnowFlowApp/1`) and the web keep today's upload tile EXACTLY. So three
 * user agents are drawn: APP2 (the camera), APP (shell 1, render.mjs's own,
 * build 8) and the web (Safari on an iPhone, and a desk at 1280).
 *
 * WHAT IS DRAWN, ar and en, light and dark, 390 x 844 at 2x unless named:
 *   - shell 2: the subject page full and empty (the upload button in place of
 *     the tile), the upload sheet open (its two equal tiles), the camera
 *     screen empty, with ten drawn pages (full), with three pages after a
 *     422 pages-unread (EVERY page marked: the route answers it only when no
 *     photo was read, and marks each one read: false), the finished state of
 *     a material saved without two pages, and the permission sheet as the
 *     camera's first send opens it (the photos line); the page, the sheet,
 *     the empty, the ten-page and the three-page screens again at 360 x 800
 *     (DPR 3); the sheet again at 1280 x 800 (the app's sheet on a wide
 *     window);
 *   - shell 1 and the web: the camera preview's page and sheet views, which
 *     must show the tile and NO camera at all, and the web at 1280.
 * Every check render.mjs makes runs on them (contrast, 44 pt targets, shaping,
 * no word alone on a line, rows, the app's wording rule...).
 *
 * CHECK 21 (cameraCheck, every camera screen): the gate (shell 2: the upload
 * button, no tile; shell 1 and the web: the tile, and no camera control,
 * sheet or screen anywhere); the sheet's two tiles equal in width and height
 * within 1 px, each title on ONE line in Arabic (the English file title two
 * at most) and not clipped; the camera title on one line wherever it is a
 * title, in both languages ("صوّر صفحاتك", "Scan pages"); the pages grid's cells equal; ten pages: no
 * add cell and the full line shown; empty: the first-page tile; the
 * none-read message (a 422 pages-unread) shown only with EVERY page marked.
 * CHECK 23 (in cameraCheck, the sheet): the two tiles share one structure,
 * icon, a title block that reserves two lines, then the description, so
 * both descriptions start at the same y within 1 px (360, 390 and 1280, ar
 * and en, light and dark). Red on 60e9ce6: "A file from your device" took
 * two lines and "Scan pages" one, and the descriptions started 24 px apart.
 * cameraPlant() lets the camera title wrap in a narrow box, and the check
 * must flag it, or the run fails (cameraForced in render.mjs).
 *
 * CHECK 22 (sameCheck, BEFORE against AFTER): the subject pages and drop
 * zone previews drawn with shell 1 or the web must be the SAME picture on
 * both sides (every pixel within 3/255 on every channel, the known jitter):
 * "build 8 and the web keep today's UI exactly", measured.
 */
import { readFileSync } from 'node:fs';
import { A360 } from './android360.mjs';

export function cameraScreens(add, { APP, SAFARI, DESK, DESKTOP }, screens) {
  const APP2 = APP.replace(/KnowFlowApp\/1$/, 'KnowFlowApp/2');
  const c = (key, path, q, ua, opts = {}) => add(key, path, q, ua, { native: ua === APP || ua === APP2, ...opts });
  // Shell 2.
  c('subject-app2', 'preview/subject', { platform: 'native' }, APP2, { camera: { shell: 2, view: 'page' } });
  c('subject-app2-empty', 'preview/subject', { platform: 'native', view: 'empty' }, APP2, { camera: { shell: 2, view: 'page' } });
  for (const v of ['choice', 'empty', 'ten', 'three', 'unread', 'consent']) {
    c(`camera-${v}-app2`, 'preview/camera', { platform: 'native', view: v }, APP2, { camera: { shell: 2, view: v } });
  }
  for (const v of ['page', 'choice', 'empty', 'ten', 'three']) {
    c(`camera-${v}-app2-360`, 'preview/camera', { platform: 'native', view: v }, APP2, { view: A360, camera: { shell: 2, view: v } });
  }
  // Check 23 at a wide window: the app's sheet (max-w-lg) at 1280.
  c('camera-choice-app2-desk', 'preview/camera', { platform: 'native', view: 'choice' }, APP2, { view: DESKTOP, targets: false, camera: { shell: 2, view: 'choice' } });
  // Shell 1 (build 8) and the web: today's tile, no camera even when asked.
  for (const v of ['page', 'choice', 'ten']) {
    c(`camera-${v}-app1`, 'preview/camera', { platform: 'native', view: v }, APP, { camera: { shell: 1, view: v } });
    c(`camera-${v}-web`, 'preview/camera', { view: v }, SAFARI, { camera: { shell: 0, view: v } });
  }
  c('camera-page-desk', 'preview/camera', { view: 'page' }, DESK, { view: DESKTOP, targets: false, camera: { shell: 0, view: 'page' } });
  // Check 22: every existing drop-zone screen drawn with shell 1 or the web
  // must be the same picture before and after.
  for (const s of screens) {
    if (/^preview\/(subject|upload)$/.test(s.path) && !s.camera && !/KnowFlowApp\/2/.test(s.ua)) s.same = true;
  }
  return APP2;
}

/** CHECK 21. Self-contained: serialised into the page. */
export function cameraCheck(expect) {
  const q = (sel) => [...document.querySelectorAll(sel)];
  const box = (el) => el.getBoundingClientRect();
  const lines = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
    return tops.size;
  };
  const clipped = (el) => el.scrollWidth > el.clientWidth + 1;
  const f = [];
  const measured = {};
  const ar = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
  const cameraBits = q('[data-kf-upload="add"], [data-kf-upload="sheet-file"], [data-kf-upload="sheet-camera"], [data-kf-camera], [data-kf-camera-sheet], [data-kf-upload-sheet], [data-kf-camera-unread]');
  if (expect.shell >= 2) {
    const add = q('[data-kf-upload="add"]');
    const tile = q('[data-kf-upload="tile"]');
    if (['page', 'choice', 'empty', 'ten', 'three', 'consent'].includes(expect.view) && add.length !== 1) f.push(`check 21: shell 2 shows ${add.length} upload button(s), want 1`);
    if (tile.length) f.push(`check 21: shell 2 still shows ${tile.length} upload tile(s)`);
  } else {
    const tile = q('[data-kf-upload="tile"]');
    if (tile.length < 1) f.push(`check 21: shell ${expect.shell} shows no upload tile`);
    if (cameraBits.length) f.push(`check 21: shell ${expect.shell} shows camera parts: ${cameraBits.map((e) => e.getAttribute('data-kf-upload') || [...e.attributes].map((a) => a.name).find((n) => n.startsWith('data-kf-camera') || n.startsWith('data-kf-upload')) ).join(', ')}`);
    return { finding: f.length ? f.join(' | ') : null, measured: { tiles: tile.length, cameraParts: cameraBits.length } };
  }
  if (expect.view === 'choice') {
    const [a, b] = ['sheet-file', 'sheet-camera'].map((k) => document.querySelector(`[data-kf-upload="${k}"]`));
    if (!a || !b) f.push('check 21: the sheet does not show both tiles');
    else {
      const A = box(a), B = box(b);
      measured.tiles = [[A.width, A.height], [B.width, B.height]].map((x) => x.map((n) => Math.round(n * 10) / 10));
      if (Math.abs(A.width - B.width) > 1 || Math.abs(A.height - B.height) > 1) f.push(`check 21: the two tiles are not equal (${A.width.toFixed(1)} x ${A.height.toFixed(1)} and ${B.width.toFixed(1)} x ${B.height.toFixed(1)})`);
      if (Math.abs(A.top - B.top) > 1) f.push('check 21: the two tiles are not on one row');
      // Arabic: each title one line. English: the file tile at most two (the
      // approved "A file from your device" needs two in a half-width tile at
      // 390 pt); the camera tile ONE ("Scan pages", approved 2026-11-18
      // to stay on one line at 360 and 390).
      for (const [el, name] of [[a, 'file'], [b, 'camera']]) {
        const most = ar || name === 'camera' ? 1 : 2;
        const t = el.querySelector('[data-kf-upload-title]');
        if (!t) { f.push(`check 21: the ${name} tile's title is missing`); continue; }
        if (lines(t) > most) f.push(`check 21: the ${name} tile's title "${t.textContent}" takes ${lines(t)} lines (at most ${most})`);
        if (clipped(t) || box(t).right > box(el).right + 1 || box(t).left < box(el).left - 1) f.push(`check 21: the ${name} tile's title "${t.textContent}" is clipped or overflows its tile`);
      }
      // Check 23: one structure in both tiles, so the descriptions start at
      // the same y whatever each title's line count.
      const da = a.querySelector('[data-kf-upload-desc]'), db = b.querySelector('[data-kf-upload-desc]');
      if (!da || !db) f.push('check 23: a sheet tile has no description');
      else {
        measured.descTops = [box(da).top, box(db).top].map((n) => Math.round(n * 10) / 10);
        if (Math.abs(box(da).top - box(db).top) > 1) f.push(`check 23: the two tiles' descriptions start at different heights (file ${box(da).top.toFixed(1)}, camera ${box(db).top.toFixed(1)})`);
      }
    }
  }
  // The camera title on ONE line wherever it is a title, in both languages:
  // "صوّر صفحاتك" and "Scan pages" (the tile and the screen).
  // measured.cameraTitleWidths: the title's own width beside its box's, so a
  // near-wrap is visible in the report before it becomes a wrap.
  const titles = [...q('[data-kf-camera-title]'), ...q('[data-kf-upload="sheet-camera"] [data-kf-upload-title]')];
  measured.cameraTitles = titles.length;
  for (const t of titles) {
    const most = 1;
    (measured.cameraTitleWidths ||= []).push([Math.round(t.scrollWidth * 10) / 10, Math.round(t.parentElement.getBoundingClientRect().width * 10) / 10, lines(t)]);
    if (lines(t) > most) f.push(`check 21: the camera title "${t.textContent}" is split over ${lines(t)} lines (at most ${most})`);
    if (clipped(t)) f.push(`check 21: the camera title "${t.textContent}" is clipped`);
  }
  if (['empty', 'ten', 'three'].includes(expect.view)) {
    const sheet = document.querySelector('[data-kf-camera-sheet="open"]');
    if (!sheet) f.push('check 21: the camera screen is not open');
    const pages = q('[data-kf-camera-page]');
    measured.pages = pages.length;
    const want = { empty: 0, ten: 10, three: 3 }[expect.view];
    if (pages.length !== want) f.push(`check 21: ${pages.length} page(s) shown, want ${want}`);
    if (expect.view === 'empty' && !document.querySelector('[data-kf-camera="first"]')) f.push('check 21: the empty screen has no first-page tile');
    if (expect.view === 'ten') {
      if (document.querySelector('[data-kf-camera="add"]')) f.push('check 21: ten pages and the add cell is still there');
      if (!document.querySelector('[data-kf-camera-full]')) f.push('check 21: ten pages and the full line is not shown');
    }
    // A 422 pages-unread is answered only when NO photo was read, each marked
    // read: false: the none-read message never stands beside an unmarked page.
    const marked = q('[data-kf-camera-problem]').length;
    const msg = document.querySelector('[data-kf-camera-message]');
    if (expect.view === 'three') {
      if (!msg) f.push('check 21: three pages after a 422 pages-unread and no message');
      if (marked !== pages.length) f.push(`check 21: ${marked} of ${pages.length} page(s) marked after a 422 pages-unread, want every page`);
    }
    if (msg && msg.getAttribute('data-kf-camera-message') === 'none-read' && marked !== pages.length) f.push(`check 21: the none-read message is shown with ${pages.length - marked} page(s) not marked`);
    const cells = q('[data-kf-camera-grid] > li > *:first-child');
    const sizes = cells.map((x) => [Math.round(box(x).width), Math.round(box(x).height)]);
    if (sizes.length > 1 && sizes.some((s) => Math.abs(s[0] - sizes[0][0]) > 1 || Math.abs(s[1] - sizes[0][1]) > 1)) f.push(`check 21: the page cells are not one size (${JSON.stringify(sizes)})`);
    // Every page number is shown, in order.
    const nums = pages.map((p) => p.querySelector('span')?.textContent.trim());
    if (nums.some((n, i) => n !== String(i + 1))) f.push(`check 21: the page numbers read ${JSON.stringify(nums)}`);
  }
  if (expect.view === 'unread' && q('[data-kf-camera-unread] li').length !== 2) f.push('check 21: the material saved without pages does not list the two pages');
  if (expect.view === 'consent' && !document.querySelector('[data-kf-consent-photos]')) f.push('check 21: the permission sheet for the camera has no photos line');
  return { finding: f.length ? f.join(' | ') : null, measured };
}

/** Check 21's forced case: the camera title free to wrap in a narrow box. */
export function cameraPlant() {
  const t = document.querySelector('[data-kf-camera-title]') || document.querySelector('[data-kf-upload="sheet-camera"] [data-kf-upload-title]');
  if (!t) return { forced: false };
  const tag = document.createElement('style');
  tag.textContent = '[data-kf-camera-title], [data-kf-upload="sheet-camera"] [data-kf-upload-title] { white-space: normal !important; display: inline-block !important; width: 4ch !important; }';
  document.head.appendChild(tag);
  let r;
  try { r = window.cameraCheck({ shell: 2, view: 'forced' }); } finally { tag.remove(); }
  return { forced: true, caught: !!(r.finding && /camera title/.test(r.finding)), finding: r.finding && /camera title/.test(r.finding) ? null : 'check 21 is blind: the camera title wrapped in a 4ch box was not flagged' };
}

/**
 * CHECK 22. The two PNGs, compared pixel by pixel in a page (no image
 * library on the runner). Same size, and no channel of any pixel more than
 * `tolerance` apart.
 */
export async function sameCheck(browser, fileA, fileB, tolerance = 3) {
  const a = readFileSync(fileA).toString('base64');
  const b = readFileSync(fileB).toString('base64');
  const ctx = await browser.createBrowserContext();
  const tab = await ctx.newPage();
  try {
    return await tab.evaluate(async (a, b, tol) => {
      const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `data:image/png;base64,${s}`; });
      const [A, B] = await Promise.all([load(a), load(b)]);
      if (A.width !== B.width || A.height !== B.height) return { same: false, why: `sizes differ: ${A.width} x ${A.height} and ${B.width} x ${B.height}` };
      const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const da = px(A), db = px(B);
      let off = 0, worst = 0, first = null;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > worst) worst = d;
        if (d > tol) { off++; if (!first) first = { x: (i / 4) % A.width, y: Math.floor(i / 4 / A.width) }; }
      }
      return { same: off === 0, pixels: A.width * A.height, off, worst, first, why: off ? `${off} pixel(s) differ by more than ${tol}/255 (worst ${worst}, first at ${first.x},${first.y})` : null };
    }, a, b, tolerance);
  } finally {
    await ctx.close();
  }
}
