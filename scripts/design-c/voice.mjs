/**
 * VOICE INPUT IN ASK (iOS 1.1, big item 4e) in design-c.
 *
 * WHO SEES WHAT. The microphone exists only in the app from shell 2
 * (`KnowFlowApp/2`) AND only where the KnowFlowSpeech plugin answers
 * (src/lib/speech/bridge.ts). A runner has no native shell, so the plugin is
 * a stub (`voiceStubSrc`): `window.Capacitor` defined before the page loads,
 * answering `isPluginAvailable('KnowFlowSpeech')`, `availability`, `start`,
 * `stop` and `openSettings` the way KnowFlowSpeech.swift does, and partial
 * lines pushed through its listeners. The same stub is given to shell 1 and
 * to the web (a forged bridge in a browser): neither may draw the mic.
 *
 * WHAT IS DRAWN, ar and en, light and dark, the Ask screen as the dashboard
 * builds it (preview/ask?view=app), at 390 x 844 and at 360 x 800:
 *   idle        the microphone between the field and Send;
 *   recording   listening, the seconds, the language chip, a partial line
 *               (in the line above the field, NOT in the field);
 *   transcript  the take stopped by a tap: the text in the field, "check";
 *   denied      a permission refused: the line and Open Settings;
 *   noSpeech    a take with no words;
 *   unsupported the language not available: the line and the chip;
 *   failed      the recognizer failed;
 *   limit       the 60 s end: the text in the field and its line;
 *   toolong     the transcript sent by the student's tap and refused with
 *               the route's 413 (question-too-long, answered in the page):
 *               the text is back in the field.
 * And the gate, at 390: shell 2 WITHOUT the stub, shell 1 with the stub, the
 * web with the stub; no mic in any.
 *
 * CHECK 27 (voiceCheck, every voice screen): the mic exactly where expected
 * (one, inside the composer, after the field and before Send in the DOM) or
 * nowhere (no mic, no line); the composer row fits: field, mic and Send in
 * one row without overlap, inside the row, each control at least 44 x 44 pt,
 * the field at least 120 pt wide and 16 px (#286, below md); per view, the
 * state, the line, the chip, the Settings button, the partial line, and the
 * field's value (empty while listening: a partial never enters the field);
 * `/api/agent` called by no take (a fetch counter in the stub), once only in
 * toolong, by the Send tap. voicePlant() removes the mic where it must be and
 * plants one where it must not; check 27 must flag both, or the run fails.
 *
 * CHECK 28 (voiceStackCheck, the owner's review of PR #340): recording,
 * unsupported and denied draw the message full width and each control on
 * its own row below it, at the reading start, 44 x 44; no message line holds
 * one word. voiceStackPlant() puts 0960b1a's side-by-side row back; check 28
 * must flag it on every render, or the run fails.
 *
 * CHECK 29 (voicePhraseCheck, the owner's review of PR #340 at 3b2fe21): on
 * every voice render with a line, ar and en, light and dark, 390 and 360, no
 * message line ends with the first word of a KEEP_TOGETHER_VOICE phrase ("or"
 * and its Arabic twin) and no such phrase spans two lines. voicePhrasePlant()
 * forces each phrase present onto two lines, broken after its first word;
 * check 29 must flag both rules on every such render, or the run fails.
 *
 * CHECK 22 (camera.mjs, sameCheck), widened again: every screen of shell 2
 * that existed before this change (no stub: build 9 before the plugin, and
 * the Android shell) must be the same picture as main, like build 8 and the
 * web; and so must shell 1 and the web WITH the stub.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { A360 } from './android360.mjs';

export const VIEWS = ['idle', 'recording', 'transcript', 'denied', 'noSpeech', 'unsupported', 'failed', 'limit', 'toolong'];

/** What the stub hears, per locale. */
export const TAKES = {
  en: { partial: 'What is opportunity', final: 'What is opportunity cost?' },
  ar: { partial: 'ما هي تكلفة', final: 'ما هي تكلفة الفرصة البديلة؟' },
};

/** The route's 413 sentence (src/lib/limit-messages.ts, questionTooLongMessage; verify-voice-input.mjs compares). */
export const TOO_LONG = {
  en: 'A question can be up to 4,000 characters, and this one is longer. Shorten it or split it into two questions, then send it again.',
  ar: 'يمكن أن يصل السؤال إلى 4000 حرف، وهذا السؤال أطول من ذلك. اختصره أو قسّمه إلى سؤالين، ثم أرسله مجددًا.',
};

export function voiceScreens(add, { APP, SAFARI }, screens) {
  const APP2 = APP.replace(/KnowFlowApp\/1$/, 'KnowFlowApp/2');
  // Check 22: every shell-2 screen drawn before this change has no stub, so
  // it is build 9 before the plugin (and the Android shell): main's picture.
  for (const s of screens) if (/KnowFlowApp\/2/.test(s.ua)) s.same = true;
  const c = (key, q, ua, opts) => add(key, 'preview/ask', q, ua, { native: ua === APP || ua === APP2, ...opts });
  for (const view of VIEWS) {
    c(`voice-${view}-app2`, { platform: 'native', view: 'app' }, APP2, { voice: { stub: true, view, mic: true } });
    c(`voice-${view}-app2-360`, { platform: 'native', view: 'app' }, APP2, { view: A360, voice: { stub: true, view, mic: true } });
  }
  c('voice-gate-app2-nostub', { platform: 'native', view: 'app' }, APP2, { same: true, voice: { stub: false, view: 'gate', mic: false } });
  c('voice-gate-app1-stub', { platform: 'native', view: 'app' }, APP, { same: true, voice: { stub: true, view: 'gate', mic: false } });
  c('voice-gate-web-stub', { platform: 'web', view: 'app' }, SAFARI, { same: true, voice: { stub: true, view: 'gate', mic: false } });
  return APP2;
}

/** The expectation check 27 reads, with the texts of the job's locale. */
export function voiceExpect(job) {
  const v = job.s.voice;
  return { ...v, ...TAKES[job.locale], tooLong: TOO_LONG[job.locale] };
}

/**
 * The plugin, stubbed before the page loads (evaluateOnNewDocument). Counts
 * the page's calls to /api/agent so check 27 can say no take sent anything.
 */
export function voiceStubSrc(job) {
  const view = job.s.voice.view;
  return `(function(){
var view=${JSON.stringify(view)};
var L={partial:[],end:[]};
function emit(ev,d){L[ev].slice().forEach(function(cb){try{cb(d)}catch(e){}})}
var V=window.__kfVoice={calls:[],agent:0,emit:emit};
var of=window.fetch;
window.fetch=function(u){try{var s=typeof u==='string'?u:(u&&u.url)||'';if(s.indexOf('/api/agent')>=0)V.agent++}catch(e){}return of.apply(this,arguments)};
window.Capacitor={
isNativePlatform:function(){return true},
getPlatform:function(){return 'ios'},
isPluginAvailable:function(n){return n==='KnowFlowSpeech'},
addListener:function(p,ev,cb){if(p!=='KnowFlowSpeech'||!L[ev])return {remove:function(){}};L[ev].push(cb);return {remove:function(){L[ev]=L[ev].filter(function(x){return x!==cb})}}},
nativePromise:function(p,m,o){V.calls.push(m);
if(p!=='KnowFlowSpeech')return Promise.reject(new Error('not stubbed: '+p));
if(m==='availability')return Promise.resolve({locale:o&&o.locale,supported:true,available:true,onDevice:true,speech:'notDetermined',mic:'notDetermined'});
if(m==='start'){if(view==='denied'||view==='unsupported'||view==='failed')return Promise.resolve({started:false,error:view});return Promise.resolve({started:true,onDevice:true})}
if(m==='stop'){var r=view==='noSpeech'?{text:'',reason:'tap'}:{text:V.final||'',reason:'tap'};setTimeout(function(){emit('end',r)},0);return Promise.resolve(r)}
if(m==='openSettings')return Promise.resolve({opened:true});
return Promise.resolve({})}
};
})();`;
}

/** The route's 413 for the toolong view, answered in the page. */
export function voiceMock(job, r) {
  if (job.s.voice?.view !== 'toolong' || r.method() !== 'POST') return false;
  if (new URL(r.url()).pathname !== '/api/agent') return false;
  r.respond({ status: 413, contentType: 'text/plain; charset=utf-8', headers: { 'X-KF-Refusal': 'question-too-long' }, body: TOO_LONG[job.locale] });
  return true;
}

/** Through the real controls. Main has no microphone: nothing to press there. */
export async function voiceAct(tab, job, side) {
  const v = job.s.voice;
  if (!v.mic) {
    // The gate: give a stub time to be asked, then nothing must have appeared.
    await new Promise((r) => setTimeout(r, 400));
    return { act: `voice-${v.view}` };
  }
  if (side === 'before') return { act: `voice-${v.view}`, before: 'no microphone on main' };
  const T = TAKES[job.locale];
  await tab.evaluate((t) => { window.__kfVoice.final = t; }, T.final);
  await tab.waitForSelector('[data-kf-voice="mic"][data-kf-voice-state="idle"]', { timeout: 10000 });
  if (v.view === 'idle') return { act: 'voice-idle' };
  const tap = () => tab.evaluate(() => document.querySelector('[data-kf-voice="mic"]').click());
  await tap();
  if (['denied', 'unsupported', 'failed'].includes(v.view)) {
    await tab.waitForSelector(`[data-kf-voice-message="${v.view}"]`, { timeout: 10000 });
    return { act: `voice-${v.view}` };
  }
  await tab.waitForSelector('[data-kf-voice="mic"][data-kf-voice-state="recording"]', { timeout: 10000 });
  if (v.view !== 'noSpeech') {
    await tab.evaluate((p) => window.__kfVoice.emit('partial', { text: p }), T.partial);
    await tab.waitForSelector('[data-kf-voice-partial]', { timeout: 10000 });
  }
  if (v.view === 'recording') return { act: 'voice-recording' };
  if (v.view === 'limit') {
    await tab.evaluate((t) => window.__kfVoice.emit('end', { text: t, reason: 'limit' }), T.final);
    await tab.waitForSelector('[data-kf-voice-message="limit"]', { timeout: 10000 });
    return { act: 'voice-limit' };
  }
  await tap();
  if (v.view === 'noSpeech') {
    await tab.waitForSelector('[data-kf-voice-message="noSpeech"]', { timeout: 10000 });
    return { act: 'voice-noSpeech' };
  }
  await tab.waitForFunction((t) => document.querySelector('[data-kf-composer] textarea')?.value === t, { timeout: 10000 }, T.final);
  await tab.waitForSelector('[data-kf-voice-message="check"]', { timeout: 10000 });
  if (v.view === 'transcript') return { act: 'voice-transcript' };
  // toolong: the student's own tap on Send; the route answers 413.
  const sentBefore = await tab.evaluate(() => window.__kfVoice.agent);
  await tab.evaluate(() => document.querySelector('[data-kf-composer] button[aria-label]:not([data-kf-voice])').click());
  await tab.waitForFunction((h) => document.body.textContent.replace(/ /g, ' ').includes(h), { timeout: 15000 }, TOO_LONG[job.locale].slice(0, 20));
  await tab.waitForFunction((t) => document.querySelector('[data-kf-composer] textarea')?.value === t, { timeout: 10000 }, T.final);
  return { act: 'voice-toolong', sentBeforeTap: sentBefore };
}

/** CHECK 27. Self-contained: serialised into the page. */
export function voiceCheck(expect) {
  const q = (sel) => [...document.querySelectorAll(sel)];
  const box = (el) => el.getBoundingClientRect();
  const f = [];
  const m = {};
  const mics = q('[data-kf-voice="mic"]');
  const line = document.querySelector('[data-kf-voice-line]');
  m.mics = mics.length;
  if (!expect.mic) {
    if (mics.length) f.push(`check 27: ${mics.length} microphone(s) drawn where none may be (${expect.view})`);
    if (line) f.push('check 27: a voice line drawn where no microphone may be');
    return { finding: f.length ? f.join(' | ') : null, measured: m };
  }
  if (mics.length !== 1) {
    f.push(`check 27: ${mics.length} microphone(s), want 1`);
    return { finding: f.join(' | '), measured: m };
  }
  const mic = mics[0];
  const composer = document.querySelector('[data-kf-composer]');
  const field = composer?.querySelector('textarea');
  const send = composer && [...composer.querySelectorAll('button[aria-label]')].find((b) => !b.hasAttribute('data-kf-voice'));
  if (!composer || !composer.contains(mic)) f.push('check 27: the microphone is not in the composer');
  if (!field || !send) f.push('check 27: the composer has no field or no Send');
  if (field && send) {
    const order = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (!order(field, mic) || !order(mic, send)) f.push('check 27: the microphone is not between the field and Send');
    const F = box(field), M = box(mic), S = box(send);
    const row = mic.parentElement && box(mic.parentElement);
    m.row = row ? Math.round(row.width) : null;
    m.field = [Math.round(F.width), Math.round(F.height)];
    m.mic = [Math.round(M.width), Math.round(M.height)];
    m.send = [Math.round(S.width), Math.round(S.height)];
    m.fieldFont = getComputedStyle(field).fontSize;
    const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    if (overlap(F, M) || overlap(M, S) || overlap(F, S)) f.push(`check 27: the field, the microphone and Send overlap (field ${m.field}, mic ${m.mic}, send ${m.send})`);
    if (row && [F, M, S].some((b) => b.left < row.left - 0.5 || b.right > row.right + 0.5)) f.push('check 27: a control spills out of the composer row');
    if (Math.abs((M.top + M.bottom) / 2 - (S.top + S.bottom) / 2) > 1) f.push('check 27: the microphone and Send are not on one line');
    if (M.width < 44 || M.height < 44) f.push(`check 27: the microphone is ${M.width.toFixed(1)} x ${M.height.toFixed(1)}, under 44 x 44`);
    if (S.width < 44 || S.height < 44) f.push(`check 27: Send is ${S.width.toFixed(1)} x ${S.height.toFixed(1)}, under 44 x 44`);
    if (F.width < 120) f.push(`check 27: the field is only ${F.width.toFixed(1)} wide beside the microphone`);
    if (window.innerWidth < 768 && parseFloat(m.fieldFont) < 16) f.push(`check 27: the field's text is ${m.fieldFont}, under 16 px (#286)`);
  }
  const state = mic.getAttribute('data-kf-voice-state');
  const msg = line?.getAttribute('data-kf-voice-message') || null;
  const value = field ? field.value : null;
  const partial = document.querySelector('[data-kf-voice-partial]');
  const chip = document.querySelector('[data-kf-voice-lang]');
  const settings = document.querySelector('[data-kf-voice-settings]');
  Object.assign(m, { state, line: msg, value, chip: chip?.getAttribute('data-kf-voice-lang') || null, settings: !!settings, partial: partial?.textContent || null, agentCalls: window.__kfVoice?.agent ?? null });
  if (!mic.getAttribute('aria-label')) f.push('check 27: the microphone has no name');
  if (line && (!line.textContent.trim() || line.getAttribute('aria-live') !== 'polite')) f.push('check 27: the voice line is empty or not a polite live region');
  if (line && composer && !composer.contains(line)) f.push('check 27: the voice line is outside the composer');
  if (line && field && box(line).bottom > box(field).top + 0.5) f.push('check 27: the voice line is not above the field');
  const want = {
    idle: { state: 'idle', line: null, value: '' },
    recording: { state: 'recording', line: 'listening', value: '', partial: expect.partial, chip: true, pressed: 'true' },
    transcript: { state: 'idle', line: 'check', value: expect.final },
    denied: { state: 'idle', line: 'denied', value: '', settings: true },
    noSpeech: { state: 'idle', line: 'noSpeech', value: '' },
    unsupported: { state: 'idle', line: 'unsupported', value: '', chip: true },
    failed: { state: 'idle', line: 'failed', value: '' },
    limit: { state: 'idle', line: 'limit', value: expect.final },
    toolong: { state: 'idle', line: null, value: expect.final },
  }[expect.view];
  if (want) {
    if (state !== want.state) f.push(`check 27: the microphone is ${state}, want ${want.state} (${expect.view})`);
    if (msg !== want.line) f.push(`check 27: the line says ${msg}, want ${want.line} (${expect.view})`);
    if (value !== want.value) f.push(`check 27: the field holds ${JSON.stringify(value)}, want ${JSON.stringify(want.value)} (${expect.view})`);
    if (want.partial && partial?.textContent !== want.partial) f.push(`check 27: the partial line reads ${JSON.stringify(partial?.textContent)}, want ${JSON.stringify(want.partial)}`);
    if (!want.partial && partial) f.push('check 27: a partial line outside a take');
    if (!!want.chip !== !!chip) f.push(`check 27: the language chip is ${chip ? 'shown' : 'missing'} (${expect.view})`);
    if (!!want.settings !== !!settings) f.push(`check 27: Open Settings is ${settings ? 'shown' : 'missing'} (${expect.view})`);
    if (want.pressed && mic.getAttribute('aria-pressed') !== want.pressed) f.push('check 27: the microphone is not aria-pressed while listening');
    const sends = expect.view === 'toolong' ? 1 : 0;
    if (window.__kfVoice && window.__kfVoice.agent !== sends) f.push(`check 27: /api/agent was called ${window.__kfVoice.agent} time(s), want ${sends} (a take never sends)`);
    if (expect.view === 'toolong' && !document.body.textContent.replace(/ /g, ' ').includes(expect.tooLong)) f.push('check 27: the 413 sentence is not shown');
  }
  return { finding: f.length ? f.join(' | ') : null, measured: m };
}

/** Check 27's forced cases: the mic removed where it must be, planted where it must not. */
export function voicePlant(expect) {
  if (expect.mic) {
    const mic = document.querySelector('[data-kf-voice="mic"]');
    if (!mic) return { forced: false };
    const parent = mic.parentNode, next = mic.nextSibling;
    parent.removeChild(mic);
    let r;
    try { r = window.voiceCheck(expect); } finally { parent.insertBefore(mic, next); }
    const caught = !!(r.finding && /check 27/.test(r.finding));
    return { forced: true, kind: 'removed', caught, finding: caught ? null : 'check 27 is blind: the microphone removed from a shell-2 screen with the plugin was not flagged' };
  }
  const row = document.querySelector('[data-kf-composer] textarea')?.parentElement;
  if (!row) return { forced: false };
  const fake = document.createElement('button');
  fake.setAttribute('data-kf-voice', 'mic');
  fake.textContent = 'mic';
  row.appendChild(fake);
  let r;
  try { r = window.voiceCheck(expect); } finally { fake.remove(); }
  const caught = !!(r.finding && /check 27/.test(r.finding));
  return { forced: true, kind: 'planted', caught, finding: caught ? null : `check 27 is blind: a microphone planted on ${expect.view} where none may be was not flagged` };
}

/**
 * CHECK 28 (the owner's review of PR #340, fix 1): in every voice state that
 * carries a control (recording and unsupported: the language chip; denied:
 * Open Settings), the message takes the full width of the line and each
 * control sits on its own row BELOW it, at the reading start (right in
 * Arabic, left in English), at least 44 x 44. The message: no line holding a
 * single word, and the seconds counter never alone on a line (it is one
 * unit, nowrap, inside the sentence). Self-contained: serialised into the page.
 * Returns null where the view has no control.
 */
export const STACK_VIEWS = ['recording', 'unsupported', 'denied'];
export function voiceStackCheck(expect) {
  if (!expect.mic || !['recording', 'unsupported', 'denied'].includes(expect.view)) return null;
  const f = [];
  const line = document.querySelector('[data-kf-voice-line]');
  const msg = line?.querySelector('[data-kf-voice-text]') || line?.querySelector('p');
  const controls = line ? [...line.querySelectorAll('[data-kf-voice-lang], [data-kf-voice-settings]')] : [];
  const m = { view: expect.view, controls: controls.length };
  if (!line || !msg) return { finding: 'check 28: no voice line or no message to measure', measured: m };
  if (!controls.length) return { finding: `check 28: ${expect.view} has no control to measure`, measured: m };
  const L = line.getBoundingClientRect(), M = msg.getBoundingClientRect();
  const cs = getComputedStyle(line);
  const rtl = cs.direction === 'rtl';
  const inner = { left: L.left + parseFloat(cs.paddingLeft), right: L.right - parseFloat(cs.paddingRight) };
  m.dir = rtl ? 'rtl' : 'ltr';
  m.messageBottom = +M.bottom.toFixed(1);
  m.messageWidth = Math.round(M.width);
  m.lineWidth = Math.round(inner.right - inner.left);
  if (M.width < (inner.right - inner.left) - 1) f.push(`check 28: the message is ${M.width.toFixed(1)} wide of ${(inner.right - inner.left).toFixed(1)}: not the full width (${expect.view})`);
  m.controlTops = [];
  for (const c of controls) {
    const C = c.getBoundingClientRect();
    const name = c.hasAttribute('data-kf-voice-settings') ? 'Open Settings' : 'the language chip';
    m.controlTops.push(+C.top.toFixed(1));
    if (C.top < M.bottom - 0.5) f.push(`check 28: ${name}'s top ${C.top.toFixed(1)} is above the message's bottom ${M.bottom.toFixed(1)}: beside the message, not below it (${expect.view})`);
    if (C.width < 44 || C.height < 44) f.push(`check 28: ${name} is ${C.width.toFixed(1)} x ${C.height.toFixed(1)}, under 44 x 44`);
  }
  // Reading start: the first control's start edge on the line's content start.
  const first = controls[0].getBoundingClientRect();
  m.startGap = +(rtl ? inner.right - first.right : first.left - inner.left).toFixed(1);
  if (Math.abs(m.startGap) > 1) f.push(`check 28: the first control is ${m.startGap} px from the reading start (${rtl ? 'right' : 'left'})`);
  // The message's lines, as units: words, and the seconds counter as one.
  const units = [];
  const secs = msg.querySelector('[data-kf-voice-seconds]');
  const walk = document.createTreeWalker(msg, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (secs && secs.contains(n)) continue;
    const re = /\S+/g;
    for (let x = re.exec(n.data); x; x = re.exec(n.data)) {
      const r = document.createRange();
      r.setStart(n, x.index);
      r.setEnd(n, x.index + x[0].length);
      const rc = [...r.getClientRects()].filter((b) => b.width > 0);
      if (rc.length) units.push({ w: x[0], top: rc[rc.length - 1].top, split: new Set(rc.map((b) => Math.round(b.top))).size > 1 });
    }
  }
  if (secs) { const b = secs.getBoundingClientRect(); units.push({ w: secs.textContent, top: b.top, secs: true, split: secs.getClientRects().length > 1 }); }
  const rows = [];
  for (const u of units.sort((a, b) => a.top - b.top)) {
    const row = rows.find((r) => Math.abs(r.top - u.top) < 4);
    if (row) row.units.push(u); else rows.push({ top: u.top, units: [u] });
  }
  m.messageLines = rows.length;
  m.wordsPerLine = rows.map((r) => r.units.length);
  for (const u of units) if (u.split) f.push(`check 28: "${u.w}" is split across two lines`);
  if (rows.length > 1) for (const r of rows) if (r.units.length === 1) f.push(`check 28: a message line holds one ${r.units[0].secs ? 'unit: the seconds counter alone' : `word: "${r.units[0].w}"`} (${expect.view})`);
  return { finding: f.length ? f.join(' | ') : null, measured: m };
}

/**
 * Check 28's forced case: the line put back the way 0960b1a drew it, the
 * message and its controls in ONE flex row (items centred, the message
 * flex-1), with inline styles so it does not depend on the bundle's classes.
 * Check 28 must flag it on every render, or the run fails.
 */
export function voiceStackPlant(expect) {
  if (!expect.mic || !['recording', 'unsupported', 'denied'].includes(expect.view)) return null;
  const line = document.querySelector('[data-kf-voice-line]');
  const msg = line?.querySelector('[data-kf-voice-text]');
  const controls = line ? [...line.querySelectorAll('[data-kf-voice-lang], [data-kf-voice-settings]')] : [];
  if (!msg || !controls.length) return { forced: false };
  const home = controls.map((c) => [c, c.parentNode, c.nextSibling]);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px';
  msg.parentNode.insertBefore(row, msg);
  const old = msg.style.cssText;
  msg.style.cssText = 'flex:1 1 0%;min-width:0';
  row.appendChild(msg);
  for (const c of controls) row.appendChild(c);
  let r;
  try { r = window.voiceStackCheck(expect); } finally {
    row.parentNode.insertBefore(msg, row);
    msg.style.cssText = old;
    for (const [c, p, n] of home) p.insertBefore(c, n);
    row.remove();
  }
  const caught = !!(r && r.finding && /beside the message, not below it/.test(r.finding));
  return { forced: true, kind: 'sideBySide', caught, measured: r?.measured || null, finding: caught ? null : `check 28 is blind: the line put back side by side (0960b1a) on ${expect.view} was not flagged` };
}

/** Check 29's phrases, read from src/lib/keep-together.ts (KEEP_TOGETHER_VOICE). */
export function keepVoiceList(root) {
  const src = readFileSync(join(root, 'src', 'lib', 'keep-together.ts'), 'utf8');
  const m = /KEEP_TOGETHER_VOICE = \[([^\]]*)\]/.exec(src);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}

/** Where check 29 reads: the voice line's message. */
export const VOICE_TEXT_SCOPE = '[data-kf-voice-text]';

/**
 * CHECK 29 (the owner's review of PR #340 at 3b2fe21: the Arabic failed
 * message at 390 ended a line on its "or"). Self-contained: serialised into
 * the page; needs window.kfPhraseChecks (pr4.mjs, phraseChecks). For the
 * message of the voice line, wherever one is drawn: (a) no line of it ends
 * with the first word of a KEEP_TOGETHER_VOICE phrase ("or", and the Arabic
 * twin), a trailing comma or full stop ignored; (b) no such phrase spans two
 * lines. Returns null where no line is drawn.
 */
export function voicePhraseCheck(expect, list) {
  if (!expect.mic) return null;
  const msg = document.querySelector('[data-kf-voice-line] [data-kf-voice-text]');
  if (!msg) return null;
  const f = [];
  const ends = [...new Set(list.map((p) => p.split(' ')[0].toLowerCase()))];
  const secs = msg.querySelector('[data-kf-voice-seconds]');
  const units = [];
  const walk = document.createTreeWalker(msg, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (secs && secs.contains(n)) continue;
    const re = /\S+/g;
    for (let x = re.exec(n.data); x; x = re.exec(n.data)) {
      const r = document.createRange();
      r.setStart(n, x.index);
      r.setEnd(n, x.index + x[0].length);
      const rc = [...r.getClientRects()].filter((b) => b.width > 0);
      if (rc.length) units.push({ w: x[0], i: units.length, top: rc[rc.length - 1].top });
    }
  }
  const rows = [];
  for (const u of [...units].sort((a, b) => a.top - b.top)) {
    const row = rows.find((r) => Math.abs(r.top - u.top) < 4);
    if (row) row.units.push(u); else rows.push({ top: u.top, units: [u] });
  }
  // The last word of a line in reading order is the one latest in the DOM.
  const lineEnds = rows.map((r) => r.units.reduce((a, b) => (b.i > a.i ? b : a)).w);
  for (const w of lineEnds) {
    const bare = w.replace(/[.,\u060C\u061B:!?\u061F]+$/u, '').toLowerCase();
    if (ends.includes(bare)) f.push(`check 29: a message line ends on "${bare}" (${expect.view})`);
  }
  const ph = window.kfPhraseChecks(list, '[data-kf-voice-line] [data-kf-voice-text]');
  for (const x of ph.findings) f.push(`check 29: ${x} (${expect.view})`);
  return { finding: f.length ? f.join(' | ') : null, measured: { view: expect.view, lines: rows.length, lineEnds, phrasesRead: ph.read } };
}

/**
 * Check 29's forced case, per phrase present in the message: the joint after
 * its first word made a plain space with a <br> after it (check 26's method),
 * check 29 run, the node put back. Caught only if BOTH rules flag it: the
 * line ending on the first word and the phrase split.
 */
export function voicePhrasePlant(expect, list) {
  const msg = document.querySelector('[data-kf-voice-line] [data-kf-voice-text]');
  if (!expect.mic || !msg) return null;
  const rows = [];
  for (const phrase of list) {
    const first = phrase.split(' ')[0];
    const re = new RegExp(phrase.split(' ').join('[  ]+'));
    const tw = document.createTreeWalker(msg, NodeFilter.SHOW_TEXT);
    let hit = null;
    for (let n = tw.nextNode(); n && !hit; n = tw.nextNode()) {
      const m = re.exec(n.data);
      if (m) hit = { n, at: m.index + first.length };
    }
    if (!hit) continue;
    const { n, at } = hit;
    const keep = n.data;
    const tail = n.splitText(at + 1);
    n.data = n.data.slice(0, -1) + ' ';
    const br = document.createElement('br');
    n.after(br);
    let r = null;
    try { r = window.voicePhraseCheck(expect, list); } finally {
      br.remove();
      tail.remove();
      n.data = keep;
    }
    const fd = r?.finding || '';
    const caught = fd.includes(`ends on "${first.toLowerCase()}"`) && fd.includes(`"${phrase}" splits`);
    rows.push({ phrase, caught, finding: fd || null });
  }
  return rows;
}
