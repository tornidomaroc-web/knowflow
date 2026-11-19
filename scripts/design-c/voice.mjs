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
 * CHECK 22 (camera.mjs, sameCheck), widened again: every screen of shell 2
 * that existed before this change (no stub: build 9 before the plugin, and
 * the Android shell) must be the same picture as main, like build 8 and the
 * web; and so must shell 1 and the web WITH the stub.
 */
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
