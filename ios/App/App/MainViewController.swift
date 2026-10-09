import Capacitor
import UIKit
#if targetEnvironment(simulator)
import UserNotifications
#endif

/// The bridge view controller, subclassed for one reason: the simulator smoke
/// test (`.github/workflows/ios-smoke.yml`). Main.storyboard names this class.
///
/// A device build carries none of the code below: everything is behind
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
class MainViewController: CAPBridgeViewController {
    #if targetEnvironment(simulator)
    private static var smoke: Smoke?
    #endif

    override open func capacitorDidLoad() {
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
    }

    func start() { waitForPage(attempt: 0) }

    // What the page reports about itself. `bridge` is the one reading that
    // decides the architecture (STORE_PATH.md §8.3): Capacitor's own object,
    // inside a document served from the live site.
    //
    // `purchase` is the Apple 3.1.3(f) reading taken on every signed-in screen
    // (ios-signed-in.yml): the words and the links that would name a price, a
    // plan, an upgrade or a checkout, in both locales, over the page's visible
    // text and every anchor. The workflow fails on any hit.
    //
    // Before anything is read or photographed, every leaf element whose text
    // is an e-mail address is masked to "[email]": the workflow screenshots
    // the screen right after each probe, and the Settings screen shows the
    // account's address, which must not reach a public artifact.
    private static let probe = """
    (function(){try{var C=window.Capacitor;Array.prototype.slice.call(document.querySelectorAll('p,span,div,a,b,strong')).forEach(function(el){if(el.children.length===0&&/\\S+@\\S+\\.\\S+/.test(el.textContent||'')){el.textContent='[email]'}});var T=(document.body&&document.body.innerText||'');var words=['Upgrade','Checkout','checkout','/month','Pricing','Free plan','الترقية','الاحترافي','الأسعار','شهرياً','شهريًا','الباقة','باقة','مجاني'];var hits=words.filter(function(w){return T.indexOf(w)>=0});if(/\\bPro\\b/.test(T))hits.push('Pro');if(/\\bPlan\\b/.test(T))hits.push('Plan');if(/\\bFree\\b/.test(T))hits.push('Free');var hrefs=Array.prototype.slice.call(document.querySelectorAll('a[href]')).map(function(a){return a.getAttribute('href')||''}).filter(function(h){return /pricing|checkout|paddle|upgrade/i.test(h)});return JSON.stringify({ready:document.readyState,href:location.href,title:document.title,bridge:!!(C&&C.isNativePlatform&&C.isNativePlatform()),platform:(C&&C.getPlatform)?C.getPlatform():null,marker:/KnowFlowApp\\/1/.test(navigator.userAgent),google:document.querySelectorAll('[fill="#4285F4"]').length,pricing:document.querySelectorAll('a[href*="/pricing"]').length,nav:window.__kfNav||0,signedIn:!!document.querySelector('a[href$="/dashboard/settings"]'),purchase:{words:hits,hrefs:hrefs},text:T.replace(/\\s+/g,' ').slice(0,400)})}catch(e){return JSON.stringify({error:String(e)})}})()
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
        eval(js) { result in
            DispatchQueue.main.asyncAfter(deadline: .now() + wait / 1000) {
                self.probeNow { probe in
                    self.record(step: name, result: result, probe: probe)
                    // After the last step the app may be in the background (an
                    // external link opened Safari) and its timers suspended, so
                    // the done-file is written at once; nothing can overwrite
                    // that screen before the workflow photographs it.
                    if self.index >= self.steps.count { self.runNext() } else { self.afterAck { self.runNext() } }
                }
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

    private func record(step: String, result: String, probe: [String: Any]) {
        let line: [String: Any] = [
            "step": step,
            "result": String(result.prefix(4000)),
            "t": Int(Date().timeIntervalSince(started)),
            "appState": UIApplication.shared.applicationState.rawValue,
            "probe": probe,
        ]
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
