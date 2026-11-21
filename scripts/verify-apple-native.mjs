/**
 * SIGN IN WITH APPLE, PR 2 OF 2 (big item 4f): the native half, ios/ only,
 * plus its CI proofs. PR 1 (#341, 6679b83) drew the button behind the gate
 * `isPluginAvailable('KnowFlowApple')`; this proves the plugin that opens the
 * gate, read from the sources (no Mac here: the build itself is ios-smoke's).
 * Red on main: none of these files or steps exist there.
 *
 *  1. THE PLUGIN (ios/App/App/KnowFlowApple.swift). KnowFlowApplePlugin:
 *     CAPPlugin, CAPBridgedPlugin, jsName KnowFlowApple, two methods.
 *     available() resolves {available:true} and touches nothing of
 *     AuthenticationServices (no sheet). signIn({nonce}) takes only a 64-char
 *     lowercase SHA-256 hex, builds ONE ASAuthorizationAppleIDProvider
 *     request with scopes fullName + email and that nonce, presents it from
 *     the web view's window, keeps the controller and the call for the
 *     duration, on the main queue, and refuses a second call while one is
 *     open. Cancel (ASAuthorizationError 1001) rejects 'canceled', everything
 *     else 'failed'. The log names an outcome and milliseconds only.
 *  2. THE CONTRACT WITH THE PAGE. The keys signIn resolves with are exactly
 *     the fields of AppleAuthorization (src/lib/auth/apple-bridge.ts), and
 *     parseAuthorization() maps an object built from those keys, field for
 *     field; with the optional keys absent (every sign-in after the first)
 *     it still parses, with nulls.
 *  3. THE ENTITLEMENT. ios/App/App/App.entitlements holds exactly
 *     com.apple.developer.applesignin = ["Default"]; CODE_SIGN_ENTITLEMENTS
 *     names it in BOTH App target configurations (Debug, Release) and in no
 *     project-level one.
 *  4. THE PROJECT. The four KnowFlowApple.swift entries like KnowFlowSpeech
 *     (file reference, group, build file, Sources phase); the entitlements
 *     file referenced in the group and in no build phase.
 *  5. REGISTRATION AND PROBE. MainViewController registers the plugin after
 *     speech, in every build; the smoke probe reports `apple:`, and the
 *     probe's wording functions are untouched (verify-app-wording holds
 *     them byte for byte).
 *  6. CI. ios-smoke: proof 11 (apple-call, apple-read settled within 20 s,
 *     the assertions, the entitlement read from the build settings);
 *     ios-signed-in: the apple-login reading on the shell-2 login (button
 *     shown, Google 0), every older reading kept; ios-testflight: the
 *     archived app's signature carries the entitlement or the run stops
 *     before the upload.
 *
 *
 * UNIVERSAL LINKS, PR 2 OF 2 (big item 4g), ios/ + CI only. PR 1 (#343,
 * e2ea86d) serves the AASA; this holds the app's half. Red on e2ea86d.
 *  3. (changed) App.entitlements holds exactly TWO keys: applesignin
 *     ["Default"] and associated-domains ["applinks:tryknowflow.com",
 *     "webcredentials:tryknowflow.com"], apex only (www 307s), nothing else.
 *  7. THE OBSERVER (MainViewController.swift, every build). Registered in
 *     capacitorDidLoad (Capacitor calls it from loadView, before the root
 *     load and before the cold-start delivery), outside the simulator block,
 *     removed in deinit. It observes ONLY .capacitorOpenUniversalLink: the
 *     proxy posts that AND .capacitorSceneOpenUniversalLink for every link,
 *     so observing both would load twice and spend the one-time token. It
 *     accepts only https, host exactly tryknowflow.com, no port, no user, no
 *     password; rebuilds the URL from the bridge's server URL + path + query
 *     (the delivered string is never loaded); keeps ONE pending link (a later
 *     one replaces it); loads only once webView.isLoading is false (KVO,
 *     invalidated after), because Capacitor loads offline.html on ANY
 *     provisional failure, the -999 cancel a second load causes included
 *     (WebViewDelegationHandler.swift). Never UIApplication.open, never a
 *     foreign host. The log names an outcome only, never the URL or query
 *     (it holds the token).
 *  8. CI. ios-smoke proof 12 (both configurations' entitlements carry
 *     applinks:tryknowflow.com) and proof 13 (simulator-only delivery through
 *     SceneDelegateProxy during the first root load and when idle: a bogus
 *     token ends on /en/login?notice=link_expired in the web view, never
 *     offline.html; example.com changes nothing); ios-testflight: the signed
 *     archive carries associated-domains with both strings or the run stops
 *     before the upload, and prints the entitlements.
 *
 * Usage: node --experimental-strip-types scripts/verify-apple-native.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { installTsxHooks } from './lib/tsx-hooks.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const failures = [];
function check(ok, name, detail = '') {
  if (ok) pass += 1;
  else failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${name}${!ok && detail ? `  -- ${detail}` : ''}`);
}
// LF always: a Windows checkout (core.autocrlf) reads CRLF, CI reads LF.
const read = (p) => (existsSync(resolvePath(ROOT, p)) ? readFileSync(resolvePath(ROOT, p), 'utf8').replace(/\r\n/g, '\n') : '');
/** The body of `func <name>(` up to the first line that closes at its own indent. */
function fn(src, re) {
  const m = re.exec(src);
  if (!m) return '';
  const start = m.index;
  const indent = /^[ \t]*/.exec(src.slice(src.lastIndexOf('\n', start) + 1))[0];
  const end = src.indexOf(`\n${indent}}`, start);
  return end < 0 ? '' : src.slice(start, end + indent.length + 2);
}
const noComments = (s) => s.replace(/\/\/\/?[^\n]*/g, '');

// ── 1. the plugin ───────────────────────────────────────────────────────────
console.log('1. KnowFlowApple.swift');
const swRaw = read('ios/App/App/KnowFlowApple.swift');
const sw = noComments(swRaw);
check(!!swRaw, 'ios/App/App/KnowFlowApple.swift exists');
check(/^import AuthenticationServices$/m.test(sw) && /^import Capacitor$/m.test(sw), 'imports AuthenticationServices and Capacitor (no third-party package)');
check(/@objc\(KnowFlowApplePlugin\)\s*public class KnowFlowApplePlugin: CAPPlugin, CAPBridgedPlugin/.test(sw), 'KnowFlowApplePlugin: CAPPlugin, CAPBridgedPlugin');
check(/identifier = "KnowFlowApplePlugin"/.test(sw) && /jsName = "KnowFlowApple"/.test(sw), 'identifier KnowFlowApplePlugin, jsName KnowFlowApple');
const methods = [...sw.matchAll(/CAPPluginMethod\(name: "(\w+)", returnType: CAPPluginReturnPromise\)/g)].map((m) => m[1]);
check(JSON.stringify(methods) === '["available","signIn"]', `exactly two methods, available and signIn: ${methods.join(', ')}`);
const avail = fn(sw, /@objc func available\(_ call: CAPPluginCall\)/);
check(!!avail && /call\.resolve\(\["available": true\]\)/.test(avail), 'available() resolves {available: true}');
check(!!avail && !/ASAuthorization|performRequests|present/.test(avail), 'available() opens no sheet and touches no authorization API');
const signIn = fn(sw, /@objc func signIn\(_ call: CAPPluginCall\)/);
check(!!signIn, 'signIn(_:) exists');
check(/call\.getString\("nonce"\)/.test(signIn) && /\^\[0-9a-f\]\{64\}\$/.test(signIn), 'signIn reads `nonce` and accepts only a 64-character lowercase hex (the SHA-256 the page sends)');
check(/DispatchQueue\.main\.async/.test(signIn), 'signIn moves to the main queue before any UIKit or controller work');
check(/ASAuthorizationAppleIDProvider\(\)\.createRequest\(\)/.test(sw) && /requestedScopes = \[\.fullName, \.email\]/.test(sw) && /request\.nonce = nonce/.test(sw), 'one Apple ID request, scopes fullName + email, the page\'s hashed nonce');
check(/ASAuthorizationController\(authorizationRequests: \[request\]\)/.test(sw) && /\.delegate = self/.test(sw) && /\.presentationContextProvider = self/.test(sw) && /performRequests\(\)/.test(sw), 'an ASAuthorizationController with the plugin as delegate and presentation provider');
check(/self\.controller = controller/.test(signIn) && /self\.pending = call/.test(signIn), 'the controller and the call are kept for the whole sheet (the delegate is weak)');
check(/if self\.pending != nil \{[^}]*call\.reject\([^)]*"failed"\)/.test(signIn) && signIn.indexOf('self.pending != nil') < signIn.indexOf('createRequest'), 'a second call while one is open is rejected before any new request');
const anchor = fn(sw, /public func presentationAnchor\(for controller: ASAuthorizationController\) -> ASPresentationAnchor/);
check(!!anchor && /bridge\?\.webView\?\.window/.test(anchor), 'the sheet is anchored to the web view\'s window');
const ok = fn(sw, /public func authorizationController\(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization\)/);
const err = fn(sw, /public func authorizationController\(controller: ASAuthorizationController, didCompleteWithError error: Error\)/);
check(!!ok && /as\? ASAuthorizationAppleIDCredential/.test(ok) && /identityToken/.test(ok) && /authorizationCode/.test(ok), 'success reads the Apple ID credential\'s identity token and authorization code');
check(!!ok && /call\.reject\([^)]*"failed"\)/.test(ok), '...and rejects \'failed\' when either is missing');
check(!!err && /if \(error as\? ASAuthorizationError\)\?\.code == \.canceled \{\s*NSLog\([^\n]*\)\s*call\.reject\([^)]*"canceled"\)\s*\} else \{\s*NSLog\([^\n]*\)\s*call\.reject\([^)]*"failed"\)/.test(err), 'error: cancel (ASAuthorizationError.Code.canceled, 1001) rejects \'canceled\', every other error \'failed\'');
const fin = fn(sw, /private func finish\(/);
check(!!fin && /controller === self\.controller/.test(fin) && /self\.pending = nil/.test(fin) && /self\.controller = nil/.test(fin), 'finish() answers only the controller it started and clears the call and the controller');
const logs = [...sw.matchAll(/NSLog\(([^\n]*)\)/g)].map((m) => m[1]);
check(logs.length >= 1 && logs.every((l) => !/identityToken|authorizationCode|token\b|code\b|nonce|email|user|givenName|familyName|credential/i.test(l.replace(/"[^"]*"/g, ''))), `no token, code, nonce, email or name reaches the log (${logs.length} NSLog call(s): outcome and ms only)`);
check(!/print\(|os_log|Logger\(/.test(sw), 'no print, os_log or Logger');
check(!/UserDefaults|Keychain|SecItem|FileManager|\.write\(to:/.test(sw), 'nothing is stored: no defaults, keychain or file');

// ── 2. the contract with the page ───────────────────────────────────────────
console.log('2. the resolved shape against parseAuthorization()');
const keys = [...ok.matchAll(/out\["(\w+)"\] = /g)].map((m) => m[1]);
const lit = /var out: \[String: Any\] = \[([^\]]*)\]/.exec(ok)?.[1] ?? '';
const litKeys = [...lit.matchAll(/"(\w+)":/g)].map((m) => m[1]);
const all = [...litKeys, ...keys];
const WANT = ['identityToken', 'authorizationCode', 'user', 'email', 'givenName', 'familyName'];
check(JSON.stringify([...all].sort()) === JSON.stringify([...WANT].sort()), `the resolved keys are exactly AppleAuthorization's: ${all.join(', ')}`);
check(JSON.stringify(litKeys.sort()) === JSON.stringify(['authorizationCode', 'identityToken', 'user']), `the always-present keys are the token, the code and the user: ${litKeys.join(', ')}`);
const bridgeSrc = read('src/lib/auth/apple-bridge.ts');
const typeKeys = [...(/export type AppleAuthorization = \{([\s\S]*?)\};/.exec(bridgeSrc)?.[1] ?? '').matchAll(/(\w+):/g)].map((m) => m[1]);
check(JSON.stringify([...typeKeys].sort()) === JSON.stringify([...WANT].sort()), `apple-bridge.ts AppleAuthorization is the same six fields: ${typeKeys.join(', ')}`);
installTsxHooks(ROOT, {});
let parse = null;
try { parse = (await import(pathToFileURL(resolvePath(ROOT, 'src/lib/auth/apple-bridge.ts')).href)).parseAuthorization; } catch (e) { check(false, 'apple-bridge.ts loads', String(e.message).slice(0, 160)); }
if (parse && all.length) {
  const first = Object.fromEntries(all.map((k) => [k, `v-${k}`]));
  const p1 = parse(first);
  check(!!p1 && WANT.every((k) => p1[k] === `v-${k}`), 'a first authorization (every key) parses field for field', JSON.stringify(p1));
  const later = Object.fromEntries(litKeys.map((k) => [k, `v-${k}`]));
  const p2 = parse(later);
  check(!!p2 && p2.email === null && p2.givenName === null && p2.familyName === null && p2.identityToken === 'v-identityToken', 'a later authorization (no email, no name) parses with nulls', JSON.stringify(p2));
  check(/!value\.isEmpty|isEmpty == false|\.isEmpty \{/.test(ok) || /, !\w+\.isEmpty/.test(ok), 'empty optional strings are left out, not sent as ""');
}

// ── 3. the entitlement ──────────────────────────────────────────────────────
console.log('3. App.entitlements and CODE_SIGN_ENTITLEMENTS');
const ent = read('ios/App/App/App.entitlements');
check(!!ent, 'ios/App/App/App.entitlements exists');
const entKeys = [...ent.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]);
check(JSON.stringify(entKeys) === '["com.apple.developer.applesignin","com.apple.developer.associated-domains"]', `exactly two entitlements, applesignin then associated-domains: ${entKeys.join(', ')}`);
check(/<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>\s*<\/array>/.test(ent), 'applesignin\'s value is ["Default"]');
const adBlock = /<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(ent)?.[1] ?? '';
const adValues = [...adBlock.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
check(JSON.stringify(adValues) === '["applinks:tryknowflow.com","webcredentials:tryknowflow.com"]', `associated-domains is exactly ["applinks:tryknowflow.com","webcredentials:tryknowflow.com"]: ${JSON.stringify(adValues)}`);
check(!/<string>[^<]*www\./.test(ent) && (ent.match(/<string>/g) || []).length === 3, `no www and no other string in the file (3 strings: Default + the two domains): ${(ent.match(/<string>/g) || []).length}`);
check(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<!DOCTYPE plist PUBLIC "-\/\/Apple\/\/DTD PLIST 1\.0\/\/EN"/.test(ent) && /<plist version="1\.0">/.test(ent), 'an XML property list');
const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
const cfg = (id) => { const m = new RegExp(`\\t\\t${id} /\\* (Debug|Release) \\*/ = \\{[\\s\\S]*?\\n\\t\\t\\};`).exec(pbx); return m ? m[0] : ''; };
for (const [id, name] of [['504EC3171FED79650016851F', 'Debug'], ['504EC3181FED79650016851F', 'Release']]) {
  const c = cfg(id);
  check(/PRODUCT_BUNDLE_IDENTIFIER = com\.knowflow\.app;/.test(c) && /CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/.test(c), `the App target's ${name} configuration names App/App.entitlements`);
}
for (const [id, name] of [['504EC3141FED79650016851F', 'Debug'], ['504EC3151FED79650016851F', 'Release']]) {
  const c = cfg(id);
  check(!!c && !/CODE_SIGN_ENTITLEMENTS/.test(c), `the project-level ${name} configuration names no entitlements`);
}
check((pbx.match(/CODE_SIGN_ENTITLEMENTS/g) || []).length === 2, 'CODE_SIGN_ENTITLEMENTS appears exactly twice');

// ── 4. the project ──────────────────────────────────────────────────────────
console.log('4. project.pbxproj');
const swLines = pbx.split('\n').filter((l) => l.includes('KnowFlowApple.swift'));
check(swLines.length === 4, `the four KnowFlowApple.swift entries: file reference, group, build file, Sources (${swLines.length} lines)`);
check(/4B4E0F10000000000000A041 \/\* KnowFlowApple\.swift in Sources \*\/ = \{isa = PBXBuildFile; fileRef = 4B4E0F10000000000000A040 \/\* KnowFlowApple\.swift \*\/; \};/.test(pbx), 'the build file points at the file reference');
check(/4B4E0F10000000000000A040 \/\* KnowFlowApple\.swift \*\/ = \{isa = PBXFileReference; lastKnownFileType = sourcecode\.swift; path = KnowFlowApple\.swift; sourceTree = "<group>"; \};/.test(pbx), 'the file reference, like KnowFlowSpeech\'s');
const sources = /\/\* Begin PBXSourcesBuildPhase section \*\/[\s\S]*?\/\* End PBXSourcesBuildPhase section \*\//.exec(pbx)?.[0] ?? '';
check(/4B4E0F10000000000000A041 \/\* KnowFlowApple\.swift in Sources \*\/,/.test(sources) && sources.indexOf('KnowFlowApple.swift') > sources.indexOf('KnowFlowSpeech.swift'), 'in the Sources phase, after KnowFlowSpeech');
const group = /504EC3061FED79650016851F \/\* App \*\/ = \{[\s\S]*?\};/.exec(pbx)?.[0] ?? '';
check(/4B4E0F10000000000000A040 \/\* KnowFlowApple\.swift \*\/,/.test(group) && /4B4E0F10000000000000A050 \/\* App\.entitlements \*\/,/.test(group), 'the App group lists KnowFlowApple.swift and App.entitlements');
const entLines = pbx.split('\n').filter((l) => l.includes('App.entitlements'));
check(/4B4E0F10000000000000A050 \/\* App\.entitlements \*\/ = \{isa = PBXFileReference; lastKnownFileType = text\.plist\.entitlements; path = App\.entitlements; sourceTree = "<group>"; \};/.test(pbx) && !/App\.entitlements in /.test(pbx), 'App.entitlements: a file reference only, in no build phase (it is read by the signing step, not copied)');
check(entLines.length === 4, `App.entitlements appears 4 times (reference, group, two build settings): ${entLines.length}`);

// ── 5. registration and probe ───────────────────────────────────────────────
console.log('5. MainViewController.swift');
const mvc = read('ios/App/App/MainViewController.swift');
check(/let apple = KnowFlowApplePlugin\(\)\s*bridge\?\.registerPluginInstance\(apple\)/.test(mvc), 'MainViewController registers KnowFlowApplePlugin');
const iS = mvc.indexOf('registerPluginInstance(speech)'), iA = mvc.indexOf('registerPluginInstance(apple)'), iSim = mvc.indexOf('#if targetEnvironment(simulator)\n        // The switch');
check(iS > 0 && iA > iS && (iSim < 0 || iA < iSim), '...after speech, outside the simulator-only block (every build)');
check(/speech:!!\(C&&C\.isPluginAvailable&&C\.isPluginAvailable\('KnowFlowSpeech'\)\),apple:!!\(C&&C\.isPluginAvailable&&C\.isPluginAvailable\('KnowFlowApple'\)\)/.test(mvc), 'the smoke probe reports apple: beside speech:');

// ── 6. CI ───────────────────────────────────────────────────────────────────
console.log('6. the workflows');
const smoke = read('.github/workflows/ios-smoke.yml');
check(/#   11\. Sign in with Apple \(iOS 1\.1, item 4f\)/.test(smoke), 'ios-smoke\'s header lists proof 11');
check(/\{"name":"apple-call","wait":500,"js":"[^\n]*C\.nativePromise\('KnowFlowApple','available',\{\}\)/.test(smoke) && /\{"name":"apple-read","settle":"[^\n]*","timeout":20000,/.test(smoke), 'ios-smoke calls available() and settles its answer within 20 s');
check(!/nativePromise\('KnowFlowApple','signIn'/.test(smoke), '...and never calls signIn (a sheet no one can answer)');
for (const line of ['11. the KnowFlowApple plugin is registered in the shell', '11. available() answers within 20 s of the call', '11. ...with {{available: true}}']) check(smoke.includes(line), `ios-smoke asserts "${line}"`);
check(/CODE_SIGN_ENTITLEMENTS/.test(smoke) && /com\.apple\.developer\.applesignin:0/.test(smoke), 'ios-smoke reads the entitlements file the Release build settings name, and its Default value');
const si = read('.github/workflows/ios-signed-in.yml');
const loginSteps = si.split('\n').filter((l) => /^\s*\{"name":"apple-login",/.test(l));
check(loginSteps.length === 1 && /"settle":/.test(loginSteps[0]) && /data-kf-apple-signin/.test(loginSteps[0]) && !/\.click\(\)/.test(loginSteps[0]), 'ios-signed-in reads the Apple button on login, settled, never pressed');
const order = ['"name":"to-login"', '"name":"google-hint"', '"name":"apple-login"', '"name":"login"'].map((s) => si.indexOf(s));
check(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), 'apple-login sits between google-hint and login (the login screen, before signing in)');
check(si.includes('the shell-2 login shows Sign in with Apple (the plugin answers)') && /P\("apple-login"\)\.get\("google"\) == 0/.test(si) && /P\("apple-login"\)\.get\("apple"\) is True/.test(si), 'ios-signed-in asserts the Apple button and Google 0 on that login');
for (const kept of ['the login page in the app tells a Google-registered student to use the forgot link', 'Ask in shell 2 shows the microphone in the composer', 'the AI permission sheet opened before the quiz']) check(si.includes(kept), `an older assertion is kept: "${kept}"`);
const tf = read('.github/workflows/ios-testflight.yml');
check(/codesign -d --entitlements - --xml "\$app"/.test(tf) && /com\.apple\.developer\.applesignin/.test(tf) && tf.indexOf('com.apple.developer.applesignin') < tf.indexOf('- name: Export and upload'), 'ios-testflight: the archived app\'s signature must carry the entitlement, before the upload');

// ── 7. the universal-link observer (item 4g) ────────────────────────────────
console.log('7. MainViewController.swift: the universal-link observer');
const mvcCode = noComments(mvc);
// What a device runs: every `#if targetEnvironment(simulator) … #endif` removed
// (none of them nests another).
const prod = mvcCode.replace(/#if targetEnvironment\(simulator\)[\s\S]*?#endif/g, '');
const smokeOnly = (s) => (s.match(/#if targetEnvironment\(simulator\)[\s\S]*?#endif/g) || []).join('\n');
const didLoad = fn(mvcCode, /override open func capacitorDidLoad\(\)/);
const didLoadProd = didLoad.replace(/#if targetEnvironment\(simulator\)[\s\S]*?#endif/g, '');
check(/linkToken = NotificationCenter\.default\.addObserver\(forName: \.capacitorOpenUniversalLink, object: nil, queue: \.main\)/.test(didLoadProd), 'capacitorDidLoad observes .capacitorOpenUniversalLink on the main queue, outside the simulator block (every build)');
check(didLoadProd.indexOf('.capacitorOpenUniversalLink') > didLoadProd.indexOf('registerPluginInstance(apple)'), '...after the three plugins are registered');
const nObs = (s) => (s.match(/addObserver\(forName:/g) || []).length;
check(nObs(prod) === 1 && nObs(mvcCode) === 2 && /addObserver\(forName: \.capacitorViewDidAppear/.test(smokeOnly(mvcCode)), `one notification observer in a device build; the only other is the smoke's cold-start hook (device ${nObs(prod)}, all ${nObs(mvcCode)})`);
check(!/capacitorSceneOpenUniversalLink|capacitorOpenURL|CDVPluginHandleOpenURL/.test(mvcCode), 'never the scene variant (.capacitorSceneOpenUniversalLink, posted for the same link: a second load would spend the token) nor the URL-scheme notifications');
const deinitBody = fn(mvcCode, /deinit \{/);
check(/NotificationCenter\.default\.removeObserver\(linkToken\)|if let linkToken \{\s*NotificationCenter\.default\.removeObserver\(linkToken\)/.test(deinitBody) && /linkWait\?\.invalidate\(\)/.test(deinitBody), 'deinit removes the observer and invalidates a pending isLoading watch');
const target = fn(mvcCode, /static func linkTarget\(_ url: URL, server: URL\?\) -> URL\?/);
check(!!target, 'static linkTarget(_:server:) exists');
const guardTarget = /guard let c = URLComponents\(url: url, resolvingAgainstBaseURL: false\),([\s\S]*?)else \{ return nil \}/.exec(target)?.[1] ?? '';
for (const cond of ['c.scheme == "https"', 'c.host == "tryknowflow.com"', 'c.port == nil', 'c.user == nil', 'c.password == nil']) check(guardTarget.includes(cond), `linkTarget accepts only ${cond}`);
check(/var out = URLComponents\(url: server, resolvingAgainstBaseURL: false\)/.test(guardTarget) && guardTarget.includes('out.scheme == "https"') && guardTarget.includes('out.host == "tryknowflow.com"'), 'the URL is rebuilt on the bridge\'s server URL, itself https://tryknowflow.com');
check(/out\.percentEncodedPath = c\.percentEncodedPath/.test(target) && /out\.percentEncodedQuery = c\.percentEncodedQuery/.test(target) && /out\.fragment = nil/.test(target) && /return out\.url/.test(target), '...from the delivered path and query only (no fragment, never the delivered string)');
const onLink = fn(mvcCode, /private func universalLink\(_ note: Notification\)/);
check(/linkTarget\(url, server: bridge\?\.config\.serverURL\)/.test(onLink) && /pendingLink = target/.test(onLink) && /loadLinkWhenIdle\(\)/.test(onLink) && !/\.load\(/.test(onLink), 'universalLink checks the URL, keeps it as THE pending link (a later one replaces it) and hands over to loadLinkWhenIdle; it loads nothing itself');
check(/if pendingLink != nil \{\s*linkLog\("replaced[^"]*"\)/.test(onLink), '...and says when it replaced a waiting link (one load only)');
const idle = fn(mvcCode, /private func loadLinkWhenIdle\(\)/);
const iBusy = idle.indexOf('if webView.isLoading'), iInval = idle.indexOf('linkWait?.invalidate()'), iClear = idle.indexOf('pendingLink = nil'), iLoad = idle.indexOf('webView.load(URLRequest(url: link))');
check(iBusy > 0 && /linkWait = webView\.observe\(\\\.isLoading/.test(idle), 'while the web view is loading it waits on an isLoading KVO');
check(iBusy > 0 && iInval > iBusy && iClear > iInval && iLoad > iClear, 'the watch is invalidated and the pending link cleared before the one load');
check((prod.match(/\.load\(URLRequest/g) || []).length === 1, 'exactly one webView.load in a device build');
check(!/UIApplication\.shared\.open|\.openURL\(|SFSafariViewController/.test(mvcCode), 'never UIApplication.open, openURL or a Safari view');
check(/private func linkLog\(_ outcome: StaticString\)/.test(mvcCode), 'the link log takes a StaticString: only a literal outcome can reach it, never the URL or its token');
check(![onLink, idle, target].some((b) => /NSLog|print\(/.test(b)), 'the link code logs only through linkLog');
check(!/http:\/\//.test(prod), 'no http:// in a device build');
// The smoke half (simulator only).
const smokeCls = /#if targetEnvironment\(simulator\)\nprivate final class Smoke[\s\S]*#endif/.exec(mvcCode)?.[0] ?? '';
check(/NSUserActivity\(activityType: NSUserActivityTypeBrowsingWeb\)/.test(smokeCls) && /SceneDelegateProxy\.shared\.scene\([^)]*continue: activity\)/.test(smokeCls), 'smoke delivers a browsing-web NSUserActivity through SceneDelegateProxy (the path SceneDelegate takes)');
check(/KF_SMOKE_UL_COLD/.test(mvcCode) && /forName: \.capacitorViewDidAppear/.test(mvcCode) && /KF_SMOKE_UL/.test(mvcCode), 'smoke can deliver at the first capacitorViewDidAppear (the proxy\'s cold-start moment) when KF_SMOKE_UL_COLD is set');
check(/observe\(\\\.url/.test(smokeCls) && /step\["ul"\]/.test(smokeCls), 'smoke records every URL the web view takes (offline.html would show) and delivers a step\'s `ul`');
check(!/NSUserActivity|SceneDelegateProxy|KF_SMOKE_UL/.test(prod), 'none of the delivery code is in a device build');

// ── 8. CI for item 4g ───────────────────────────────────────────────────────
console.log('8. the workflows (item 4g)');
check(/#   12\. Universal links \(iOS 1\.1, item 4g\)/.test(smoke) && /#   13\. /.test(smoke), 'ios-smoke\'s header lists proofs 12 and 13');
check(/Print :com\.apple\.developer\.associated-domains/.test(smoke) && /applinks:tryknowflow\.com/.test(smoke) && /echo "12\. \$c:/.test(smoke), 'proof 12 reads associated-domains from the entitlements file both configurations name');
check(smoke.includes('https://tryknowflow.com/api/auth/callback?token_hash=bogus&type=signup&locale=en') && smoke.includes('https://example.com/'), 'proof 13 delivers the bogus signup link and example.com');
for (const line of ['13. cold: the link was handed over while the first page was loading', '13. cold: the web view ends on /en/login?notice=link_expired', '13. cold: two links while loading load once', '13. idle: the web view ends on /en/login?notice=link_expired', '13. example.com leaves the URL unchanged', '13. offline.html never loads']) check(smoke.includes(line), `ios-smoke asserts "${line}"`);
check(/smoke-ul\.jsonl/.test(smoke) && /ul\.log/.test(smoke), 'proof 13\'s readings are kept in the artifact');
const tfGuard = tf.slice(tf.lastIndexOf('grep -q \'<key>com.apple.developer.applesignin</key>\''), tf.indexOf('- name: Export and upload'));
const entCheck = read('.github/scripts/ios-entitlements-check.py');
check(/^ *python3 \.github\/scripts\/ios-entitlements-check\.py "\$RUNNER_TEMP\/entitlements\.xml"$/m.test(tfGuard), 'ios-testflight: after the applesignin check and before the upload, the signature is read by .github/scripts/ios-entitlements-check.py');
check(/KEY = "com\.apple\.developer\.associated-domains"/.test(entCheck) && /WANT = \["applinks:tryknowflow\.com", "webcredentials:tryknowflow\.com"\]/.test(entCheck) && /plistlib\.load/.test(entCheck) && /sorted\(got\) == sorted\(WANT\)/.test(entCheck), '...which parses the plist and requires associated-domains to be exactly the two strings');
check(/FIX = "tick Associated Domains on the App ID first/.test(entCheck) && (entCheck.match(/return 1/g) || []).length === 2 && /echo "signed entitlements:"; cat "\$RUNNER_TEMP\/entitlements\.xml"/.test(tfGuard), '...fails with a clear message otherwise, and prints the entitlements on success');

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('---');
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
