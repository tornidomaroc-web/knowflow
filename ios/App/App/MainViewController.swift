import Capacitor
import UIKit

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
    private static let probe = """
    (function(){try{var C=window.Capacitor;return JSON.stringify({ready:document.readyState,href:location.href,title:document.title,bridge:!!(C&&C.isNativePlatform&&C.isNativePlatform()),platform:(C&&C.getPlatform)?C.getPlatform():null,marker:/KnowFlowApp\\/1/.test(navigator.userAgent),google:document.querySelectorAll('[fill="#4285F4"]').length,pricing:document.querySelectorAll('a[href*="/pricing"]').length,nav:window.__kfNav||0,text:(document.body&&document.body.innerText||'').replace(/\\s+/g,' ').slice(0,160)})}catch(e){return JSON.stringify({error:String(e)})}})()
    """

    private func waitForPage(attempt: Int) {
        probeNow { probe in
            let ready = (probe["ready"] as? String) == "complete"
            let href = probe["href"] as? String ?? ""
            let settled = href.hasPrefix("https://tryknowflow.com") || href.contains("offline.html")
            if (ready && settled) || attempt >= 90 {
                self.record(step: "launch", result: "settled after \(attempt) s", probe: probe)
                self.runNext()
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
                    self.runNext()
                }
            }
        }
    }

    private func eval(_ js: String, _ done: @escaping (String) -> Void) {
        guard let web = controller?.bridge?.webView else { done("no webview"); return }
        web.evaluateJavaScript(js) { value, error in
            if let error = error { done("error: \(error.localizedDescription)") } else { done(value.map { "\($0)" } ?? "undefined") }
        }
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
            "result": String(result.prefix(300)),
            "t": Int(Date().timeIntervalSince(started)),
            "appState": UIApplication.shared.applicationState.rawValue,
            "probe": probe,
        ]
        if let data = try? JSONSerialization.data(withJSONObject: line), let s = String(data: data, encoding: .utf8) {
            write("smoke.jsonl", s + "\n", append: true)
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
