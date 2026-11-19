/**
 * VOICE INPUT IN ASK (iOS 1.1, big item 4e): the proof, without a phone, a
 * browser, a network or a credential. The study is
 * D:\Temp\kf-research\voice-study-9092d05\report.md, section 8, option (a):
 * an in-repo KnowFlowSpeech plugin on Apple's SFSpeechRecognizer, the app at
 * shell 2 only and only where the plugin answers, the transcript appended to
 * the field and NEVER sent by itself. No server change.
 *
 *  1. THE BRIDGE. speechBridge() is null on the web (no window.Capacitor), in
 *     a browser with a forged `KnowFlowApp/2` user agent, in the Android shell
 *     (getPlatform() is 'android'), in an iOS shell without the plugin (build
 *     9 cut before this change, and build 8), and when the bridge lacks
 *     nativePromise or addListener. With all of them it calls
 *     `KnowFlowSpeech` and nothing else. The shell gate is 2 on, never 0 or 1.
 *  2. THE APPEND RULES. appendTranscript: an empty field takes the take; a
 *     field with text gets one space then the take; a trailing space or
 *     newline is kept and no second space is added; a whitespace-only take
 *     changes nothing; the take's own runs of white space become one space;
 *     nothing is ever cut (the 4,000-character cap stays the server's).
 *  3. A TAKE NEVER SENDS. startTake() is driven with a fake plugin while
 *     globalThis.fetch, XMLHttpRequest and navigator.sendBeacon are spies:
 *     partial lines, a tap stop, an end event (60 s), a refused start; not
 *     one call. The client sources hold no fetch, no handleSend and no form
 *     submit; ChatBox hands the transcript to setInput only.
 *  4. THE ERROR MAP. Every error code the plugin can give maps to a message
 *     key present and non-empty in both dictionaries; every outcome
 *     (tap, silence, limit, background, interruption, no speech, a failed
 *     recognizer with and without text, a refused or unsupported start) says
 *     what is appended and which line shows.
 *  5. THE STRINGS. dashboard.agent.voice is the same key set in en and ar,
 *     placeholders equal, no em dash, Western digits, no hit of the app's
 *     wording rule (kfWording) in either language, the two purpose strings
 *     and the privacy sentence too; every one is, byte for byte, the owner's
 *     approved text in docs/copy/ARABIC_STRINGS_app_v13.md (approved
 *     2026-11-19): the Arabic table row and English bullet of each key, the
 *     "(en)" and "(ar)" lines of the permission texts and the privacy
 *     sentence. Exact equality, not "contained in".
 *  6. THE 413 PATH. ChatBox's QUESTION_TOO_LONG branch still puts the
 *     question back in the field, the field has no maxLength, and a field
 *     grown past 4,000 characters by takes is kept whole (the browser half
 *     of this, a transcript sent and refused, is design-c's check 27).
 *  7. THE SERVER HTML. ChatBox rendered on the server for the web, shell 1
 *     and shell 2 is byte for byte the same: the microphone is drawn only
 *     after mount, so the page every shell receives is today's.
 *  8. THE NATIVE PLUGIN. KnowFlowSpeech.swift in this repository, jsName
 *     KnowFlowSpeech, the four methods; on-device recognition required where
 *     the phone supports it; the 60 s limit; ~3 s of silence; stop on resign
 *     active and on an audio interruption; the audio session restored on
 *     every exit; no file written, no audio sent to the page (only `partial`
 *     and `end`, text); registered in MainViewController beside
 *     KnowFlowStore; the four project entries; the smoke probe's `speech`;
 *     both purpose strings in Info.plist and both .lproj files; PrivacyInfo
 *     declares no audio type; Android untouched.
 *
 * Tier 0. Usage: node --experimental-strip-types scripts/verify-voice-input.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';
import { kfWording } from './lib/app-wording.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8') : '');
const failures = [];
let passed = 0;
const check = (ok, msg) => {
  if (ok) { passed += 1; console.log(`  OK    ${msg}`); } else { failures.push(msg); console.log(`  FAIL  ${msg}`); }
};
const section = (t) => console.log(`\n${t}`);
async function load(p) {
  try { return await import(pathToFileURL(resolvePath(ROOT, p)).href); } catch (e) { check(false, `${p} loads (${String(e.message).split('\n')[0]})`); return null; }
}

installTsxHooks(ROOT, {
  '@/lib/supabase/client': 'export function createClient(){ throw new Error("no Supabase in a proof"); }',
  '@/lib/supabase/server': 'export async function createClient(){ throw new Error("no Supabase in a proof"); }',
});
globalThis.__tsxHooksParams = { locale: 'en' };

const bridgeMod = await load('src/lib/speech/bridge.ts');
const merge = await load('src/lib/speech/merge.ts');
const take = await load('src/lib/speech/take.ts');
const en = (await load('src/lib/i18n/locales/en.ts'))?.en;
const ar = (await load('src/lib/i18n/locales/ar.ts'))?.ar;

// ── 1. The bridge ───────────────────────────────────────────────────────────
section('1. The bridge: the plugin, iOS, shell 2; nothing anywhere else');
const fakeCap = (over = {}) => {
  const calls = [];
  const listeners = [];
  const C = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    isPluginAvailable: (n) => n === 'KnowFlowSpeech',
    nativePromise: (plugin, method, options) => { calls.push({ plugin, method, options }); return Promise.resolve({ ok: true }); },
    addListener: (plugin, event, cb) => { const l = { plugin, event, cb, removed: false }; listeners.push(l); return { remove: () => { l.removed = true; } }; },
    ...over,
  };
  return { C, calls, listeners };
};
const withCap = (C, ua, fn) => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'Capacitor');
  const prev = globalThis.Capacitor;
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  if (C === undefined) delete globalThis.Capacitor; else globalThis.Capacitor = C;
  if (ua) Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua }, configurable: true, writable: true });
  try { return fn(); } finally {
    if (had) globalThis.Capacitor = prev; else delete globalThis.Capacitor;
    if (ua) { if (prevNav) Object.defineProperty(globalThis, 'navigator', prevNav); else delete globalThis.navigator; }
  }
};
if (bridgeMod) {
  const { speechBridge, speechShellAllowed, SPEECH_PLUGIN, SPEECH_SHELL_VERSION } = bridgeMod;
  check(SPEECH_PLUGIN === 'KnowFlowSpeech', `the plugin is named KnowFlowSpeech (${SPEECH_PLUGIN})`);
  check(SPEECH_SHELL_VERSION === 2 && speechShellAllowed(2) && speechShellAllowed(3) && !speechShellAllowed(1) && !speechShellAllowed(0) && !speechShellAllowed(NaN) && !speechShellAllowed(1.5), 'the shell gate: 2 on; never the web (0), build 8 (1) or a non-integer');
  check(withCap(undefined, null, () => speechBridge()) === null, 'the web (no window.Capacitor): null');
  check(withCap(undefined, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KnowFlowApp/2', () => speechBridge()) === null, 'a browser with a forged KnowFlowApp/2 user agent: null');
  check(withCap(fakeCap({ getPlatform: () => 'android' }).C, null, () => speechBridge()) === null, 'the Android shell (getPlatform android, which also sends KnowFlowApp/2): null');
  check(withCap(fakeCap({ isPluginAvailable: () => false }).C, null, () => speechBridge()) === null, 'an iOS shell without the plugin (build 8, a build 9 cut before this change): null');
  check(withCap(fakeCap({ isPluginAvailable: (n) => n === 'KnowFlowStore' }).C, null, () => speechBridge()) === null, 'an iOS shell with KnowFlowStore but not KnowFlowSpeech: null');
  check(withCap(fakeCap({ isNativePlatform: () => false }).C, null, () => speechBridge()) === null, 'Capacitor present but not native: null');
  check(withCap(fakeCap({ nativePromise: undefined }).C, null, () => speechBridge()) === null, 'no nativePromise: null');
  check(withCap(fakeCap({ addListener: undefined }).C, null, () => speechBridge()) === null, 'no addListener (partial lines could not arrive): null');
  const f = fakeCap();
  const b = withCap(f.C, null, () => speechBridge());
  check(b !== null, 'iOS, native, the plugin present: a bridge');
  if (b) {
    await b.call('availability', { locale: 'ar-SA' });
    const off = b.listen('partial', () => {});
    off();
    check(f.calls.length === 1 && f.calls[0].plugin === 'KnowFlowSpeech' && f.calls[0].method === 'availability' && f.calls[0].options.locale === 'ar-SA', `calls reach KnowFlowSpeech only: ${JSON.stringify(f.calls)}`);
    check(f.listeners.length === 1 && f.listeners[0].plugin === 'KnowFlowSpeech' && f.listeners[0].event === 'partial' && f.listeners[0].removed, 'listeners are KnowFlowSpeech\'s and are removed');
  }
}
const vb = read('src/components/agent/VoiceButton.tsx');
check(/speechShellAllowed\(/.test(vb) && /speechBridge\(/.test(vb), 'VoiceButton asks the shell gate AND the bridge');
check(/useShellVersion\(\)/.test(vb) && /usePlatform\(\)/.test(vb) && /'native'/.test(vb), 'VoiceButton reads the shell and the platform from PlatformProvider (the server reading), not the user agent');
check(!/navigator\.userAgent/.test(vb), 'VoiceButton does not sniff the user agent');
check(/useEffect\(/.test(vb) && /availability/.test(vb), 'the microphone appears only after mount, once availability answers');
// The owner's review of PR #340, fix 1: a control sits on its own row below the message (design-c check 28 measures it).
const vText = vb.indexOf('data-kf-voice-text=""'), vCtl = vb.indexOf('data-kf-voice-controls=""');
check(vText > -1 && vCtl > vText && vb.indexOf('data-kf-voice-lang=', vCtl) > vCtl && vb.indexOf('data-kf-voice-settings=""', vCtl) > vCtl, 'the language chip and Open Settings sit in their own row after the message');
check(!/min-w-0 flex-1/.test(vb), 'the message is not a flex-1 item beside a control (0960b1a\'s row)');
// Fix 2: the microphone is all clay, no outline stand.
const clay = read('src/components/clay/ClayIcons.tsx');
const micSvg = /export const ClayMic = [\s\S]*?<\/svg>/.exec(clay)?.[0] || '';
check(!!micSvg && !/stroke/i.test(micSvg) && !/fill="none"/.test(micSvg), 'ClayMic draws no stroke and no unfilled shape');
check(!!micSvg && !/#1A1611/i.test(micSvg) && /G\('taupe'\)/.test(micSvg) && /G\('cream'\)/.test(micSvg), 'ClayMic\'s stand is clay taupe (theme-following), not ink');
check(/<rect x="8\.2" y="2" width="7\.6" height="13\.2" rx="3\.8" fill=\{G\('gold'\)\} \/>/.test(micSvg) && /<rect x="8\.2" y="7\.3" width="7\.6" height="2\.6" fill=\{G\('cream'\)\} \/>/.test(micSvg), 'ClayMic\'s head is gold clay with a cream band (reads on the cream button in light)');
const ask = read('src/app/[locale]/dashboard/agent/page.tsx') + read('src/app/[locale]/dashboard/layout.tsx');
check(/PlatformProvider platform=\{platform\} shell=\{shell\}/.test(read('src/app/[locale]/dashboard/layout.tsx')), 'the dashboard\'s PlatformProvider carries the shell version (Ask is under it)');
check(!!ask, 'the dashboard layout is read');

// ── 2. The append rules ─────────────────────────────────────────────────────
section('2. The transcript is appended, never replaces, never cut');
if (merge) {
  const { appendTranscript } = merge;
  const cases = [
    ['', 'What is opportunity cost?', 'What is opportunity cost?', 'empty field'],
    ['   ', 'hello', 'hello', 'a whitespace-only field'],
    ['Explain', 'opportunity cost', 'Explain opportunity cost', 'a field with text: one space between'],
    ['Explain ', 'opportunity cost', 'Explain opportunity cost', 'a trailing space: no second space'],
    ['Line one\n', 'line two', 'Line one\nline two', 'a trailing newline is kept'],
    ['Keep me', '   ', 'Keep me', 'a whitespace-only take changes nothing'],
    ['Keep me', '', 'Keep me', 'an empty take changes nothing'],
    ['', '  ما هي   مرونة\nالطلب؟ ', 'ما هي مرونة الطلب؟', 'the take\'s white space made single, Arabic kept'],
    ['ما هو', 'التضخم؟', 'ما هو التضخم؟', 'Arabic after Arabic'],
  ];
  for (const [field, t, want, what] of cases) {
    const got = appendTranscript(field, t);
    check(got === want, `${what}: ${JSON.stringify(field)} + ${JSON.stringify(t)} -> ${JSON.stringify(got)}`);
  }
  const big = 'x'.repeat(3990);
  const grown = appendTranscript(big, 'one two three four five');
  check(grown.length === 3990 + 1 + 23 && grown.startsWith(big), `nothing is cut at 4,000: ${grown.length} characters kept (the cap is the server's, its 413 brings the text back)`);
  const { speechLocaleFor } = merge;
  check(speechLocaleFor('ar') === 'ar-SA' && speechLocaleFor('en') === 'en-US' && speechLocaleFor('fr') === 'en-US', 'the language by default follows the screen: ar -> ar-SA, en -> en-US');
}

// ── 3. A take never sends ───────────────────────────────────────────────────
section('3. A take never calls fetch, XMLHttpRequest or sendBeacon');
const net = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (...a) => { net.push(['fetch', String(a[0])]); return Promise.reject(new Error('no network in a proof')); };
globalThis.XMLHttpRequest = function () { net.push(['xhr']); };
const navBeacon = (u) => { net.push(['beacon', u]); return true; };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'proof', sendBeacon: navBeacon }, configurable: true, writable: true });
const tick = () => new Promise((r) => setTimeout(r, 0));
function fakePlugin({ start = { started: true, onDevice: true }, stop = { text: 'What is opportunity cost?', reason: 'tap' } } = {}) {
  const ls = { partial: [], end: [] };
  const calls = [];
  return {
    calls,
    emit: (ev, data) => ls[ev].forEach((cb) => cb(data)),
    bridge: {
      call: async (method, options) => { calls.push([method, options]); return method === 'start' ? start : method === 'stop' ? stop : {}; },
      listen: (ev, cb) => { ls[ev].push(cb); return () => { ls[ev] = ls[ev].filter((x) => x !== cb); }; },
    },
  };
}
if (take && merge) {
  const { startTake } = take;
  // (a) partial lines, then a tap.
  let fp = fakePlugin();
  const partials = [];
  let ended = null;
  let r = await startTake(fp.bridge, 'en-US', (p) => partials.push(p), (e) => { ended = e; });
  check(r.ok === true, 'a started take answers ok');
  fp.emit('partial', { text: 'What is' });
  fp.emit('partial', { text: 'What is opportunity' });
  await r.stop();
  fp.emit('end', { text: 'What is opportunity cost?', reason: 'tap' });
  await tick();
  check(partials.join('|') === 'What is|What is opportunity', `partial lines reach the page as text: ${JSON.stringify(partials)}`);
  check(ended && ended.text === 'What is opportunity cost?' && ended.reason === 'tap', `the tap stop ends the take once with the final text: ${JSON.stringify(ended)}`);
  check(JSON.stringify(fp.calls.map((c) => c[0])) === '["start","stop"]' && fp.calls[0][1].locale === 'en-US', `the plugin is asked start then stop, in the chosen language: ${JSON.stringify(fp.calls)}`);
  // (b) the plugin ends it (60 s).
  fp = fakePlugin();
  ended = null;
  r = await startTake(fp.bridge, 'ar-SA', () => {}, (e) => { ended = e; });
  fp.emit('end', { text: 'ما هي مرونة الطلب؟', reason: 'limit' });
  fp.emit('end', { text: 'twice', reason: 'limit' });
  await tick();
  check(ended && ended.reason === 'limit' && ended.text === 'ما هي مرونة الطلب؟', 'the 60 s end arrives once, with its text');
  // (c) refused start.
  fp = fakePlugin({ start: { started: false, error: 'denied' } });
  r = await startTake(fp.bridge, 'en-US', () => {}, () => {});
  check(r.ok === false && r.error === 'denied', `a refused start says why: ${JSON.stringify(r)}`);
  // (d) a cancelled take (language switch, leaving the page) delivers nothing.
  fp = fakePlugin();
  ended = null;
  r = await startTake(fp.bridge, 'en-US', () => {}, (e) => { ended = e; });
  await r.cancel();
  fp.emit('end', { text: 'late', reason: 'tap' });
  await tick();
  check(ended === null, 'a cancelled take hands nothing to the field');
  // (e) a plugin that throws.
  r = await startTake({ call: async () => { throw new Error('boom'); }, listen: () => () => {} }, 'en-US', () => {}, () => {});
  check(r.ok === false && r.error === 'failed', 'a plugin call that throws is a failed start, not an exception');
  check(net.length === 0, `not one network call during five takes: ${JSON.stringify(net)}`);
}
globalThis.fetch = realFetch;
const clientSrc = ['src/components/agent/VoiceButton.tsx', 'src/lib/speech/bridge.ts', 'src/lib/speech/merge.ts', 'src/lib/speech/take.ts'].map((p) => [p, read(p)]);
for (const [p, s] of clientSrc) {
  check(!!s && !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|handleSend|requestSubmit|\.submit\(/.test(s), `${p} holds no fetch, XMLHttpRequest, sendBeacon, handleSend or submit`);
}
const chat = read('src/components/agent/ChatBox.tsx');
const voiceUse = /<VoiceButton\b[\s\S]*?\/>/.exec(chat)?.[0] || '';
check(!!voiceUse, 'ChatBox mounts VoiceButton');
check(/onTranscript=\{appendTake\}/.test(voiceUse) && !/handleSend/.test(voiceUse), 'ChatBox hands the transcript to appendTake, not to handleSend');
const appendTake = /const appendTake = [\s\S]*?\n  \};/.exec(chat)?.[0] || '';
check(/setInput\(\(prev\) => appendTranscript\(prev, take\)\)/.test(appendTake) && !/handleSend|fetch/.test(appendTake), 'appendTake only appends to the field (setInput) and sends nothing');
check(/\[data-kf-composer\]|data-kf-composer/.test(chat) && chat.indexOf('<VoiceButton') > chat.indexOf('data-kf-composer=""') && chat.indexOf('<VoiceButton') < chat.indexOf('aria-label={t.dashboard.agent.send}'), 'the microphone sits in the composer row, between the field and Send');
check(/if \(\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === 'Enter'\) handleSend\(\);/.test(chat), 'Ctrl/Cmd+Enter unchanged');

// ── 4. The error map ────────────────────────────────────────────────────────
section('4. Every outcome has its line, in both languages');
if (merge && en && ar) {
  const { VOICE_ERRORS, takeOutcome, parseStart, parseEnd } = merge;
  const V = { en: en.dashboard?.agent?.voice || {}, ar: ar.dashboard?.agent?.voice || {} };
  for (const code of VOICE_ERRORS) for (const L of ['en', 'ar']) check(typeof V[L][code] === 'string' && V[L][code].trim().length > 0, `${L}: the ${code} line exists`);
  check(VOICE_ERRORS.join(',') === 'denied,noSpeech,unsupported,failed,limit', `the codes: ${VOICE_ERRORS.join(',')}`);
  const want = [
    [{ text: 'Hello there', reason: 'tap' }, 'Hello there', 'check'],
    [{ text: 'Hello there', reason: 'silence' }, 'Hello there', 'check'],
    [{ text: 'Hello there', reason: 'background' }, 'Hello there', 'check'],
    [{ text: 'Hello there', reason: 'interrupted' }, 'Hello there', 'check'],
    [{ text: 'Hello there', reason: 'limit' }, 'Hello there', 'limit'],
    [{ text: '', reason: 'silence' }, '', 'noSpeech'],
    [{ text: '  ', reason: 'tap' }, '', 'noSpeech'],
    [{ text: '', reason: 'error', error: 'noSpeech' }, '', 'noSpeech'],
    [{ text: '', reason: 'error', error: 'failed' }, '', 'failed'],
    [{ text: 'partly heard', reason: 'error', error: 'failed' }, 'partly heard', 'check'],
    [{ text: '', reason: 'limit' }, '', 'noSpeech'],
  ];
  for (const [end, append, message] of want) {
    const o = takeOutcome(end);
    check(o.append === append && o.message === message, `${JSON.stringify(end)} -> append ${JSON.stringify(o.append)}, line ${o.message}`);
  }
  check(parseStart({ started: true, onDevice: false }).started === true, 'a started answer reads as started');
  for (const e of ['denied', 'unsupported', 'failed', 'busy', 'nonsense', undefined]) {
    const s = parseStart({ started: false, error: e });
    check(s.started === false && VOICE_ERRORS.includes(s.error), `a refused start (${e}) maps to a known line: ${s.error}`);
  }
  check(parseStart(null).started === false && parseStart('x').started === false, 'a malformed answer is a failed start');
  check(parseEnd({ text: 5, reason: 'tap' }).text === '' && parseEnd(null).reason === 'error', 'a malformed end is read safely');
}

// ── 5. The strings ──────────────────────────────────────────────────────────
section('5. The strings: both locales, the wording rule, the approved batch (app v13)');
const KEYS = ['start', 'stop', 'listening', 'seconds', 'langAr', 'langEn', 'check', 'denied', 'openSettings', 'noSpeech', 'unsupported', 'failed', 'limit'];
const batch = read('docs/copy/ARABIC_STRINGS_app_v13.md');
check(!!batch && /APPROVED by the owner 2026-11-19/.test(batch), 'docs/copy/ARABIC_STRINGS_app_v13.md exists and is marked APPROVED 2026-11-19');
const okAr = new Map([...batch.matchAll(/^\| `dashboard\.agent\.voice\.(\w+)` \| (.*?) \| (?:.*?) \|\s*$/gm)].map((m) => [m[1], m[2]]));
const okEn = new Map([...batch.matchAll(/^- `dashboard\.agent\.voice\.(\w+)`: (.*)$/gm)].map((m) => [m[1], m[2].replace(/\r$/, '')]));
const okOther = new Map([...batch.matchAll(/^- `([\w.]+)` \((en|ar)\): (.*)$/gm)].map((m) => [`${m[1]} ${m[2]}`, m[3].replace(/\r$/, '')]));
check(okAr.size === KEYS.length && okEn.size === KEYS.length, `the batch holds ${KEYS.length} Arabic rows and ${KEYS.length} English bullets (${okAr.size}, ${okEn.size})`);
check(okOther.size === 6, `the batch holds the (en) and (ar) lines of the two permission texts and the privacy sentence (${okOther.size})`);
const plistEn = read('ios/App/App/en.lproj/InfoPlist.strings');
const plistAr = read('ios/App/App/ar.lproj/InfoPlist.strings');
const plist = read('ios/App/App/Info.plist');
const privacy = read('src/app/[locale]/(site)/privacy/page.tsx');
const strOf = (src, key) => (new RegExp(`"${key}" = "([^"]*)";`).exec(src) || [])[1];
const plistOf = (key) => (new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist) || [])[1];
if (en && ar) {
  const V = { en: en.dashboard?.agent?.voice || {}, ar: ar.dashboard?.agent?.voice || {} };
  const OK = { en: okEn, ar: okAr };
  check(JSON.stringify(Object.keys(V.en).sort()) === JSON.stringify([...KEYS].sort()), `en dashboard.agent.voice holds exactly the ${KEYS.length} keys: ${Object.keys(V.en).join(',')}`);
  check(JSON.stringify(Object.keys(V.ar).sort()) === JSON.stringify([...KEYS].sort()), `ar dashboard.agent.voice holds exactly the ${KEYS.length} keys: ${Object.keys(V.ar).join(',')}`);
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of KEYS) {
    check(ph(V.en[k]) === ph(V.ar[k]), `${k}: placeholders equal (${ph(V.en[k]) || 'none'})`);
    for (const L of ['en', 'ar']) {
      const s = V[L][k] || '';
      check(kfWording(s).length === 0, `${L}.${k} passes the wording rule: ${JSON.stringify(kfWording(s))}`);
      check(!/[—–]/.test(s), `${L}.${k}: no em or en dash`);
      check(!/[٠-٩۰-۹]/.test(s), `${L}.${k}: Western digits`);
      check(!!s && s === OK[L].get(k), `${L}.${k} is the approved text, byte for byte`);
    }
  }
  check(String(V.en.seconds || '').includes('{n}') && String(V.ar.seconds || '').includes('{n}'), 'the seconds counter has its {n}');
  check(/60/.test(V.en.limit || '') && /60/.test(V.ar.limit || ''), 'the limit line names 60 in Western digits in both');
}
for (const key of ['NSMicrophoneUsageDescription', 'NSSpeechRecognitionUsageDescription']) {
  const e = strOf(plistEn, key), a = strOf(plistAr, key), p = plistOf(key);
  check(!!e && !!a && !!p, `${key} in Info.plist and both .lproj files`);
  check(p === e, `${key}: Info.plist carries the English text`);
  for (const [L, s] of [['en', e], ['ar', a]]) {
    check(!!s && kfWording(s).length === 0 && !/[—–]/.test(s) && !/[٠-٩۰-۹]/.test(s), `${key} (${L}): wording rule, no dash, Western digits`);
    check(!!s && s === okOther.get(`${key} ${L}`), `${key} (${L}) is the approved text, byte for byte`);
  }
}
const pRaw = /data-kf-privacy-voice[^>]*>([\s\S]*?)<\/p>/.exec(privacy)?.[1] || '';
const pSentence = pRaw.replace(/&apos;/g, "'");
check(!/[<{]/.test(pRaw) && !/'/.test(pRaw), 'the privacy sentence is plain text, its apostrophes written &apos;');
check(pSentence === okOther.get('privacy.voice en'), `the privacy page's sentence is the approved English, byte for byte: ${pSentence.slice(0, 80)}...`);
check(kfWording(pSentence).length === 0, 'the privacy sentence passes the wording rule');
const pAr = okOther.get('privacy.voice ar') || '';
check(pAr.length > 40 && /Apple/.test(pAr) && /KnowFlow/.test(pAr) && kfWording(pAr).length === 0, 'the batch stores the Arabic privacy sentence for the future Arabic page');
check(!/DRAFT \(voice input/.test(privacy), 'the privacy page carries no DRAFT comment for the voice sentence');
check(!/copy-drafts\/voice_input_v1/.test(plistEn + plistAr + read('src/lib/i18n/locales/en.ts') + read('src/lib/i18n/locales/ar.ts')), 'no file the app ships points at the old draft');

// ── 5b. The phrases kept on one line ─────────────────────────────────────────
section("5b. The voice line's kept phrases (the owner's review of #340 at 3b2fe21)");
// The phrases are cut from the approved batch file here too (the owner's review at 62c9f7a): per language,
// the failed message's whole second sentence without its final full stop, then that sentence's first two
// words ("Try again", a trailing comma dropped), which also guard denied and noSpeech. Long before short.
const secondOf = (s) => { const p = String(s || '').split('. '); return p.length === 2 ? p[1].replace(/\.$/, '') : ''; };
const head2 = (s) => s.split(' ').slice(0, 2).join(' ').replace(/,$/, '');
const KT = await load('src/lib/keep-together.ts');
const LONG = { ar: secondOf(okAr.get('failed')), en: secondOf(okEn.get('failed')) };
const SHORT = { ar: head2(LONG.ar), en: head2(LONG.en) };
const WANT_VOICE = [LONG.ar, SHORT.ar, LONG.en, SHORT.en];
if (KT) {
  const NB = '\u00A0';
  const nb = (p) => p.split(' ').join(NB);
  check(JSON.stringify([...(KT.KEEP_TOGETHER_VOICE || [])]) === JSON.stringify(WANT_VOICE), `KEEP_TOGETHER_VOICE is exactly the approved failed message's second sentences and their "try again" heads, long before short, byte for byte (${(KT.KEEP_TOGETHER_VOICE || []).length} phrases)`);
  check(LONG.en === 'Try again, or type your question' && SHORT.en === 'Try again' && LONG.ar.split(' ').length === 5 && SHORT.ar.split(' ').length === 2, 'the phrases cut from the batch are "Try again, or type your question", "Try again", a five-word and a two-word Arabic phrase');
  check(WANT_VOICE.every((p) => p && !p.endsWith('.')), 'no kept phrase carries a final full stop');
  for (const k of ['denied', 'noSpeech', 'failed']) check(String(okAr.get(k) || '').includes(SHORT.ar), `the approved Arabic ${k} holds the short Arabic phrase, so it is guarded too`);
  if (en && ar && typeof KT.keepTogetherVoice === 'function') {
    const V = { en: en.dashboard.agent.voice, ar: ar.dashboard.agent.voice };
    for (const L of ['ar', 'en']) {
      for (const k of ['failed', 'denied', 'noSpeech']) {
        const out = KT.keepTogetherVoice(V[L][k]);
        check(out.replace(/\u00A0/g, ' ') === V[L][k], `${L}.${k}: keepTogetherVoice changes no character but spaces`);
        const want = k === 'failed' ? LONG[L] : V[L][k].includes(SHORT[L]) ? SHORT[L] : null;
        if (!want) { check(L === 'en' && k === 'denied', `${L}.${k}: holds no kept phrase (only en.denied may, its "try again" is lower case)`); continue; }
        check(out.includes(nb(want)), `${L}.${k}: keepTogetherVoice joins "${L === 'ar' ? `ar ${k === 'failed' ? 'long' : 'short'}` : want}" with no-break spaces`);
        // Forced: keepTogether alone (main's path) leaves the phrase breakable, and the same test must fail.
        check(!KT.keepTogether(V[L][k]).includes(nb(want)), `forced: keepTogether alone leaves ${L}.${k}'s phrase breakable, and the test flags it`);
      }
      // The failed message's first sentence stays breakable: only the second sentence is held together.
      const first = V[L].failed.split('. ')[0];
      check(KT.keepTogetherVoice(V[L].failed).startsWith(first), `${L}.failed: the first sentence is untouched`);
    }
    check(KT.keepTogetherVoice('a ready question') === KT.keepTogether('a ready question'), "keepTogetherVoice keeps KEEP_TOGETHER's phrases too");
  } else check(false, 'keepTogetherVoice is exported from src/lib/keep-together.ts');
}
// Only the voice line: keepTogetherVoice is imported by VoiceButton.tsx alone, so the web and build 8 are unchanged.
{
  const { readdirSync, statSync } = await import('node:fs');
  const { relative, sep } = await import('node:path');
  const users = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const q = resolvePath(d, f); if (statSync(q).isDirectory()) walk(q); else if (/\.tsx?$/.test(f) && readFileSync(q, 'utf8').includes('keepTogetherVoice')) users.push(relative(ROOT, q).split(sep).join('/')); } };
  walk(resolvePath(ROOT, 'src'));
  check(JSON.stringify(users.sort()) === JSON.stringify(['src/components/agent/VoiceButton.tsx', 'src/lib/keep-together.ts']), `keepTogetherVoice is used by VoiceButton.tsx alone (${JSON.stringify(users)})`);
  check(/keepTogetherVoice\(labels\[line\]\)/.test(vb), 'VoiceButton draws every line message through keepTogetherVoice');
}

// ── 6. The 413 path ─────────────────────────────────────────────────────────
section('6. A transcript over the cap comes back to the field');
const b413 = /if \(res\.status === 413 && res\.headers\.get\('X-KF-Refusal'\) === QUESTION_TOO_LONG\) \{[\s\S]*?\n      \}/.exec(chat)?.[0] || '';
check(/setInput\(userMsg\.content\)/.test(b413), 'the 413 branch puts the question back in the field');
check(!/maxLength/.test(chat), 'the field has no maxLength: a long transcript is kept and the server says how long a question can be');
check(!/speech|voice/i.test(read('src/app/api/agent/route.ts')), 'the agent route is untouched (no speech or voice in it)');
const lm = await load('src/lib/limit-messages.ts');
const dcv = await load('scripts/design-c/voice.mjs');
if (lm && dcv) for (const L of ['en', 'ar']) check(dcv.TOO_LONG[L] === lm.questionTooLongMessage(L), `design-c's 413 sentence (${L}) is the route's own (questionTooLongMessage)`);

// ── 7. The server HTML ──────────────────────────────────────────────────────
section('7. The server HTML of Ask is the same for the web, shell 1 and shell 2');
const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const PP = await load('src/components/platform/PlatformProvider.tsx');
const CB = await load('src/components/agent/ChatBox.tsx');
const ACP = await load('src/components/ai-consent/AiConsentProvider.tsx');
if (PP && CB && ACP && en) {
  const h = React.createElement;
  const render = (platform, shell) => renderToStaticMarkup(
    h(PP.PlatformProvider, { platform, shell },
      h(ACP.AiConsentProvider, { labels: en.dashboard.aiConsent, initialConsented: true, privacyHref: '/en/privacy' },
        h(CB.ChatBox, { kbId: 'k1', kbName: 'Microeconomics', materials: [] }))));
  const web = render('web', 0), one = render('native', 1), two = render('native', 2);
  check(web.includes('data-kf-composer'), 'the composer is rendered');
  check(web === one && one === two, `ChatBox's server HTML is identical for the web, shell 1 and shell 2 (${web.length} bytes)`);
  check(!/data-kf-voice/.test(two), 'no microphone in the server HTML, even at shell 2');
  if (PP.useShellVersion) check(typeof PP.useShellVersion === 'function', 'PlatformProvider exports useShellVersion');
  else check(false, 'PlatformProvider exports useShellVersion');
}

// ── 8. The native plugin ────────────────────────────────────────────────────
section('8. The native plugin, its registration, the plist, the manifest');
const sw = read('ios/App/App/KnowFlowSpeech.swift');
check(!!sw, 'ios/App/App/KnowFlowSpeech.swift exists');
check(/class KnowFlowSpeechPlugin: CAPPlugin, CAPBridgedPlugin/.test(sw) && /jsName = "KnowFlowSpeech"/.test(sw) && /identifier = "KnowFlowSpeechPlugin"/.test(sw), 'KnowFlowSpeechPlugin, jsName KnowFlowSpeech');
for (const m of ['availability', 'start', 'stop', 'openSettings']) check(new RegExp(`CAPPluginMethod\\(name: "${m}"`).test(sw) && new RegExp(`@objc func ${m}\\(_ call: CAPPluginCall\\)`).test(sw), `method ${m}`);
check(/if recognizer\.supportsOnDeviceRecognition \{\s*request\.requiresOnDeviceRecognition = true/.test(sw), 'on-device recognition is REQUIRED wherever the phone supports it for the language');
check(/static let limit: TimeInterval = 60/.test(sw), 'the 60 s limit');
check(/static let silence: TimeInterval = 3/.test(sw), 'about 3 s of silence ends a take');
check(/willResignActiveNotification/.test(sw) && /interruptionNotification/.test(sw), 'a take stops when the app resigns active and on an audio interruption');
check(/requestAuthorization/.test(sw) && /requestRecordPermission/.test(sw), 'start asks speech recognition, then the microphone');
check(sw.indexOf('requestAuthorization') > -1 && sw.indexOf('requestAuthorization') < sw.indexOf('requestRecordPermission'), '...in that order');
const availFn = /@objc func availability\(_ call: CAPPluginCall\) \{[\s\S]*?\n    \}/.exec(sw)?.[0] || '';
check(!!availFn && !/request(Authorization|RecordPermission)/.test(availFn), 'availability() asks for nothing (no prompt)');
check(/override public func load\(\)/.test(sw) && /warmLocales = \["en-US", "ar-SA"\]/.test(sw), 'both languages\' recognizers are made at launch (the speech daemon\'s cold start is not the student\'s wait)');
check(/factsQueue\.async/.test(availFn) && !/DispatchQueue\.main/.test(availFn) && !/SFSpeechRecognizer\(locale/.test(availFn), 'availability() answers from the kept recognizer, off the main queue');
const loadFn = /override public func load\(\) \{[\s\S]*?\n    \}/.exec(sw)?.[0] || '';
check(!!loadFn && !/request(Authorization|RecordPermission)|authorizationStatus|recordPermission/.test(loadFn), 'the launch warm-up reads no permission and asks for none');
check(/func restoreSession\(\)/.test(sw) && (sw.match(/restoreSession\(\)/g) || []).length >= 3, `the previous audio session is restored (restoreSession called on ${(sw.match(/restoreSession\(\)/g) || []).length - 1} path(s))`);
check(/previousCategory/.test(sw) && /setCategory\(previous/.test(sw), 'the previous category, mode and options are what is restored');
check(!/AVAudioFile|FileManager|\.write\(to:|createFile|AVAudioRecorder/.test(sw), 'no file is written, no recorder');
const events = [...sw.matchAll(/notifyListeners\("(\w+)"/g)].map((m) => m[1]);
check(events.length >= 2 && events.every((e) => e === 'partial' || e === 'end'), `the page receives only "partial" and "end" (text): ${events.join(', ')}`);
check(!/buffer[^\n]*notifyListeners|notifyListeners[^\n]*buffer|base64/i.test(sw), 'no audio buffer is handed to the page');
const mvc = read('ios/App/App/MainViewController.swift');
check(/let speech = KnowFlowSpeechPlugin\(\)\s*bridge\?\.registerPluginInstance\(speech\)/.test(mvc), 'MainViewController registers KnowFlowSpeechPlugin');
check(mvc.indexOf('registerPluginInstance(store)') > -1 && mvc.indexOf('registerPluginInstance(speech)') > mvc.indexOf('registerPluginInstance(store)'), '...beside KnowFlowStore, in every build');
check(/speech:!!\(C&&C\.isPluginAvailable&&C\.isPluginAvailable\('KnowFlowSpeech'\)\)/.test(mvc), 'the smoke probe reports speech:');
const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
const pbxLines = pbx.split('\n').filter((l) => l.includes('KnowFlowSpeech.swift')).length;
check(pbxLines === 4, `the four project entries: file reference, group, build file, Sources (${pbxLines} lines)`);
check(/KnowFlowSpeech\.swift in Sources \*\/ = \{isa = PBXBuildFile; fileRef = 4B4E0F10000000000000A030/.test(pbx) && /4B4E0F10000000000000A031 \/\* KnowFlowSpeech\.swift in Sources \*\/,/.test(pbx), 'build file in the Sources phase, file reference in the group');
const pi = read('ios/App/App/PrivacyInfo.xcprivacy');
check(!/NSPrivacyCollectedDataTypeAudioData/.test(pi.replace(/<!--[\s\S]*?-->/g, '')), 'PrivacyInfo collects no audio');
check(/Audio Data/.test(pi) && /KnowFlowSpeech/.test(pi), 'PrivacyInfo\'s header says why Audio Data is absent');
check(!/RECORD_AUDIO/.test(read('android/app/src/main/AndroidManifest.xml')), 'Android: no RECORD_AUDIO (not on Android in 1.1)');
check(!/KnowFlowApp\/3/.test(read('capacitor.config.ts')), 'no shell version bump: the plugin is the gate');

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
