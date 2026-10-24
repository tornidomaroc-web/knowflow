import XCTest

/// DIAG, branch diag/ipad-zoom only (never merged). Guideline 4.0: does a REAL
/// tap on a 14 px field zoom the web view, and does the zoom survive a
/// client-side navigation? Signed out only: nothing is typed, nothing is sent.
///
/// The target is standalone (no target application): the app is installed by
/// `simctl install` and driven by bundle id, so an iPhone-only app can be
/// driven on an iPad simulator, where iOS runs it in compatibility mode.
/// The readings come from the app's DEBUG+simulator hook (MainViewController,
/// `ZoomDiag`): a JSON accessibility label on the element `kf-diag`.
final class KFZoomUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.knowflow.app")
    private let dev = ProcessInfo.processInfo.environment["KF_DEV"] ?? "device"
    private var lastSeq = 0

    override func setUp() {
        continueAfterFailure = true
    }

    func testFocusZoom() {
        app.launchEnvironment["KF_DIAG"] = "1"
        app.launch()
        waitPath("/ar/login", timeout: 60)
        record("01-baseline-login")

        tap(app.webViews.textFields.firstMatch, "email")
        record("02-tap-email")
        record("03-dismiss-keyboard", note: dismissKeyboard())
        record("04-nav-signup", note: tapSignup())

        app.terminate()
        lastSeq = 0
        app.launch()
        waitPath("/ar/login", timeout: 60)
        record("05-baseline-login-fresh")

        tap(app.webViews.secureTextFields.firstMatch, "password")
        record("06-tap-password")
        record("07-dismiss-keyboard", note: dismissKeyboard())
        record("08-nav-signup", note: tapSignup())
    }

    // MARK: actions (all real touches through XCTest's event synthesis)

    private func tap(_ field: XCUIElement, _ name: String) {
        guard field.waitForExistence(timeout: 20) else {
            XCTFail("\(dev): the \(name) field is not in the accessibility tree")
            return
        }
        print("KFTAP|\(dev)|\(name)|frame=\(field.frame)|hittable=\(field.isHittable)")
        field.tap()
    }

    private func dismissKeyboard() -> String {
        let done = app.toolbars.buttons["Done"]
        if done.waitForExistence(timeout: 3) && done.isHittable { done.tap(); return "accessory Done" }
        // No accessory bar: tap the page's first static text (the heading), which
        // blurs the field the way a person tapping outside it does.
        let text = app.webViews.staticTexts.firstMatch
        if text.exists && text.isHittable { text.tap(); return "tapped first static text: \(text.label.prefix(30))" }
        return "NOT dismissed (no Done button, no hittable text)"
    }

    private func tapSignup() -> String {
        let link = app.webViews.links.matching(NSPredicate(format: "label CONTAINS %@", "أنشئ")).firstMatch
        guard link.waitForExistence(timeout: 10) else { XCTFail("\(dev): no signup link"); return "no signup link" }
        if !link.isHittable { app.webViews.firstMatch.swipeUp() }
        link.tap()
        let arrived = waitPath("/ar/signup", timeout: 20)
        return "tapped signup link, arrived=\(arrived)"
    }

    // MARK: readings

    private func diag(after: Int, timeout: TimeInterval) -> [String: Any]? {
        let el = app.descendants(matching: .any).matching(identifier: "kf-diag").firstMatch
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if el.exists,
               let d = el.label.data(using: .utf8),
               let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
               (o["seq"] as? Int ?? 0) > after {
                return o
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        return nil
    }

    @discardableResult
    private func waitPath(_ path: String, timeout: TimeInterval) -> Bool {
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if let o = diag(after: 0, timeout: 5), let p = o["page"] as? [String: Any],
               (p["path"] as? String) == path, (p["ready"] as? String) == "complete" {
                Thread.sleep(forTimeInterval: 2)
                return true
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTFail("\(dev): never reached \(path)")
        return false
    }

    private func record(_ step: String, note: String = "") {
        Thread.sleep(forTimeInterval: 2.5)
        var line = diag(after: lastSeq, timeout: 15) ?? ["error": "no diag reading"]
        lastSeq = line["seq"] as? Int ?? lastSeq
        line["step"] = step
        line["device"] = dev
        line["note"] = note
        line["runner"] = runnerReading()
        let data = (try? JSONSerialization.data(withJSONObject: line, options: [.sortedKeys])) ?? Data()
        let json = String(data: data, encoding: .utf8) ?? "{}"
        print("KFDIAG|\(json)")
        let a = XCTAttachment(string: json)
        a.name = "\(dev)-\(step).json"
        a.lifetime = .keepAlways
        add(a)
        let s = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        s.name = "\(dev)-\(step)"
        s.lifetime = .keepAlways
        add(s)
    }

    /// The runner is a native app on the device, so its screen is the real
    /// screen; the app's window frame here is in that screen's points.
    private func runnerReading() -> [String: Any] {
        func r(_ f: CGRect) -> [Double] { [Double(f.minX), Double(f.minY), Double(f.width), Double(f.height)] }
        let w = app.windows.firstMatch
        let shot = XCUIScreen.main.screenshot().image
        return [
            "idiom": UIDevice.current.userInterfaceIdiom.rawValue,
            "model": UIDevice.current.model,
            "screen": r(UIScreen.main.bounds),
            "screenshotPx": [Double(shot.size.width * shot.scale), Double(shot.size.height * shot.scale)],
            "appWindowOnScreen": w.exists ? r(w.frame) : [],
            "appFrameOnScreen": r(app.frame),
            "webViewOnScreen": app.webViews.firstMatch.exists ? r(app.webViews.firstMatch.frame) : [],
            "keyboardShown": app.keyboards.count > 0,
        ]
    }
}
