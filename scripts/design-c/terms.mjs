/**
 * THE APP STORE SUBSCRIPTION TERMS (Apple 3.1.2; item 4j, store step 1) in design-c.
 *
 * WHO SEES WHAT. /terms gains an "App Store subscriptions" section
 * (src/components/legal/AppStoreTerms.tsx): on the web in the server markup,
 * unmarked; in the app only where the KnowFlowStore plugin answers (build 9),
 * after mount, inside data-kf-iap="terms"; never in build 8, never in the
 * Android shell. A runner has no native shell, so the plugin is a stub
 * (`termsStubSrc`), as in apple.mjs and voice.mjs.
 *
 * WHAT IS DRAWN, ar and en, light and dark, every one opened at
 * /terms#app-store-subscriptions, the address the paywall's Terms link uses:
 *   - the web at 390 x 844, 360 x 800 and 1280 x 800: the section, plain;
 *   - shell 2 with the stub at 390 and 360: the section, marked;
 *   - shell 2 WITHOUT the stub (the Android shell, or iOS before the plugin
 *     answers) and shell 1 (build 8, which has no plugin) at 390: no section.
 * /terms is the screen this change is about, so none of these is held to
 * main's picture; every other screen still is (check 22).
 *
 * CHECK 34 (termsCheck, every terms screen, AFTER):
 *   - exactly one section where expected, none elsewhere;
 *   - marked data-kf-iap="terms" in the app, under no data-kf-iap on the web
 *     (the web and build 8 may hold no marked element, check 24);
 *   - THE LINK REACHES IT: the page was opened with the paywall's fragment,
 *     and the section's heading is in the first half of the first viewport
 *     (the web by the browser's own scroll, the app by the section's
 *     scrollIntoView once it arrives);
 *   - Apple's standard EULA linked at its exact address, and no price figure
 *     in the section (the wording rule's currency pattern).
 * termsPlant() then forces, on every AFTER terms render, before the shot (at the
 * screen's own size; each case put back): the mark taken off
 * the app's section; a section planted where none may be; the web's section
 * wrapped in a mark; the heading pushed below the first viewport. Check 34
 * must flag every one that applies, or the run fails.
 */
import { A360 } from './android360.mjs';

export const TERMS_ID = 'app-store-subscriptions';
export const EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const TERMS_KINDS = ['unmarked', 'planted', 'web-marked', 'pushed'];

export function termsScreens(add, { APP, SAFARI, DESK, DESKTOP }) {
  const APP2 = APP.replace(/KnowFlowApp\/1$/, 'KnowFlowApp/2');
  const c = (key, ua, opts) => add(key, 'terms', {}, ua, { native: ua === APP || ua === APP2, hash: TERMS_ID, ...opts });
  c('terms-web', SAFARI, { terms: { mode: 'plain', stub: false } });
  c('terms-web-360', SAFARI, { view: A360, terms: { mode: 'plain', stub: false } });
  c('terms-desk', DESK, { view: DESKTOP, targets: false, terms: { mode: 'plain', stub: false } });
  c('terms-app2', APP2, { terms: { mode: 'marked', stub: true } });
  c('terms-app2-360', APP2, { view: A360, terms: { mode: 'marked', stub: true } });
  c('terms-app2-nostub', APP2, { terms: { mode: null, stub: false } });
  c('terms-app1', APP, { terms: { mode: null, stub: false } });
}

/** The KnowFlowStore plugin as the iOS shell registers it from build 9. Nothing on /terms calls it. */
export function termsStubSrc() {
  return `(function(){
var S=window.__kfStore={calls:[]};
var prev=window.Capacitor||{};
window.Capacitor=Object.assign({},prev,{
isNativePlatform:function(){return true},
getPlatform:function(){return 'ios'},
isPluginAvailable:function(n){return n==='KnowFlowStore'||(prev.isPluginAvailable?prev.isPluginAvailable(n):false)},
nativePromise:function(p,m,o){S.calls.push(p+'.'+m);
if(p==='KnowFlowStore')return new Promise(function(){});
return prev.nativePromise?prev.nativePromise(p,m,o):Promise.reject(new Error('not stubbed: '+p))}
});
})();`;
}

export function termsExpect(job) {
  return { mode: job.s.terms.mode, id: TERMS_ID, eula: EULA, nativeShell: job.s.native };
}

/** CHECK 34, in the page. Self-contained (passed to evaluate as source). Needs window.kfWording. */
export function termsCheck(expect) {
  const f = [];
  const secs = [...document.querySelectorAll('[data-kf-terms-app-store]')];
  const m = { sections: secs.length, hash: location.hash };
  if (expect.mode === null) {
    if (secs.length) f.push(`check 34: ${secs.length} App Store section(s) where none may be`);
    if (document.querySelector('[data-kf-iap]')) f.push('check 34: a data-kf-iap element on a terms page with no section');
  } else {
    if (secs.length !== 1) f.push(`check 34: ${secs.length} App Store section(s), want 1`);
    const s = secs[0];
    if (s) {
      const mark = s.closest('[data-kf-iap]');
      m.mark = mark ? mark.getAttribute('data-kf-iap') : null;
      if (expect.mode === 'marked' && m.mark !== 'terms') f.push(`check 34: the app's section is not inside data-kf-iap="terms" (got ${m.mark})`);
      if (expect.mode === 'plain' && mark) f.push(`check 34: the web's section sits inside data-kf-iap="${m.mark}"`);
      const head = document.getElementById(expect.id);
      if (!head || !s.contains(head)) f.push(`check 34: no #${expect.id} heading inside the section`);
      else {
        const top = head.getBoundingClientRect().top;
        m.headingTop = Math.round(top);
        m.viewport = window.innerHeight;
        if (location.hash !== `#${expect.id}`) f.push(`check 34: the page was not opened at #${expect.id} (${location.hash})`);
        if (!(top >= -2 && top <= window.innerHeight / 2)) f.push(`check 34: the paywall's link does not reach the section: its heading is at ${Math.round(top)} in a ${window.innerHeight} tall view`);
      }
      const links = [...s.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
      m.links = links;
      if (!links.includes(expect.eula)) f.push(`check 34: Apple's standard EULA is not linked at ${expect.eula}`);
      const words = window.kfWording(s.innerText || '');
      if (words.includes('currency')) f.push('check 34: a price figure in the section');
    }
  }
  return { finding: f.length ? f.join('; ') : null, measured: m };
}

/** Check 34's forced cases, before the shot (the screen's own size), on AFTER. Self-contained; needs window.termsCheck. */
export function termsPlant(expect) {
  const rows = [];
  const flagged = (e) => !!window.termsCheck(e).finding;
  const sec = document.querySelector('[data-kf-terms-app-store]');
  if (expect.mode === 'marked' && sec) {
    const mark = sec.closest('[data-kf-iap]');
    mark.removeAttribute('data-kf-iap');
    try { rows.push({ kind: 'unmarked', caught: flagged(expect) }); } finally { mark.setAttribute('data-kf-iap', 'terms'); }
  }
  if (expect.mode === null) {
    const p = document.createElement('section');
    p.setAttribute('data-kf-terms-app-store', '');
    p.textContent = 'App Store subscriptions';
    document.body.appendChild(p);
    try { rows.push({ kind: 'planted', caught: flagged(expect) }); } finally { p.remove(); }
  }
  if (expect.mode === 'plain' && sec) {
    const w = document.createElement('div');
    w.setAttribute('data-kf-iap', 'terms');
    sec.before(w);
    w.appendChild(sec);
    try { rows.push({ kind: 'web-marked', caught: flagged(expect) }); } finally { w.before(sec); w.remove(); }
  }
  if (expect.mode !== null && sec) {
    // The link that lands short: a block one viewport tall pushed in above the heading.
    const y = window.scrollY;
    const spacer = document.createElement('div');
    spacer.style.height = `${window.innerHeight}px`;
    // Scroll anchoring would move the view with the heading and hide the push.
    const root = document.documentElement;
    const anchor = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none';
    document.body.style.overflowAnchor = 'none';
    sec.prepend(spacer);
    try { rows.push({ kind: 'pushed', caught: flagged(expect) }); } finally {
      spacer.remove();
      root.style.overflowAnchor = anchor;
      document.body.style.removeProperty('overflow-anchor');
      window.scrollTo(0, y);
    }
  }
  return rows;
}
