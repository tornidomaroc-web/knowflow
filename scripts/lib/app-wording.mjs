/**
 * THE APP'S WORDING RULE, ONE SOURCE (Apple 3.1.3(f); Step Wording-1).
 *
 * Inside the iOS app no text may name a plan, a subscription, an upgrade, a
 * premium or Pro tier, a price, a checkout, or "free". `KF_WORDING_SRC` is an
 * ES5 function kept as text, so the SAME bytes run in the in-app probe
 * (ios/App/App/MainViewController.swift embeds it, with each backslash doubled
 * for the Swift string, and scripts/verify-app-wording.mjs fails if that copy
 * drifts) and in the Node proofs (evaluated below).
 *
 * English is matched case-insensitively on word boundaries. Arabic is matched
 * by STEM after normalising: diacritics and tatweel removed, every alef form
 * to bare alef, ta marbuta to ha, alef maqsura to ya. So باقة, الباقة, باقتك,
 * بباقتك and الباقات all reach باق followed by ه, ت or ا; اشتراك, الاشتراك,
 * اشتراكك and اشترك all reach اشترا?ك. "أسئلة باقية" (questions left) does
 * not: after باق comes ي. خطة needs a word start before it, so مخطط and
 * الخطوط stay clean.
 *
 * Returns the names of the rules hit; empty when the text is clean.
 */
export const KF_WORDING_SRC = String.raw`function kfWording(T){var h=[];var E=[['plan',/\bplans?\b/i],['subscription',/\bsubscri(?:be|bed|bes|ber|bers|bing|ption|ptions)\b/i],['upgrade',/\bupgrad(?:e|es|ed|ing)\b/i],['premium',/\bpremium\b/i],['pro',/\bpro\b/i],['price',/\bpric(?:e|es|ed|ing)\b/i],['free',/\bfree\b/i],['checkout',/\bcheck-?out\b/i],['currency',/\$\s?\d|\d\s?(?:usd|eur|mad|dhs?|dirhams?)\b|\/\s?mo(?:nth)?\b|\bper month\b/i]];for(var i=0;i<E.length;i++){if(E[i][1].test(T))h.push(E[i][0])}var N=T.replace(/[ً-ٰٟـ]/g,'').replace(/[آأإٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');var A=[['باقة',/باق[هتا]/],['اشتراك',/اشترا?ك/],['ترقية',/ترقي[هت]/],['مجاني',/مجان/],['سعر',/سعر|اسعار/],['احترافي',/احتراف/],['خطة',/(?:^|[^ء-ي])(?:ال|و|ب|ف|ل)?خط[هت]/],['شهريا',/شهريا/]];for(var j=0;j<A.length;j++){if(A[j][1].test(N))h.push(A[j][0])}return h}`;

// The same text, as a function, for the Node proofs.
// eslint-disable-next-line no-new-func
export const kfWording = new Function(`${KF_WORDING_SRC}; return kfWording;`)();

/**
 * THE RULE IN SHELL 2 (in-app Pro, iOS 1.1, item 4d). One rule, decided here:
 *
 *   - Shell 1 (build 8) and the web: STRICT, as before. The whole page's text
 *     is read, and ANY element marked `data-kf-iap` is itself a violation
 *     (`outside`): those shells must never be shown a purchase surface.
 *   - Shell 2 on: purchase words may stand ONLY inside an element marked
 *     `data-kf-iap` (the paywall, the offer card and button, the App Store
 *     manage lines). The text is read with every marked element hidden, so
 *     one purchase word anywhere else on the screen is a hit.
 *   - Every shell: a link whose address names pricing, checkout, Paddle or
 *     an upgrade is a hit WHEREVER it is, marked or not (3.1.1: no way to a
 *     purchase outside the App Store, ever).
 *
 * `KF_PURCHASE_SRC` is ES5 kept as text, like `KF_WORDING_SRC`, and runs in
 * the in-app probe (MainViewController.swift, backslashes doubled; drift
 * fails scripts/verify-app-wording.mjs) and in the design-c renders
 * (Chromium). It needs `kfWording` defined beside it. Marked elements are
 * hidden with `display: none !important` only for the one synchronous
 * `innerText` read and put back before the function returns, so nothing is
 * painted in between.
 *
 * Returns `{ words, hrefs, marked, outside }`; a reading is clean when
 * `words` and `hrefs` are empty and `outside` is false.
 */
export const KF_PURCHASE_SRC = String.raw`function kfPurchase(D,S){var M=D.querySelectorAll('[data-kf-iap]');var B=D.body;var T='';if(B){if(S>=2&&M.length){var k=[];for(var i=0;i<M.length;i++){k.push(M[i].style.getPropertyValue('display'));M[i].style.setProperty('display','none','important')}T=B.innerText;for(var j=0;j<M.length;j++){if(k[j]){M[j].style.setProperty('display',k[j])}else{M[j].style.removeProperty('display')}}}else{T=B.innerText}}var H=[];var A=D.querySelectorAll('a[href]');for(var n=0;n<A.length;n++){var h=A[n].getAttribute('href')||'';if(/pricing|checkout|paddle|upgrade/i.test(h))H.push(h)}return{words:kfWording(T),hrefs:H,marked:M.length,outside:S<2&&M.length>0}}`;

/** Whether a `kfPurchase` reading breaks the rule. */
export function purchaseViolation(r) {
  return !!r && (r.words.length > 0 || r.hrefs.length > 0 || r.outside === true);
}

/**
 * The same rule over SERVER MARKUP (renderToStaticMarkup), for the Node
 * proofs, which have no DOM: marked subtrees are cut out of the HTML by
 * balanced tags when the shell is 2 or later, and the rest is read as text.
 */
export function kfPurchaseHtml(html, shell) {
  const marked = (html.match(/<[a-z][a-z0-9]*\b[^>]*\sdata-kf-iap(?:=|\s|>|\/)/gi) || []).length;
  let rest = html;
  if (shell >= 2) rest = cutMarked(html);
  const text = rest
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)].map((m) => m[1]).filter((h) => /pricing|checkout|paddle|upgrade/i.test(h));
  return { words: kfWording(text), hrefs, marked, outside: shell < 2 && marked > 0, text };
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** Remove every element carrying data-kf-iap, with its whole subtree. */
export function cutMarked(html) {
  const open = /<([a-z][a-z0-9]*)\b[^>]*\sdata-kf-iap(?:=|\s|>|\/)[^>]*>|<([a-z][a-z0-9]*)\b[^>]*\sdata-kf-iap(?:=|\s|>|\/)/i;
  let out = html;
  for (let guard = 0; guard < 1000; guard++) {
    const m = open.exec(out);
    if (!m) return out;
    const tag = (m[1] || m[2]).toLowerCase();
    const start = m.index;
    const tagEnd = out.indexOf('>', start);
    if (tagEnd < 0) return out.slice(0, start);
    if (VOID.has(tag) || out[tagEnd - 1] === '/') {
      out = out.slice(0, start) + out.slice(tagEnd + 1);
      continue;
    }
    const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'gi');
    re.lastIndex = tagEnd + 1;
    let depth = 1;
    let end = out.length;
    for (let t = re.exec(out); t; t = re.exec(out)) {
      if (t[0].endsWith('/>')) continue;
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}
