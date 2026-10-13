/**
 * The in-page audit of a render (Step Redesign-2, moved here unchanged in Step
 * Redesign-3 so render.mjs and render-redesign3.mjs share one audit). It is
 * passed to `page.evaluate`, so it must stay self-contained: no import, no
 * closure over this module.
 */
export function audit() {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const stops = (img) => (img && img !== 'none' ? (img.match(/rgba?\([^)]+\)/g) || []).map(parse) : []);
  const over = (top, under) => {
    const a = top.a + under.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (k) => (top[k] * top.a + under[k] * under.a * (1 - top.a)) / a;
    return { r: mix('r'), g: mix('g'), b: mix('b'), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };
  const extremes = (list) => { const s = [...list].sort((p, q) => lum(p) - lum(q)); return s.length > 2 ? [s[0], s[s.length - 1]] : s; };
  const grounds = (el, includeSelf, pseudo) => {
    const chain = [];
    for (let n = includeSelf ? el : el.parentElement; n && n !== document.documentElement; n = n.parentElement) chain.unshift(n);
    let cands = [parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }].map((c) => ({ ...c, a: 1 }));
    const paint = (cs) => {
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) cands = cands.map((c) => over(bg, c));
      const st = stops(cs.backgroundImage);
      if (st.length) cands = extremes(st.flatMap((s) => cands.map((c) => over(s, c))));
    };
    for (const n of chain) paint(getComputedStyle(n));
    if (pseudo) paint(getComputedStyle(el, pseudo));
    return extremes(cands);
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)' || (cs.position === 'absolute' && cs.width === '1px' && cs.height === '1px')) return false;
    }
    return true;
  };
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const disabled = (el) => !!el.closest('[disabled],[aria-disabled="true"]');
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean)[0] : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 36)}"`;
  const worst = (fg, gs) => Math.min(...gs.map((g) => ratio(over(fg, g), g)));

  const text = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || el.closest('svg')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el) || disabled(el)) continue;
    const cs = getComputedStyle(el);
    const fg0 = parse(cs.color);
    const fg = { ...fg0, a: fg0.a * opacityOf(el) };
    const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const got = worst(fg, grounds(el, true));
    text.push({ el: name(el), got: Math.round(got * 100) / 100, need, ok: got >= need });
  }

  const controls = [];
  const check = (what, el, got) => controls.push({ el: `${what}: ${name(el)}`, got: Math.round(got * 100) / 100, need: 3, ok: got >= 3 });
  const edgeOrFill = (cs, gs) => {
    let best = Math.min(...gs.map((g) => Math.max(...[parse(cs.backgroundColor), ...stops(cs.backgroundImage)].filter(Boolean).map((c) => ratio(over(c, g), g)), 1)));
    if (parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none') best = Math.max(best, worst(parse(cs.borderTopColor), gs));
    return best;
  };
  for (const sw of document.querySelectorAll('[role="switch"]')) {
    if (!visible(sw) || disabled(sw)) continue;
    const track = sw.querySelector('.kf-switch-track') || sw;
    check('switch track', track, edgeOrFill(getComputedStyle(track), grounds(sw, false)));
    const thumb = sw.querySelector('.kf-switch-thumb') || sw.querySelector('span');
    if (thumb) check('switch thumb', thumb, worst(parse(getComputedStyle(thumb).backgroundColor), grounds(track, true)));
  }
  for (const g of document.querySelectorAll('[role="group"], [role="radiogroup"]')) {
    if (!visible(g)) continue;
    check('segmented track', g, edgeOrFill(getComputedStyle(g), grounds(g, false)));
    const chosen = g.querySelector('[aria-current="true"], [aria-checked="true"]');
    if (chosen) check('chosen segment', chosen, edgeOrFill(getComputedStyle(chosen), grounds(g, true)));
  }
  for (const f of document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea, .kf-composer'))
    if (visible(f) && !disabled(f) && !(f.tagName === 'TEXTAREA' && f.closest('.kf-composer'))) check('field', f, edgeOrFill(getComputedStyle(f), grounds(f, false)));

  const targets = [];
  for (const el of document.querySelectorAll('a[href], button, [role="switch"], [role="radio"]')) {
    if (!visible(el) || el.closest('nav.kf-tabbar') === null && false) continue;
    const r = el.getBoundingClientRect();
    // An inline link inside running text is exempt (WCAG 2.5.8); everything else is a control.
    const inline = getComputedStyle(el).display === 'inline' && el.closest('p');
    if (inline) continue;
    targets.push({ el: name(el), w: Math.round(r.width), h: Math.round(r.height), ok: r.width >= 44 && r.height >= 44 });
  }

  const shaping = [];
  const ctx = document.createElement('canvas').getContext('2d');
  const JOIN = /[بتثجحخسشصضطظعغفقكلمنهيئ][ً-ْ]*[ء-ي]/;
  const draw = (s, font, dir) => {
    const w = Math.ceil(ctx.measureText(s).width) + 8, h = 48;
    const c = document.createElement('canvas'); c.width = Math.min(w, 4000); c.height = h;
    const x = c.getContext('2d'); x.font = font; x.direction = dir; x.textBaseline = 'middle'; x.fontKerning = 'none'; x.fillText(s, dir === 'rtl' ? c.width - 4 : 4, h / 2);
    return { w: c.width, data: x.getImageData(0, 0, c.width, h).data };
  };
  for (const el of document.body.querySelectorAll('*')) {
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!t || !JOIN.test(t) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const font = `${cs.fontWeight} 20px ${cs.fontFamily}`;
    ctx.font = font;
    const a1 = draw(t, font, 'rtl'), a2 = draw([...t].join(String.fromCharCode(0x200c)), font, 'rtl');
    shaping.push({ el: name(el), ok: a1.w !== a2.w || a1.data.some((v, i) => v !== a2.data[i]) });
  }
  // The control: letters that never join (alef, dal, ra, waw) must measure
  // the same with a ZWNJ between them, so a width change on a joining string
  // can only be shaping. (The first control drew Latin and compared pixels
  // against an undefined array, so it could never pass.)
  let shapingControl = true;
  {
    ctx.font = `600 20px ${getComputedStyle(document.body).fontFamily}`; ctx.fontKerning = 'none';
    const plain = ctx.measureText('ادرو ادرو').width, apart = ctx.measureText([...'ادرو ادرو'].join(String.fromCharCode(0x200c))).width;
    shapingControl = Math.abs(plain - apart) < 0.5;
  }
  const rubik = [...document.fonts].some((f) => /Rubik|__/.test(f.family) && f.status === 'loaded') || document.fonts.check('16px Rubik');

  let maxLayers = 0, blurred = 0, shadowed = 0, heaviest = '';
  const filters = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    for (const s of [cs, getComputedStyle(el, '::before'), getComputedStyle(el, '::after')]) {
      if (s.boxShadow && s.boxShadow !== 'none') {
        const layers = s.boxShadow.split(/,(?![^(]*\))/).filter((l) => !/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px/.test(l.trim()) && !/^\s*0px 0px 0px 0px/.test(l));
        shadowed++;
        if (layers.length > maxLayers) { maxLayers = layers.length; heaviest = name(el); }
        for (const l of layers) { const px = (l.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat); if ((px[2] || 0) > 0) blurred++; }
      }
    }
    if ((cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none')) filters.push(name(el));
  }

  return { text, controls, targets, shaping, shapingControl, rubik, cost: { shadowed, maxLayers, blurred, filters, heaviest }, visibleText: document.body.innerText };
}
