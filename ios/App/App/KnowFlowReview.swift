import Capacitor
import StoreKit
import UIKit

/// IN-APP RATING (iOS 1.1, big item 4h, PR 2 of 2). Apple's own StoreKit
/// review prompt, in this repository: no package, no network, nothing stored.
///
/// The page reaches this plugin through the bridge (src/lib/review/bridge.ts).
/// Its presence is the page's gate: PR 1 draws the Settings rate row and lets
/// the quiz result's ReviewTrigger decide only where
/// `isPluginAvailable('KnowFlowReview')` is true in shell 2 on iOS. A plugin
/// of its own, not a KnowFlowStore method: a shell-2 binary built before this
/// one answers for KnowFlowStore without the method, and the gate would pass.
///
/// TWO METHODS.
///  - `available()` resolves `{available: true, version}`, the app's
///    CFBundleShortVersionString (the record's once-per-version rule). It
///    opens nothing (ios-smoke proof 14 calls it).
///  - `request()` asks StoreKit once: AppStore.requestReview(in:) on iOS 16
///    and later, SKStoreReviewController.requestReview(in:) on iOS 15. Only
///    with the web view's scene in the foreground and active; otherwise it
///    resolves `{asked: false}` and asks nothing. Otherwise `{asked: true}`,
///    which says the request was made, never that a sheet showed: Apple
///    decides (at most three in 365 days) and tells no one.
///
/// CI NEVER CALLS `request`. Both simulator builds are Debug, where the sheet
/// shows every time; ios-smoke and ios-signed-in count the one log line below
/// and fail on any. In TestFlight the call does nothing at all.
///
/// NOTHING IS KEPT. The page holds the device record (localStorage
/// `kf-review`); no UserDefaults (a required-reason API the privacy manifest
/// declares none of), no file, no network.
@objc(KnowFlowReviewPlugin)
public class KnowFlowReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KnowFlowReviewPlugin"
    public let jsName = "KnowFlowReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
    ]

    @objc func available(_ call: CAPPluginCall) {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        call.resolve(["available": true, "version": version])
    }

    @objc func request(_ call: CAPPluginCall) {
        // Capacitor calls plugin methods off the main queue; the scene and
        // StoreKit's prompt are UI, so everything below runs on it.
        DispatchQueue.main.async {
            guard let scene = self.bridge?.webView?.window?.windowScene, scene.activationState == .foregroundActive else {
                NSLog("[KFReview] not asked: no active scene")
                call.resolve(["asked": false])
                return
            }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            NSLog("[KFReview] request")
            call.resolve(["asked": true])
        }
    }
}
