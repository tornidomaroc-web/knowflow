import Capacitor
import UIKit
#if targetEnvironment(simulator)
import UserNotifications
#endif
#if DEBUG && targetEnvironment(simulator)
import WebKit
#endif

/// The bridge view controller, subclassed for two reasons: the page colour
/// under the web view (below, every build) and the simulator smoke test
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

    override open func capacitorDidLoad() {
        if let webView = bridge?.webView {
            pageColour = webView.observe(\.underPageBackgroundColor, options: [.initial, .new]) { webView, _ in
                webView.scrollView.backgroundColor = webView.underPageBackgroundColor
            }
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
            // The web view is created in viewDidLoad; give it a moment before
            // the first probe rather than racing it.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { smoke.start() }
        }
        #endif
        #if DEBUG && targetEnvironment(simulator)
        // DIAG, branch diag/ipad-zoom only (never merged): the focus-zoom
        // measurement read by ios/diag/KFZoomUITests over accessibility.
        if ProcessInfo.processInfo.environment["KF_DIAG"] == "1" {
            MainViewController.zoomDiag = ZoomDiag(controller: self)
        }
        #endif
    }
    #if DEBUG && targetEnvironment(simulator)
    private static var zoomDiag: ZoomDiag?
    #endif
}

#if DEBUG && targetEnvironment(simulator)
/// Every 0.5 s: the page measurement (evaluated in the web view) plus the
/// native geometry, published as the accessibility label of a 1-pt, clear,
/// non-interactive view (identifier `kf-diag`) on the window, where the UI
/// test reads it. On the first settled page it sends the web view to /ar/login.
/// Rects are [x, y, w, h], insets [top, left, bottom, right], in app points.
private final class ZoomDiag {
    private weak var controller: CAPBridgeViewController?
    private let marker = UIView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
    private var seq = 0
    private var sentArabic = false
    private var timer: Timer?

    private static let measure = """
    (function(){var d=document.documentElement,v=window.visualViewport,safe=null;if(document.readyState==='complete'&&document.body){var p=document.createElement('div');p.style.cssText='position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';document.body.appendChild(p);var cs=getComputedStyle(p);safe=[cs.paddingTop,cs.paddingRight,cs.paddingBottom,cs.paddingLeft].map(parseFloat);p.remove()}var W=d.clientWidth,o=[],all=document.body?document.body.getElementsByTagName('*'):[];for(var i=0;i<all.length&&o.length<8;i++){var el=all[i],r=el.getBoundingClientRect();if(r.width>0&&(r.right>W+0.5||r.left<-0.5)){o.push(el.tagName.toLowerCase()+(typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\\s+/).slice(0,2).join('.'):'')+' w='+Math.round(r.width)+' l='+Math.round(r.left)+' r='+Math.round(r.right))}}var a=document.activeElement,f=Array.prototype.slice.call(document.querySelectorAll('input,textarea,select')).map(function(x){return (x.type||x.tagName.toLowerCase())+':'+getComputedStyle(x).fontSize});return JSON.stringify({href:location.href,path:location.pathname,ready:document.readyState,iw:innerWidth,ih:innerHeight,vv:v?{w:v.width,h:v.height,s:v.scale,ol:v.offsetLeft,ot:v.offsetTop}:null,sw:d.scrollWidth,cw:W,sh:d.scrollHeight,ch:d.clientHeight,sx:scrollX,sy:scrollY,dpr:devicePixelRatio,safe:safe,dir:d.dir,theme:d.getAttribute('data-theme'),active:a?(a.tagName+(a.type?':'+a.type:'')):null,fields:f,over:o})})()
    """

    init(controller: CAPBridgeViewController) {
        self.controller = controller
        marker.isUserInteractionEnabled = false
        marker.backgroundColor = .clear
        marker.isAccessibilityElement = true
        marker.accessibilityIdentifier = "kf-diag"
        marker.accessibilityTraits = .staticText
        marker.accessibilityLabel = "{\"seq\":0}"
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.tick() }
    }

    private func tick() {
        guard let c = controller, let web = c.bridge?.webView else { return }
        if marker.superview == nil, let win = c.view.window { win.addSubview(marker) }
        marker.superview?.bringSubviewToFront(marker)
        web.evaluateJavaScript(ZoomDiag.measure) { [weak self] value, error in
            guard let self = self else { return }
            var page: Any = error.map { "error: \($0.localizedDescription)" } ?? "undefined"
            if let s = value as? String, let d = s.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) { page = o }
            if !self.sentArabic, let p = page as? [String: Any], (p["href"] as? String ?? "").hasPrefix("https://tryknowflow.com"), (p["ready"] as? String) == "complete" {
                self.sentArabic = true
                if (p["path"] as? String) != "/ar/login" { web.evaluateJavaScript("location.assign('/ar/login')", completionHandler: nil) }
            }
            self.seq += 1
            let line: [String: Any] = ["seq": self.seq, "page": page, "native": ZoomDiag.native(c, web)]
            if let d = try? JSONSerialization.data(withJSONObject: line), let s = String(data: d, encoding: .utf8) {
                self.marker.accessibilityLabel = s
            }
        }
    }

    private static func native(_ c: UIViewController, _ web: WKWebView) -> [String: Any] {
        func r(_ x: CGRect) -> [Double] { [Double(x.origin.x), Double(x.origin.y), Double(x.size.width), Double(x.size.height)] }
        func e(_ i: UIEdgeInsets) -> [Double] { [Double(i.top), Double(i.left), Double(i.bottom), Double(i.right)] }
        let sv = web.scrollView
        var out: [String: Any] = [
            "idiom": UIDevice.current.userInterfaceIdiom.rawValue,
            "model": UIDevice.current.model,
            "screen": r(UIScreen.main.bounds),
            "screenNative": r(UIScreen.main.nativeBounds),
            "screenScale": Double(UIScreen.main.scale),
            "webFrame": r(web.frame),
            "webInWindow": r(web.convert(web.bounds, to: nil)),
            "zoomScale": Double(sv.zoomScale),
            "zoomRange": [Double(sv.minimumZoomScale), Double(sv.maximumZoomScale)],
            "contentSize": [Double(sv.contentSize.width), Double(sv.contentSize.height)],
            "contentOffset": [Double(sv.contentOffset.x), Double(sv.contentOffset.y)],
            "contentInset": e(sv.contentInset),
            "adjustedInset": e(sv.adjustedContentInset),
            "viewSafe": e(c.view.safeAreaInsets),
        ]
        if let win = c.view.window {
            out["window"] = r(win.bounds)
            out["windowFrame"] = r(win.frame)
            out["windowSafe"] = e(win.safeAreaInsets)
        }
        return out
    }
}
#endif

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
    // Before anything is read or photographed, every leaf element whose text
    // is an e-mail address is masked to "[email]": the workflow screenshots
    // the screen right after each probe, and the Settings screen shows the
    // account's address, which must not reach a public artifact.
    private static let probe = """
    (function(){try{var C=window.Capacitor;Array.prototype.slice.call(document.querySelectorAll('p,span,div,a,b,strong')).forEach(function(el){if(el.children.length===0&&/\\S+@\\S+\\.\\S+/.test(el.textContent||'')){el.textContent='[email]'}});var T=(document.body&&document.body.innerText||'');function kfWording(T){var h=[];var E=[['plan',/\\bplans?\\b/i],['subscription',/\\bsubscri(?:be|bed|bes|ber|bers|bing|ption|ptions)\\b/i],['upgrade',/\\bupgrad(?:e|es|ed|ing)\\b/i],['premium',/\\bpremium\\b/i],['pro',/\\bpro\\b/i],['price',/\\bpric(?:e|es|ed|ing)\\b/i],['free',/\\bfree\\b/i],['checkout',/\\bcheck-?out\\b/i],['currency',/\\$\\s?\\d|\\d\\s?(?:usd|eur|mad|dhs?|dirhams?)\\b|\\/\\s?mo(?:nth)?\\b|\\bper month\\b/i]];for(var i=0;i<E.length;i++){if(E[i][1].test(T))h.push(E[i][0])}var N=T.replace(/[ً-ٰٟـ]/g,'').replace(/[آأإٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');var A=[['باقة',/باق[هتا]/],['اشتراك',/اشترا?ك/],['ترقية',/ترقي[هت]/],['مجاني',/مجان/],['سعر',/سعر|اسعار/],['احترافي',/احتراف/],['خطة',/(?:^|[^ء-ي])(?:ال|و|ب|ف|ل)?خط[هت]/],['شهريا',/شهريا/]];for(var j=0;j<A.length;j++){if(A[j][1].test(N))h.push(A[j][0])}return h}var hrefs=Array.prototype.slice.call(document.querySelectorAll('a[href]')).map(function(a){return a.getAttribute('href')||''}).filter(function(h){return /pricing|checkout|paddle|upgrade/i.test(h)});return JSON.stringify({ready:document.readyState,href:location.href,title:document.title,bridge:!!(C&&C.isNativePlatform&&C.isNativePlatform()),platform:(C&&C.getPlatform)?C.getPlatform():null,marker:/KnowFlowApp\\/1/.test(navigator.userAgent),google:document.querySelectorAll('[fill="#4285F4"]').length,pricing:document.querySelectorAll('a[href*="/pricing"]').length,nav:window.__kfNav||0,signedIn:!!document.querySelector('a[href$="/dashboard/settings"]'),purchase:{words:kfWording(T),hrefs:hrefs},text:T.replace(/\\s+/g,' ').slice(0,400)})}catch(e){return JSON.stringify({error:String(e)})}})()
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
        // A page step names `until`, the pattern its URL must match: the URL is
        // read before its script, and `wait` starts only once the URL has left
        // that start, matches `until` and the document is complete, or after
        // `timeout` ms (20 s by default). The reading then carries `nav`, and
        // scripts/ios/page_steps.py fails the step if it did not arrive. A
        // fixed wait alone let a slow load be read as the page before it (run
        // 38426358277: ar-terms read /ar/privacy after 8 s).
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

    private func settle(name: String, result: String, wait: Double, nav: [String: Any]?) {
        DispatchQueue.main.asyncAfter(deadline: .now() + wait / 1000) {
            self.probeNow { probe in
                self.record(step: name, result: result, probe: probe, nav: nav)
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

    private func record(step: String, result: String, probe: [String: Any], nav: [String: Any]? = nil) {
        var line: [String: Any] = [
            "step": step,
            "result": String(result.prefix(4000)),
            "t": Int(Date().timeIntervalSince(started)),
            "appState": UIApplication.shared.applicationState.rawValue,
            "probe": probe,
        ]
        if let nav = nav { line["nav"] = nav }
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
