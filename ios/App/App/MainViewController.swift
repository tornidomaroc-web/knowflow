import Capacitor
import UIKit
#if targetEnvironment(simulator)
import UserNotifications
#endif

/// The bridge view controller, subclassed for three reasons: the page colour
/// under the web view (below, every build), the universal-link observer
/// (item 4g, every build: `universalLink`) and the simulator smoke test
/// (`.github/workflows/ios-smoke.yml`). Main.storyboard names this class.
///
/// A device build carries none of the smoke code: all of it is behind
/// `targetEnvironment(simulator)` and runs only when the launch environment
/// sets `KF_SMOKE=1`. What it does there: once the first page from
/// tryknowflow.com has loaded, it evaluates a probe inside the web view (is the
/// Capacitor bridge present, does the user agent carry the marker, which URL,
/// is the Google button or a pricing link in the DOM), then runs each step the
/// workflow passed in `KF_SMOKE_STEPS` (base64 JSON: `[{name, js, wait}]`),
/// a line of JavaScript each, probing again after it, and appends one JSON
/// line per step to `tmp/smoke.jsonl`. The workflow reads that file from the
/// app's data container, takes a screenshot at every new line, and asserts
/// on the probes. Nothing here is a plugin, a permission or a network call.
///
/// One thing here is in every build, device included: the web view's scroll
/// view takes the page's own background colour (Step Store-Fix-2). Capacitor
/// paints it `UIColor.systemBackground` when the config names no colour
/// (CAPBridgeViewController.prepareWebView), which is white on a phone in
/// light appearance, and that white showed in the home-indicator inset at the
/// end of every scrolling page while the app was in its dark theme (Settings,
/// relay runs 38592947638 and 38610848524). One fixed colour cannot be right:
/// the theme is the app's own choice (`data-theme`), not the phone's. WebKit
/// already knows the page's colour (`underPageBackgroundColor` defaults to
/// it, from the root element's background, and changes when the toggle
/// changes the theme), so the scroll view follows it.
class MainViewController: CAPBridgeViewController {
    #if targetEnvironment(simulator)
    private static var smoke: Smoke?
    #endif
    private var pageColour: NSKeyValueObservation?
    // Universal links (item 4g): the observer's token, the one link waiting
    // for the page in flight, and the isLoading watch that waits with it.
    private var linkToken: NSObjectProtocol?
    private var pendingLink: URL?
    private var linkWait: NSKeyValueObservation?

    deinit {
        if let linkToken {
            NotificationCenter.default.removeObserver(linkToken)
        }
        linkWait?.invalidate()
    }

    override open func capacitorDidLoad() {
        // In-app Pro (iOS 1.1, item 4d): the StoreKit 2 plugin that lives in
        // this target (KnowFlowStore.swift), registered the way Capacitor
        // documents a local plugin, in every build. Its Transaction.updates
        // listener starts here, at launch.
        let store = KnowFlowStorePlugin()
        bridge?.registerPluginInstance(store)
        store.startListening()
        // Voice input in Ask (iOS 1.1, item 4e): the SFSpeechRecognizer plugin
        // that lives in this target (KnowFlowSpeech.swift), registered beside
        // the store, in every build. Nothing runs until a page calls `start`.
        let speech = KnowFlowSpeechPlugin()
        bridge?.registerPluginInstance(speech)
        // Sign in with Apple (iOS 1.1, item 4f): the AuthenticationServices
        // plugin in this target (KnowFlowApple.swift), registered beside
        // speech, in every build. This shell carries the entitlement
        // (App.entitlements), so the plugin answering is the page's gate.
        // Nothing runs until a page calls `signIn`.
        let apple = KnowFlowApplePlugin()
        bridge?.registerPluginInstance(apple)
        if let webView = bridge?.webView {
            pageColour = webView.observe(\.underPageBackgroundColor, options: [.initial, .new]) { webView, _ in
                webView.scrollView.backgroundColor = webView.underPageBackgroundColor
            }
        }
        // Universal links (iOS 1.1, item 4g), every build. A tapped
        // https://tryknowflow.com link the AASA hands to the app (only the
        // confirm and reset mails' /api/auth/callback?token_hash=…) reaches
        // SceneDelegate, which passes it to Capacitor's SceneDelegateProxy;
        // the proxy posts it twice, as .capacitorOpenUniversalLink and as
        // .capacitorSceneOpenUniversalLink. Only the first is observed: two
        // loads would spend the one-time token. Registered here because
        // Capacitor calls capacitorDidLoad from loadView, before the root
        // page's load and before the proxy's cold-start delivery (on the
        // first capacitorViewDidAppear).
        linkToken = NotificationCenter.default.addObserver(forName: .capacitorOpenUniversalLink, object: nil, queue: .main) { [weak self] note in
            self?.universalLink(note)
        }
        #if targetEnvironment(simulator)
        // The switch arrives either as an environment variable (simctl's
        // SIMCTL_CHILD_ prefix) or as a launch argument; both are accepted, and
        // a boot file records which, so a run that never starts says why.
        let env = ProcessInfo.processInfo.environment
        let args = CommandLine.arguments
        let asked = env["KF_SMOKE"] == "1" || args.contains("--kf-smoke")
        let boot = "asked=\(asked) env=\(env["KF_SMOKE"] ?? "nil") args=\(args.dropFirst().joined(separator: " ").prefix(120)) webView=\(bridge?.webView != nil)\n"
        try? boot.write(to: FileManager.default.temporaryDirectory.appendingPathComponent("smoke.boot"), atomically: true, encoding: .utf8)
        NSLog("[KFSmoke] capacitorDidLoad: %@", boot)
        if asked {
            // The reminder's proof (ios-smoke.yml, proof 6) needs notifications
            // allowed with no person to tap the system prompt: provisional
            // authorization is granted with no prompt at all. Asked only when
            // the workflow sets KF_SMOKE_NOTIFY=provisional, so every other run
            // starts, like a real install, with the permission never asked.
            if env["KF_SMOKE_NOTIFY"] == "provisional" {
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge, .provisional]) { granted, _ in
                    NSLog("[KFSmoke] provisional notifications: %@", granted ? "granted" : "refused")
                }
            }
            let smoke = Smoke(controller: self)
            MainViewController.smoke = smoke
            // Proof 13 (item 4g): links handed over at the moment the proxy
            // hands over a cold start's, the first capacitorViewDidAppear,
            // while the root page is still loading. KF_SMOKE_UL_COLD is a
            // base64 JSON array of URLs, delivered in order.
            if let cold = env["KF_SMOKE_UL_COLD"], let data = Data(base64Encoded: cold),
               let links = try? JSONSerialization.jsonObject(with: data) as? [String] {
                var token: NSObjectProtocol?
                token = NotificationCenter.default.addObserver(forName: .capacitorViewDidAppear, object: nil, queue: .main) { _ in
                    if let token {
                        NotificationCenter.default.removeObserver(token)
                    }
                    for link in links { smoke.deliver(link, phase: "cold") }
                }
            }
            // The web view is created in viewDidLoad; give it a moment before
            // the first probe rather than racing it.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { smoke.start() }
        }
        #endif
    }

    /// A universal link from the proxy. Anything but https://tryknowflow.com
    /// (no port, no user, no password) is ignored: never another host, never
    /// UIApplication.open. A link that arrives while another is still waiting
    /// replaces it, so the page loads once.
    private func universalLink(_ note: Notification) {
        guard let url = (note.object as? [String: Any])?["url"] as? URL,
              let target = MainViewController.linkTarget(url, server: bridge?.config.serverURL) else {
            linkLog("ignored: not an https://tryknowflow.com link")
            return
        }
        if pendingLink != nil {
            linkLog("replaced the link still waiting")
        }
        pendingLink = target
        loadLinkWhenIdle()
    }

    /// The URL to load: the bridge's own server URL with the delivered path
    /// and query, or nil. The delivered string itself is never loaded.
    static func linkTarget(_ url: URL, server: URL?) -> URL? {
        guard let c = URLComponents(url: url, resolvingAgainstBaseURL: false),
              c.scheme == "https", c.host == "tryknowflow.com",
              c.port == nil, c.user == nil, c.password == nil,
              let server, var out = URLComponents(url: server, resolvingAgainstBaseURL: false),
              out.scheme == "https", out.host == "tryknowflow.com" else { return nil }
        out.percentEncodedPath = c.percentEncodedPath
        out.percentEncodedQuery = c.percentEncodedQuery
        out.fragment = nil
        return out.url
    }

    /// Loads the pending link once nothing is loading. Capacitor answers ANY
    /// failed provisional navigation with its error page
    /// (WebViewDelegationHandler, didFailProvisionalNavigation), including the
    /// -999 cancel a second load causes: a link loaded over the root page in
    /// flight (a cold start) would cancel it, the error handler would load
    /// offline.html, and that would cancel the link. So it waits for
    /// isLoading to turn false, about a second on a cold start, nothing on a
    /// warm one.
    private func loadLinkWhenIdle() {
        guard let webView = bridge?.webView, pendingLink != nil else { return }
        if webView.isLoading {
            if linkWait == nil {
                linkLog("waiting for the page in flight")
                linkWait = webView.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
                    if !webView.isLoading {
                        DispatchQueue.main.async { self?.loadLinkWhenIdle() }
                    }
                }
            }
            return
        }
        linkWait?.invalidate()
        linkWait = nil
        guard let link = pendingLink else { return }
        pendingLink = nil
        webView.load(URLRequest(url: link))
        linkLog("loaded")
    }

    /// An outcome only. StaticString: nothing but a literal can be passed, so
    /// the link, whose query carries the one-time token, can never be logged.
    private func linkLog(_ outcome: StaticString) {
        NSLog("[KFLink] %@", "\(outcome)")
        #if targetEnvironment(simulator)
        MainViewController.smoke?.note("link: \(outcome)")
        #endif
    }
}

#if targetEnvironment(simulator)
private final class Smoke {
    private weak var controller: CAPBridgeViewController?
    private var steps: [[String: Any]] = []
    private var index = 0
    private let started = Date()
    private let dir = FileManager.default.temporaryDirectory

    // The reviewer account's credentials, for the signed-in run
    // (`.github/workflows/ios-signed-in.yml`). They arrive only through the
    // launch environment, never in the steps JSON (whose first bytes land in
    // smoke.boot and in the log); a step names them as the bare tokens
    // __KF_EMAIL__ and __KF_PASSWORD__, which `eval` replaces with JSON string
    // literals just before evaluation. Nothing here writes them anywhere: the
    // recorded `result` is scrubbed in case a page echoed one back.
    private let email = ProcessInfo.processInfo.environment["KF_SMOKE_EMAIL"]
    private let password = ProcessInfo.processInfo.environment["KF_SMOKE_PASSWORD"]

    init(controller: CAPBridgeViewController) {
        self.controller = controller
        // The steps, base64 JSON, from the environment or from `--kf-steps=<b64>`.
        var b64 = ProcessInfo.processInfo.environment["KF_SMOKE_STEPS"]
        if b64 == nil, let arg = CommandLine.arguments.first(where: { $0.hasPrefix("--kf-steps=") }) {
            b64 = String(arg.dropFirst("--kf-steps=".count))
        }
        if let b64 = b64,
           let data = Data(base64Encoded: b64),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            steps = arr
        }
        write("smoke.jsonl", "", append: false)
        NSLog("[KFSmoke] %d step(s); tmp=%@", steps.count, dir.path)
        if ulOn, let web = controller.bridge?.webView {
            write("ul.log", "", append: false)
            urlWatch = web.observe(\.url, options: [.initial, .new]) { [weak self] web, _ in
                guard let u = web.url else { return }
                self?.note("url \(u.scheme ?? "")://\(u.host ?? "")\(u.path)")
            }
        }
    }

    // Proof 13 (universal links, item 4g; ios-smoke.yml). With KF_SMOKE_UL=1,
    // tmp/ul.log gets one line per URL the web view takes (scheme, host and
    // path, never a query), so an offline.html shows however briefly it was
    // there, and one per outcome of the link observer (linkLog).
    private let ulOn = ProcessInfo.processInfo.environment["KF_SMOKE_UL"] == "1"
    private var urlWatch: NSKeyValueObservation?

    func note(_ line: String) {
        guard ulOn else { return }
        write("ul.log", "\(Int(Date().timeIntervalSince(started) * 1000)) \(line)\n", append: true)
    }

    /// What iOS does with a tapped universal link, from the point the app
    /// receives it: SceneDelegate hands the activity to SceneDelegateProxy.
    func deliver(_ link: String, phase: String) {
        guard let url = URL(string: link), let scene = controller?.view.window?.windowScene else {
            note("deliver \(phase): no URL or no scene")
            return
        }
        let activity = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
        activity.webpageURL = url
        note("deliver \(phase) host=\(url.host ?? "") isLoading=\(controller?.bridge?.webView?.isLoading ?? false)")
        SceneDelegateProxy.shared.scene(scene, continue: activity)
    }

    func start() { waitForPage(attempt: 0) }

    // What the page reports about itself. `bridge` is the one reading that
    // decides the architecture (STORE_PATH.md §8.3): Capacitor's own object,
    // inside a document served from the live site.
    //
    // `purchase` is the Apple 3.1.3(f) reading taken on every screen
    // (ios-signed-in.yml, ios-smoke.yml): the words and the links that would
    // name a plan, a subscription, an upgrade, a premium or Pro tier, a price,
    // a checkout or "free", in both locales, over the page's whole text (below
    // the fold too: innerText is the document, not the viewport) and every
    // anchor. The words are `kfWording`, the function in
    // scripts/lib/app-wording.mjs copied here byte for byte (each backslash
    // doubled for this string); scripts/verify-app-wording.mjs fails if the two
    // drift. Arabic is matched by normalised stem, so باقتك and اشتراكك count.
    // The workflows fail on any hit.
    //
    // In-app Pro (iOS 1.1, item 4d): the reading is `kfPurchase`, the same
    // file's KF_PURCHASE_SRC, also byte for byte. From shell 2 the words are
    // read with every element marked `data-kf-iap` hidden (the paywall and its
    // entry points, the only place purchase words may stand); in shell 1 any
    // marked element is itself a hit (`outside`); a pricing, checkout, Paddle
    // or upgrade link is a hit everywhere. `store` says whether the
    // KnowFlowStore plugin answers in this web view, `speech` the same for
    // KnowFlowSpeech (voice input in Ask, item 4e), `apple` for KnowFlowApple
    // (Sign in with Apple, item 4f).
    //
    // Before anything is read or photographed, every leaf element whose text
    // is an e-mail address is masked to "[email]": the workflow screenshots
    // the screen right after each probe, and the Settings screen shows the
    // account's address, which must not reach a public artifact.
    private static let probe = """
    (function(){try{var C=window.Capacitor;Array.prototype.slice.call(document.querySelectorAll('p,span,div,a,b,strong')).forEach(function(el){if(el.children.length===0&&/\\S+@\\S+\\.\\S+/.test(el.textContent||'')){el.textContent='[email]'}});var T=(document.body&&document.body.innerText||'');function kfWording(T){var h=[];var E=[['plan',/\\bplans?\\b/i],['subscription',/\\bsubscri(?:be|bed|bes|ber|bers|bing|ption|ptions)\\b/i],['upgrade',/\\bupgrad(?:e|es|ed|ing)\\b/i],['premium',/\\bpremium\\b/i],['pro',/\\bpro\\b/i],['price',/\\bpric(?:e|es|ed|ing)\\b/i],['free',/\\bfree\\b/i],['checkout',/\\bcheck-?out\\b/i],['currency',/\\$\\s?\\d|\\d\\s?(?:usd|eur|mad|dhs?|dirhams?)\\b|\\/\\s?mo(?:nth)?\\b|\\bper month\\b/i]];for(var i=0;i<E.length;i++){if(E[i][1].test(T))h.push(E[i][0])}var N=T.replace(/[ً-ٰٟـ]/g,'').replace(/[آأإٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');var A=[['باقة',/باق[هتا]/],['اشتراك',/اشترا?ك/],['ترقية',/ترقي[هت]/],['مجاني',/مجان/],['سعر',/سعر|اسعار/],['احترافي',/احتراف/],['خطة',/(?:^|[^ء-ي])(?:ال|و|ب|ف|ل)?خط[هت]/],['شهريا',/شهريا/]];for(var j=0;j<A.length;j++){if(A[j][1].test(N))h.push(A[j][0])}return h}function kfPurchase(D,S){var M=D.querySelectorAll('[data-kf-iap]');var B=D.body;var T='';if(B){if(S>=2&&M.length){var k=[];for(var i=0;i<M.length;i++){k.push(M[i].style.getPropertyValue('display'));M[i].style.setProperty('display','none','important')}T=B.innerText;for(var j=0;j<M.length;j++){if(k[j]){M[j].style.setProperty('display',k[j])}else{M[j].style.removeProperty('display')}}}else{T=B.innerText}}var H=[];var A=D.querySelectorAll('a[href]');for(var n=0;n<A.length;n++){var h=A[n].getAttribute('href')||'';if(/pricing|checkout|paddle|upgrade/i.test(h))H.push(h)}return{words:kfWording(T),hrefs:H,marked:M.length,outside:S<2&&M.length>0}}var shellN=+(((navigator.userAgent.match(/KnowFlowApp\\/(\\d+)/)||[])[1])||0);return JSON.stringify({ready:document.readyState,href:location.href,title:document.title,bridge:!!(C&&C.isNativePlatform&&C.isNativePlatform()),platform:(C&&C.getPlatform)?C.getPlatform():null,marker:/KnowFlowApp\\/\\d/.test(navigator.userAgent),shell:((navigator.userAgent.match(/KnowFlowApp\\/(\\d+)/)||[])[1]||null),google:document.querySelectorAll('[fill="#4285F4"]').length,pricing:document.querySelectorAll('a[href*="/pricing"]').length,nav:window.__kfNav||0,signedIn:!!document.querySelector('a[href$="/dashboard/settings"]'),purchase:kfPurchase(document,shellN),store:!!(C&&C.isPluginAvailable&&C.isPluginAvailable('KnowFlowStore')),speech:!!(C&&C.isPluginAvailable&&C.isPluginAvailable('KnowFlowSpeech')),apple:!!(C&&C.isPluginAvailable&&C.isPluginAvailable('KnowFlowApple')),text:T.replace(/\\s+/g,' ').slice(0,400)})}catch(e){return JSON.stringify({error:String(e)})}})()
    """

    private func waitForPage(attempt: Int) {
        probeNow { probe in
            let ready = (probe["ready"] as? String) == "complete"
            let href = probe["href"] as? String ?? ""
            let settled = href.hasPrefix("https://tryknowflow.com") || href.contains("offline.html")
            if (ready && settled) || attempt >= 90 {
                self.record(step: "launch", result: "settled after \(attempt) s", probe: probe)
                if self.steps.isEmpty { self.runNext() } else { self.afterAck { self.runNext() } }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.waitForPage(attempt: attempt + 1) }
            }
        }
    }

    private func runNext() {
        guard index < steps.count else {
            write("smoke.done", "done\n", append: false)
            NSLog("[KFSmoke] done")
            return
        }
        let step = steps[index]
        index += 1
        let name = step["name"] as? String ?? "step\(index)"
        let js = step["js"] as? String ?? ""
        let wait = (step["wait"] as? Double) ?? 4000
        NSLog("[KFSmoke] step %@", name)
        // Proof 13: a step naming `ul` has that link delivered as a universal
        // link (deliver) before anything else it does.
        if let link = step["ul"] as? String { deliver(link, phase: name) }
        // A page step names `until`, the pattern its URL must match: the URL is
        // read before its script, and `wait` starts only once the URL has left
        // that start, matches `until` and the document is complete, or after
        // `timeout` ms (20 s by default). The reading then carries `nav`, and
        // scripts/ios/page_steps.py fails the step if it did not arrive. A
        // fixed wait alone let a slow load be read as the page before it (run
        // 38426358277: ar-terms read /ar/privacy after 8 s).
        // A reading step may name `settle`, a script that returns "true" once
        // what the step reads has arrived: it is evaluated every 250 ms, up
        // to `timeout` ms (20 s by default), BEFORE `js` runs, and the
        // reading carries `poll`: {settled, ms}. A fixed wait read voice
        // availability as still "waiting" (ios-smoke run 44465856628).
        if let condition = step["settle"] as? String {
            let timeout = (step["timeout"] as? Double) ?? 20000
            let began = Date()
            pollUntil(condition, deadline: began.addingTimeInterval(timeout / 1000)) { settled in
                let poll: [String: Any] = ["settled": settled, "ms": Int(Date().timeIntervalSince(began) * 1000)]
                self.eval(js) { result in self.settle(name: name, result: result, wait: wait, nav: nil, poll: poll) }
            }
            return
        }
        guard let until = step["until"] as? String else {
            eval(js) { result in self.settle(name: name, result: result, wait: wait, nav: nil) }
            return
        }
        let timeout = (step["timeout"] as? Double) ?? 20000
        location { start, _ in
            let began = Date()
            self.eval(js) { result in
                self.waitForURL(start: start, until: until, deadline: began.addingTimeInterval(timeout / 1000)) { arrived in
                    let nav: [String: Any] = ["start": start, "until": until, "arrived": arrived, "ms": Int(Date().timeIntervalSince(began) * 1000)]
                    self.settle(name: name, result: result, wait: wait, nav: nav)
                }
            }
        }
    }

    private func settle(name: String, result: String, wait: Double, nav: [String: Any]?, poll: [String: Any]? = nil) {
        DispatchQueue.main.asyncAfter(deadline: .now() + wait / 1000) {
            self.probeNow { probe in
                self.record(step: name, result: result, probe: probe, nav: nav, poll: poll)
                // After the last step the app may be in the background (an
                // external link opened Safari) and its timers suspended, so
                // the done-file is written at once; nothing can overwrite
                // that screen before the workflow photographs it.
                if self.index >= self.steps.count { self.runNext() } else { self.afterAck { self.runNext() } }
            }
        }
    }

    /// The page's URL and readyState, read without the probe's masking and
    /// wording work, so it can be polled; a read that fails mid-navigation
    /// gives an empty URL.
    private func location(_ done: @escaping (String, String) -> Void) {
        eval("JSON.stringify([location.href,document.readyState])") { raw in
            if let data = raw.data(using: .utf8),
               let pair = try? JSONSerialization.jsonObject(with: data) as? [String], pair.count == 2 {
                done(pair[0], pair[1])
            } else {
                done("", "")
            }
        }
    }

    private func pollUntil(_ condition: String, deadline: Date, _ done: @escaping (Bool) -> Void) {
        eval(condition) { value in
            if value == "true" {
                done(true)
            } else if Date() >= deadline {
                done(false)
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.pollUntil(condition, deadline: deadline, done) }
            }
        }
    }

    private func waitForURL(start: String, until: String, deadline: Date, _ done: @escaping (Bool) -> Void) {
        let pattern = try? NSRegularExpression(pattern: until)
        location { href, ready in
            let matches = pattern?.firstMatch(in: href, range: NSRange(href.startIndex..., in: href)) != nil
            if !href.isEmpty && href != start && matches && ready == "complete" {
                done(true)
            } else if Date() >= deadline || pattern == nil {
                done(false)
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.waitForURL(start: start, until: until, deadline: deadline, done) }
            }
        }
    }

    // Every recorded line is photographed by the workflow before the next
    // step runs: after line n is written the app waits for the workflow to
    // create `ack-n` beside smoke.jsonl (it does so right after its
    // screenshot), up to 30 s, so no screen is left unphotographed and no
    // screenshot shows the step after the one it is named for.
    private var lines = 0
    private func afterAck(_ then: @escaping () -> Void, waited: Int = 0) {
        let ack = dir.appendingPathComponent("ack-\(lines)")
        if FileManager.default.fileExists(atPath: ack.path) || waited >= 120 {
            then()
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.afterAck(then, waited: waited + 1) }
        }
    }

    private func eval(_ js: String, _ done: @escaping (String) -> Void) {
        guard let web = controller?.bridge?.webView else { done("no webview"); return }
        // The credential tokens become JSON string literals here and nowhere
        // else; a step that names them without the environment gets `null`.
        let script = js
            .replacingOccurrences(of: "__KF_EMAIL__", with: Smoke.literal(email))
            .replacingOccurrences(of: "__KF_PASSWORD__", with: Smoke.literal(password))
        web.evaluateJavaScript(script) { value, error in
            if let error = error { done(self.scrub("error: \(error.localizedDescription)")) } else { done(self.scrub(value.map { "\($0)" } ?? "undefined")) }
        }
    }

    private static func literal(_ value: String?) -> String {
        guard let value = value,
              let data = try? JSONSerialization.data(withJSONObject: [value]),
              let s = String(data: data, encoding: .utf8) else { return "null" }
        return String(s.dropFirst().dropLast())
    }

    /// Never let a credential into smoke.jsonl or the log, whatever a page returns.
    private func scrub(_ s: String) -> String {
        var out = s
        if let p = password, !p.isEmpty { out = out.replacingOccurrences(of: p, with: "[password]") }
        if let e = email, !e.isEmpty { out = out.replacingOccurrences(of: e, with: "[email]") }
        return out
    }

    private func probeNow(_ done: @escaping ([String: Any]) -> Void) {
        eval(Smoke.probe) { raw in
            var dict: [String: Any] = ["raw": raw]
            if let data = raw.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                dict = obj
            }
            done(dict)
        }
    }

    private func record(step: String, result: String, probe: [String: Any], nav: [String: Any]? = nil, poll: [String: Any]? = nil) {
        var line: [String: Any] = [
            "step": step,
            "result": String(result.prefix(4000)),
            "t": Int(Date().timeIntervalSince(started)),
            "appState": UIApplication.shared.applicationState.rawValue,
            "probe": probe,
        ]
        if let nav = nav { line["nav"] = nav }
        if let poll = poll { line["poll"] = poll }
        // The whole line is scrubbed: a probe's `text` on the Settings screen
        // carries the account's e-mail, which must not reach the artifact.
        if let data = try? JSONSerialization.data(withJSONObject: line), let raw = String(data: data, encoding: .utf8) {
            let s = scrub(raw)
            write("smoke.jsonl", s + "\n", append: true)
            lines += 1
            NSLog("[KFSmoke] %@", s)
        }
    }

    private func write(_ name: String, _ text: String, append: Bool) {
        let url = dir.appendingPathComponent(name)
        if append, let handle = try? FileHandle(forWritingTo: url) {
            handle.seekToEndOfFile()
            handle.write(text.data(using: .utf8) ?? Data())
            try? handle.close()
        } else {
            try? text.write(to: url, atomically: true, encoding: .utf8)
        }
    }
}
#endif
